# ============================================================
# Task Store：后台任务记录的持久化存储（阶段五，独立通用模块）
# ------------------------------------------------------------
# 阶段三/四的视频任务只存在内存 dict 里，后端一重启任务状态就全部丢失。
# 本模块把每条任务记录以「一任务一 JSON 文件」的方式落到 data/tasks/：
#
#   1. 运行期仍保留内存热缓存（查询零 IO），每次更新同步原子写盘
#      （临时文件 + os.replace，进程崩溃也不会留下半截 JSON）；
#   2. 后端启动时 load_all() 读回全部记录，并把 queued/processing
#      的任务标记为「服务重启导致中断」——后台 asyncio 任务不会跨进程存活，
#      诚实告知用户需要重新生成，而不是假装还在合成；
#   3. done / failed 的历史记录重启后仍可查询（list / get）。
#
# 刻意与具体业务解耦：任何后台任务都可以复用本类，记录字段由调用方决定。
# ============================================================
import json
import os
import re
import threading
import time

import config

# 任务 id 只允许这三类字符（拼文件名前强制校验，防目录穿越）
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


class TaskStore:
    def __init__(self, directory: str, interrupted_message: str):
        self._dir = directory
        self._interrupted_message = interrupted_message
        self._cache: dict[str, dict] = {}
        self._lock = threading.Lock()

    def _path(self, task_id: str) -> str | None:
        if not task_id or not _SAFE_ID.match(task_id):
            return None
        return os.path.join(self._dir, f"{task_id}.json")

    @staticmethod
    def _atomic_write(path: str, record: dict) -> None:
        """临时文件 + os.replace 原子落盘，避免并发/崩溃产生半截 JSON。"""
        tmp = f"{path}.tmp.{os.getpid()}.{threading.get_ident()}"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

    def create(self, task_id: str, record: dict) -> None:
        """登记一条新任务并立即落盘。"""
        path = self._path(task_id)
        if path is None:
            raise ValueError(f"非法任务 id：{task_id!r}")
        os.makedirs(self._dir, exist_ok=True)
        now = int(time.time() * 1000)
        # id / 时间戳由存储层统一写入（放最后强制覆盖，保证记录与文件名一致）
        full = {**record, "id": task_id, "createdAt": now, "updatedAt": now}
        with self._lock:
            self._cache[task_id] = full
            self._atomic_write(path, full)

    def update(self, task_id: str, **patch) -> None:
        """更新任务字段并落盘；任务不存在时静默忽略（与旧内存版行为一致）。"""
        path = self._path(task_id)
        if path is None:
            return
        with self._lock:
            current = self._cache.get(task_id)
            if current is None:
                return
            current.update(patch)
            current["updatedAt"] = int(time.time() * 1000)
            try:
                self._atomic_write(path, current)
            except OSError:
                # 落盘失败不应让正在运行的合成流程崩溃：内存状态仍可用，
                # 只是重启后该条记录丢失；下一次更新会再次尝试写盘。
                pass

    def get(self, task_id: str) -> dict | None:
        with self._lock:
            task = self._cache.get(task_id)
            # 返回浅拷贝，避免调用方意外改动缓存
            return dict(task) if task is not None else None

    def list(self, limit: int = 30) -> list[dict]:
        """按创建时间倒序返回历史任务（含已完成/失败的持久记录）。"""
        with self._lock:
            items = [dict(t) for t in self._cache.values()]
        items.sort(key=lambda t: t.get("createdAt", 0), reverse=True)
        return items[: max(1, limit)]

    def load_all(self) -> int:
        """启动时从磁盘读回全部任务，并把中断在 queued/processing 的标记失败。

        @return 被标记为中断的任务条数
        """
        os.makedirs(self._dir, exist_ok=True)
        recovered = 0
        with self._lock:
            for name in os.listdir(self._dir):
                if not name.endswith(".json"):
                    continue
                task_id = name[:-5]
                if not _SAFE_ID.match(task_id):
                    continue
                try:
                    with open(os.path.join(self._dir, name), "r", encoding="utf-8") as f:
                        record = json.load(f)
                    if not isinstance(record, dict):
                        continue
                    record.setdefault("id", task_id)
                except (OSError, json.JSONDecodeError):
                    # 损坏文件不阻断启动，跳过即可
                    continue
                if record.get("status") in ("queued", "processing"):
                    record["status"] = "failed"
                    record["error"] = self._interrupted_message
                    record["message"] = "任务因服务重启而中断"
                    record["interrupted"] = True
                    record["updatedAt"] = int(time.time() * 1000)
                    try:
                        self._atomic_write(os.path.join(self._dir, name), record)
                    except OSError:
                        pass
                    recovered += 1
                self._cache[task_id] = record
        return recovered


# 全局单例：视频合成任务（video_service 使用）
video_task_store = TaskStore(
    config.TASKS_DIR,
    "服务已重启，上一次视频合成任务被中断，请重新生成（历史成片若已生成可继续使用）。",
)
