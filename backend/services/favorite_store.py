# ============================================================
# Favorite Store：收藏记录持久化（MySpace 收藏夹，独立模块）
# ------------------------------------------------------------
# 每条收藏一个 JSON 落到 data/favorites/（与 works 同一套约定）：
#   - 原子写（临时文件 + os.replace）；
#   - 不在 /api/files 静态挂载范围内，只能通过 /api/favorites 访问；
#   - 记录里的 snapshot 由服务端在收藏时刻从事实来源（knowledge/items.json、
#     work_store）生成，前端伪造的名称/分类不会进入存储。
# ============================================================
import json
import os
import re
import threading
import time
import uuid

import config

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


class FavoriteStore:
    def __init__(self, directory: str):
        self._dir = directory
        self._lock = threading.Lock()

    def _path(self, fav_id: str) -> str | None:
        if not fav_id or not _SAFE_ID.match(fav_id):
            return None
        return os.path.join(self._dir, f"{fav_id}.json")

    @staticmethod
    def _atomic_write(path: str, record: dict) -> None:
        tmp = f"{path}.tmp.{os.getpid()}.{threading.get_ident()}"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

    def find_by_target(self, fav_type: str, target_id: str) -> dict | None:
        """同一 (type, targetId) 只保留一条收藏（重复收藏时幂等返回已有记录）。"""
        target_id = str(target_id or "")
        if not _SAFE_ID.match(target_id):
            return None
        for record in self.list_all():
            if record.get("type") == fav_type and record.get("targetId") == target_id:
                return record
        return None

    def add(self, fav_type: str, target_id: str, snapshot: dict) -> dict:
        """新增一条收藏（幂等：已收藏同一目标时返回已有记录，不重复建）。"""
        os.makedirs(self._dir, exist_ok=True)
        record = {
            "id": f"fav_{uuid.uuid4().hex[:12]}",
            "type": fav_type,
            "targetId": target_id,
            "createdAt": int(time.time() * 1000),
            "snapshot": snapshot,
        }
        path = self._path(record["id"])
        with self._lock:
            self._atomic_write(path, record)
        return record

    def list_all(self, fav_type: str | None = None) -> list[dict]:
        """按收藏时间倒序返回全部（或指定类型）收藏。"""
        os.makedirs(self._dir, exist_ok=True)
        items: list[dict] = []
        with self._lock:
            for name in os.listdir(self._dir):
                if not name.endswith(".json"):
                    continue
                try:
                    with open(os.path.join(self._dir, name), "r", encoding="utf-8") as f:
                        record = json.load(f)
                    if isinstance(record, dict) and record.get("id"):
                        items.append(record)
                except (OSError, json.JSONDecodeError):
                    continue
        if fav_type:
            items = [r for r in items if r.get("type") == fav_type]
        items.sort(key=lambda r: r.get("createdAt", 0), reverse=True)
        return items

    def get(self, fav_id: str) -> dict | None:
        path = self._path(fav_id)
        if path is None or not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                record = json.load(f)
            return record if isinstance(record, dict) else None
        except (OSError, json.JSONDecodeError):
            return None

    def delete(self, fav_id: str) -> bool:
        path = self._path(fav_id)
        if path is None or not os.path.exists(path):
            return False
        with self._lock:
            try:
                os.remove(path)
                return True
            except OSError:
                return False


# 全局单例
favorite_store = FavoriteStore(config.FAVORITES_DIR)
