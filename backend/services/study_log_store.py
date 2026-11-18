# ============================================================
# Study Log Store：AI 学习记录持久化（MySpace 学习档案，独立模块）
# ------------------------------------------------------------
# 用户每次成功获得 AI 导师回答，追加一条摘要记录到 data/study_log.json：
#   { ts, question, answerPreview, retrievalStatus, sourceCount, sessionId, mode }
#
# 设计要点：
#   - 单文件 JSON + threading.Lock 串行写（问答频率低，单文件足够）；
#   - 只存摘要（问题原文 + 答案前 ~80 字），不存完整答案，控制体积；
#   - 上限 STUDY_LOG_LIMIT 条（默认 200），超出丢弃最旧的；
#   - 写入失败静默（学习记录是附属数据，绝不能影响聊天主流程）。
# ============================================================
import json
import os
import threading
import time

import config

_lock = threading.Lock()


def append(
    *,
    question: str,
    answer: str,
    retrieval_status: str,
    source_count: int,
    session_id: str,
    mode: str,
) -> None:
    """追加一条学习记录（任何失败都静默，不影响聊天主流程）。"""
    record = {
        "ts": int(time.time() * 1000),
        "question": (question or "").strip()[:200],
        "answerPreview": (answer or "").strip()[:80],
        "retrievalStatus": retrieval_status or "",
        "sourceCount": int(source_count or 0),
        "sessionId": session_id or "",
        "mode": mode or "",
    }
    try:
        with _lock:
            records = _read_all()
            records.append(record)
            if len(records) > config.STUDY_LOG_LIMIT:
                records = records[-config.STUDY_LOG_LIMIT:]
            _write_all(records)
    except Exception:
        # 学习记录写入失败不影响聊天；下次提问会再尝试
        pass


def list_recent(limit: int = 30) -> list[dict]:
    """按时间倒序返回最近 N 条记录。"""
    limit = max(1, min(int(limit), config.STUDY_LOG_LIMIT))
    try:
        with _lock:
            records = _read_all()
    except Exception:
        return []
    return list(reversed(records))[:limit]


def _read_all() -> list[dict]:
    if not os.path.isfile(config.STUDY_LOG_FILE):
        return []
    with open(config.STUDY_LOG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _write_all(records: list[dict]) -> None:
    os.makedirs(os.path.dirname(config.STUDY_LOG_FILE), exist_ok=True)
    tmp = f"{config.STUDY_LOG_FILE}.tmp.{os.getpid()}.{threading.get_ident()}"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    os.replace(tmp, config.STUDY_LOG_FILE)
