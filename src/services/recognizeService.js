/* ============================================================
 * 图像识别数据访问层（service）
 * ------------------------------------------------------------
 * 与 heritageService.js 的思路一致：页面组件不直接写 fetch，
 * 统一从这里调用后端接口。将来接口地址变化时只改这个文件。
 *
 * 开发环境说明：请求路径写 /api/...，
 * 由 vite.config.js 中的 proxy 转发到 http://127.0.0.1:8000，
 * 因此浏览器地址栏仍是 5173，不会遇到跨域问题。
 * ============================================================ */

/**
 * 健康检查：判断后端是否启动、当前是 mock 还是真实 AI 模式
 * @returns {{ok: boolean, mode: 'mock'|'ai', model: string|null}}
 */
export async function checkBackendHealth() {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('后端响应异常')
  return res.json()
}

/**
 * 上传图片并获取识别结果
 * @param {File} file 用户选择的图片文件
 * @returns {Promise<{ok: boolean, mode: string, data: object, disclaimer: string}>}
 * @throws {Error} 校验失败或后端报错时，抛出可直接展示给用户的中文信息
 */
export async function recognizeImage(file) {
  // FormData 是浏览器原生表单对象，用于以 multipart/form-data 上传文件
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/recognize', {
    method: 'POST',
    body: formData,
  })

  // 后端返回的不是 JSON（例如代理错误页）时，json() 会抛错，这里兜底
  const json = await res.json().catch(() => null)
  if (!json) {
    throw new Error('后端返回内容异常，请确认 FastAPI 服务已启动')
  }
  if (!res.ok || !json.ok) {
    throw new Error(json?.error?.message || '识别失败，请稍后重试')
  }
  return json
}
