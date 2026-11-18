# ============================================================
# 「我的作品」接口（阶段五：作品持久化）
# ------------------------------------------------------------
# POST   /api/works          保存一件作品（正常新建；带 id 时为迁移/覆盖）
# GET    /api/works          作品列表（按保存时间倒序）
# GET    /api/works/{id}     单件作品详情
# DELETE /api/works/{id}     删除一件作品
#
# 统一响应壳：成功 {ok:true,...}，失败 {ok:false,error:{code,message}}
# ============================================================
import re

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import (
    WorkDeletedResponse,
    WorkItem,
    WorkListResponse,
    WorkSaveRequest,
)
from services.work_store import work_store

router = APIRouter(prefix="/api/works", tags=["works"])

# 占位 / 随意填写的作品名，保存时直接拒绝，避免"123"这类名称进入作品库
_PLACEHOLDER_TITLES = {
    "test", "test123", "admin", "demo", "user", "guest", "sample",
    "123", "1234", "12345", "123456", "111", "abc", "aaa", "xxx",
    "匿名", "未命名", "无名", "佚名",
}


def _title_error(title: str) -> str:
    """作品标题校验：必须是完整、可识别的名称。"""
    if len(title) < 2:
        return "作品标题至少 2 个字，请填写完整名称"
    if not re.search(r"[\u4e00-\u9fa5A-Za-z]", title):
        return "作品标题不能只用数字或符号，请填写完整名称"
    if title.lower() in _PLACEHOLDER_TITLES:
        return "请填写完整、可识别的作品名称，不要使用占位名称"
    return ""


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


@router.post("", response_model=WorkItem)
async def save_work(payload: WorkSaveRequest):
    """保存作品。

    - 正常新建：服务端生成 work_xxx 的 id 与 createdAt；
    - localStorage 迁移：请求体带 id/createdAt 时保留原值（store 层 upsert）。
    """
    if not payload.title.strip():
        return _error("EMPTY_TITLE", "作品标题不能为空", 400)
    title = payload.title.strip()
    title_error = _title_error(title)
    if title_error:
        return _error("INVALID_TITLE", title_error, 400)
    data = payload.model_dump()
    data["title"] = title
    try:
        record = work_store.upsert(data)
    except OSError:
        return _error("WORK_WRITE_FAILED", "作品保存失败：服务器存储目录不可写，请联系管理员", 500)
    return WorkItem(**record)


@router.get("", response_model=WorkListResponse)
async def list_works():
    try:
        records = work_store.list_all()
    except OSError:
        return _error("WORK_READ_FAILED", "作品读取失败，请稍后重试", 500)
    # 逐条校验，过滤掉意外损坏的记录而不是让整个列表 500
    works = []
    for r in records:
        try:
            works.append(WorkItem(**r))
        except Exception:
            continue
    return WorkListResponse(works=works)


@router.get("/{work_id}", response_model=WorkItem)
async def get_work(work_id: str):
    record = work_store.get(work_id)
    if record is None:
        return _error("WORK_NOT_FOUND", "作品不存在或已被删除", 404)
    return WorkItem(**record)


@router.delete("/{work_id}", response_model=WorkDeletedResponse)
async def delete_work(work_id: str):
    ok = work_store.delete(work_id)
    if not ok:
        return _error("WORK_NOT_FOUND", "作品不存在或已被删除", 404)
    return WorkDeletedResponse(id=work_id)
