/* ============================================================
 * AI 配音设置面板 VoiceoverPanel（阶段四，VideoPanel 的前置步骤）
 * ------------------------------------------------------------
 * 功能：
 *   1. 一键生成 5 句口播旁白（POST /api/studio/generate-narration），可逐句编辑；
 *   2. 音色（温柔女声 / 沉稳男声 / 自然讲解）与语速（慢 / 正常 / 稍快）；
 *   3. 「试听旁白」使用浏览器 Web Speech 本地朗读，仅预览节奏，不是最终配音；
 *   4. 「生成配音」逐句调用后端真实 TTS，得到可合进视频的 mp3，可逐句试听；
 *   5. 未配置 TTS Key / 超时 / 限流等错误由后端返回中文提示，前端绝不伪造音频；
 *   6. 「合成有声视频」带着配音进入合成；也可跳过，直接合成无声视频。
 * ============================================================ */
import { useEffect, useRef, useState } from 'react'
import StudioIcon from './StudioIcons.jsx'
import { generateAudio, generateNarration } from '../../services/studioService.js'

/* 与后端 tts_service 保持一致的选项表 */
const VOICE_OPTIONS = [
  { key: 'gentle-female', name: '温柔女声', desc: '苏瑶 · 温柔亲切' },
  { key: 'calm-male', name: '沉稳男声', desc: '阿闻 · 字正腔圆' },
  { key: 'natural-talk', name: '自然讲解', desc: '芊悦 · 阳光亲切' },
]
const SPEED_OPTIONS = [
  { key: 'slow', name: '慢速', rate: 0.9 },
  { key: 'normal', name: '正常', rate: 1.0 },
  { key: 'fast', name: '稍快', rate: 1.12 },
]
/* 单句字数口径（与后端 tts_service 一致：剔除空白与标点后计数）
 * 实测 TTS 约 4 字/秒：单句 ≤14 字、5 句 ≤40 字，成片才能控制在 16 秒内 */
const MAX_CHARS = 14
const WARN_CHARS = 12
const TOTAL_TARGET = 40
const SPOKEN_PUNCT_RE = /[\s，。！？、；：,.!?;:…—“”‘’"'（）()【】《》<>·-]/g
const spokenLen = (s) => (s || '').replace(SPOKEN_PUNCT_RE, '').length
/* 分镜标签：与视频脚本的 5 个画面一一对应（五段文化叙事） */
const SCENE_LABELS = ['开场吸引', '文化来源', '工艺细节', '现代生活', '情绪收尾']
const SCENE_HINTS = ['点出非遗主题与产品', '技艺渊源或气质（有资料才讲史实）', '最讲究的工艺或纹样处理', '设计如何走进日常', '简短有力的品牌收束']
const SENTENCE_COUNT = SCENE_LABELS.length

/* 阶段五：视频可控选项（与后端 _VIDEO_PURPOSES/_VIDEO_STYLES/_NARRATIVE_FOCI 对应） */
const PURPOSE_OPTIONS = [
  { key: '', name: '通用介绍' },
  { key: '电商详情', name: '电商详情' },
  { key: '社交分享', name: '社交分享' },
  { key: '文化科普', name: '文化科普' },
  { key: '礼品推荐', name: '礼品推荐' },
]
const STYLE_OPTIONS = [
  { key: '', name: '通用' },
  { key: '雅致叙事', name: '雅致叙事' },
  { key: '轻快活泼', name: '轻快活泼' },
  { key: '沉静人文', name: '沉静人文' },
]
const FOCUS_OPTIONS = [
  { key: '', name: '均衡' },
  { key: '文化传承', name: '文化传承' },
  { key: '工艺美学', name: '工艺美学' },
  { key: '现代生活', name: '现代生活' },
]

export default function VoiceoverPanel({ context, initial, onComposeAudio, onComposeSilent }) {
  const [sentences, setSentences] = useState(() => {
    // 历史会话可能保存过旧版 4 句旁白：按 5 句结构补齐，不丢弃已写内容
    const base = Array.isArray(initial?.sentences) ? initial.sentences : []
    return Array.from({ length: SENTENCE_COUNT }, (_, i) => base[i] || '')
  })
  /* 可控选项：影响旁白/视频脚本的叙事角度与口吻 */
  const [videoPurpose, setVideoPurpose] = useState(initial?.videoPurpose || '')
  const [videoStyle, setVideoStyle] = useState(initial?.videoStyle || '')
  const [narrativeFocus, setNarrativeFocus] = useState(initial?.narrativeFocus || '')
  const [voice, setVoice] = useState(initial?.voice || 'gentle-female')
  const [speed, setSpeed] = useState(initial?.speed || 'normal')
  const [narrationMode, setNarrationMode] = useState(initial ? 'restored' : '')
  const [loadingNarration, setLoadingNarration] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [narrationError, setNarrationError] = useState('')
  const [audioError, setAudioError] = useState('')
  /* 最近一次成功生成的配音；改动文本/音色/语速后置为 stale，需要重新生成 */
  const [audio, setAudio] = useState(initial?.audio || null)
  const [stale, setStale] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const previewIndex = useRef(0)
  const previewTimer = useRef(null)

  /* 卸载时停止浏览器朗读 */
  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (previewTimer.current) clearTimeout(previewTimer.current)
  }, [])

  const allFilled = sentences.every((s) => s.trim())
  const charCounts = sentences.map((s) => spokenLen(s))
  const tooLongIndex = charCounts.findIndex((n) => n > MAX_CHARS)
  const totalChars = charCounts.reduce((a, b) => a + b, 0)
  const totalOver = totalChars > TOTAL_TARGET

  /* ---------------- 旁白生成 ---------------- */
  const handleGenerateNarration = async () => {
    setLoadingNarration(true)
    setNarrationError('')
    try {
      const { sentences: next, mode } = await generateNarration({
        ...context,
        videoPurpose,
        videoStyle,
        narrativeFocus,
      })
      setSentences(next)
      setNarrationMode(mode)
      setStale(true) // 新文本需要重新配音
    } catch (e) {
      setNarrationError(e.message)
    } finally {
      setLoadingNarration(false)
    }
  }

  const editSentence = (i, value) => {
    setSentences((prev) => prev.map((s, idx) => (idx === i ? value : s)))
    setStale(true)
  }

  /* ---------------- 浏览器本地朗读预览（非最终配音） ---------------- */
  const stopPreview = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = null
    setPreviewing(false)
  }

  const handlePreview = () => {
    if (previewing) {
      stopPreview()
      return
    }
    if (!('speechSynthesis' in window)) {
      setAudioError('当前浏览器不支持语音朗读预览，可直接生成配音后试听真实效果')
      return
    }
    if (!allFilled) {
      setAudioError(`请先把 ${SENTENCE_COUNT} 句旁白填写完整`)
      return
    }
    setAudioError('')
    const synth = window.speechSynthesis
    synth.cancel()
    const zhVoice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('zh'))
    const rate = SPEED_OPTIONS.find((o) => o.key === speed)?.rate ?? 1
    previewIndex.current = 0
    setPreviewing(true)

    const speakNext = () => {
      const i = previewIndex.current
      if (i >= sentences.length) {
        setPreviewing(false)
        return
      }
      const u = new SpeechSynthesisUtterance(sentences[i])
      u.lang = 'zh-CN'
      if (zhVoice) u.voice = zhVoice
      u.rate = rate
      u.onend = () => {
        previewIndex.current += 1
        previewTimer.current = setTimeout(speakNext, 250)
      }
      u.onerror = () => setPreviewing(false)
      synth.speak(u)
    }
    speakNext()
  }

  /* ---------------- 真实 TTS 配音生成 ---------------- */
  const handleGenerateAudio = async () => {
    if (!allFilled) {
      setAudioError(`请先把 ${SENTENCE_COUNT} 句旁白填写完整`)
      return
    }
    if (tooLongIndex >= 0) {
      setAudioError(`第 ${tooLongIndex + 1} 句超过 ${MAX_CHARS} 字（不含标点），短片每句建议 6-10 字，请精简`)
      return
    }
    stopPreview()
    setAudioLoading(true)
    setAudioError('')
    try {
      const result = await generateAudio({
        sentences: sentences.map((s) => s.trim()),
        voice,
        speed,
      })
      setAudio(result)
      setStale(false)
    } catch (e) {
      setAudio(null)
      setAudioError(e.message)
    } finally {
      setAudioLoading(false)
    }
  }

  /* 预计成片时长 ≈ 全部配音 + 每句 0.6s 留白 − (n-1) 个 0.5s 转场重叠；画面基础时长约 11s */
  const estimatedDuration = audio
    ? Math.max(11, audio.totalDuration + sentences.length * 0.6 - (sentences.length - 1) * 0.5)
    : 0
  const overLimit = audio ? estimatedDuration > 16 : false
  const audioReady = audio && !stale && !overLimit

  /* ---------------- 合成入口 ---------------- */
  const handleComposeAudio = () => {
    if (!audioReady) return
    onComposeAudio({
      voice,
      speed,
      audioSentenceUrls: audio.sentenceUrls,
      audioDurations: audio.durations,
      audioSentences: sentences.map((s) => s.trim()),
      voiceName: audio.voiceName,
      speedName: audio.speedName,
      videoPurpose,
      videoStyle,
      narrativeFocus,
    })
  }

  return (
    <div className="space-y-4">
      {/* 卡片一：旁白文本 */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-base font-semibold text-ink">1. 视频旁白（{SENTENCE_COUNT} 句 · 对应 {SENTENCE_COUNT} 个画面）</h3>
            <p className="mt-1 text-xs text-ink-mute">
              每句 6-10 字、{SENTENCE_COUNT} 句共不超过 {TOTAL_TARGET} 字（朗读约 10-13 秒）；五段文化叙事：开场吸引 → 文化来源 → 工艺细节 → 现代生活 → 情绪收尾，不编造非遗历史与寓意
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateNarration}
            disabled={loadingNarration}
            className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <StudioIcon name={loadingNarration ? 'refresh' : 'sparkle'} size={14}
              className={loadingNarration ? 'animate-spin' : ''} />
            {loadingNarration ? '正在生成…' : 'AI 生成旁白'}
          </button>
        </div>
        {narrationError && (
          <p className="mt-3 rounded-lg bg-cinnabar/10 px-3 py-2 text-xs text-cinnabar">{narrationError}</p>
        )}
        {narrationMode === 'ai' && (
          <p className="mt-3 text-[11px] text-celadon">旁白由 AI 根据所选方案生成，请核对后可直接修改</p>
        )}
        {narrationMode === 'mock' && (
          <p className="mt-3 text-[11px] text-ink-mute">当前为本地模板旁白（后端未启用真实 AI），可直接修改</p>
        )}

        {/* 可控选项：影响叙事角度与口吻 */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft">视频用途</label>
            <select
              value={videoPurpose}
              onChange={(e) => { setVideoPurpose(e.target.value); setStale(true) }}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-cinnabar/40"
            >
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft">叙事风格</label>
            <select
              value={videoStyle}
              onChange={(e) => { setVideoStyle(e.target.value); setStale(true) }}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-cinnabar/40"
            >
              {STYLE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft">叙事重点</label>
            <select
              value={narrativeFocus}
              onChange={(e) => { setNarrativeFocus(e.target.value); setStale(true) }}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-cinnabar/40"
            >
              {FOCUS_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sentences.map((text, i) => {
            const count = charCounts[i]
            const over = count > MAX_CHARS
            const warn = !over && count > WARN_CHARS
            return (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-ink-soft">
                    第 {i + 1} 句 · {SCENE_LABELS[i]}
                    <span className="ml-1.5 font-normal text-ink-mute">{SCENE_HINTS[i]}</span>
                  </label>
                  <span
                    className={`text-[11px] ${
                      over ? 'text-cinnabar' : warn ? 'text-amber-700' : 'text-ink-mute'
                    }`}
                  >
                    {count}/{MAX_CHARS}
                    {over ? ' 超长' : warn ? ' 偏长' : ''}
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => editSentence(i, e.target.value)}
                  rows={2}
                  placeholder={`请输入第 ${i + 1} 句旁白（建议 6-10 字）…`}
                  className={`w-full resize-none rounded-xl border bg-paper/60 px-4 py-3 text-sm
                    leading-relaxed text-ink outline-none transition placeholder:text-ink-mute
                    focus:bg-white focus:ring-2 focus:ring-cinnabar/10
                    ${over ? 'border-cinnabar' : warn ? 'border-amber-400 focus:border-amber-500' : 'border-line focus:border-cinnabar/50'}`}
                />
              </div>
            )
          })}
        </div>

        {/* 总字数即时提示 */}
        {allFilled && (
          <p className={`mt-3 text-[11px] ${totalOver ? 'text-cinnabar' : 'text-ink-mute'}`}>
            {SENTENCE_COUNT} 句共 {totalChars} 字（不含标点）·{' '}
            {totalOver
              ? `已超过 ${TOTAL_TARGET} 字建议值，配音总时长可能超片长，请精简`
              : '长度合适，配音成片预计可控制在 16 秒内'}
          </p>
        )}
      </div>

      {/* 卡片二：音色与语速 */}
      <div className="card p-5 sm:p-6">
        <h3 className="font-serif text-base font-semibold text-ink">2. 配音设置</h3>

        <p className="mt-4 text-xs font-medium text-ink-soft">音色</p>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
          {VOICE_OPTIONS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => { setVoice(v.key); setStale(true) }}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                voice === v.key
                  ? 'border-cinnabar bg-cinnabar/5 ring-1 ring-cinnabar/30'
                  : 'border-line bg-white hover:border-cinnabar/40'
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <StudioIcon name="microphone" size={14} className="text-cinnabar" />
                {v.name}
              </span>
              <span className="mt-1 block text-[11px] text-ink-mute">{v.desc}</span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-ink-soft">语速</p>
        <div className="mt-2 inline-flex rounded-xl border border-line bg-paper p-1">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setSpeed(s.key); setStale(true) }}
              className={`rounded-lg px-5 py-1.5 text-sm transition ${
                speed === s.key ? 'bg-white text-cinnabar shadow-sm' : 'text-ink-mute hover:text-ink'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePreview}
            className="btn-ghost inline-flex items-center gap-1.5"
          >
            <StudioIcon name={previewing ? 'video' : 'music'} size={14} />
            {previewing ? '停止试听' : '试听旁白'}
          </button>
          <button
            type="button"
            onClick={handleGenerateAudio}
            disabled={audioLoading}
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <StudioIcon name={audioLoading ? 'refresh' : 'microphone'} size={15}
              className={audioLoading ? 'animate-spin' : ''} />
            {audioLoading ? '正在逐句合成…' : (audio ? '重新生成配音' : '生成配音')}
          </button>
          {previewing && <span className="text-[11px] text-ink-mute">正在本地朗读…</span>}
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">
          「试听旁白」是浏览器本地朗读，仅用于预览节奏，不是最终配音；点击「生成配音」才会调用真实语音服务。
        </p>
        {audioError && (
          <p className="mt-3 rounded-lg bg-cinnabar/10 px-3 py-2 text-xs leading-relaxed text-cinnabar">
            {audioError}
          </p>
        )}
      </div>

      {/* 卡片三：配音结果与合成 */}
      <div className="card p-5 sm:p-6">
        <h3 className="font-serif text-base font-semibold text-ink">3. 合成视频</h3>

        {audio ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-celadon/15 px-2.5 py-1 text-[11px] font-medium text-celadon">
                <StudioIcon name="check" size={12} />
                真实配音 · {audio.voiceName} · {audio.speedName}
              </span>
              <span className="text-[11px] text-ink-mute">
                配音总时长 {audio.totalDuration.toFixed(1)} 秒 · 预计成片约 {estimatedDuration.toFixed(1)} 秒
              </span>
              {stale && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-800">
                  设置已修改，请重新生成配音
                </span>
              )}
              {overLimit && (
                <span className="rounded-full bg-cinnabar/10 px-2.5 py-1 text-[11px] text-cinnabar">
                  预计超过 16 秒上限，请精简旁白后重新生成
                </span>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {audio.sentenceUrls.map((url, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-paper/70 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-semibold text-cinnabar shadow-sm">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
                    {SCENE_LABELS[i]} · {audio.durations[i].toFixed(1)} 秒
                  </span>
                  <audio src={url} controls preload="none" className="h-8 max-w-[220px]" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-ink-mute">
            尚未生成配音。可以先「AI 生成旁白」并试听节奏，再「生成配音」；
            也可以直接合成无声视频，之后随时回来补配音。
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={handleComposeAudio}
            disabled={!audioReady || audioLoading}
            className="btn-primary inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <StudioIcon name="video" size={15} />
            合成有声视频
          </button>
          <button
            type="button"
            onClick={() => onComposeSilent({ videoPurpose, videoStyle, narrativeFocus })}
            className="btn-ghost inline-flex items-center gap-1.5"
          >
            先合成无声视频
          </button>
        </div>
      </div>
    </div>
  )
}
