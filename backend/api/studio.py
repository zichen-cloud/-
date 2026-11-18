# ============================================================
# 创作工坊路由
# ------------------------------------------------------------
#   POST /api/studio/generate-plan       生成结构化文字设计方案（原有能力）
#   POST /api/studio/upload-reference    上传产品参考图（阶段一新增）
#   POST /api/studio/generate-proposals  生成 3 个产品效果图提案（阶段一新增）
#
# 路由层职责：基础校验 → 调用 service → 把业务异常转成友好的 JSON 错误。
# ============================================================
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

import asyncio
import time
import uuid

import config
from models.schemas import (
    AudioRequest,
    AudioResponse,
    NarrationRequest,
    NarrationResponse,
    ProposalRequest,
    ProposalResponse,
    ProposalItem,
    ReferenceUploadResponse,
    StudioPlanRequest,
    StudioPlanResponse,
    VideoRequest,
    VideoStartResponse,
    VideoStatusResponse,
    VideoTaskItem,
    VideoTaskListResponse,
)
from services import image_service, tts_service
from services.ai_service import (
    generate_design_plan,
    generate_narration,
    generate_proposal_briefs,
    ChatError,
)
from services.image_service import IMAGE_DISCLAIMER, ImageError
from services.tts_service import TTSError
from services.video_service import (
    VideoError,
    VIDEO_DISCLAIMER,
    get_video_task,
    list_video_tasks,
    start_video_task,
)

router = APIRouter(prefix="/api/studio", tags=["studio"])


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


@router.post("/generate-plan", response_model=StudioPlanResponse)
async def generate_plan(payload: StudioPlanRequest):
    """接收创作需求，返回 AI 生成的结构化设计方案（原有接口，保持不变）"""
    # 基础校验
    if not payload.title.strip():
        return _error("EMPTY_TITLE", "请先填写作品标题", 400)
    if not payload.theme or not payload.createType or not payload.style:
        return _error("MISSING_OPTIONS", "请完整选择非遗主题、创作类型与视觉风格", 400)

    # 调用 AI 生成
    try:
        plan = await generate_design_plan(payload.model_dump())
    except ChatError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "创作服务开小差了，请稍后重试", 500)

    return StudioPlanResponse(
        mode="ai",
        promptSummary=f"{payload.createTypeName}设计方案 · {payload.themeName} · {payload.styleName}",
        plan=plan,
    )


# ============================================================
# 阶段一：参考图上传
# ============================================================

@router.post("/upload-reference", response_model=ReferenceUploadResponse)
async def upload_reference(file: UploadFile = File(...)):
    """接收产品参考图 → 类型/大小/PIL 三重校验 → 重编码保存 → 返回访问地址"""
    # 1. 类型白名单
    content_type = file.content_type
    if content_type not in config.ALLOWED_TYPES:
        return _error(
            "INVALID_FILE_TYPE",
            f"仅支持 JPG / PNG / WebP 图片，收到的是「{content_type or '未知类型'}」",
            400,
        )

    # 2. 读取并校验大小
    contents = await file.read()
    max_bytes = config.MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        return _error(
            "FILE_TOO_LARGE",
            f"图片不能超过 {config.MAX_UPLOAD_MB}MB，当前约 {len(contents) / 1024 / 1024:.1f}MB",
            413,
        )

    # 3. 结构校验 + 重编码保存
    try:
        info = image_service.save_reference_image(contents, content_type)
    except ImageError as e:
        return _error(e.code, e.message, 400)

    return ReferenceUploadResponse(**info)


# ============================================================
# 阶段一：生成 3 个产品效果图提案
# ------------------------------------------------------------
# demo 图片模式：同步返回（本地绘图秒级完成，响应结构与历史版本一致）。
# real 图片模式（wan2.7-image）：3 张图并行也要 40~90 秒，HTTP 同步等不完，
# 因此任务化：本接口立即返回 taskId，后台协程完成文案+生图，
# 前端轮询 GET /proposal-status/{taskId} 拿结果（结构与 demo 响应一致）。
# ============================================================

# 内存任务表：taskId -> {status, stage, progress, result?, error?}
# 进行中的提案任务生命周期只有几分钟，服务重启丢失可接受（轮询会得到 404 提示重新生成）
_proposal_tasks: dict[str, dict] = {}
_PROPOSAL_TASK_TTL_S = 1800  # 已结束任务的保留时长，超时清理防止内存增长


def _cleanup_proposal_tasks() -> None:
    now = time.time()
    for tid in [
        tid
        for tid, t in _proposal_tasks.items()
        if t.get("status") != "processing" and now - t.get("finishedAt", now) > _PROPOSAL_TASK_TTL_S
    ]:
        _proposal_tasks.pop(tid, None)


async def _run_proposal_task(task_id: str, payload: ProposalRequest, reference_path: str | None) -> None:
    """后台执行：提案文案（文本模型）→ 3 张效果图（wan2.7-image 并行）→ 组装结果。"""
    task = _proposal_tasks[task_id]
    try:
        task.update(stage="正在生成设计提案文案", progress=15)
        briefs, text_mode = await generate_proposal_briefs(payload.model_dump(), config.IMAGE_PROPOSAL_COUNT)

        task.update(stage="正在生成效果图（约 1~2 分钟）", progress=40)
        images = await image_service.generate_proposal_images(
            briefs,
            theme_name=payload.themeName,
            product_name=payload.productTypeName,
            style_name=payload.styleName,
            reference_path=reference_path,
        )

        proposals = []
        for i, (brief, image) in enumerate(zip(briefs, images), start=1):
            proposals.append({
                "id": f"p{i}",
                "imageUrl": image["url"],
                "proposalTitle": brief["proposalTitle"],
                "concept": brief["concept"],
                "elements": brief["elements"],
                "composition": brief["composition"],
                "colorPalette": brief["colorPalette"],
            })
        prompt_summary = (
            f"{payload.productTypeName + '效果图' if payload.productTypeName else '设计方案'} · {payload.themeName} · "
            f"{payload.styleName}（{config.IMAGE_PROPOSAL_COUNT} 个提案）"
        )

        # result 与 demo 模式的 ProposalResponse 完全同构，前端无需区分
        task.update(
            status="succeeded",
            stage="完成",
            progress=100,
            finishedAt=time.time(),
            result={
                "ok": True,
                "mode": text_mode,
                "imageMode": images[0]["mode"],
                "imageModel": images[0].get("model", ""),
                "promptSummary": prompt_summary,
                "proposals": proposals,
                "disclaimer": IMAGE_DISCLAIMER,
            },
        )
    except (ChatError, ImageError) as e:
        task.update(status="failed", stage="失败", finishedAt=time.time(), error={"code": e.code, "message": e.message})
    except Exception:
        task.update(
            status="failed",
            stage="失败",
            finishedAt=time.time(),
            error={"code": "SERVER_ERROR", "message": "提案生成失败，请稍后重试"},
        )


@router.post("/generate-proposals", response_model=ProposalResponse)
async def generate_proposals(payload: ProposalRequest):
    """文案（文本模型）+ 效果图（图片服务）组装为 3 个完整提案。

    demo 图片模式：同步返回完整提案；
    real 图片模式：返回 {taskId, status}，结果通过 /proposal-status/{taskId} 轮询。
    """
    # 基础校验（创作类型/产品类型为选填：空串合法，由主题+创意驱动生成）
    if not payload.title.strip():
        return _error("EMPTY_TITLE", "请先填写作品标题", 400)
    if not payload.theme or not payload.style:
        return _error("MISSING_OPTIONS", "请选择非遗主题与视觉风格", 400)

    # 1. 解析参考图（如有），非法标识直接报错
    try:
        reference_path = image_service.resolve_reference_path(payload.referenceId)
    except ImageError as e:
        return _error(e.code, e.message, 400)

    # 2. real 模式：任务化（3 张真实生图约 1~2 分钟，不能占用同一个 HTTP 请求）
    if config.is_real_image_mode():
        _cleanup_proposal_tasks()
        task_id = f"img_{uuid.uuid4().hex[:12]}"
        _proposal_tasks[task_id] = {"status": "processing", "stage": "任务已创建", "progress": 5}
        asyncio.create_task(_run_proposal_task(task_id, payload, reference_path))
        return JSONResponse({"taskId": task_id, "status": "processing"})

    # 3. demo 模式：生成 3 套差异化提案文案（real 文本模型；mock 用本地模板）
    try:
        briefs, text_mode = await generate_proposal_briefs(
            payload.model_dump(), config.IMAGE_PROPOSAL_COUNT
        )
    except ChatError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "提案文案生成失败，请稍后重试", 500)

    # 4. 生成 3 张效果图（demo：本地水印图）
    try:
        images = await image_service.generate_proposal_images(
            briefs,
            theme_name=payload.themeName,
            product_name=payload.productTypeName,
            style_name=payload.styleName,
            reference_path=reference_path,
        )
    except ImageError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "效果图生成失败，请稍后重试", 500)

    # 5. 文案与图片一一对应组装
    proposals = []
    for i, (brief, image) in enumerate(zip(briefs, images), start=1):
        proposals.append(ProposalItem(
            id=f"p{i}",
            imageUrl=image["url"],
            proposalTitle=brief["proposalTitle"],
            concept=brief["concept"],
            elements=brief["elements"],
            composition=brief["composition"],
            colorPalette=brief["colorPalette"],
        ))

    prompt_summary = (
        f"{payload.productTypeName + '效果图' if payload.productTypeName else '设计方案'} · {payload.themeName} · "
        f"{payload.styleName}（{config.IMAGE_PROPOSAL_COUNT} 个提案）"
    )

    return ProposalResponse(
        mode=text_mode,
        imageMode=images[0]["mode"],
        imageModel=images[0].get("model", ""),
        promptSummary=prompt_summary,
        proposals=proposals,
        disclaimer=IMAGE_DISCLAIMER,
    )


@router.get("/proposal-status/{task_id}")
async def proposal_status(task_id: str):
    """轮询真实生图提案任务的进度与结果。

    processing → {taskId, status, stage, progress}
    succeeded  → 附 result（与 demo 模式 ProposalResponse 完全同构）
    failed     → 附 error {code, message}（前端据此抛出中文提示）
    """
    _cleanup_proposal_tasks()
    task = _proposal_tasks.get(task_id)
    if task is None:
        return _error(
            "TASK_NOT_FOUND",
            "提案任务不存在或已过期（服务重启会丢失进行中的任务），请重新生成",
            404,
        )
    body = {
        "taskId": task_id,
        "status": task["status"],
        "stage": task.get("stage", ""),
        "progress": task.get("progress", 0),
    }
    if task["status"] == "succeeded":
        body["result"] = task["result"]
    elif task["status"] == "failed":
        body["error"] = task.get("error", {"code": "SERVER_ERROR", "message": "提案生成失败"})
    return body


# ============================================================
# 阶段三：产品介绍视频
# ============================================================

@router.post("/generate-video", response_model=VideoStartResponse)
async def generate_video(payload: VideoRequest):
    """启动产品介绍视频合成任务，立即返回 taskId；合成在后台异步进行。"""
    if not payload.title.strip():
        return _error("EMPTY_TITLE", "请先填写作品标题", 400)
    task_id = start_video_task(payload.model_dump())
    return VideoStartResponse(taskId=task_id)


@router.get("/video-status/{task_id}", response_model=VideoStatusResponse)
async def video_status(task_id: str):
    """查询视频合成任务的状态 / 进度 / 失败原因 / 成片地址。"""
    task = get_video_task(task_id)
    if task is None:
        return _error("TASK_NOT_FOUND", "视频任务不存在或已过期，请重新生成", 404)
    return VideoStatusResponse(
        status=task["status"],
        progress=task["progress"],
        message=task["message"],
        error=task["error"],
        videoUrl=task["videoUrl"],
        duration=task["duration"],
        mode=task["mode"],
        scriptMode=task["scriptMode"],
        hasAudio=task.get("hasAudio", False),
        voiceName=task.get("voiceName", ""),
        speedName=task.get("speedName", ""),
        script=task["script"],
        disclaimer=VIDEO_DISCLAIMER,
    )


@router.get("/video-tasks", response_model=VideoTaskListResponse)
async def video_task_history(limit: int = 20):
    """历史视频任务列表（阶段五：任务持久化，按创建时间倒序）。

    重启后已完成/失败的任务仍在此返回；重启时仍在合成中的任务会被标记
    interrupted=true、status=failed，并给出需要重新生成的中文提示。
    """
    limit = max(1, min(limit, config.TASK_LIST_LIMIT))
    tasks = []
    for t in list_video_tasks(limit):
        tasks.append(VideoTaskItem(
            taskId=t.get("id", ""),
            status=t["status"],
            progress=t.get("progress", 0),
            message=t.get("message", ""),
            error=t.get("error", ""),
            videoUrl=t.get("videoUrl", ""),
            duration=t.get("duration", 0),
            mode=t.get("mode", ""),
            scriptMode=t.get("scriptMode", ""),
            hasAudio=t.get("hasAudio", False),
            voiceName=t.get("voiceName", ""),
            speedName=t.get("speedName", ""),
            createdAt=t.get("createdAt", 0),
            updatedAt=t.get("updatedAt", 0),
            interrupted=t.get("interrupted", False),
        ))
    return VideoTaskListResponse(tasks=tasks)


# ============================================================
# 阶段四：AI 配音（旁白生成 → 逐句 TTS → 与视频合成）
# ============================================================

@router.post("/generate-narration", response_model=NarrationResponse)
async def create_narration(payload: NarrationRequest):
    """根据作品与所选方案生成 4 句口播旁白（与视频 4 个分镜一一对应）。"""
    if not payload.title.strip():
        return _error("EMPTY_TITLE", "请先填写作品标题", 400)
    try:
        sentences, mode = await generate_narration(payload.model_dump())
    except ChatError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "旁白生成失败，请稍后重试", 500)
    return NarrationResponse(sentences=sentences, mode=mode)


@router.post("/generate-audio", response_model=AudioResponse)
async def create_audio(payload: AudioRequest):
    """逐句调用真实 TTS 合成配音并保存为本地 mp3（未配置 Key 时返回明确中文错误）。"""
    sentences = [s.strip() for s in payload.sentences]
    if len(sentences) != 5 or any(not s for s in sentences):
        return _error("TTS_EMPTY_TEXT", "需要恰好 5 句非空旁白才能生成配音", 400)
    try:
        result = await tts_service.synthesize_sentences(sentences, payload.voice, payload.speed)
    except TTSError as e:
        # 参数类错误返回 400，服务/网络类错误返回 502
        status = 400 if e.code in ("TTS_BAD_VOICE", "TTS_BAD_SPEED", "TTS_EMPTY_TEXT", "TTS_TEXT_TOO_LONG") else 502
        return _error(e.code, e.message, status)
    except Exception:
        return _error("SERVER_ERROR", "配音生成失败，请稍后重试", 500)
    return AudioResponse(**result)
