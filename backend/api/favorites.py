# ============================================================
# 收藏接口（MySpace 收藏夹）
# ------------------------------------------------------------
# POST   /api/favorites        收藏 {type:'heritage'|'work', targetId}
# GET    /api/favorites        收藏列表（?type= 可按类型过滤，按时间倒序）
# DELETE /api/favorites/{id}   取消收藏
#
# 防伪造：快照由服务端在收藏时刻从事实来源生成——
#   heritage ← knowledge/items.json（知识库唯一事实来源）
#   work     ← work_store（服务端保存的作品记录）
# 前端只传 type + targetId，传什么名称/分类都会被忽略。
# ============================================================
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.schemas import (
    FavoriteCreateRequest,
    FavoriteDeletedResponse,
    FavoriteItem,
    FavoriteListResponse,
)
from services import knowledge_loader
from services.favorite_store import favorite_store
from services.work_store import work_store

router = APIRouter(prefix="/api/favorites", tags=["favorites"])

# 非遗快照保留的字段（够 MySpace 卡片展示与跳转详情页使用）
_HERITAGE_SNAPSHOT_FIELDS = (
    "name",
    "category",
    "province",
    "region",
    "level",
    "tags",
    "summary",
    "verified",
)


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


def _heritage_snapshot(target_id: str) -> dict | None:
    """从知识库 items.json 校验并生成非遗收藏快照。"""
    try:
        data = knowledge_loader.load_raw()
    except OSError:
        return None
    items = data.get("items", []) if isinstance(data, dict) else []
    for item in items:
        if isinstance(item, dict) and item.get("id") == target_id:
            return {k: item.get(k) for k in _HERITAGE_SNAPSHOT_FIELDS}
    return None


def _work_snapshot(target_id: str) -> dict | None:
    """从 work_store 校验并生成作品收藏快照。"""
    record = work_store.get(target_id)
    if record is None:
        return None
    return {
        "id": record.get("id", ""),
        "title": record.get("title", ""),
        "themeName": record.get("themeName", ""),
        "productTypeName": record.get("productTypeName", ""),
        "imageUrl": record.get("imageUrl", ""),
        "hasVideo": bool(record.get("videoUrl")),
        "workCreatedAt": record.get("createdAt", 0),
    }


@router.post("")
async def create_favorite(payload: FavoriteCreateRequest):
    target_id = payload.targetId.strip()
    if not target_id:
        return _error("EMPTY_TARGET", "收藏目标不能为空", 400)

    # 1. 服务端校验目标存在并生成快照（前端伪造的字段一概不采信）
    if payload.type == "heritage":
        snapshot = _heritage_snapshot(target_id)
        if snapshot is None:
            return _error("HERITAGE_NOT_FOUND", "该非遗项目不存在，无法收藏", 404)
    else:
        snapshot = _work_snapshot(target_id)
        if snapshot is None:
            return _error("WORK_NOT_FOUND", "该作品不存在或已被删除，无法收藏", 404)

    # 2. 幂等：同一目标已收藏时直接返回已有记录
    existing = favorite_store.find_by_target(payload.type, target_id)
    if existing is not None:
        return _favorite_ok(existing)

    # 3. 落盘
    try:
        record = favorite_store.add(payload.type, target_id, snapshot)
    except OSError:
        return _error("FAVORITE_WRITE_FAILED", "收藏保存失败：服务器存储目录不可写，请联系管理员", 500)
    return _favorite_ok(record)


def _favorite_ok(record: dict) -> JSONResponse:
    """统一响应壳：{ok:true, ...收藏字段}。前端据 ok 判断成功（曾因裸记录
    缺 ok 字段导致前端误报"收藏失败 HTTP 200"，与 works 接口同一教训）。"""
    return JSONResponse(content={"ok": True, **record})


@router.get("", response_model=FavoriteListResponse)
async def list_favorites(type: str | None = None):
    if type is not None and type not in ("heritage", "work"):
        return _error("INVALID_TYPE", "type 参数仅支持 heritage 或 work", 400)
    records = favorite_store.list_all(type)
    favorites = []
    for r in records:
        try:
            favorites.append(FavoriteItem(**r))
        except Exception:
            continue  # 单条损坏不拖垮整个列表
    return FavoriteListResponse(favorites=favorites)


@router.delete("/{fav_id}", response_model=FavoriteDeletedResponse)
async def delete_favorite(fav_id: str):
    ok = favorite_store.delete(fav_id)
    if not ok:
        return _error("FAVORITE_NOT_FOUND", "收藏不存在或已取消", 404)
    return FavoriteDeletedResponse(id=fav_id)
