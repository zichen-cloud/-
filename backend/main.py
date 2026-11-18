# ============================================================
# FastAPI 后端入口
# ------------------------------------------------------------
# 启动方式（在 backend 目录下）：
#   .venv\Scripts\activate        （先激活虚拟环境）
#   uvicorn main:app --reload --port 8000
#
# 接口列表：
#   GET  /api/health     健康检查（前端用它显示"后端已连接 / 未启动"）
#   POST /api/chat       AI 非遗导师聊天（Mock 模式，第一阶段）
#   POST /api/recognize  上传图片并返回结构化识别结果
#   文档页：http://127.0.0.1:8000/docs （FastAPI 自动生成的调试界面）
# ============================================================
import os

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import config
from api.chat import router as chat_router
from api.favorites import router as favorites_router
from api.fusion import router as fusion_router
from api.persona import router as persona_router
from api.studio import router as studio_router
from api.study_log import router as study_log_router
from api.works import router as works_router
from services import image_service
from services.task_store import video_task_store
from recognizer import DISCLAIMER, RecognizeError, mock_recognition, recognize_image_bytes, use_mock
from schemas import ErrorInfo, RecognitionData, RecognitionResponse

app = FastAPI(title="非遗灵境 API", version="0.5.0")

# 确保参考图 / 生成图的存储目录存在
image_service.ensure_dirs()
# 视频成片目录（阶段三）
os.makedirs(config.VIDEO_DIR, exist_ok=True)
# TTS 配音音频目录（阶段四）
os.makedirs(config.AUDIO_DIR, exist_ok=True)
# 任务记录 / 作品持久化目录（阶段五；在 storage 之外，不经静态服务暴露）
os.makedirs(config.TASKS_DIR, exist_ok=True)
os.makedirs(config.WORKS_DIR, exist_ok=True)
# 收藏记录目录（MySpace 收藏夹）
os.makedirs(config.FAVORITES_DIR, exist_ok=True)
# 启动恢复：读回历史任务；把重启前仍在排队/合成中的任务诚实标记为「中断」
_interrupted = video_task_store.load_all()

# 挂载聊天路由（定义在 api/chat.py，前缀 /api）
app.include_router(chat_router)
# 挂载创作工坊路由（定义在 api/studio.py，前缀 /api/studio）
app.include_router(studio_router)
# 挂载数字传承人路由（阶段二，定义在 api/persona.py，前缀 /api/persona）
app.include_router(persona_router)
# 挂载跨界融合创作路由（阶段三，定义在 api/fusion.py，前缀 /api/fusion）
app.include_router(fusion_router)
# 挂载「我的作品」路由（阶段五，定义在 api/works.py，前缀 /api/works）
app.include_router(works_router)
# 挂载收藏路由（MySpace，定义在 api/favorites.py，前缀 /api/favorites）
app.include_router(favorites_router)
# 挂载 AI 学习记录路由（定义在 api/study_log.py，前缀 /api/study-log）
app.include_router(study_log_router)

# 静态文件：上传的参考图与生成的效果图（放在路由之后挂载，避免覆盖 /api 业务接口）
app.mount("/api/files", StaticFiles(directory=config.STORAGE_DIR), name="storage")

# CORS：允许前端开发服务器跨域访问
# （开发时我们用 Vite 代理转发 /api 请求，通常用不到 CORS，
#   但加上后前端直连 8000 端口调试也不会被浏览器拦截）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 比赛演示阶段放开；正式上线应改为具体域名
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- 工具函数 ----------
def _guess_type(filename: str | None) -> str | None:
    """个别浏览器不上传 content_type 时，用扩展名兜底判断"""
    if not filename or "." not in filename:
        return None
    ext = filename.lower().rsplit(".", 1)[-1]
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext)


def _error(code: str, message: str, status: int) -> JSONResponse:
    """构造统一格式的错误响应（和成功响应共用同一个外壳结构）"""
    body = RecognitionResponse(
        ok=False,
        mode="mock" if use_mock() else "ai",
        error=ErrorInfo(code=code, message=message),
        disclaimer=DISCLAIMER,
    )
    return JSONResponse(status_code=status, content=body.model_dump())


# ---------- 接口 1：健康检查 ----------
@app.get("/api/health")
async def health():
    """前端页面加载时调用，用来判断后端是否启动、当前是什么模式"""
    is_mock = use_mock()
    return {
        "ok": True,
        "mode": "mock" if is_mock else "ai",
        "model": None if is_mock else config.AI_MODEL,
        "imageMode": "real" if config.is_real_image_mode() else "demo",
        "imageModel": config.IMAGE_MODEL if config.is_real_image_mode() else None,
    }


# ---------- 接口 2：图片识别 ----------
@app.post("/api/recognize", response_model=RecognitionResponse)
async def recognize(file: UploadFile = File(...)):
    """接收图片 → 校验 → 返回结构化识别结果

    校验规则（前后端双重校验，后端为准）：
      1. 格式：仅 JPG / PNG / WebP
      2. 大小：不超过 MAX_UPLOAD_MB（默认 10MB）
    """
    # 1. 格式校验
    content_type = file.content_type or _guess_type(file.filename)
    if content_type not in config.ALLOWED_TYPES:
        return _error(
            "INVALID_FILE_TYPE",
            f"仅支持 JPG / PNG / WebP 图片，收到的是「{content_type or '未知类型'}」",
            400,
        )

    # 2. 读取内容并校验大小
    contents = await file.read()
    if not contents:
        return _error("EMPTY_FILE", "上传的文件是空的，请重新选择图片", 400)
    max_bytes = config.MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        return _error(
            "FILE_TOO_LARGE",
            f"图片不能超过 {config.MAX_UPLOAD_MB}MB，当前约 {len(contents) / 1024 / 1024:.1f}MB",
            413,
        )

    # 3. mock 模式：直接返回演示数据（不调用任何 AI）
    if use_mock():
        data: RecognitionData = mock_recognition()
        return RecognitionResponse(ok=True, mode="mock", data=data, disclaimer=DISCLAIMER)

    # 4. 真实模式：调用多模态模型
    try:
        data = await recognize_image_bytes(contents, content_type)
    except RecognizeError as e:
        return _error(e.code, e.message, 502)

    return RecognitionResponse(ok=True, mode="ai", data=data, disclaimer=DISCLAIMER)
