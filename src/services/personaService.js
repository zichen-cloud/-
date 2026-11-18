/* ============================================================
 * 数字传承人数据服务层
 * ------------------------------------------------------------
 * 与后端 /api/persona/* 一一对应。页面不直接写 fetch，
 * 所有失败都转换成可直接展示的中文提示。
 *
 * 接口：
 *   listPersonas()        角色列表
 *   matchPersona()        依据识别结果匹配角色（真实匹配，不随机）
 *   chatWithPersona()     人格化问答 / 讲文化故事
 *   fetchQuiz()           趣味问答
 *   synthesizeSpeech()    文本转语音（失败可降级为纯文字）
 *   transcribeVoice()     录音转文字（麦克风需用户授权）
 * ============================================================ */

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

/* 角色列表 */
export async function listPersonas() {
  const res = await fetch('/api/persona/list')
  const json = await readJson(res, '数字传承人列表加载失败')
  return json.personas || []
}

/* 依据真实识别结果匹配角色 */
export async function matchPersona({ candidates = [], predictedCategory = '', heritageId = '' }) {
  const res = await fetch('/api/persona/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidates, predictedCategory, heritageId }),
  })
  return readJson(res, '传承人匹配失败，请稍后重试')
}

/* 与角色对话；intent: 'chat' | 'story' */
export async function chatWithPersona({ personaId, message = '', intent = 'chat', history = [], heritageId = '' }) {
  const res = await fetch('/api/persona/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId, message, intent, history, heritageId }),
  })
  return readJson(res, '传承人没有回应，请稍后再试')
}

/* 趣味问答 */
export async function fetchQuiz({ personaId, heritageId = '' }) {
  const res = await fetch('/api/persona/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId, heritageId }),
  })
  return readJson(res, '题目生成失败，请再试一次')
}

/* 文本转语音：返回 { segmentUrls, durations, totalDuration } */
export async function synthesizeSpeech(text, voiceKey) {
  const res = await fetch('/api/persona/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceKey }),
  })
  return readJson(res, '语音合成暂不可用')
}

/* 录音转文字（麦克风须由用户主动点击触发） */
export async function transcribeVoice(blob) {
  const form = new FormData()
  const ext = blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : 'webm'
  form.append('file', blob, `voice.${ext}`)
  const res = await fetch('/api/persona/asr', { method: 'POST', body: form })
  return readJson(res, '语音识别失败，请改用文字提问')
}
