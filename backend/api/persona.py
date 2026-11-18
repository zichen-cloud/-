# ============================================================
# 数字传承人路由（阶段二）
# ------------------------------------------------------------
#   GET  /api/persona/list        所有数字传承人（前端选择器）
#   POST /api/persona/match       依据【真实识别结果】匹配角色
#   POST /api/persona/chat        人格化问答 / 讲文化故事
#   POST /api/persona/quiz        生成一道结构化知识问答
#   POST /api/persona/tts         文本 → 多段语音（真实 TTS）
#   POST /api/persona/asr         录音 → 文字（真实 ASR）
#
# 路由层只做校验与异常转换；业务全部在 persona_service / tts_service / asr_service。
# 不修改任何既有接口的请求与返回格式。
# ============================================================
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from models.schemas import (
    ASRResponse,
    PersonaChatRequest,
    PersonaChatResponse,
    PersonaListResponse,
    PersonaMatchRequest,
    PersonaMatchResponse,
    PersonaQuizResponse,
    PersonaTTSRequest,
    PersonaTTSResponse,
)
from services import asr_service, persona_service, tts_service
from services.asr_service import ASRError
from services.persona_service import PersonaError
from services.tts_service import TTSError

router = APIRouter(prefix="/api/persona", tags=["persona"])

MAX_MESSAGE_LENGTH = 500
MAX_TTS_CHARS = 600
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 录音上限 10MB（约 30 秒）
ALLOWED_AUDIO_EXT = {".webm", ".wav", ".mp3", ".m4a", ".ogg"}


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


@router.get("/list", response_model=PersonaListResponse)
async def persona_list():
    """返回全部数字传承人的公开形象配置（不含内部提示词）。"""
    return PersonaListResponse(ok=True, personas=persona_service.list_personas())


@router.post("/match", response_model=PersonaMatchResponse)
async def persona_match(payload: PersonaMatchRequest):
    """根据识别候选匹配数字传承人。

    匹配规则全部基于真实识别结果（候选名称/类别/依据），
    无匹配或多候选时不会强行指派角色。
    """
    try:
        candidates = [c.model_dump() for c in payload.candidates]
        result = persona_service.match_persona(
            candidates,
            predicted=payload.predictedCategory,
            heritage_id=payload.heritageId,
        )
    except Exception:
        return _error("SERVER_ERROR", "传承人匹配失败，请稍后重试", 500)
    return PersonaMatchResponse(ok=True, **result)


@router.post("/chat", response_model=PersonaChatResponse)
async def persona_chat(payload: PersonaChatRequest):
    """与指定数字传承人对话（intent=chat 提问 / story 讲故事）。"""
    message = (payload.message or "").strip()
    if payload.intent not in ("chat", "story"):
        payload.intent = "chat"
    if payload.intent == "chat" and not message:
        return _error("EMPTY_MESSAGE", "想问我什么？说一句再发送吧", 400)
    if len(message) > MAX_MESSAGE_LENGTH:
        return _error(
            "MESSAGE_TOO_LONG", f"一次不要问太多，控制在 {MAX_MESSAGE_LENGTH} 字以内", 400
        )

    try:
        result = await persona_service.persona_chat(
            payload.personaId,
            message,
            history=[h.model_dump() for h in payload.history],
            intent=payload.intent,
            heritage_id=payload.heritageId,
        )
    except PersonaError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "传承人暂时走神了，请稍后再问", 500)

    return PersonaChatResponse(ok=True, **result)


@router.post("/quiz", response_model=PersonaQuizResponse)
async def persona_quiz(payload: PersonaChatRequest):
    """生成一道围绕该非遗的趣味问答（结构化 JSON）。"""
    try:
        result = await persona_service.persona_quiz(payload.personaId, payload.heritageId)
    except PersonaError as e:
        return _error(e.code, e.message, 502)
    except Exception:
        return _error("SERVER_ERROR", "出题失败，请再试一次", 500)
    return PersonaQuizResponse(ok=True, **result)


@router.post("/tts", response_model=PersonaTTSResponse)
async def persona_tts(payload: PersonaTTSRequest):
    """把传承人的一段话合成为可播放的语音（多段，按顺序播放）。"""
    text = (payload.text or "").strip()
    if not text:
        return _error("EMPTY_TEXT", "没有可朗读的内容", 400)
    if len(text) > MAX_TTS_CHARS:
        text = text[:MAX_TTS_CHARS]

    try:
        result = await tts_service.synthesize_speech(text, payload.voiceKey)
    except TTSError as e:
        # 语音不可用属于可降级错误：前端收到后自动退回纯文字交互
        return _error(e.code, e.message, 503)
    except Exception:
        return _error("SERVER_ERROR", "语音合成失败，已为你保留文字内容", 500)

    return PersonaTTSResponse(ok=True, **result)


@router.post("/asr", response_model=ASRResponse)
async def persona_asr(file: UploadFile = File(...)):
    """语音提问：上传录音，返回识别出的文字。

    文件类型与大小在服务端二次校验（前端校验可被绕过）。
    """
    name = (file.filename or "").lower()
    ext = "." + name.rsplit(".", 1)[-1] if "." in name else ""
    if ext not in ALLOWED_AUDIO_EXT:
        return _error(
            "INVALID_AUDIO_TYPE",
            "只支持 webm / wav / mp3 / m4a / ogg 录音格式",
            400,
        )

    data = await file.read()
    if not data:
        return _error("EMPTY_AUDIO", "没有收到录音内容，请重新录制", 400)
    if len(data) > MAX_AUDIO_BYTES:
        return _error("AUDIO_TOO_LARGE", "录音太长（超过 10MB），请控制在 30 秒内", 400)

    try:
        result = await asr_service.transcribe(data, filename=file.filename or "voice.webm")
    except ASRError as e:
        return _error(e.code, e.message, 503)
    except Exception:
        return _error("SERVER_ERROR", "语音识别失败，请改用文字提问", 500)

    return ASRResponse(ok=True, **result)
