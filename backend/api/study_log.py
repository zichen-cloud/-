# ============================================================
# AI 学习记录接口（MySpace 学习档案）
# ------------------------------------------------------------
# GET /api/study-log?limit=20   最近成功问答的摘要记录（按时间倒序）
#
# 写入在 chat_service.handle_chat 成功后自动发生（study_log_store.append），
# 这里只负责读取。记录只是学习过程的"足迹"，不参与 RAG 事实证据。
# ============================================================
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import StudyLogItem, StudyLogListResponse
from services import study_log_store

router = APIRouter(prefix="/api/study-log", tags=["study-log"])


@router.get("", response_model=StudyLogListResponse)
async def list_study_log(limit: int = 30):
    records = study_log_store.list_recent(limit)
    items = []
    for r in records:
        try:
            items.append(StudyLogItem(**r))
        except Exception:
            continue  # 单条损坏不拖垮整个列表
    return StudyLogListResponse(records=items)
