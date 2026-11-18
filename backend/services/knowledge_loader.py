# ============================================================
# 知识文档加载与切分（第二阶段重写）
# ------------------------------------------------------------
# 职责：
#   1. 读写 backend/knowledge/items.json —— 知识库的"唯一事实来源"；
#   2. 切成多个文本块（chunk），长文本按中文句子边界语义切段，不截断句子；
#   3. 每个 chunk 带完整 metadata：文档ID / 标题 / 章节 / 来源机构 / 原始链接 /
#      分类 / 地区 / 核验状态等（来源字段名保持旧版，ai_service 直接兼容）。
#
# chunk 稳定 ID 规则：project_id + chunk_type + 序号
#   kunqu__overview
#   kunqu__history            （短文本，单块）
#   kunqu__history_0/_1…      （长文本，多块）
#   kunqu__technique_0        （第 0 条技艺，单块）
#   kunqu__technique_0_0/_1…  （第 0 条技艺，多块）
#   kunqu__pending(_0…)
#   条目内容不变 → 重跑导入 ID 不变 → 支持增量更新与重复检测。
#
# 核验状态：verified 默认 False；只尊重 items.json 中显式填写的值，
#           代码绝不自动把任何条目标记为已核验。
# ============================================================
import hashlib
import json
import os
import re

import config

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "knowledge", "items.json")

CHUNK_MAX_CHARS = getattr(config, "CHUNK_MAX_CHARS", 260)
CHUNK_OVERLAP_CHARS = getattr(config, "CHUNK_OVERLAP_CHARS", 40)

# 以中文句末标点为界的句子切分（保留标点）
_SENT_END = re.compile(r"(?<=[。！？；])")


# ---------------- items.json 读写（唯一事实来源） ----------------
def load_raw() -> dict:
    """读取知识文件原始结构。"""
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_raw(data: dict) -> None:
    """原子写回知识文件：先写临时文件再替换，避免中途断电留下半个 JSON。"""
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, DATA_FILE)


def file_content_hash() -> str:
    """items.json 内容哈希（rag_service 计算数据版本用）。"""
    with open(DATA_FILE, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


# ---------------- 中文语义切分 ----------------
def _split_sentences(text: str) -> list[str]:
    """按中文句末标点切成句子列表（保留标点，去空白）。"""
    return [s for s in (p.strip() for p in _SENT_END.split(text or "")) if s]


def split_long_text(
    text: str,
    max_chars: int = CHUNK_MAX_CHARS,
    overlap_chars: int = CHUNK_OVERLAP_CHARS,
) -> list[str]:
    """把长文本按句子边界切成若干段。

    原则：
      - 每段 ≤ max_chars；
      - 绝不把一句话从中间截断（单句超过 max_chars 时才硬切该句）；
      - 相邻段之间保留约 overlap_chars 字的句尾重叠，避免知识点在边界丢失上下文。
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    sentences = _split_sentences(text)
    chunks, cur = [], ""

    def _tail_overlap(finished: str, next_len: int) -> str:
        """取已切段的句尾作为下一段开头，保证下一段 + 新句子仍 ≤ max_chars。"""
        budget = min(overlap_chars, max_chars - next_len)
        tail = ""
        for prev in reversed(_split_sentences(finished)):
            if len(tail) + len(prev) <= budget:
                tail = prev + tail
            else:
                break
        return tail

    for s in sentences:
        if len(s) > max_chars:
            # 极端情况：单句超长，只能硬切该句（不截断其他句子）
            if cur:
                chunks.append(cur)
                cur = ""
            for i in range(0, len(s), max_chars):
                chunks.append(s[i : i + max_chars])
            continue
        if len(cur) + len(s) <= max_chars:
            cur += s
        else:
            chunks.append(cur)
            cur = _tail_overlap(cur, len(s)) + s
    if cur:
        chunks.append(cur)
    return chunks


# ---------------- chunk 生成 ----------------
def _pick_source(sources: list[dict]) -> tuple[str, str]:
    """从项目的资料来源列表中取第一条作为该 chunk 的来源。没有来源时返回空串。"""
    if sources:
        first = sources[0]
        return first.get("name", ""), first.get("url", "")
    return "", ""


def _content_hash(text: str) -> str:
    """chunk 文本内容哈希，便于变更检测与排查。"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:12]


def chunks_for_item(item: dict) -> list[dict]:
    """把一个知识条目切成 chunk 列表（供全量导入与单条更新共用）。"""
    pid = item["id"]
    name = item["name"]
    source_name, source_url = _pick_source(item.get("sources", []))

    base_meta = {
        # —— 文档级元数据（第二阶段新增）——
        "doc_id": pid,                                  # 所属文档（项目）ID
        "title": name,                                  # 文档标题
        "province": item.get("province", ""),
        "level": item.get("level", ""),
        "tags": ",".join(item.get("tags", [])),         # Chroma metadata 不支持列表，逗号拼接
        "verified": bool(item.get("verified", False)),  # 核验状态：只尊重文件中显式填写的值
        # —— 兼容旧字段（ai_service._extract_sources 等读取）——
        "project_id": pid,
        "project_name": name,
        "category": item.get("category", ""),
        "region": item.get("region", ""),
        "source_name": source_name,                     # 来源机构
        "source_url": source_url,                       # 原始链接
    }

    def _mk(cid: str, text: str, chunk_type: str, section: str, extra: dict | None = None) -> dict:
        meta = {
            **base_meta,
            "chunk_type": chunk_type,
            "section": section,
            "content_hash": _content_hash(text),
        }
        if extra:
            meta.update(extra)
        return {"id": cid, "text": text, "metadata": meta}

    chunks = []

    # 1) 概要 chunk（短，不切分）
    chunks.append(
        _mk(
            f"{pid}__overview",
            f"{name}（{base_meta['category']}，{base_meta['region']}）。{item.get('summary', '')}",
            "overview",
            "项目概要",
        )
    )

    # 2) 历史背景 chunk（长文本按句子切分）
    if item.get("historyBackground"):
        prefix = f"{name}的历史背景"
        parts = split_long_text(item["historyBackground"], CHUNK_MAX_CHARS - len(prefix) - 6)
        for i, part in enumerate(parts):
            if len(parts) == 1:
                cid, text, section = f"{pid}__history", f"{prefix}：{part}", "历史背景"
            else:
                cid = f"{pid}__history_{i}"
                text = f"{prefix}（{i + 1}/{len(parts)}）：{part}"
                section = f"历史背景（{i + 1}/{len(parts)}）"
            chunks.append(_mk(cid, text, "history", section))

    # 3) 每条技艺特点一个 chunk（长描述同样按句子切分）
    for idx, feat in enumerate(item.get("techniqueFeatures", [])):
        title = feat.get("title", "")
        prefix = f"{name}的{title}"
        parts = split_long_text(feat.get("desc", ""), CHUNK_MAX_CHARS - len(prefix) - 6)
        for i, part in enumerate(parts):
            if len(parts) == 1:
                cid = f"{pid}__technique_{idx}"
                text, section = f"{prefix}：{part}", f"技艺特点·{title}"
            else:
                cid = f"{pid}__technique_{idx}_{i}"
                text = f"{prefix}（{i + 1}/{len(parts)}）：{part}"
                section = f"技艺特点·{title}（{i + 1}/{len(parts)}）"
            chunks.append(_mk(cid, text, "technique", section, {"feature_title": title}))

    # 4) 待核实事项 chunk（检索到时会提醒用户查证）
    pending = item.get("factsPending", [])
    if pending:
        prefix = f"{name}相关待核实事项"
        parts = split_long_text("；".join(pending) + "。", CHUNK_MAX_CHARS - len(prefix) - 6)
        for i, part in enumerate(parts):
            if len(parts) == 1:
                cid, text, section = f"{pid}__pending", f"{prefix}：{part}", "待核实事项"
            else:
                cid = f"{pid}__pending_{i}"
                text = f"{prefix}（{i + 1}/{len(parts)}）：{part}"
                section = f"待核实事项（{i + 1}/{len(parts)}）"
            chunks.append(_mk(cid, text, "pending", section))

    return chunks


def load_and_chunk() -> list[dict]:
    """读取知识文件并切分成 chunk 列表。

    重复检测：条目 id 或 chunk id 重复会直接抛 ValueError（导入方记录并拒绝启动索引），
    避免同一文档被静默写入两份向量。
    """
    data = load_raw()
    chunks = []
    seen_items, seen_chunks = set(), set()
    for item in data.get("items", []):
        pid = item.get("id")
        if pid in seen_items:
            raise ValueError(f"items.json 存在重复条目 id：{pid}")
        seen_items.add(pid)
        for c in chunks_for_item(item):
            if c["id"] in seen_chunks:
                raise ValueError(f"chunk id 冲突：{c['id']}")
            seen_chunks.add(c["id"])
            chunks.append(c)
    return chunks


# ---------------- 单条文档的增删改（rag_service 调用，先改文件再改索引） ----------------
def upsert_item_to_file(item: dict) -> bool:
    """把条目写入 items.json（按 id 存在则替换，否则追加）。

    @return True=新插入，False=替换已有
    """
    data = load_raw()
    items = data.setdefault("items", [])
    for i, old in enumerate(items):
        if old.get("id") == item.get("id"):
            items[i] = item
            save_raw(data)
            return False
    items.append(item)
    save_raw(data)
    return True


def delete_item_from_file(project_id: str) -> bool:
    """从 items.json 删除条目。@return 是否真的删到了"""
    data = load_raw()
    items = data.get("items", [])
    kept = [it for it in items if it.get("id") != project_id]
    if len(kept) == len(items):
        return False
    data["items"] = kept
    save_raw(data)
    return True
