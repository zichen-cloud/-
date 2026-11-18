/* ============================================================
 * PersonaPet：非遗萌宠桌宠（全局唯一实例）
 * ------------------------------------------------------------
 * 交互：悬浮 → 点击展开小窗 → 可拖动 / 最小化 / 关闭，
 *       支持文字对话、语音提问（ASR）、逐条语音播放（TTS）。
 *
 * 语音设计（重点）：
 *   1. 文字优先：AI 回答一到就渲染，TTS 独立异步，互不阻塞；
 *   2. 每条回答有独立音频状态机，按 messageId 绑定音频，
 *      多轮对话不会错位：
 *        idle → generating → loading → ready → playing → ended
 *        任意环节失败 → error（文字始终保留）
 *   3. 同一时刻只播放一条回答，切角色/关闭会中止并释放音频；
 *   4. 浏览器拦截自动播放时不报错：音频保留为 ready，提示点击播放。
 *
 * 角色数据来自现有 /api/persona/* 接口，未识别时使用通用形象「小灵」。
 * ============================================================ */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonaAvatar from './PersonaAvatar.jsx'
import {
  chatWithPersona,
  listPersonas,
  synthesizeSpeech,
  transcribeVoice,
} from '../../services/personaService.js'

const EDGE = 8
const DRAG_THRESHOLD = 5
const PET_W = 104
const PET_H = 104
const GAP = 8
const VOICE_PREF_KEY = 'feiyi_pet_voice_auto'

let seq = 0
const uid = () => `m${Date.now().toString(36)}-${(seq += 1)}`
const emptyAudio = () => ({ status: 'idle', urls: [], index: 0, error: '' })

export default function PersonaPet({
  persona,
  mode = 'lion_active',
  recognition = '',
  bridgeText = '',
  notice = null,
  greetingOverride = '',
  onReturnToLion,
  onSwitch,
}) {
  const navigate = useNavigate()
  const isLion = persona.avatarStyle === 'lion'
  const accent = persona.colors?.primary || '#B23A2E'

  const [open, setOpen] = useState(false)
  // 卷轴入场结束后的一次性问候语：只在本次挂载内有效（狮小灵专属）
  const introLineRef = useRef(greetingOverride)
  const introLine = isLion ? introLineRef.current : ''
  const [messages, setMessages] = useState(() => [
    {
      id: uid(),
      role: 'persona',
      text: introLineRef.current || bridgeText || persona.greeting,
      sources: [],
      audio: emptyAudio(),
    },
  ])
  const greetingId = messages[0]?.id
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [avatarState, setAvatarState] = useState('greeting')
  const [needTap, setNeedTap] = useState(false)
  // 语音
  const [autoVoice, setAutoVoice] = useState(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const [playingId, setPlayingId] = useState(null)
  // 录音
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  // 外观
  const [alpha, setAlpha] = useState(0.97)
  const [pos, setPos] = useState({ right: 20, bottom: 20 })
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 1440 : window.innerWidth,
    h: typeof window === 'undefined' ? 900 : window.innerHeight,
  }))
  // 切换角色
  const [switchOpen, setSwitchOpen] = useState(false)
  const [personas, setPersonas] = useState([])
  // 用户展开过一次后就不再显示问候气泡，避免反复打扰
  const [bubbleDismissed, setBubbleDismissed] = useState(false)

  const wrapRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const dragRef = useRef({ active: false, moved: false, sx: 0, sy: 0, sr: 0, sb: 0 })
  const audioRef = useRef(null)
  const playingRef = useRef({ msgId: null, index: 0 })
  const ttsTokens = useRef({})
  const messagesRef = useRef(messages)
  const autoVoiceRef = useRef(autoVoice)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const greetedRef = useRef(false)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    autoVoiceRef.current = autoVoice
    try {
      localStorage.setItem(VOICE_PREF_KEY, autoVoice ? 'on' : 'off')
    } catch {
      /* 忽略隐私模式写入失败 */
    }
  }, [autoVoice])

  /* ---------------- 拖拽：全屏任意位置 ---------------- */
  const clampPos = useCallback((p) => {
    const maxRight = Math.max(EDGE, window.innerWidth - PET_W - EDGE)
    const maxBottom = Math.max(EDGE, window.innerHeight - PET_H - EDGE)
    return {
      right: Math.round(Math.min(Math.max(EDGE, p.right), maxRight)),
      bottom: Math.round(Math.min(Math.max(EDGE, p.bottom), maxBottom)),
    }
  }, [])

  useLayoutEffect(() => {
    setPos((p) => {
      const n = clampPos(p)
      return n.right === p.right && n.bottom === p.bottom ? p : n
    })
  }, [open, clampPos])

  useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      setPos((p) => {
        const n = clampPos(p)
        return n.right === p.right && n.bottom === p.bottom ? p : n
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampPos])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      sr: pos.right,
      sb: pos.bottom,
    }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true
    setPos(clampPos({ right: d.sr - dx, bottom: d.sb - dy }))
  }

  const onPointerUp = (e) => {
    const d = dragRef.current
    if (!d.active) return
    d.active = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (!d.moved) {
      setOpen((v) => !v)
      setBubbleDismissed(true)
    }
  }

  /* ---------------- 消息与语音状态 ---------------- */
  const patchMessage = useCallback((id, patch) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              audio: patch.audio ? { ...m.audio, ...patch.audio } : m.audio,
            }
          : m,
      ),
    )
  }, [])

  const stopPlayback = useCallback((msgId = null) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    const current = playingRef.current.msgId
    if (current) {
      patchMessage(current, { audio: { status: 'ended' } })
    }
    if (msgId && msgId !== current) {
      patchMessage(msgId, { audio: { status: 'ended' } })
    }
    playingRef.current = { msgId: null, index: 0 }
    setPlayingId(null)
    setAvatarState((s) => (s === 'speaking' ? 'idle' : s))
  }, [patchMessage])

  /* 顺序播放一条回答的所有分段 */
  const playSegment = useCallback(() => {
    const { msgId, index } = playingRef.current
    if (!msgId) return
    const msg = messagesRef.current.find((m) => m.id === msgId)
    const urls = msg?.audio?.urls || []
    if (!msg || index >= urls.length) {
      patchMessage(msgId, { audio: { status: 'ended' } })
      playingRef.current = { msgId: null, index: 0 }
      setPlayingId(null)
      setAvatarState('idle')
      return
    }
    const audio = new Audio(urls[index])
    audio.preload = 'auto'
    audioRef.current = audio
    audio.onended = () => {
      playingRef.current = { msgId, index: playingRef.current.index + 1 }
      playSegment()
    }
    audio.onerror = () => {
      patchMessage(msgId, { audio: { status: 'error', error: '音频播放失败' } })
      playingRef.current = { msgId: null, index: 0 }
      setPlayingId(null)
      setAvatarState('idle')
    }
    patchMessage(msgId, { audio: { status: 'playing', index } })
    setPlayingId(msgId)
    setAvatarState('speaking')
    audio.play().catch((err) => {
      audioRef.current = null
      playingRef.current = { msgId: null, index: 0 }
      setPlayingId(null)
      setAvatarState('idle')
      if (err?.name === 'NotAllowedError') {
        // 自动播放被拦：保留已生成的音频，提示用户点播放
        patchMessage(msgId, { audio: { status: 'ready' } })
        setNeedTap(true)
      } else {
        patchMessage(msgId, { audio: { status: 'error', error: '播放失败，请重试' } })
      }
    })
  }, [patchMessage])

  const startPlaying = useCallback(
    (msgId, fromIndex = 0) => {
      // 同一时刻只允许一条回答发声：先停掉正在播的
      const current = playingRef.current.msgId
      if (current && current !== msgId) stopPlayback(current)
      playingRef.current = { msgId, index: fromIndex }
      playSegment()
    },
    [playSegment, stopPlayback],
  )

  /* TTS：独立异步任务，完成后才允许播放，不阻塞文字展示 */
  const requestVoice = useCallback(
    async (msgId, text) => {
      if (!text) return
      patchMessage(msgId, { audio: { status: 'generating', error: '' } })
      const token = (ttsTokens.current[msgId] || 0) + 1
      ttsTokens.current[msgId] = token
      // 上游偶发限流/超时：自动重试一次，减少"点了没声音"
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await synthesizeSpeech(text, persona.voiceKey)
          if (ttsTokens.current[msgId] !== token) return
          const urls = res.segmentUrls || []
          if (!urls.length) throw new Error('empty')
          patchMessage(msgId, { audio: { status: 'loading', urls, index: 0 } })
          // 等首段可播放再置为 ready，避免"能点但没声音"
          await new Promise((resolve) => {
            const probe = new Audio()
            probe.preload = 'auto'
            const done = () => resolve()
            probe.addEventListener('canplay', done, { once: true })
            probe.addEventListener('error', done, { once: true })
            probe.src = urls[0]
            setTimeout(done, 6000)
          })
          if (ttsTokens.current[msgId] !== token) return
          patchMessage(msgId, { audio: { status: 'ready' } })
          if (autoVoiceRef.current && !playingRef.current.msgId) {
            startPlaying(msgId, 0)
          }
          return
        } catch {
          if (ttsTokens.current[msgId] !== token) return
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 900))
            patchMessage(msgId, { audio: { status: 'generating' } })
            continue
          }
          patchMessage(msgId, { audio: { status: 'error', error: '语音暂不可用，可点播放重试' } })
        }
      }
    },
    [patchMessage, persona.voiceKey, startPlaying],
  )

  /* 逐条回答的语音按钮 */
  const handleAudioAction = (m) => {
    const s = m.audio?.status || 'idle'
    if (s === 'playing') {
      audioRef.current?.pause()
      patchMessage(m.id, { audio: { status: 'paused' } })
      setAvatarState('idle')
      return
    }
    if (s === 'paused') {
      audioRef.current?.play().then(
        () => {
          patchMessage(m.id, { audio: { status: 'playing' } })
          setAvatarState('speaking')
        },
        () => patchMessage(m.id, { audio: { status: 'ready' } }),
      )
      return
    }
    if (s === 'ready') {
      setNeedTap(false)
      startPlaying(m.id, m.audio?.index || 0)
      return
    }
    if (s === 'generating' || s === 'loading') return
    if (s === 'ended' || s === 'error' || s === 'idle') {
      requestVoice(m.id, m.text)
    }
  }

  /* 背景故事：固定角色设定，不消耗 RAG，也不会被模型改写 */
  const tellOrigin = useCallback(() => {
    if (!persona.story) return
    setOpen(true)
    setBubbleDismissed(true)
    const msgId = `story-${persona.id}`
    if (messagesRef.current.some((m) => m.id === msgId)) {
      setAvatarState('happy')
      setTimeout(() => setAvatarState('idle'), 1200)
      return
    }
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'persona', text: persona.story, sources: [], audio: emptyAudio() },
    ])
    setAvatarState('happy')
    setTimeout(() => setAvatarState('idle'), 1400)
    if (autoVoiceRef.current) requestVoice(msgId, persona.story)
  }, [persona, requestVoice])

  /* ---------------- 对话 ---------------- */
  const buildHistory = () => {
    const pairs = []
    let pending = ''
    for (const m of messagesRef.current) {
      if (m.role === 'user') pending = m.text
      else if (m.role === 'persona' && pending) {
        pairs.push({ user: pending, ai: m.text })
        pending = ''
      }
    }
    return pairs.slice(-4)
  }

  const send = useCallback(
    async (raw, intent = 'chat') => {
      const text = (raw || '').trim()
      if (!text || sending) return
      setError('')
      // 新问题优先：先停掉上一条回答的语音，避免两段声音叠在一起
      stopPlayback()
      const userMsg = { id: uid(), role: 'user', text }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setSending(true)
      setAvatarState('thinking')
      try {
        const res = await chatWithPersona({
          personaId: persona.id,
          message: text,
          intent,
          history: buildHistory(),
        })
        const aiMsg = {
          id: uid(),
          role: 'persona',
          text: res.answer,
          sources: res.sources || [],
          audio: emptyAudio(),
        }
        // 文字先落地
        setMessages((prev) => [...prev, aiMsg])
        setSending(false)
        setAvatarState('idle')
        // 语音独立异步，不阻塞文字
        if (autoVoiceRef.current) requestVoice(aiMsg.id, res.answer)
      } catch (e) {
        setSending(false)
        setAvatarState('idle')
        setError(e.message || '这次没聊上，请稍后再试')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona.id, sending, recognition, requestVoice],
  )

  /* 首次进入：尝试用语音打招呼（受浏览器策略限制时保留文字气泡） */
  useEffect(() => {
    if (greetedRef.current) return
    greetedRef.current = true
    const timer = setTimeout(() => {
      setAvatarState(bridgeText ? 'cheering' : 'idle')
      // "认出来了"的过渡语马上会被专属传承人接管，不必单独合成语音
      if (!bridgeText && autoVoiceRef.current && greetingId) {
        requestVoice(greetingId, messages[0]?.text || persona.greeting)
      }
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 入场问候气泡：主动打完招呼后自动收起，避免长时间挡住首页标题 */
  useEffect(() => {
    if (!introLine || open || bubbleDismissed) return undefined
    const t = setTimeout(() => setBubbleDismissed(true), 9000)
    return () => clearTimeout(t)
  }, [introLine, open, bubbleDismissed])

  /* 识别失败等提示：由狮小灵在对话里说明，不唤醒任何专属角色 */
  useEffect(() => {
    if (!notice?.text) return
    setMessages((prev) => {
      if (prev.some((m) => m.id === notice.id)) return prev
      return [
        ...prev,
        { id: notice.id, role: 'persona', text: notice.text, sources: [], audio: emptyAudio() },
      ]
    })
    setAvatarState('greeting')
    setOpen(true)
    setBubbleDismissed(true)
  }, [notice])

  /* 组件卸载：停止录音与播放，避免残留声音 / 占用麦克风 */
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      const rec = recorderRef.current
      if (rec && rec.state === 'recording') rec.stop()
    }
  }, [])

  /* 消息区自动滚到底 */
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  /* ---------------- 语音提问 ---------------- */
  const startRecording = useCallback(async () => {
    if (recording || transcribing) return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持麦克风录音，请改用文字提问。')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('没有获得麦克风权限，无法语音提问。你仍然可以直接输入文字。')
      return
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    chunksRef.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setRecording(false)
      const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
      if (!blob.size) return
      setTranscribing(true)
      setAvatarState('thinking')
      try {
        const res = await transcribeVoice(blob)
        setTranscribing(false)
        send(res.text)
      } catch (e) {
        setTranscribing(false)
        setAvatarState('idle')
        setError(e.message || '语音识别失败，请改用文字提问')
      }
    }
    recorderRef.current = rec
    rec.start()
    stopPlayback()
    setRecording(true)
    setAvatarState('listening')
  }, [recording, transcribing, send, stopPlayback])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
  }, [])

  /* ---------------- 切换角色 ---------------- */
  const toggleSwitch = async () => {
    setSwitchOpen((v) => !v)
    if (!personas.length) {
      try {
        const list = await listPersonas()
        setPersonas(list)
      } catch {
        setError('角色列表暂时加载失败')
      }
    }
  }

  /* ---------------- 卡片位置：不越出视口 ---------------- */
  const cardW = Math.min(viewport.w * 0.86, 300)
  const avatarLeft = viewport.w - pos.right - PET_W
  const avatarTop = viewport.h - pos.bottom - PET_H
  const clampedLeft = Math.min(
    Math.max(EDGE, avatarLeft + PET_W - cardW),
    Math.max(EDGE, viewport.w - cardW - EDGE),
  )
  const vertical =
    viewport.h - (avatarTop + PET_H) - GAP - EDGE >= avatarTop - GAP - EDGE ? 'down' : 'up'
  const space =
    vertical === 'down' ? viewport.h - (avatarTop + PET_H) - GAP - EDGE : avatarTop - GAP - EDGE
  const maxCardH = Math.max(200, Math.min(viewport.h * 0.7, space))
  const cardStyle = {
    width: cardW,
    left: clampedLeft - avatarLeft,
    maxHeight: maxCardH,
    ...(vertical === 'up' ? { bottom: PET_H + GAP } : { top: PET_H + GAP }),
    backgroundColor: `rgba(255, 253, 249, ${alpha})`,
    boxShadow: '0 18px 40px -16px rgba(42, 39, 34, 0.45)',
  }
  const bubbleW = Math.min(168, viewport.w - EDGE * 2)
  const bubbleLeft = Math.min(
    Math.max(EDGE, avatarLeft + PET_W - bubbleW),
    Math.max(EDGE, viewport.w - bubbleW - EDGE),
  )
  const bubbleStyle = {
    width: bubbleW,
    left: bubbleLeft - avatarLeft,
    ...(vertical === 'up' ? { bottom: PET_H + 6 } : { top: PET_H + 6 }),
  }

  return (
    <div
      ref={wrapRef}
      className={`fixed z-40 ${isLion ? 'pet-enter' : 'pet-wake'}`}
      style={{ right: pos.right, bottom: pos.bottom, width: PET_W, height: PET_H }}
    >
      {/* ============ 小窗对话卡 ============ */}
      {open && (
        <div
          className="pet-card absolute flex flex-col overflow-hidden rounded-2xl border border-line backdrop-blur-sm"
          style={cardStyle}
        >
          {/* 头部：可拖动 */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex cursor-grab touch-none items-center gap-2 border-b border-line/70 px-2.5 py-2 active:cursor-grabbing"
            style={{ background: `linear-gradient(90deg, ${accent}14, transparent)` }}
          >
            <span className="shrink-0">
              <PersonaAvatar persona={persona} state={avatarState} size={40} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-ink">{persona.name}</p>
              <p className="truncate text-[10px] text-ink-mute">{persona.title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setAutoVoice((v) => !v)}
                aria-label={autoVoice ? '关闭自动语音' : '开启自动语音'}
                title={autoVoice ? '自动语音已开' : '自动语音已关'}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                  autoVoice ? 'bg-cinnabar/10 text-cinnabar' : 'text-ink-mute hover:bg-paper'
                }`}
              >
                {autoVoice ? '🔊' : '🔇'}
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleSwitch}
                aria-label="切换传承人"
                title="切换传承人"
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-ink-mute transition hover:bg-paper hover:text-cinnabar"
              >
                ⇄
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setOpen(false)}
                aria-label="最小化"
                title="最小化"
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-mute transition hover:bg-paper hover:text-ink"
              >
                −
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setOpen(false)
                  if (isLion) {
                    // 狮小灵是常驻导师，只收起窗口，不会离开
                    setAvatarState('idle')
                    return
                  }
                  // 专属传承人：先告别，再把舞台交还狮小灵
                  setAvatarState('goodbye')
                  setTimeout(() => onReturnToLion?.(), 560)
                }}
                aria-label={isLion ? '收起桌宠窗口' : '关闭并送它回去'}
                title={isLion ? '收起窗口（狮小灵常驻）' : '关闭并回到狮小灵'}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-mute transition hover:bg-paper hover:text-cinnabar"
              >
                ×
              </button>
            </div>
          </div>

          {/* 换角色 */}
          {switchOpen && (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-line/70 bg-paper/60 px-2 py-1.5">
              {personas.length === 0 ? (
                <span className="px-1 text-[11px] text-ink-mute">正在加载角色…</span>
              ) : (
                personas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSwitchOpen(false)
                      if (p.id !== persona.id) onSwitch?.(p)
                    }}
                    className={`flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-1 text-[10px] transition ${
                      p.id === persona.id
                        ? 'border-cinnabar/50 bg-cinnabar/10 text-cinnabar'
                        : 'border-line bg-white text-ink-soft hover:border-cinnabar/40'
                    }`}
                  >
                    <PersonaAvatar persona={p} state="idle" size={22} />
                    {p.name}
                  </button>
                ))
              )}
            </div>
          )}

          {/* 消息区 */}
          <div ref={listRef} className="min-h-[80px] flex-1 space-y-2.5 overflow-y-auto px-2.5 py-2.5">
            {recognition && (
              <p className="rounded-lg bg-paper/80 px-2 py-1 text-[10px] text-ink-mute">
                识别到：{recognition}
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                {m.id.startsWith('story-') && (
                  <p className="mb-1 text-[10px] tracking-wide text-ink-mute">角色背景故事 · 设定演绎</p>
                )}
                <div
                  className={`inline-block max-w-[92%] rounded-xl px-2.5 py-1.5 text-left text-[12.5px] leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-cinnabar text-white'
                      : 'rounded-bl-sm border border-line bg-white/90 text-ink'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'persona' && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-mute">
                    {m.audio?.status === 'generating' && (
                      <span className="inline-flex items-center gap-1">
                        <span className="pv-dot inline-block h-1 w-1 rounded-full bg-cinnabar" />
                        正在准备语音…
                      </span>
                    )}
                    {m.audio?.status === 'loading' && <span>正在加载语音…</span>}
                    {m.audio?.status === 'ready' && <span>可以听我说话啦</span>}
                    {m.audio?.status === 'paused' && <span>已暂停</span>}
                    {m.audio?.status === 'playing' && (
                      <span className="inline-flex items-center gap-1 text-cinnabar">
                        <span className="pv-bar inline-block h-2 w-0.5 rounded bg-cinnabar" />
                        <span className="pv-bar inline-block h-3 w-0.5 rounded bg-cinnabar" style={{ animationDelay: '.15s' }} />
                        <span className="pv-bar inline-block h-1.5 w-0.5 rounded bg-cinnabar" style={{ animationDelay: '.3s' }} />
                        正在播放
                      </span>
                    )}
                    {m.audio?.status === 'error' && (
                      <span className="text-cinnabar">{m.audio.error || '语音暂不可用'}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAudioAction(m)}
                      className={`inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 transition ${
                        m.audio?.status === 'playing'
                          ? 'border-cinnabar/50 bg-cinnabar/10 text-cinnabar'
                          : 'border-line bg-white text-ink-mute hover:border-cinnabar/40 hover:text-cinnabar'
                      }`}
                    >
                      {m.audio?.status === 'playing' ? '暂停' : m.audio?.status === 'paused' ? '继续' : m.audio?.status === 'ended' ? '重播' : '播放'}
                    </button>
                    {(m.audio?.status === 'playing' || m.audio?.status === 'paused') && (
                      <button
                        type="button"
                        onClick={() => stopPlayback(m.id)}
                        className="inline-flex h-5 items-center rounded-full border border-line bg-white px-1.5 text-ink-mute transition hover:text-cinnabar"
                      >
                        停止
                      </button>
                    )}
                    {m.sources?.length > 0 && (
                      <span className="truncate">· 资料：{m.sources[0].name || m.sources[0].title}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {sending && <p className="text-[11px] text-ink-mute">{persona.name} 正在想…</p>}
            {needTap && (
              <p className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                浏览器暂时不允许自动播放，点上面的「播放」就能听到语音。
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-cinnabar/5 px-2 py-1 text-[10px] text-cinnabar">{error}</p>
            )}
          </div>

          {/* 快捷操作 */}
          <div className="flex flex-wrap gap-1.5 border-t border-line/70 bg-paper/50 px-2.5 py-1.5">
            {[
              ['它的来历', tellOrigin],
              ['听听文化故事', () => send('给我讲一段它的文化故事', 'story')],
              ['了解制作工艺', () => send('它的制作工艺是怎样的？')],
              ['和我聊一聊', () => inputRef.current?.focus()],
              ['去创作工坊', () => { setOpen(false); navigate('/studio') }],
            ].map(([label, fn]) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                disabled={sending}
                className="rounded-full border border-line bg-white px-2 py-1 text-[10.5px] text-ink-soft transition hover:border-cinnabar/40 hover:text-cinnabar disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>

          {/* 输入 */}
          <div className="flex items-center gap-1.5 border-t border-line/70 p-2.5">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              aria-label={recording ? '结束录音' : '语音提问'}
              title={recording ? '再点一次结束录音' : '语音提问'}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                recording
                  ? 'animate-pulse border-cinnabar bg-cinnabar text-white'
                  : 'border-line bg-white text-ink-soft hover:border-cinnabar/40 hover:text-cinnabar'
              } disabled:opacity-50`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder={
                recording
                  ? '正在录音，再点麦克风结束…'
                  : transcribing
                    ? '正在识别语音…'
                    : `问问${persona.name}…`
              }
              disabled={recording || transcribing}
              className="h-8 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-[12.5px] text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-cinnabar/60 focus:ring-2 focus:ring-cinnabar/15 disabled:bg-paper"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || sending || recording || transcribing}
              className="h-8 shrink-0 rounded-full bg-cinnabar px-3.5 text-[12px] font-medium text-white transition hover:bg-cinnabar-dark disabled:opacity-40"
            >
              发送
            </button>
          </div>

          {/* 不透明度 */}
          <div className="flex items-center gap-2 border-t border-line/70 px-2.5 py-1.5">
            <span className="text-[10px] text-ink-mute">不透明度</span>
            <input
              type="range"
              min="0.6"
              max="1"
              step="0.01"
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="h-1 flex-1 accent-cinnabar"
              aria-label="窗口不透明度"
            />
            <span className="w-8 text-right text-[10px] text-ink-mute">{Math.round(alpha * 100)}%</span>
          </div>
        </div>
      )}

      {/* ============ 桌宠本体（按住可拖到任意位置） ============ */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        aria-label={`${persona.name} 非遗萌宠桌宠，可拖动`}
        title="点一下展开，按住可拖动"
        className="group relative h-full w-full cursor-grab touch-none select-none outline-none active:cursor-grabbing"
      >
        {!open && !bubbleDismissed && (
          <span
            className="pet-bubble absolute z-10 rounded-xl border border-line bg-white/95 px-2.5 py-1.5 text-left text-[11px] leading-relaxed text-ink-soft shadow-md"
            style={bubbleStyle}
          >
            {needTap ? '点我听我说话～' : introLine || `我是${persona.name}，点我聊聊～`}
          </span>
        )}
        {/* 透明背景角色本体 + 底部软阴影 + 主题小装饰，不再使用白圆贴图 */}
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
          style={{ background: `radial-gradient(circle, ${persona.colors?.accent || '#E0A23F'}55 0%, transparent 70%)` }}
        />
        <span className="pet-spark pointer-events-none absolute right-1 top-4 h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <span
          className="pet-spark pointer-events-none absolute left-1.5 top-9 h-1 w-1 rounded-full"
          style={{ background: accent, animationDelay: '0.9s' }}
        />
        <span className="pointer-events-none absolute bottom-0 left-1/2 h-2 w-14 -translate-x-1/2 rounded-full bg-ink/25 blur-[3px]" />
        <span className="absolute inset-0 flex items-end justify-center transition-transform duration-300 group-hover:-translate-y-1">
          <PersonaAvatar persona={persona} state={open ? avatarState : bridgeText ? 'cheering' : 'idle'} size={104} />
        </span>
      </div>

      <style>{`
        @keyframes petIn { 0% { opacity: 0; transform: translateY(16px) scale(.86) } 60% { opacity: 1; transform: translateY(-4px) scale(1.03) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes petBubble { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes petDot { 0%,100% { opacity: .3; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-2px) } }
        @keyframes petBar { 0%,100% { height: 4px } 50% { height: 10px } }
        @keyframes petWake { 0% { opacity: 0; transform: translateY(10px) scale(.62) } 55% { opacity: 1; transform: translateY(-4px) scale(1.06) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes petSpark { 0%,100% { opacity: .2; transform: translateY(0) scale(.9) } 50% { opacity: .9; transform: translateY(-5px) scale(1.15) } }
        .pet-enter { animation: petIn .52s cubic-bezier(.22,.9,.28,1) both }
        .pet-wake { animation: petWake .68s cubic-bezier(.2,.9,.3,1) both }
        .pet-bubble { animation: petBubble 3.4s ease-in-out infinite }
        .pet-spark { animation: petSpark 2.8s ease-in-out infinite }
        .pv-dot { animation: petDot 1s ease-in-out infinite }
        .pv-bar { animation: petBar .7s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .pet-enter, .pet-wake, .pet-bubble, .pet-spark, .pv-dot, .pv-bar { animation: none !important }
        }
      `}</style>
    </div>
  )
}
