# ============================================================
# Chat Service：聊天流程编排
# ------------------------------------------------------------
# 对应《最终系统架构》中的核心链路：
#   用户问题 → rag_service.retrieve() 检索资料
#            → ai_service.generate_reply() 生成回答
#            → 组装 answer + sources + retrieval_status + mode 返回
#
# api/chat.py 只调用本文件，不直接接触 ai/rag 两个服务，
# 将来替换 Mock 为真实 RAG 时，这一层就是"唯一需要微调的枢纽"。
#
# 第四阶段：
#   - session 记忆：内存 dict 保存最近 N 轮问答（LRU，上限 100 个会话），
#     支持"它还有呢"这类连续追问；历史仅供理解语境，prompt 已约束
#     不得把历史中的说法当作事实证据。
#   - retrieval_status：把检索质量显式暴露给前端与评测，
#     区分 语义命中 ok / 仅关键词命中 keyword_only / 无命中 empty / 检索降级 degraded。
# ============================================================
import config
from collections import OrderedDict
from services import ai_service, rag_service, study_log_store

# 转发 ai_service.ChatError，让 api 层只需 import 本文件
ChatError = ai_service.ChatError

# ---------------- 会话记忆（第四阶段：连续追问） ----------------
# 单进程内存实现：服务重启即清空；不做持久化（对话不是需要留存的数据）。
SESSION_MAX = 100        # 最多同时记住多少个会话（LRU 淘汰最久未用）
HISTORY_TURNS = 6        # 每个会话最多保留最近几轮问答

# 用 OrderedDict 的 move_to_end 做 LRU；dict 本身没有该方法
_sessions: "OrderedDict[str, list[dict]]" = OrderedDict()


def _get_history(session_id: str) -> list[dict]:
    """取该会话最近几轮历史（旧的在前）。"""
    return list(_sessions.get(session_id, []))[-HISTORY_TURNS:]


def _record_turn(session_id: str, question: str, answer: str) -> None:
    """把本轮问答写入会话历史；超上限时按 LRU 淘汰最久未用的会话。"""
    if session_id not in _sessions:
        if len(_sessions) >= SESSION_MAX:
            _sessions.popitem(last=False)  # 淘汰最久未使用
        _sessions[session_id] = []
    _sessions[session_id].append({"user": question, "ai": answer})
    _sessions[session_id] = _sessions[session_id][-HISTORY_TURNS:]
    _sessions.move_to_end(session_id)


def _retrieval_status(chunks: list[dict]) -> str:
    """根据检索结果计算状态：
    - degraded：检索服务本身未初始化（Chroma/Embedding 故障），结果不可信
    - empty：服务正常但没有任何命中
    - keyword_only：命中全部来自 BM25 字面匹配（distance 为 None），语义未确认
    - ok：至少一条语义（向量）命中
    """
    if not chunks:
        status = rag_service.get_status()
        return "empty" if status.get("initialized") else "degraded"
    if all(c.get("distance") is None for c in chunks):
        return "keyword_only"
    return "ok"


async def handle_chat(message: str, session_id: str = "demo-session") -> dict:
    """处理一次聊天请求，返回符合 ChatResponse 的字典。

    @param message 已去首尾空白的用户问题
    @param session_id 会话标识：同一会话的最近几轮问答会作为追问语境传给模型
    """
    # 第 1 步：RAG 检索相关资料（条数由 config.RETRIEVE_TOP_K 配置）
    chunks = rag_service.retrieve(message, top_k=config.RETRIEVE_TOP_K)
    retrieval_status = _retrieval_status(chunks)

    # 第 2 步：调用 AI Service 生成回答（带会话历史，支持连续追问）
    answer, sources = await ai_service.generate_reply(
        message, chunks, history=_get_history(session_id)
    )

    # 第 3 步：记录本轮问答（回答成功才记，避免错误回答污染后续语境）
    _record_turn(session_id, message, answer)

    # 第 3.5 步：追加「AI 学习记录」（MySpace 学习档案；写入失败静默，不影响聊天）
    study_log_store.append(
        question=message,
        answer=answer,
        retrieval_status=retrieval_status,
        source_count=len(sources),
        session_id=session_id,
        mode="mock" if config.use_mock() else "real",
    )

    # 第 4 步：组装响应（统一结构：answer / sources / retrieval_status / mode）
    return {
        "answer": answer,
        "sources": sources,
        "mode": "mock" if config.use_mock() else "real",
        "retrieval_status": retrieval_status,
    }
