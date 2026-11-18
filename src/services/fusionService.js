/* ============================================================
 * 跨界融合创作数据服务
 * ------------------------------------------------------------
 * 与后端 /api/fusion/* 对应：
 *   analyzeFusion()  多非遗要素拆解 + 融合方案（不含图）
 *   generateFusionImages()  为方案生成产品效果图
 *
 * 两个接口都带超时保护：真实图像生成单次可达 1-2 分钟，
 * 但不会无限等待；超时后给出可读提示，用户可以重试。
 * 失败统一抛中文错误，由页面展示。
 * ============================================================ */

const ANALYZE_TIMEOUT_MS = 150_000
const IMAGES_SUBMIT_TIMEOUT_MS = 30_000
const IMAGES_POLL_INTERVAL_MS = 2_000
const IMAGES_MAX_WAIT_MS = 10 * 60 * 1000

async function readJson(res, fallbackMessage) {
  let json = null
  try {
    json = await res.json()
  } catch {
    throw new Error(fallbackMessage)
  }
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error?.message || fallbackMessage)
  }
  return json
}

async function postJson(path, body, timeoutMs, fallbackMessage, timeoutMessage) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    return await readJson(res, fallbackMessage)
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(timeoutMessage)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export async function analyzeFusion({ heritages, productType, productName, styleName, ratios, idea, count = 2 }) {
  return postJson(
    '/api/fusion/analyze',
    { heritages, productType, productName, styleName, ratios, idea, count },
    ANALYZE_TIMEOUT_MS,
    '融合分析失败，请稍后重试',
    '融合分析超时了，请稍后重试或减少非遗数量',
  )
}

/**
 * 生成融合方案效果图。
 *
 * 真实图片模型单张 40~90 秒，同步等待会被网关/浏览器判超时，
 * 因此后端改为「提交任务 → 轮询状态」：
 *   1. POST /api/fusion/images 立即返回 taskId
 *   2. 每隔 2 秒查询一次，直到 succeeded / failed / 超过 10 分钟
 * 轮询期间通过 onProgress({ stage, progress }) 回报进度。
 */
export async function generateFusionImages({ proposals, themeName, productName, styleName, onProgress }) {
  const started = await postJson(
    '/api/fusion/images',
    { proposals, themeName, productName, styleName },
    IMAGES_SUBMIT_TIMEOUT_MS,
    '效果图生成失败，请稍后重试',
    '提交生成任务超时，请检查网络后重试',
  )

  // 兼容后端仍返回同步结果的情况
  if (!started.taskId) {
    return { proposals: started.proposals || [], notice: started.notice || '' }
  }

  const deadline = Date.now() + IMAGES_MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, IMAGES_POLL_INTERVAL_MS))

    let res
    try {
      const resp = await fetch(`/api/fusion/images/${started.taskId}`)
      res = await resp.json()
    } catch {
      throw new Error('查询生成进度失败，请检查网络后重试')
    }

    if (res?.ok === false) {
      throw new Error(res?.error?.message || '效果图生成失败，请稍后重试')
    }
    if (res.status === 'succeeded') {
      return { proposals: res.proposals || [], notice: res.notice || '' }
    }
    if (res.status === 'failed') {
      throw new Error(res?.error?.message || '效果图生成失败，请稍后重试')
    }

    onProgress?.({ stage: res.stage || '正在生成效果图', progress: res.progress || 0 })
  }

  throw new Error('效果图生成等待超时（已等待 10 分钟），请稍后重试')
}
