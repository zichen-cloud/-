# ============================================================
# 配置文件：集中读取环境变量
# ------------------------------------------------------------
# 为什么 API Key 放在这里？
#   前端代码会被打包发布到浏览器，任何人都能看到，
#   把 Key 写在前端等于公开泄露。后端环境变量只有服务器能读到，
#   前端 → 后端 → AI 服务的调用链路中，Key 始终留在后端。
# ============================================================
import os

from dotenv import load_dotenv

# 读取 backend/.env 文件（文件不存在也不报错，仅使用系统环境变量）
load_dotenv()

# ---------------- AI 模式配置 ----------------
# AI_MODE=mock（默认）：使用本地演示回答，不需要任何 API Key
# AI_MODE=real：调用真实大模型（第五阶段实现，需要先配置 AI_API_KEY）
AI_MODE = os.getenv("AI_MODE", "mock").strip().lower()

# 多模态 AI 服务配置（real 模式使用，第一阶段保持为空即可）
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_BASE_URL = os.getenv(
    "AI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
).rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "qwen-plus")

# 多模态视觉模型（图像识别专用，与文本模型分开配置）
# 注意：qwen-vl-max 已被阿里云下线（2026-10 实测 Model not exist），默认改用 qwen3-vl-plus
AI_VISION_MODEL = os.getenv("AI_VISION_MODEL", "qwen3-vl-plus")

# 是否强制 mock 模式（MOCK_MODE=1 时即使有 Key 也不调用真实 AI）
MOCK_MODE = os.getenv("MOCK_MODE", "0") == "1"

# ---------------- 知识库（RAG）配置 ----------------
# Embedding 提供方：
#   fastembed（默认）：本地 ONNX 中文语义模型，无需 torch / API Key，
#     首次运行经 hf-mirror.com 镜像下载，缓存于 backend/.models_cache；
#   其他值（如 naive）：跳过模型加载，直接使用本地伪向量兜底。
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "fastembed").strip().lower()
FASTEMBED_MODEL = os.getenv("FASTEMBED_MODEL", "BAAI/bge-small-zh-v1.5")
# 模型缓存目录（不进 git；下载中断后重启会自动续传）
MODEL_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".models_cache")

# 检索时返回的最大资料条数
RETRIEVE_TOP_K = int(os.getenv("RETRIEVE_TOP_K", "3"))

# ---------------- 混合检索（第三阶段） ----------------
# HYBRID_SEARCH=1（默认）：向量检索 + BM25 关键词检索，RRF 融合
# HYBRID_SEARCH=0：退回纯向量检索（用于对比测试/排障）
HYBRID_SEARCH = os.getenv("HYBRID_SEARCH", "1") == "1"
# 每路检索先取多少个候选，再做 RRF 融合
RETRIEVE_CANDIDATES = int(os.getenv("RETRIEVE_CANDIDATES", "10"))
# RRF 融合常数（经典值 60）
RRF_K = int(os.getenv("RRF_K", "60"))
# BM25 候选最低分：纯关键词命中的结果若低于此分会被丢弃，
# 防止无关问题仅靠个别常见双字词混入（bigram 检索的噪音下限，实测后设定）
BM25_MIN_SCORE = float(os.getenv("BM25_MIN_SCORE", "2.0"))

# 中文长文本切分参数：单块最大字数 / 相邻块重叠字数。
# 按中文句子边界切分，不截断句子（见 knowledge_loader.split_long_text）。
CHUNK_MAX_CHARS = int(os.getenv("CHUNK_MAX_CHARS", "260"))
CHUNK_OVERLAP_CHARS = int(os.getenv("CHUNK_OVERLAP_CHARS", "40"))

# 相似度阈值（cosine distance，越小越相关）。
# 伪向量模式下建议 0.85~0.9；真实语义模型下 rag_service 会自动改用更严格的默认值。
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.85"))

# 上传图片校验规则
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

# ---------------- 创作工坊：产品效果图生成服务 ----------------
# IMAGE_MODE=demo（默认）：本地 Pillow 生成带"演示图"水印的占位图，零成本、不会伪装成真实生成
# IMAGE_MODE=real：调用阿里云百炼「通义万相」文生图（异步任务接口，需在百炼控制台开通该模型）
IMAGE_MODE = os.getenv("IMAGE_MODE", "demo").strip().lower()

# 万相服务默认复用 AI_API_KEY；如单独申请了图片服务的 Key，可填 IMAGE_API_KEY
IMAGE_API_KEY = os.getenv("IMAGE_API_KEY", "").strip() or AI_API_KEY

# 百炼「原生 API」地址（万相 / ASR 走原生 multimodal-generation 接口，
# 与聊天用的 OpenAI 兼容地址 AI_BASE_URL 不同，不能混用）
DASHSCOPE_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com").rstrip("/")
IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL", DASHSCOPE_BASE_URL).rstrip("/")
# IMAGE_MODE=real：调用阿里云百炼真实图像生成。
# 2026-10 实测：wanx2.1-t2i-turbo/plus 已下线；新模型 wan2.7-image 走
# 【同步】multimodal-generation 接口（提交后等待 40~90s 返回图片 URL）。
IMAGE_MODEL = os.getenv("IMAGE_MODEL", "wan2.7-image")
IMAGE_SIZE = os.getenv("IMAGE_SIZE", "1024*1024")          # 万相支持的尺寸（宽*高）
IMAGE_PROPOSAL_COUNT = int(os.getenv("IMAGE_PROPOSAL_COUNT", "3"))  # 一次生成的提案数
IMAGE_TASK_TIMEOUT_S = int(os.getenv("IMAGE_TASK_TIMEOUT_S", "150"))  # 等待万相任务的最长秒数
IMAGE_POLL_INTERVAL_S = float(os.getenv("IMAGE_POLL_INTERVAL_S", "2.5"))  # 轮询间隔
IMAGE_SYNC_TIMEOUT_S = int(os.getenv("IMAGE_SYNC_TIMEOUT_S", "240"))  # wan2.7 同步接口单图超时

# ---------------- 创作工坊：产品介绍视频（阶段三） ----------------
# VIDEO_MODE=demo（默认）：本地 FFmpeg 把提案效果图 + 字幕 + 转场合成 10-15 秒短片，
#     片头/片尾字幕卡明确标注"演示视频"，绝不伪装成真实视频生成模型的产物。
# VIDEO_MODE=real：调用真实视频生成服务（预留，默认关闭；接口见 video_service）。
VIDEO_MODE = os.getenv("VIDEO_MODE", "demo").strip().lower()

# 视频服务 Key（不填则复用 AI_API_KEY）
VIDEO_API_KEY = os.getenv("VIDEO_API_KEY", "").strip() or AI_API_KEY
VIDEO_BASE_URL = os.getenv("VIDEO_BASE_URL", "https://dashscope.aliyuncs.com").rstrip("/")
VIDEO_MODEL = os.getenv("VIDEO_MODEL", "wanx2.1-t2v-turbo")

# FFmpeg 可执行文件路径：
#   留空 → 依次尝试 系统 PATH → imageio-ffmpeg 包内置的完整 ffmpeg（pip 依赖，推荐）；
#   也可在此显式指定本机完整版 ffmpeg.exe 的绝对路径。
#   注意：Trae 编辑器自带的 ffmpeg 是裁剪版（缺 concat/overlay/xfade 滤镜），不可用于合成。
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "").strip()

# 单片时长限制（秒）：阶段一第一版固定 10-15 秒短片
VIDEO_DURATION_S = int(os.getenv("VIDEO_DURATION_S", "12"))

# 真实视频生成是异步任务：提交后轮询等待。以下为轮询节奏与总超时（阶段五）
VIDEO_POLL_INTERVAL_S = float(os.getenv("VIDEO_POLL_INTERVAL_S", "3"))   # 每次轮询间隔
VIDEO_TASK_TIMEOUT_S = float(os.getenv("VIDEO_TASK_TIMEOUT_S", "300"))  # 单次生成最长等待

# ---------------- 创作工坊：AI 配音 TTS（阶段四） ----------------
# TTS 未配置 Key 时，后端不会伪造任何音频，generate-audio 会返回明确的中文错误；
# 前端"试听旁白"使用浏览器自带的 Web Speech 朗读（仅本地预览，不进入视频）。
# 默认复用 AI_API_KEY；如单独申请了语音服务 Key，填 TTS_API_KEY。
TTS_API_KEY = os.getenv("TTS_API_KEY", "").strip() or AI_API_KEY
# 百炼 Qwen-TTS 非实时语音合成端点（与万相同域名，走原生 /api/v1）
TTS_BASE_URL = os.getenv("TTS_BASE_URL", "https://dashscope.aliyuncs.com").rstrip("/")
TTS_MODEL = os.getenv("TTS_MODEL", "qwen3-tts-flash")
TTS_TIMEOUT_S = int(os.getenv("TTS_TIMEOUT_S", "60"))  # 单句合成超时
# 有声视频总时长上限（秒）：旁白过长时给出明确提示，不无限延长画面
VIDEO_WITH_AUDIO_MAX_S = float(os.getenv("VIDEO_WITH_AUDIO_MAX_S", "16"))

# ---------------- 文件存储（参考图 / 生成图） ----------------
# 存在 backend/storage 下，通过 /api/files/... 访问；该目录已加入 .gitignore
STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage")
UPLOAD_DIR = os.path.join(STORAGE_DIR, "uploads")    # 用户上传的参考图
GENERATED_DIR = os.path.join(STORAGE_DIR, "generated")  # AI 或演示流程生成的图片
VIDEO_DIR = os.path.join(STORAGE_DIR, "videos")     # 合成的介绍视频
AUDIO_DIR = os.path.join(STORAGE_DIR, "audio")      # TTS 生成的配音音频

# ---------------- 持久化数据（阶段五：任务记录 / 我的作品） ----------------
# 注意：这里存的是业务 JSON，刻意【不】放在 STORAGE_DIR 下——
# STORAGE_DIR 被 /api/files 静态服务公开挂载，JSON 记录不应被静态地址直接读取，
# 它们只能通过 /api/studio/video-tasks、/api/works 等业务接口访问。
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
TASKS_DIR = os.path.join(DATA_DIR, "tasks")         # 视频合成任务记录（每任务一个 JSON）
WORKS_DIR = os.path.join(DATA_DIR, "works")         # 用户保存的作品（每件一个 JSON）
FAVORITES_DIR = os.path.join(DATA_DIR, "favorites") # 收藏记录（每条一个 JSON）
STUDY_LOG_FILE = os.path.join(DATA_DIR, "study_log.json")  # AI 学习记录（问答日志，单文件）
# 历史任务列表默认返回条数
TASK_LIST_LIMIT = int(os.getenv("TASK_LIST_LIMIT", "30"))
# 学习记录最多保留条数（超出时丢弃最旧的）
STUDY_LOG_LIMIT = int(os.getenv("STUDY_LOG_LIMIT", "200"))


def is_real_image_mode() -> bool:
    """是否启用真实的文生图服务。必须 IMAGE_MODE=real、有 Key 且未开启 MOCK_MODE。"""
    return IMAGE_MODE == "real" and bool(IMAGE_API_KEY) and not MOCK_MODE


def is_real_mode() -> bool:
    """是否处于"真实模型"模式。必须同时满足：
    1. AI_MODE=real；
    2. 已配置 AI_API_KEY；
    3. 没有设置 MOCK_MODE=1（开发调试开关）。
    """
    return AI_MODE == "real" and bool(AI_API_KEY) and not MOCK_MODE


def is_tts_ready() -> bool:
    """是否已配置真实 TTS 服务（有 Key 且未开启 MOCK_MODE）。"""
    return bool(TTS_API_KEY) and not MOCK_MODE


def is_real_video_mode() -> bool:
    """是否启用真实的视频生成服务。必须 VIDEO_MODE=real、有 Key 且未开启 MOCK_MODE。"""
    return VIDEO_MODE == "real" and bool(VIDEO_API_KEY) and not MOCK_MODE


def use_mock() -> bool:
    """判断当前是否使用 mock（演示）模式（与 is_real_mode 相反）。
    默认 AI_MODE=mock，团队成员克隆项目后无需任何 Key 即可运行。
    """
    return not is_real_mode()
