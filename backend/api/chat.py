# ============================================================
# 聊天路由：POST /api/chat
# ------------------------------------------------------------
# 路由层职责（保持极简）：
#   1. 做基础校验（空输入、超长输入）
#   2. 调用 chat_service.handle_chat()
#   3. 把业务异常转成友好的 JSON 错误（绝不向前端暴露 Python 报错堆栈）
# ============================================================
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import ChatRequest, ChatResponse
from services import chat_service
from services.chat_service import ChatError

router = APIRouter(prefix="/api", tags=["chat"])

# 单条消息最大长度（防止恶意超长文本拖垮服务）
MAX_MESSAGE_LENGTH = 500


def _error(code: str, message: str, status: int) -> JSONResponse:
    """统一错误响应格式：{ok: false, error: {code, message}}"""
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    """接收用户问题，返回 AI 回答 + 知识来源 + 模式标识"""
    message = payload.message.strip()

    # ---- 基础校验 ----
    if not message:
        return _error("EMPTY_MESSAGE", "请输入问题后再发送", 400)
    if len(message) > MAX_MESSAGE_LENGTH:
        return _error(
            "MESSAGE_TOO_LONG",
            f"问题不能超过 {MAX_MESSAGE_LENGTH} 个字，请精简后再试",
            400,
        )

    # ---- 调用业务层 ----
    try:
        result = await chat_service.handle_chat(message, session_id=payload.session_id)
    except ChatError as e:
        # 可预期业务错误（如 AI_MODE=real 但真实模型未接入）
        return _error(e.code, e.message, 502)
    except Exception:
        # 兜底：未知异常只给友好提示，不把 Python traceback 发给用户
        return _error("SERVER_ERROR", "导师服务开小差了，请稍后重试", 500)

    return ChatResponse(**result)
