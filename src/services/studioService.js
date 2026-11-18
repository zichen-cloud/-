/* ============================================================
 * 创作工坊数据服务层
 * ------------------------------------------------------------
 * 目前包含两类能力：
 *   1. generateDesignPlan：mock 生成设计方案（模拟网络延迟与失败）
 *   2. 作品本地存储：localStorage 增删查（无需后端即可保存）
 *
 * 将来接入 FastAPI 时：
 *   - 把 generateDesignPlan 内部改为 fetch('/api/studio/generate-plan')
 *   - 把作品存储改为 /api/works 接口
 * 页面组件无需改动。
 * ============================================================ */
import {
  getThemeById,
  getCreateTypeById,
  getProductTypeById,
  getStyleById,
} from '../data/studioOptions.js'

/* localStorage 的键名（带版本号，将来数据结构变化时可以平滑升级） */
const STORAGE_KEY = 'feiyi_works_v1'

/* 数字作品声明（成功结果与已保存作品都展示这一条，统一口径） */
export const DIGITAL_WORK_DISCLAIMER =
  '本方案是 AI 辅助生成的数字设计参考，与非遗传承人以传统技艺手工完成的工艺实物有本质区别；' +
  '它不代表任何非遗项目的官方设计、授权或鉴定结果，传统元素的历史源流与文化寓意请以权威资料为准。'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------
 * 一、设计方案生成（优先真实 AI，失败时降级 Mock）
 * ---------------------------------------------------------- */

/**
 * 根据表单内容生成结构化设计方案。
 * 优先调用后端 POST /api/studio/generate-plan（真实 AI），
 * 后端不可用时降级到本地 Mock 模板生成。
 * @param {object} form { title, theme, createType, style, requirement }
 * @returns {Promise<{mode:'mock'|'ai', plan: object, promptSummary: string}>}
 */
export async function generateDesignPlan(form) {
  const theme = getThemeById(form.theme)
  const createType = getCreateTypeById(form.createType)
  const style = getStyleById(form.style)

  // 组装后端需要的完整字段（含展示名称，避免后端再查一遍）
  const payload = {
    title: form.title.trim(),
    theme: form.theme,
    createType: form.createType,
    style: form.style,
    requirement: form.requirement.trim(),
    themeName: theme?.name ?? '',
    themeTagline: theme?.tagline ?? '',
    createTypeName: createType?.name ?? '',
    createTypeHint: createType?.hint ?? '',
    styleName: style?.name ?? '',
    styleHint: style?.hint ?? '',
  }

  try {
    const resp = await fetch('/api/studio/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err?.error?.message || `HTTP ${resp.status}`)
    }

    const data = await resp.json()
    return {
      mode: data.mode || 'ai',
      promptSummary: data.promptSummary,
      plan: data.plan,
    }
  } catch (e) {
    // 后端不可用 → 降级到本地 Mock（演示模式）
    console.warn('[studioService] 后端不可用，降级到 Mock 模式:', e.message)
    return _generateMockPlan(form)
  }
}

/* ------------------------------------------------------------
 * 二、Mock 设计方案生成（后端不可用时的降级方案）
 * ---------------------------------------------------------- */

/**
 * 根据表单内容生成结构化设计方案（mock）。
 * @param {object} form { title, theme, createType, style, requirement }
 * @returns {Promise<{mode:'mock', plan: object, promptSummary: string}>}
 */
async function _generateMockPlan(form) {
  // 模拟真实网络请求的耗时（页面在这段时间展示分步进度）
  await delay(1800)

  // 【团队测试入口】在"创作需求"里输入"模拟失败"三个字，
  // 即可看到失败状态，方便测试异常分支，无需停掉服务。
  if (form.requirement.includes('模拟失败')) {
    throw new Error('模拟的服务异常：生成服务暂时不可用，请稍后重试。')
  }

  const theme = getThemeById(form.theme)
  const createType = getCreateTypeById(form.createType)
  const style = getStyleById(form.style)

  // 组装"文生图提示词"
  const promptSummary = [
    `${createType.name}设计方案`,
    `以中国非遗「${theme.name}」为灵感`,
    `${style.name}风格`,
    `核心元素：${theme.elements.map((e) => e.name).join('、')}`,
    `参考配色：${theme.palette.map((c) => c.name).join('、')}`,
    form.requirement.trim() ? `具体需求：${form.requirement.trim()}` : '',
  ]
    .filter(Boolean)
    .join('；')

  // 设计说明（只描述设计做法，不编造历史故事）
  const designBrief =
    `本方案面向「${createType.name}」场景，从「${theme.name}」中提取 ${theme.elements
      .map((e) => `「${e.name}」`)
      .join('、')} 等可识别的视觉语言，` +
    `以「${style.name}」的方式进行现代转译：保留传统元素的形式特征，` +
    `简化繁复细节并调整版式节奏，使其适配${createType.hint}。` +
    (form.requirement.trim()
      ? `针对你的需求「${form.requirement.trim()}」，建议先以小尺寸稿验证主体辨识度，再扩展到完整应用。`
      : '建议先以小尺寸稿验证主体辨识度，再扩展到完整应用。')

  // 配色建议：在主题色板基础上附上使用方式
  const colorUsage = ['主色：用于主体图形与大面积色块', '辅助色：用于点缀、分隔与重点信息', '底色：用于背景与留白区域']
  const colorPalette = theme.palette.map((c, i) => ({ ...c, usage: colorUsage[i] }))

  // 构图建议：风格专属建议 + 一条通用建议
  const composition = [
    ...style.composition,
    '先确定一个明确的视觉主体，再安排纹样与文字层级，避免元素过多导致重点不清。',
  ]

  // 传统元素说明：只描述视觉形式特征，并附统一的核实提醒
  const traditionalElements = theme.elements.map((e) => ({
    ...e,
    verifyNote: '以上为视觉形式层面的客观描述；该元素的历史源流与文化寓意请查证权威资料后再使用。',
  }))

  return {
    mode: 'mock',
    promptSummary,
    plan: {
      designBrief,
      colorPalette,
      composition,
      traditionalElements,
    },
  }
}

/* ------------------------------------------------------------
 * 一之二、产品效果图提案（阶段一）
 * ---------------------------------------------------------- */

/**
 * 上传产品参考图到后端（后端做类型/大小/图片结构校验并重编码）。
 * @param {File} file
 * @returns {Promise<{id:string, url:string, width:number, height:number}>}
 */
export async function uploadReferenceImage(file) {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch('/api/studio/upload-reference', {
    method: 'POST',
    body: formData,
  })
  const json = await resp.json().catch(() => null)
  if (!json) {
    throw new Error('后端返回内容异常，请确认 FastAPI 服务已启动')
  }
  if (!resp.ok || !json.ok) {
    throw new Error(json?.error?.message || '参考图上传失败，请稍后重试')
  }
  return { id: json.referenceId, url: json.url, width: json.width, height: json.height }
}

/**
 * 生成 3 个产品效果图提案。
 * 优先调用后端（真实 AI 文案 + demo/real 效果图）；
 * 仅在【后端连不上】时降级为本地 canvas 演示图，业务错误（如校验失败）不降级。
 *
 * real 图片模式（wan2.7-image）下后端立即返回 {taskId, status:'processing'}，
 * 真实生图 3 张约 1~2 分钟，这里轮询 GET /api/studio/proposal-status/{taskId}
 * 直到 succeeded（返回与 demo 同构的 result）或 failed（抛中文错误）。
 * @returns {Promise<{mode, imageMode, promptSummary, proposals: [], disclaimer: string}>}
 */
export async function generateProposals(form) {
  const theme = getThemeById(form.theme)
  const createType = getCreateTypeById(form.createType)
  const productType = getProductTypeById(form.productType)
  const style = getStyleById(form.style)

  const payload = {
    title: form.title.trim(),
    theme: form.theme,
    createType: form.createType,
    productType: form.productType,
    style: form.style,
    requirement: form.requirement.trim(),
    referenceId: form.reference?.id || '',
    themeName: theme?.name ?? '',
    themeTagline: theme?.tagline ?? '',
    createTypeName: createType?.name ?? '',
    createTypeHint: createType?.hint ?? '',
    productTypeName: productType?.name ?? '',
    productTypeHint: productType?.hint ?? '',
    styleName: style?.name ?? '',
    styleHint: style?.hint ?? '',
  }

  let resp
  try {
    resp = await fetch('/api/studio/generate-proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    // 只有网络层失败（后端没启动）才降级本地演示
    console.warn('[studioService] 后端不可用，降级为本地演示提案:', e.message)
    return _generateLocalProposals(form)
  }

  const json = await resp.json().catch(() => null)
  if (!resp.ok || (!json?.ok && !json?.taskId)) {
    // 业务错误（参数/AI 报错）直接抛出，不伪装成成功
    throw new Error(json?.error?.message || `生成失败（HTTP ${resp.status}）`)
  }

  // real 模式：任务化返回 taskId → 轮询直到完成（约 1~2 分钟，上限 6 分钟）
  if (json.taskId && !json.ok) {
    return _pollProposalTask(json.taskId)
  }

  return {
    mode: json.mode,
    imageMode: json.imageMode,
    imageModel: json.imageModel || '',
    promptSummary: json.promptSummary,
    proposals: json.proposals,
    disclaimer: json.disclaimer || '',
  }
}

const PROPOSAL_POLL_INTERVAL_MS = 2500
const PROPOSAL_POLL_MAX_MS = 6 * 60 * 1000 // 真实生图偶发排队，放宽到 6 分钟

async function _pollProposalTask(taskId) {
  const deadline = Date.now() + PROPOSAL_POLL_MAX_MS
  while (Date.now() < deadline) {
    await delay(PROPOSAL_POLL_INTERVAL_MS)
    const resp = await fetch(`/api/studio/proposal-status/${encodeURIComponent(taskId)}`)
    const json = await resp.json().catch(() => null)
    if (!json) throw new Error(`状态查询失败（HTTP ${resp.status}）`)
    if (resp.status === 404) {
      // 任务丢失（服务重启等）：把后端中文提示原样抛给用户
      throw new Error(json?.error?.message || '提案任务不存在或已过期，请重新生成')
    }
    if (json.status === 'succeeded' && json.result) {
      return json.result
    }
    if (json.status === 'failed') {
      throw new Error(json?.error?.message || '提案生成失败，请稍后重试')
    }
    // processing → 继续轮询（stage/progress 可后续接入进度展示）
  }
  throw new Error('生成超时，真实生图偶尔排队较久，请稍后重试')
}

/* ------ 后端不可用时的本地降级：canvas 绘制带水印演示图 ------ */

function _hexToRgb(hex) {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return [192, 57, 43]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

function _rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function _lighten(c, ratio) {
  return c.map((v) => Math.round(v + (245 - v) * ratio))
}

function _drawLocalDemoImage(index, paletteHex, labels) {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const colors = paletteHex.map(_hexToRgb)
  const main = colors[0]
  const sub = colors[1] || colors[0]
  const dark = colors[2] || [42, 39, 34]

  // 背景
  ctx.fillStyle = '#FAF7F1'
  ctx.fillRect(0, 0, size, size)

  // 装饰图形（三种布局）
  ctx.fillStyle = _rgb(_lighten(main, 0.55))
  if (index === 0) {
    ctx.beginPath(); ctx.arc(512, 320, 280, 0, Math.PI * 2); ctx.fill()
  } else if (index === 1) {
    ctx.fillRect(0, 0, 470, 470)
  } else {
    ctx.fillRect(0, 120, size, 130)
    ctx.strokeStyle = _rgb(main); ctx.lineWidth = 18
    ctx.beginPath(); ctx.arc(512, 512, 220, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.fillStyle = _rgb(_lighten(sub, 0.6))
  ctx.beginPath(); ctx.arc(830, 600, 110, 0, Math.PI * 2); ctx.fill()

  // 中央卡片
  ctx.fillStyle = '#FFFFFF'
  const r = 36
  ctx.beginPath()
  ctx.roundRect(152, 330, 720, 370, r)
  ctx.fill()
  ctx.strokeStyle = _rgb(_lighten(dark, 0.55))
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = _rgb(dark)
  ctx.font = '600 58px "Microsoft YaHei", sans-serif'
  ctx.fillText(`演示提案 ${String(index + 1).padStart(2, '0')}`, 512, 440)
  ctx.fillStyle = _rgb(main)
  ctx.font = '38px "Microsoft YaHei", sans-serif'
  ctx.fillText(labels.subtitle, 512, 520)
  ctx.fillStyle = 'rgb(120,112,100)'
  ctx.font = '30px "Microsoft YaHei", sans-serif'
  ctx.fillText(labels.direction, 512, 590)

  // 底部水印条（明确标注非真实生成）
  ctx.fillStyle = _rgb(dark)
  ctx.fillRect(0, 880, size, 144)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '42px "Microsoft YaHei", sans-serif'
  ctx.fillText('演示图 · 非真实 AI 生成', 512, 970)

  return canvas.toDataURL('image/png')
}

function _generateLocalProposals(form) {
  const theme = getThemeById(form.theme)
  const product = getProductTypeById(form.productType)
  const style = getStyleById(form.style)
  // 产品类型选填：未选择时以"作品/画面"表述，文案依然通顺
  const carrier = product?.name ?? '作品'
  const palette = (theme?.palette || [{ hex: '#C0392B' }, { hex: '#D8A7B1' }, { hex: '#2A2722' }]).map((c) => c.hex)

  const directions = [
    {
      title: `${theme?.name ?? '非遗'}·主韵`,
      concept: `（本地演示）把「${theme?.name ?? '非遗'}」的主体造型放大居中，作为${carrier}的视觉核心，配合${style?.name ?? ''}处理，第一眼就能认出非遗来源。`,
      elements: `主体纹样提取后做适度简化，保留原有形式特征，居中布置在${carrier}的主要展示面。`,
      composition: ['主体居中放大，占展示面约一半', '四周留白，不额外堆装饰'],
    },
    {
      title: `${theme?.name ?? '非遗'}·边饰`,
      concept: `（本地演示）把主题纹理转化为连续边饰，环绕${carrier}边缘，使用时慢慢看到细节，含蓄有仪式感。`,
      elements: `典型纹理提取为二方连续图案，沿${carrier}边缘排布，主面保持干净。`,
      composition: ['纹样沿边缘形成装饰带', '主展示面大面积留白'],
    },
    {
      title: `${theme?.name ?? '非遗'}·小景`,
      concept: `（本地演示）取一个小巧局部元素做成角落小景，像盖在${carrier}上的印记，轻盈日常。`,
      elements: `选取轮廓最清晰的局部元素，等比缩小后放在${carrier}一角。`,
      composition: ['小图案置于角落，占比不超过两成', '搭配细线平衡画面'],
    },
  ]

  const proposals = directions.map((d, i) => ({
    id: `p${i + 1}`,
    imageUrl: _drawLocalDemoImage(
      i,
      palette,
      {
        subtitle: [theme?.name, product?.name].filter(Boolean).join(' · '),
        direction: `${style?.name ?? ''}风格设计方向`,
      },
    ),
    proposalTitle: d.title,
    concept: d.concept,
    elements: d.elements,
    composition: d.composition,
    colorPalette: (theme?.palette || []).map((c) => ({ ...c, usage: '' })),
  }))

  return {
    mode: 'mock',
    imageMode: 'demo',
    imageModel: '',
    promptSummary: `${product?.name ? `${product.name}效果图` : '设计方案'}（本地演示） · ${theme?.name ?? ''} · ${style?.name ?? ''}`,
    proposals,
    disclaimer: DIGITAL_WORK_DISCLAIMER,
  }
}

/* ------------------------------------------------------------
 * 一之三、产品介绍视频（阶段三）+ AI 配音（阶段四）
 * ---------------------------------------------------------- */

/**
 * 根据作品与所选方案生成 4 句口播旁白。
 * @param {object} ctx { title, themeName, productTypeName, styleName,
 *                       proposalTitle, concept, elements }
 * @returns {Promise<{sentences: string[], mode: 'ai'|'mock'}>}
 */
export async function generateNarration(ctx) {
  const resp = await fetch('/api/studio/generate-narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  })
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error?.message || `旁白生成失败（HTTP ${resp.status}）`)
  }
  return { sentences: json.sentences, mode: json.mode }
}

/**
 * 逐句调用真实 TTS 合成配音，返回每句 mp3 地址与时长。
 * 未配置 TTS Key 时后端返回中文业务错误（这里原样抛出，绝不伪造音频）。
 * @param {{sentences: string[], voice: string, speed: string}} payload
 * @returns {Promise<object>} { audioId, sentenceUrls, durations, totalDuration,
 *                              voice, voiceName, speed, speedName, mode }
 */
export async function generateAudio(payload) {
  const resp = await fetch('/api/studio/generate-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error?.message || `配音生成失败（HTTP ${resp.status}）`)
  }
  return json
}

/**
 * 启动产品介绍视频合成任务，返回 taskId。
 * @param {object} ctx { title, themeName, productTypeName, styleName,
 *                       proposalTitle, concept, elements, imageUrl, colorPalette,
 *                       audioSentenceUrls?, audioDurations?, audioSentences?,
 *                       voiceName?, speedName? }
 * @returns {Promise<{taskId: string}>}
 */
export async function generateVideo(ctx) {
  const resp = await fetch('/api/studio/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  })
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error?.message || `视频任务创建失败（HTTP ${resp.status}）`)
  }
  return { taskId: json.taskId }
}

/**
 * 轮询视频合成任务状态。
 * @param {string} taskId
 * @returns {Promise<{status, progress, message, error, videoUrl, duration, mode,
 *                    scriptMode, hasAudio, voiceName, speedName, script, disclaimer}>}
 */
export async function pollVideoStatus(taskId) {
  const resp = await fetch(`/api/studio/video-status/${taskId}`)
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error?.message || `状态查询失败（HTTP ${resp.status}）`)
  }
  return json
}

/* ------------------------------------------------------------
 * 二、作品持久化（阶段五）
 * ------------------------------------------------------------
 * 优先使用后端 /api/works（data/works 落盘，重启不丢、跨浏览器可见）；
 * 后端不可达时自动降级到浏览器 localStorage 作为本机缓存，
 * 并在下次连通后端时由 migrateLocalWorks() 一次性迁移，用户无感知。
 */

/* ---------- localStorage 本机缓存（降级路径，数据结构沿用 v1） ---------- */
function readLocalWorks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const works = raw ? JSON.parse(raw) : []
    return Array.isArray(works) ? works : []
  } catch {
    // localStorage 数据损坏时不让页面崩溃，返回空列表
    return []
  }
}

function writeLocalWorks(works) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(works))
  } catch {
    // 隐私模式 / 存储配额已满：降级写入本身失败时静默（不阻断用户操作）
  }
}

function buildLocalWork(payload) {
  return {
    id: `work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    imageUrl: '',
    ...payload,
  }
}

/**
 * 把旧 localStorage 作品一次性迁移到后端（保留原 id 与保存时间）。
 * 应在「我的作品」页首次加载时调用；后端不可达则保留本地数据，下次再试。
 * @returns {Promise<number>} 实际迁移条数
 */
export async function migrateLocalWorks() {
  const local = readLocalWorks()
  if (local.length === 0) return 0
  let migrated = 0
  try {
    for (const work of local) {
      const resp = await fetch('/api/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(work), // 带 id/createdAt，后端 upsert 保留原值
      })
      if (resp.ok) migrated += 1
    }
    if (migrated > 0) writeLocalWorks([])
    return migrated
  } catch {
    return 0
  }
}

/**
 * 获取作品列表：优先后端，失败自动降级本机缓存（按保存时间倒序）。
 * @returns {Promise<{works: object[], source: 'server'|'local'}>}
 */
export async function listWorks() {
  try {
    const resp = await fetch('/api/works')
    const json = await resp.json().catch(() => null)
    if (!resp.ok || !json?.ok) throw new Error('works api unavailable')
    return { works: Array.isArray(json.works) ? json.works : [], source: 'server' }
  } catch {
    return {
      works: readLocalWorks().sort((a, b) => b.createdAt - a.createdAt),
      source: 'local',
    }
  }
}

/**
 * 保存一件作品：优先后端；网络失败时写入本机缓存。
 * @param {object} payload 页面提交的完整内容（标题/主题/提案/视频与配音信息）
 * @returns {Promise<{work: object, source: 'server'|'local'}>}
 */
export async function saveWork(payload) {
  let resp
  try {
    resp = await fetch('/api/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // 仅网络不可达时降级本机缓存
    return saveWorkLocal(payload)
  }
  const json = await resp.json().catch(() => null)
  if (resp.ok && json && json.id) {
    // POST 成功直接返回完整 WorkItem（响应体无 ok 包装）
    return { work: json, source: 'server' }
  }
  // 4xx 是业务错误（如空标题），必须把后端中文提示抛给用户，不静默降级
  if (resp.status >= 400 && resp.status < 500) {
    throw new Error(json?.error?.message || `保存失败（HTTP ${resp.status}）`)
  }
  // 5xx / 响应异常：降级本机缓存
  return saveWorkLocal(payload)
}

function saveWorkLocal(payload) {
  const works = readLocalWorks()
  const work = buildLocalWork(payload)
  works.push(work)
  writeLocalWorks(works)
  return { work, source: 'local' }
}

/**
 * 删除一件作品：优先后端（404 视为已删除）；后端不可达时删本机缓存。
 * @returns {Promise<'server'|'local'>} 实际生效的存储位置
 */
export async function deleteWork(id) {
  try {
    const resp = await fetch(`/api/works/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (resp.ok || resp.status === 404) return 'server'
    throw new Error('delete failed')
  } catch {
    writeLocalWorks(readLocalWorks().filter((w) => w.id !== id))
    return 'local'
  }
}
