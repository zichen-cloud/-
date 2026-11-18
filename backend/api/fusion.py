# ============================================================
# 跨界融合创作路由（阶段三）
# ------------------------------------------------------------
#   POST /api/fusion/analyze   多非遗要素拆解 + 融合方案（不含图）
#   POST /api/fusion/images    为融合方案生成效果图
#
# 与既有 /api/studio/* 互不影响：单一非遗创作继续走原链路，
# 这里只处理"2-3 项非遗融合"的独立业务。
# ============================================================
import asyncio
import time
import uuid

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import (
    FusionAnalyzeRequest,
    FusionAnalyzeResponse,
    FusionImagesRequest,
)
from services import fusion_service
from services.fusion_service import FusionError

router = APIRouter(prefix="/api/fusion", tags=["fusion"])

MAX_IDEA_LENGTH = 200

# 效果图任务表：真实图片服务单张 40~90 秒，同步返回容易超时，
# 因此改为「提交即返回 taskId，前端轮询」的方式。
# 结构：taskId -> {status, stage, progress, createdAt, result?, error?}
_image_tasks: dict[str, dict] = {}
_TASK_TTL_S = 1800  # 30 分钟后清理，避免内存堆积


def _cleanup_tasks() -> None:
    now = time.time()
    for tid, task in list(_image_tasks.items()):
        if now - task.get("createdAt", now) > _TASK_TTL_S:
            _image_tasks.pop(tid, None)


async def _run_images_task(task_id: str, proposals: list[dict], theme_name: str,
                           product_name: str, style_name: str) -> None:
    task = _image_tasks.get(task_id)
    if task is None:
        return
    total = len(proposals)

    def on_progress(done: int, count: int) -> None:
        task.update(
            stage=f"已完成 {done}/{count} 张效果图",
            progress=25 + int(60 * done / max(count, 1)),
        )

    try:
        task.update(stage=f"正在生成 {total} 张效果图（并行，约 1–2 分钟）", progress=25)
        result = await fusion_service.generate_images(
            proposals,
            theme_name=theme_name,
            product_name=product_name,
            style_name=style_name,
            on_progress=on_progress,
        )
        task.update(status="succeeded", stage="完成", progress=100,
                    finishedAt=time.time(), result=result)
    except FusionError as e:
        task.update(status="failed", stage="失败", finishedAt=time.time(),
                    error={"code": e.code, "message": e.message})
    except Exception:
        task.update(status="failed", stage="失败", finishedAt=time.time(),
                    error={"code": "SERVER_ERROR", "message": "效果图生成失败，请稍后重试"})


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


@router.post("/analyze", response_model=FusionAnalyzeResponse)
async def analyze(payload: FusionAnalyzeRequest):
    """分析 2-3 项非遗的文化要素并给出融合方案。"""
    heritages = [h.model_dump() for h in payload.heritages if h.name.strip()]
    if len(heritages) < 2:
        return _error("FUSION_BAD_SELECTION", "跨界融合至少需要选择 2 项非遗", 400)
    if len(heritages) > 3:
        return _error("FUSION_BAD_SELECTION", "一次最多融合 3 项非遗", 400)
    if len(payload.idea) > MAX_IDEA_LENGTH:
        return _error("IDEA_TOO_LONG", f"补充想法请控制在 {MAX_IDEA_LENGTH} 字以内", 400)

    count = 2 if payload.count not in (2, 3) else payload.count
    try:
        result = await fusion_service.analyze(
            heritages,
            product_name=payload.productName,
            style_name=payload.styleName,
            ratios=payload.ratios,
            idea=payload.idea.strip(),
            count=count,
        )
    except FusionError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "融合分析失败，请稍后重试", 500)

    return FusionAnalyzeResponse(ok=True, **result)


@router.post("/images")
async def images(payload: FusionImagesRequest):
    """提交融合效果图生成任务，立即返回 taskId（前端轮询 /images/{taskId}）。

    真实图像模型单张 40~90 秒，同步等待容易触发网关/浏览器超时，
    因此统一改为后台任务执行。
    """
    if not payload.proposals:
        return _error("EMPTY_PROPOSALS", "没有可生成的融合方案", 400)

    proposals = [p.model_dump() for p in payload.proposals]
    _cleanup_tasks()
    task_id = f"fus_{uuid.uuid4().hex[:12]}"
    _image_tasks[task_id] = {
        "status": "processing",
        "stage": "任务已创建",
        "progress": 5,
        "createdAt": time.time(),
    }
    asyncio.create_task(
        _run_images_task(
            task_id,
            proposals,
            payload.themeName,
            payload.productName,
            payload.styleName,
        )
    )
    return JSONResponse({"ok": True, "taskId": task_id, "status": "processing"})


@router.get("/images/{task_id}")
async def images_status(task_id: str):
    """查询融合效果图任务状态；成功后返回 proposals 与 notice。"""
    _cleanup_tasks()
    task = _image_tasks.get(task_id)
    if task is None:
        return _error("TASK_NOT_FOUND", "生成任务不存在或已过期，请重新生成", 404)

    body = {
        "ok": True,
        "taskId": task_id,
        "status": task["status"],
        "stage": task.get("stage", ""),
        "progress": task.get("progress", 0),
    }
    if task["status"] == "succeeded":
        result = task.get("result") or {}
        body["proposals"] = result.get("proposals", [])
        body["notice"] = result.get("notice", "")
    elif task["status"] == "failed":
        body["error"] = task.get("error", {"code": "SERVER_ERROR", "message": "效果图生成失败，请稍后重试"})
    return JSONResponse(body)
