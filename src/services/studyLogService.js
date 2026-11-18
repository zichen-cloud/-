/* ============================================================
 * AI 学习记录服务层（MySpace 学习档案）
 * ------------------------------------------------------------
 * 对接后端 GET /api/study-log：最近成功问答的摘要记录。
 * 记录由后端在每次聊天成功后自动写入，这里只读。
 * ============================================================ */

/**
 * 获取最近的学习记录（按时间倒序）。
 * @param {number} [limit=20]
 * @returns {Promise<Array<{ts, question, answerPreview, retrievalStatus, sourceCount, sessionId, mode}>>}
 */
export async function listStudyLog(limit = 20) {
  const resp = await fetch(`/api/study-log?limit=${encodeURIComponent(limit)}`)
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error?.message || `学习记录获取失败（HTTP ${resp.status}）`)
  }
  return Array.isArray(json.records) ? json.records : []
}
