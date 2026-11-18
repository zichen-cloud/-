# ============================================================
# RAG Service：知识检索（第二阶段重写）
# ------------------------------------------------------------
# 数据一致性模型：
#   items.json = 唯一事实来源（"数据库"）；Chroma 集合 = 向量索引（派生物）。
#   集合 metadata 里存 data_version = md5(items.json 内容 + embedding 签名 + 切分参数)。
#   启动时版本不一致 → 自动安全重建索引，保证"数据库与向量索引一致"。
#
# 对外接口：
#   retrieve(query, top_k=None)   检索，结构不变 [{id,text,metadata,distance}]
#   list_documents()              按文档聚合的知识库清单
#   upsert_item(item)             新增/更新条目（先写 items.json，再同步索引）
#   delete_item(project_id)       删除条目（同步删索引）
#   rebuild_index()               全量重建索引
#   get_status()                  初始化状态 / 版本 / embedding 方案（调试用）
#
# 容错：Chroma / Embedding 初始化失败时 retrieve() 降级返回 []，
#       ai_service 会据此回答"知识库资料不足"，服务不崩溃。
# ============================================================
import hashlib
import os

import config
from services import knowledge_loader
from services.keyword_service import BM25Index
from services.embedding_service import (
    ChineseEmbeddingFunction,
    get_embedding_signature,
    is_real_embedding,
)

# Chroma 数据持久化目录（在 backend/data/chroma_db）
CHROMA_DIR = os.path.join(
    os.path.dirname(__file__), "..", "data", "chroma_db"
)
COLLECTION_NAME = "heritage_knowledge"

# 真实语义模型的默认相似度阈值（cosine distance）。
# 实测 bge-small-zh-v1.5（第三阶段 8 查询对比集）：
#   相关问题最佳命中 dist≈0.19~0.46；无关问题最佳命中 dist≈0.517~0.588。
#   0.5 位于两者的分隔带中，可挡掉无关误命中；
#   术语类问题即使向量距离边缘，还有 BM25 一路兜底召回（混合检索的协同）。
REAL_MODEL_THRESHOLD = 0.5

# 模块级状态
_client = None
_collection = None
_init_error = None
_bm25 = BM25Index()          # 内存关键词索引（第三阶段混合检索）
_doc_cache: dict = {}        # chunk id -> (text, metadata)，RRF 融合时补全文用


def _refresh_keyword_index() -> None:
    """从 Chroma 集合全量重建内存 BM25 索引与文档缓存。

    127 块规模下全量重建是毫秒级操作，导入/重建/增删后直接调用即可。
    """
    global _doc_cache
    if _collection is None:
        return
    got = _collection.get(include=["documents", "metadatas"])
    ids = got.get("ids", [])
    docs = got.get("documents", [])
    metas = got.get("metadatas", [])
    _bm25.build(ids, docs)
    _doc_cache = {cid: (text, meta) for cid, text, meta in zip(ids, docs, metas)}


def _compute_data_version() -> str:
    """数据版本 = items.json 内容 + embedding 方案 + 切分参数 的哈希。

    任一变化 → 版本变化 → 下次启动自动重建索引，杜绝"旧向量配新数据"。
    """
    h = hashlib.md5()
    h.update(knowledge_loader.file_content_hash().encode("utf-8"))
    h.update(get_embedding_signature().encode("utf-8"))
    h.update(
        f"{config.CHUNK_MAX_CHARS}/{config.CHUNK_OVERLAP_CHARS}".encode("utf-8")
    )
    return h.hexdigest()[:16]


def _save_data_version() -> None:
    """把当前数据版本写进集合 metadata。

    注意：chromadb 1.x 的 modify(metadata) 会尝试应用 hnsw:* 等索引配置键，
    传入 "hnsw:space" 会报 "Changing the distance function ... is not supported"，
    因此回写前必须剔除配置键，只保留用户元数据。
    """
    meta = {
        k: v
        for k, v in dict(_collection.metadata or {}).items()
        if not k.startswith("hnsw:")
    }
    meta["data_version"] = _compute_data_version()
    _collection.modify(metadata=meta)


def _ingest_all() -> int:
    """全量导入 items.json 到当前（空）集合，返回 chunk 数。"""
    chunks = knowledge_loader.load_and_chunk()
    print(f"[rag] 开始导入 {len(chunks)} 个知识块…")
    _collection.add(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )
    _save_data_version()
    _refresh_keyword_index()
    print(f"[rag] 知识库导入完成，共 {_collection.count()} 个知识块")
    return _collection.count()


def rebuild_index() -> int:
    """全量重建索引：删旧集合 → 新建 → 重新导入。返回 chunk 数。

    用途：数据/模型/切分参数变更后的安全迁移；也可由调试脚本直接调用。
    """
    global _collection
    if _client is None:
        raise RuntimeError(f"Chroma 未初始化：{_init_error}")
    try:
        _client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass  # 集合不存在时忽略
    _collection = _client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ChineseEmbeddingFunction(),
        metadata={"hnsw:space": "cosine"},
    )
    return _ingest_all()


def _init_knowledge_base():
    """初始化 Chroma 集合；版本不一致时自动重建索引。"""
    global _client, _collection, _init_error
    try:
        import chromadb

        os.makedirs(CHROMA_DIR, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_DIR)

        try:
            _collection = _client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=ChineseEmbeddingFunction(),
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as e:
            # 旧集合与新 embedding function 配置冲突等 → 删旧重建
            print(f"[rag] 打开旧集合失败（{e}），将重建索引")
            _client.delete_collection(COLLECTION_NAME)
            _collection = _client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=ChineseEmbeddingFunction(),
                metadata={"hnsw:space": "cosine"},
            )

        version = _compute_data_version()
        stored = (_collection.metadata or {}).get("data_version")

        if _collection.count() == 0:
            print("[rag] 知识库为空，执行首次导入")
            _ingest_all()
        elif stored != version:
            print(f"[rag] 数据版本变化（{stored} → {version}），重建索引")
            rebuild_index()
        else:
            print(f"[rag] 知识库已存在且版本一致（{version}），共 {_collection.count()} 个知识块")

        print(f"[rag] embedding 模式：{'真实模型 ' + get_embedding_signature() if is_real_embedding() else '本地降级（伪向量）'}")
        _refresh_keyword_index()
        print(f"[rag] BM25 关键词索引就绪（{_bm25.n} 块），混合检索：{'开' if config.HYBRID_SEARCH else '关'}")

    except Exception as e:
        # 任何初始化失败都记录下来，retrieve() 时降级返回 []
        _client = None
        _collection = None
        _init_error = e
        print(f"[rag] Chroma 初始化失败，检索功能将降级。原因：{e}")


# 模块加载时初始化一次（失败不抛异常，仅记录）
_init_knowledge_base()


def retrieve(query: str, top_k: int | None = None) -> list[dict]:
    """检索与问题相关的知识资料（第三阶段：向量 + BM25 混合检索）。

    流程：向量候选（阈值过滤）+ BM25 候选（最低分过滤）→ RRF 融合 → top_k。
    HYBRID_SEARCH=0 时退回纯向量检索（旧行为，用于对比测试）。

    @param query 用户问题
    @param top_k 最多返回几条资料；None 时取 config.RETRIEVE_TOP_K
    @return [{"id","text","metadata","distance","score"}]；
            distance 为向量距离（仅关键词命中时为 None），score 为 RRF 融合分；
            初始化失败或无结果时返回 []
    """
    if _collection is None:
        return []
    if not query or not query.strip():
        return []

    if top_k is None:
        top_k = config.RETRIEVE_TOP_K
    candidate_k = max(config.RETRIEVE_CANDIDATES, top_k)

    # 相似度阈值：真实语义模型实测相关对 dist≈0.2~0.5、无关对 dist≈0.74+，
    # 默认收紧到 0.6；.env 显式配置 ≤0.8 的阈值时以配置为准。
    threshold = config.SIMILARITY_THRESHOLD
    if is_real_embedding() and threshold > 0.8:
        threshold = REAL_MODEL_THRESHOLD

    try:
        # ---------- 第 1 路：Chroma 向量检索 ----------
        result = _collection.query(
            query_texts=[query],
            n_results=min(candidate_k, _collection.count()),
        )
        ids = result.get("ids", [[]])[0]
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        vector_hits = []
        for cid, text, meta, dist in zip(ids, documents, metadatas, distances):
            dist = float(dist)
            if dist >= threshold:
                continue
            vector_hits.append(
                {"id": cid, "text": text, "metadata": meta, "distance": dist}
            )

        # ---------- 纯向量模式（对比测试 / 排障用） ----------
        if not config.HYBRID_SEARCH:
            # 伪向量模式下的二次过滤：用"双字词组交集"排除误命中
            if vector_hits and not is_real_embedding():
                import re

                def _bigrams(text: str) -> set:
                    t = re.sub(r"\s+", "", text or "")
                    return {t[i : i + 2] for i in range(len(t) - 1)}

                q_bigrams = _bigrams(query)
                vector_hits = [
                    c for c in vector_hits
                    if len(q_bigrams & _bigrams(c["text"])) >= 2
                ]
            for h in vector_hits:
                h["score"] = None
            return vector_hits[:top_k]

        # ---------- 第 2 路：BM25 关键词检索 ----------
        bm25_hits = [
            h for h in _bm25.search(query, candidate_k)
            if h["score"] >= config.BM25_MIN_SCORE
        ]

        # ---------- RRF 融合 ----------
        rrf_k = config.RRF_K
        fused: dict[str, dict] = {}
        for rank, h in enumerate(vector_hits, 1):
            fused[h["id"]] = {**h, "score": 1.0 / (rrf_k + rank)}
        for rank, h in enumerate(bm25_hits, 1):
            entry = fused.get(h["id"])
            if entry is None:
                # 纯关键词命中：从文档缓存补全文与 metadata
                cached = _doc_cache.get(h["id"])
                if cached is None:
                    continue
                entry = {
                    "id": h["id"], "text": cached[0],
                    "metadata": cached[1], "distance": None, "score": 0.0,
                }
                fused[h["id"]] = entry
            entry["score"] += 1.0 / (rrf_k + rank)

        ranked = sorted(fused.values(), key=lambda x: x["score"], reverse=True)
        return ranked[:top_k]
    except Exception as e:
        print(f"[rag] 检索失败，返回空结果：{e}")
        return []


# ---------------- 知识库管理（文档级增删改查） ----------------

def list_documents() -> list[dict]:
    """按文档（非遗项目）聚合的知识库清单。"""
    if _collection is None:
        return []
    got = _collection.get(include=["metadatas"])
    docs: dict[str, dict] = {}
    for m in got.get("metadatas", []):
        pid = m.get("doc_id", "")
        d = docs.setdefault(
            pid,
            {
                "id": pid,
                "title": m.get("title", ""),
                "category": m.get("category", ""),
                "province": m.get("province", ""),
                "region": m.get("region", ""),
                "level": m.get("level", ""),
                "verified": bool(m.get("verified", False)),
                "source_name": m.get("source_name", ""),
                "source_url": m.get("source_url", ""),
                "chunks": 0,
            },
        )
        d["chunks"] += 1
    return sorted(docs.values(), key=lambda d: d["id"])


def _delete_chunks_of(project_id: str) -> int:
    """删除某文档的全部索引 chunk，返回删除条数。"""
    got = _collection.get(where={"doc_id": project_id}, include=[])
    ids = got.get("ids", [])
    if ids:
        _collection.delete(ids=ids)
    return len(ids)


def upsert_item(item: dict) -> dict:
    """新增或更新一个知识条目。

    一致性保证：先写 items.json（原子替换），再删旧 chunk、写新 chunk，
    最后刷新集合的 data_version —— 文件与索引始终指向同一份内容。

    @param item 完整条目（至少含 id、name；缺省时字段按空处理）
    @return {"id", "created", "chunks"}
    """
    if _collection is None:
        raise RuntimeError(f"知识库未初始化：{_init_error}")
    pid = item.get("id")
    if not pid or not item.get("name"):
        raise ValueError("条目必须包含 id 和 name")
    # 核验状态绝不自动标真：未显式提供时强制 False
    item = {**item, "verified": bool(item.get("verified", False))}

    created = knowledge_loader.upsert_item_to_file(item)
    _delete_chunks_of(pid)  # 先删旧 chunk（重复检测/更新语义）
    chunks = knowledge_loader.chunks_for_item(item)
    _collection.add(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )
    _save_data_version()
    _refresh_keyword_index()
    return {"id": pid, "created": created, "chunks": len(chunks)}


def delete_item(project_id: str) -> dict:
    """删除一个知识条目（文件与索引同步删除）。

    @return {"existed", "chunks_deleted"}
    """
    if _collection is None:
        raise RuntimeError(f"知识库未初始化：{_init_error}")
    existed = knowledge_loader.delete_item_from_file(project_id)
    deleted = _delete_chunks_of(project_id)
    _save_data_version()
    _refresh_keyword_index()
    return {"existed": existed, "chunks_deleted": deleted}


def get_status() -> dict:
    """调试信息：初始化状态、数据版本、embedding 方案。"""
    return {
        "initialized": _collection is not None,
        "count": _collection.count() if _collection is not None else 0,
        "data_version": (_collection.metadata or {}).get("data_version") if _collection is not None else None,
        "expected_version": _compute_data_version() if _collection is not None else None,
        "embedding": get_embedding_signature(),
        "real_embedding": is_real_embedding(),
        "error": str(_init_error) if _init_error else None,
    }
