# ============================================================
# Work Store：「我的作品」持久化存储（阶段五，独立模块）
# ------------------------------------------------------------
# 阶段一~四作品只保存在浏览器 localStorage，换浏览器/清缓存即丢失，也无法
# 跨设备查看。本模块把每件作品以「一作品一 JSON」落到 data/works/：
#
#   - 原子写（临时文件 + os.replace），崩溃不会产生半截 JSON；
#   - data/works 不在 /api/files 静态挂载范围内，只能通过 /api/works 访问；
#   - 字段保持宽松（提案原文 result 整体存档），未来接入真实视频/图片后，
#     作品保存逻辑无需改动——这里只负责存取，不关心产物是 demo 还是 real。
#
# 同一作品在浏览器里仍保留 localStorage 作为【后端不可用时的降级缓存】，
# 前端在首次连通后端时会做一次性迁移（见 studioService.migrateLocalWorks）。
# ============================================================
import json
import os
import re
import threading
import time
import uuid

import config

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


class WorkStore:
    def __init__(self, directory: str):
        self._dir = directory
        self._lock = threading.Lock()

    def _path(self, work_id: str) -> str | None:
        if not work_id or not _SAFE_ID.match(work_id):
            return None
        return os.path.join(self._dir, f"{work_id}.json")

    @staticmethod
    def _atomic_write(path: str, record: dict) -> None:
        tmp = f"{path}.tmp.{os.getpid()}.{threading.get_ident()}"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

    def create(self, data: dict) -> dict:
        """保存一件新作品。服务端生成 id / createdAt，返回完整记录。"""
        os.makedirs(self._dir, exist_ok=True)
        record = dict(data)
        record["id"] = f"work_{uuid.uuid4().hex[:12]}"
        record["createdAt"] = int(time.time() * 1000)
        path = self._path(record["id"])
        with self._lock:
            self._atomic_write(path, record)
        return record

    def upsert(self, record: dict) -> dict:
        """按记录自带的 id 落盘（用于 localStorage → 服务端迁移，保留原 id/时间）。"""
        wid = str(record.get("id") or "").strip()
        if not wid:
            return self.create(record)
        if not _SAFE_ID.match(wid):
            wid = f"work_{uuid.uuid4().hex[:12]}"
            record["id"] = wid
        record.setdefault("createdAt", int(time.time() * 1000))
        os.makedirs(self._dir, exist_ok=True)
        path = self._path(wid)
        with self._lock:
            self._atomic_write(path, record)
        return record

    def list_all(self) -> list[dict]:
        """按保存时间倒序返回全部作品。"""
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
        items.sort(key=lambda w: w.get("createdAt", 0), reverse=True)
        return items

    def get(self, work_id: str) -> dict | None:
        path = self._path(work_id)
        if path is None or not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                record = json.load(f)
            return record if isinstance(record, dict) else None
        except (OSError, json.JSONDecodeError):
            return None

    def delete(self, work_id: str) -> bool:
        path = self._path(work_id)
        if path is None or not os.path.exists(path):
            return False
        with self._lock:
            try:
                os.remove(path)
                return True
            except OSError:
                return False


# 全局单例
work_store = WorkStore(config.WORKS_DIR)
