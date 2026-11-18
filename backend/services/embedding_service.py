# ============================================================
# Embedding 服务：把文本转成向量
# ------------------------------------------------------------
# 当前方案（第二阶段起默认）：fastembed + BAAI/bge-small-zh-v1.5
#   - 本地 ONNX 推理（onnxruntime），无需 torch / sentence-transformers；
#   - 模型经 HuggingFace 镜像 hf-mirror.com 下载（HF 仓库 Qdrant/bge-small-zh-v1.5），
#     无需 API Key，缓存于 backend/.models_cache（下载中断后重开会自动续传）；
#   - 中文语义检索质量远好于字符 n-gram 伪向量。
#
# 兜底：模型下载/加载失败时自动降级为"字符 n-gram 哈希"伪向量，
#       保证 RAG 链路可运行（检索质量下降，启动日志会明确提示）。
#
# 对外接口（rag_service 使用）：
#   embed(texts)                 统一向量化入口（内部自动选真实模型或兜底）
#   is_real_embedding()          是否使用了真实语义模型
#   get_embedding_signature()    当前 embedding 方案签名（数据版本哈希用）
#   ChineseEmbeddingFunction     Chroma 的 EmbeddingFunction 适配器
# ============================================================
import hashlib
import math
import os

# 在导入 fastembed / huggingface_hub 之前设置 HuggingFace 镜像（国内可下载）
# 注意：这两行必须放在任何 HF 相关导入之前
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
# hf-mirror 不代理 HF 的 xet CAS 存储（会 401），禁用 xet 走普通 HTTP 下载
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

import config

PROVIDER = getattr(config, "EMBEDDING_PROVIDER", "fastembed")
MODEL_NAME = getattr(config, "FASTEMBED_MODEL", "BAAI/bge-small-zh-v1.5")
MODEL_CACHE_DIR = getattr(
    config,
    "MODEL_CACHE_DIR",
    os.path.join(os.path.dirname(__file__), "..", ".models_cache"),
)
NAIVE_DIM = 512  # 兜底伪向量的固定维度


# ---------------- 兜底方案：本地伪向量 ----------------
def _naive_embed_one(text: str, dim: int = NAIVE_DIM) -> list[float]:
    """基于"字符 n-gram 哈希"的本地伪向量。

    原理：把文本拆成单字、双字、三字组合，每个组合哈希到 dim 维中的一格并累加计数，
    最后做 L2 归一化。相同字符/词组越多的文本相似度越高。
    语义能力弱，但不依赖任何外部模型，保证流程能跑通。
    """
    chars = list(text or "")
    vec = [0.0] * dim
    for n in (1, 2, 3):
        for i in range(len(chars) - n + 1):
            gram = "".join(chars[i : i + n])
            h = int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16)
            vec[h % dim] += 1.0
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def _naive_embed(texts: list[str]) -> list[list[float]]:
    return [_naive_embed_one(t) for t in texts]


# ---------------- 真实模型加载（fastembed，带降级） ----------------
_fe_model = None       # fastembed TextEmbedding 实例
_use_real = False      # 是否真的用了真实模型
_real_dim = 0          # 真实模型的向量维度（自检时测得）


def _l2_normalize(vec: list[float]) -> list[float]:
    """L2 归一化：配合 Chroma 的 cosine 距离使用，保证距离口径稳定。"""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def _try_load_fastembed():
    """尝试加载 fastembed 模型；失败则保持兜底模式，不影响服务启动。"""
    global _fe_model, _use_real, _real_dim
    if _use_real:
        return
    if PROVIDER != "fastembed":
        print(f"[embedding] EMBEDDING_PROVIDER={PROVIDER}，按配置使用本地伪向量")
        return
    try:
        from fastembed import TextEmbedding  # 延迟导入

        os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
        model = TextEmbedding(model_name=MODEL_NAME, cache_dir=MODEL_CACHE_DIR)
        # 试跑一条，确认模型文件完整可用（首次运行会在此联网下载/续传模型）
        probe = _l2_normalize(list(map(float, list(model.embed(["模型自检"]))[0])))
        _fe_model = model
        _real_dim = len(probe)
        _use_real = True
        print(f"[embedding] 使用 fastembed 真实模型：{MODEL_NAME}（dim={_real_dim}）")
    except Exception as e:
        # 任何失败都降级，不让服务启动不起来
        _fe_model = None
        _use_real = False
        print(
            f"[embedding] fastembed 模型加载失败，降级到本地伪向量。\n"
            f"  原因：{e}\n"
            f"  → 检查网络后重启服务即可自动续传下载（镜像 hf-mirror.com）。"
        )


# 模块加载时尝试一次（失败就降级，不抛异常）
_try_load_fastembed()


def embed(texts: list[str]) -> list[list[float]]:
    """对外的统一 embedding 接口。内部自动选择真实模型或兜底方案。"""
    if _use_real and _fe_model is not None:
        return [
            _l2_normalize(list(map(float, vec)))
            for vec in _fe_model.embed(list(texts))
        ]
    return _naive_embed(texts)


def is_real_embedding() -> bool:
    """当前是否使用了真实语义模型（供日志/检索策略判断）。"""
    return _use_real


def get_embedding_signature() -> str:
    """当前 embedding 方案签名，用于 rag_service 计算数据版本哈希。

    方案或模型变化 → 签名变化 → 索引自动重建，避免不同向量混在同一集合。
    """
    if _use_real:
        return f"fastembed:{MODEL_NAME}:{_real_dim}"
    return f"naive:pseudo:{NAIVE_DIM}"


# ---------------- Chroma 自定义 EmbeddingFunction ----------------
# Chroma 要求 embedding function 实现 __call__(input: list[str]) -> list[list[float]]
# 这里包一层，让 Chroma 自动复用上面的 embed()
try:
    from chromadb.api.types import EmbeddingFunction
except Exception:  # pragma: no cover - chromadb 导入失败时的兜底
    EmbeddingFunction = object


class ChineseEmbeddingFunction(EmbeddingFunction):
    """Chroma 用的自定义 embedding function，支持真实模型与兜底两种模式。"""

    def __call__(self, input):  # input: list[str]
        return embed(input)

    @staticmethod
    def name() -> str:
        """chromadb 1.x 用该名字记录集合的 embedding function 配置。"""
        return "chinese-fastembed-v2"
