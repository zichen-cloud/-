/* ============================================================
 * 聊天数据服务层
 * ------------------------------------------------------------
 * 页面组件不直接写 fetch，统一从这里调用后端接口。
 * 请求路径 /api/chat 由 Vite 代理转发到 http://127.0.0.1:8000，
 * 所以浏览器里不会遇到跨域问题。
 *
 * 错误处理原则：把各种失败（后端没启动 / 网络错误 / 服务异常）
 * 都转换成"用户能看懂的中文提示"抛出，页面直接展示。
 * ============================================================ */

/**
 * 查询后端状态（页面加载时用它显示"真实 AI / 演示模式"徽章）
 * @returns {Promise<{ok: boolean, mode: 'mock'|'ai', model: string|null}>}
 */
export async function checkChatHealth() {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('后端响应异常')
  return res.json()
}

/**
 * 发送一条聊天消息
 * @param {string} message 用户问题
 * @param {string} sessionId 会话标识
 * @returns {Promise<{answer: string, sources: Array, mode: string}>}
 * @throws {Error} 出错时抛出可直接展示的中文提示
 */
export async function sendChatMessage(message, sessionId = 'demo-session') {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    })
  } catch {
    // fetch 抛错通常是"连不上服务器"（后端没启动 / 网络断开）
    throw new Error(
      '无法连接导师服务。请确认后端已启动：在 backend 目录运行 uvicorn main:app --port 8000',
    )
  }

  // 后端返回的不是 JSON（比如代理错误页）时兜底
  const json = await res.json().catch(() => null)
  if (!json) {
    throw new Error('导师服务返回内容异常，请稍后重试')
  }
  if (!res.ok) {
    // 后端统一错误格式：{ ok: false, error: { code, message } }
    throw new Error(json?.error?.message || '导师服务暂时不可用，请稍后重试')
  }
  return json // { answer, sources, mode }
}
