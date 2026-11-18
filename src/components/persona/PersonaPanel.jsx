/* ============================================================
 * PersonaPanel：与数字传承人互动的完整面板
 * ------------------------------------------------------------
 * 左侧角色形象（6 种状态动画），右侧对话区。功能：
 *   · 登场问候（可自动朗读）
 *   · 文字提问 / 连续对话（带上下文）
 *   · 语音讲解（真实 TTS，逐段播放；不可用时自动退回文字）
 *   · 语音提问（麦克风需用户点击授权，录音后走真实 ASR）
 *   · 文化故事、趣味问答、创作引导
 *
 * 所有内容都来自后端真实接口；失败时如实提示，不伪造回答。
 * ============================================================ */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonaAvatar from './PersonaAvatar.jsx'
import {
  chatWithPersona,
  fetchQuiz,
  synthesizeSpeech,
  transcribeVoice,
} from '../../services/personaService.js'

const QUICK_ACTIONS = [
  { key: 'more', label: '继续了解' },
  { key: 'story', label: '文化故事' },
  { key: 'quiz', label: '趣味问答' },
  { key: 'create', label: '进入创作工坊' },
]

export default function PersonaPanel({ persona, inline = false, autoGreet = true }) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [avatarState, setAvatarState] = useState('idle')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceError, setVoiceError] = useState('')
  const [needTap, setNeedTap] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [quiz, setQuiz] = useState(null) // {question, options, answerIndex, explain}
  const [quizPick, setQuizPick] = useState(null)

  const listRef = useRef(null)
  const audioRef = useRef(null)
  const queueRef = useRef([])
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const greetedRef = useRef(false)

  /* ---------- 语音播放 ---------- */
  const stopVoice = useCallback(() => {
    queueRef.current = []
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setAvatarState((s) => (s === 'speaking' ? 'idle' : s))
  }, [])

  const playNext = useCallback(() => {
    const next = queueRef.current.shift()
    if (!next) {
      audioRef.current = null
      setAvatarState('idle')
      return
    }
    const audio = new Audio(next)
    audioRef.current = audio
    audio.onended = playNext
    audio.onerror = () => {
      setVoiceError('这段语音播放失败，已保留文字内容')
      playNext()
    }
    setAvatarState('speaking')
    audio.play().catch(() => {
      // 浏览器自动播放限制：需要用户点一下
      setNeedTap(true)
      setAvatarState('idle')
      queueRef.current = []
    })
  }, [])

  const speak = useCallback(
    async (text, force = false) => {
      // force=true 表示用户主动点了「播放」按钮，忽略自动朗读开关
      if ((!voiceOn && !force) || !text) return
      setVoiceError('')
      try {
        const res = await synthesizeSpeech(text, persona.voiceKey)
        const urls = res.segmentUrls || []
        if (!urls.length) return
        stopVoice()
        queueRef.current = urls
        playNext()
      } catch (e) {
        // 语音不可用 → 静默降级为纯文字，只提示一次
        setVoiceError(e.message || '语音暂不可用，已切换为文字交流')
        setAvatarState('idle')
      }
    },
    [voiceOn, persona, playNext, stopVoice],
  )

  /* 自动滚动到最新消息 */
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, quiz])

  /* 登场：先说欢迎语（每个角色只问候一次）
     autoGreet=false 时只展示欢迎语、不朗读——避免与桌宠的问候语音重叠 */
  useEffect(() => {
    if (!persona || greetedRef.current) return
    greetedRef.current = true
    setMessages([{ role: 'persona', text: persona.greeting }])
    if (!autoGreet) return
    setAvatarState('greeting')
    const t = setTimeout(() => {
      speak(persona.greeting)
      setAvatarState((s) => (s === 'greeting' ? 'idle' : s))
    }, 700)
    return () => clearTimeout(t)
  }, [persona, speak, autoGreet])

  /* 卸载时停止播放与录音 */
  useEffect(() => {
    return () => {
      stopVoice()
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop()
      }
    }
  }, [stopVoice])

  /* ---------- 发送消息 ---------- */
  const history = useCallback(
    () =>
      messages
        .filter((m) => m.text)
        .slice(-6)
        .map((m, i, arr) => (m.role === 'user' ? { user: m.text, ai: arr[i + 1]?.text || '' } : null))
        .filter(Boolean),
    [messages],
  )

  const ask = useCallback(
    async (text, intent = 'chat') => {
      const question = (text || '').trim()
      if (sending) return
      if (intent === 'chat' && !question) return
      setError('')
      setQuiz(null)
      setQuizPick(null)
      if (question) setMessages((m) => [...m, { role: 'user', text: question }])
      setSending(true)
      setAvatarState('thinking')
      setInput('')
      try {
        const res = await chatWithPersona({
          personaId: persona.id,
          message: question,
          intent,
          history: history(),
        })
        setMessages((m) => [...m, { role: 'persona', text: res.answer, sources: res.sources }])
        setSending(false)
        speak(res.answer)
        if (!voiceOn) setAvatarState('happy')
      } catch (e) {
        setError(e.message || '传承人暂时没有回应')
        setSending(false)
        setAvatarState('idle')
      }
    },
    [sending, persona, history, speak, voiceOn],
  )

  /* ---------- 趣味问答 ---------- */
  const startQuiz = useCallback(async () => {
    if (sending) return
    setError('')
    setSending(true)
    setAvatarState('thinking')
    try {
      const res = await fetchQuiz({ personaId: persona.id })
      setQuiz(res.quiz)
    } catch (e) {
      setError(e.message || '题目生成失败')
    } finally {
      setSending(false)
      setAvatarState('idle')
    }
  }, [persona, sending])

  /* ---------- 语音提问 ---------- */
  const startRecording = useCallback(async () => {
    if (recording || transcribing) return
    setError('')
    let stream
    try {
      // 必须由用户点击触发；浏览器会弹权限请求
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
        setInput('')
        ask(res.text, 'chat')
      } catch (e) {
        setTranscribing(false)
        setAvatarState('idle')
        setError(e.message || '语音识别失败，请改用文字提问')
      }
    }
    recorderRef.current = rec
    rec.start()
    stopVoice()
    setRecording(true)
    setAvatarState('listening')
  }, [recording, transcribing, ask, stopVoice])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
  }, [])

  /* ---------- 快捷动作 ---------- */
  const onAction = (key) => {
    if (key === 'more') ask('再详细讲讲刚才提到的内容，可以补充一些细节吗？')
    else if (key === 'story') ask(`${persona.heritage}有什么动人的文化故事？`, 'story')
    else if (key === 'quiz') startQuiz()
    else if (key === 'create') navigate('/studio')
  }

  const submitting = sending || transcribing

  return (
    <div className={`grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] ${inline ? '' : 'items-start'}`}>
      {/* ============ 角色区 ============ */}
      <div className="flex flex-col items-center rounded-3xl border border-line bg-white/80 p-5 backdrop-blur-sm">
        <PersonaAvatar persona={persona} state={avatarState} size={inline ? 220 : 268} />

        <div className="mt-2 text-center">
          <p className="font-serif text-xl font-semibold text-ink">{persona.name}</p>
          <p className="mt-1 text-xs tracking-wide text-ink-mute">{persona.title}</p>
          <p className="mt-3 max-w-[240px] text-xs leading-relaxed text-ink-soft">{persona.tagline}</p>
        </div>

        {/* 状态提示 */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-mute">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              avatarState === 'speaking'
                ? 'bg-cinnabar'
                : avatarState === 'listening'
                  ? 'bg-celadon'
                  : avatarState === 'thinking'
                    ? 'bg-gold'
                    : 'bg-ink/30'
            }`}
          />
          {avatarState === 'speaking'
            ? '正在讲解…'
            : avatarState === 'listening'
              ? '正在聆听…'
              : avatarState === 'thinking'
                ? '正在思考…'
                : '在线'}
        </div>

        {/* 语音控制 */}
        <div className="mt-4 flex w-full items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (voiceOn) stopVoice()
              setVoiceOn((v) => !v)
            }}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              voiceOn
                ? 'border-cinnabar/40 bg-cinnabar/10 text-cinnabar'
                : 'border-line bg-white text-ink-mute hover:text-ink'
            }`}
          >
            {voiceOn ? '自动朗读：开' : '自动朗读：关'}
          </button>
          <button
            type="button"
            onClick={stopVoice}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink"
          >
            停止播放
          </button>
        </div>

        {(voiceError || needTap) && (
          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-mute">
            {needTap ? '浏览器阻止了自动播放，点击「继续了解」即可听到语音。' : voiceError}
          </p>
        )}
      </div>

      {/* ============ 对话区 ============ */}
      <div className="flex min-h-[420px] flex-col rounded-3xl border border-line bg-white/85 backdrop-blur-sm">
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5" style={{ maxHeight: inline ? 380 : 460 }}>
          {messages.map((m, i) => (
            <Bubble key={i} {...m} persona={persona} onPlay={(t) => speak(t, true)} />
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-ink-mute">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40" />
              {persona.name} 正在思考…
            </div>
          )}

          {/* 趣味问答卡片 */}
          {quiz && (
            <div className="rounded-2xl border border-celadon/40 bg-celadon/5 p-4">
              <p className="text-xs font-medium tracking-wide text-celadon-dark">趣味问答</p>
              <p className="mt-2 font-serif text-sm font-semibold text-ink">{quiz.question}</p>
              <div className="mt-3 space-y-2">
                {quiz.options.map((opt, idx) => {
                  const picked = quizPick === idx
                  const correct = quiz.answerIndex === idx
                  const revealed = quizPick !== null
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={revealed}
                      onClick={() => {
                        setQuizPick(idx)
                        setAvatarState(idx === quiz.answerIndex ? 'happy' : 'idle')
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        revealed && correct
                          ? 'border-celadon bg-celadon/15 text-ink'
                          : picked
                            ? 'border-cinnabar/60 bg-cinnabar/10 text-ink'
                            : 'border-line bg-white text-ink-soft hover:border-celadon/50'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                      {revealed && correct && <span className="ml-2 text-xs text-celadon-dark">正确</span>}
                      {revealed && picked && !correct && <span className="ml-2 text-xs text-cinnabar">再想想</span>}
                    </button>
                  )
                })}
              </div>
              {quizPick !== null && (
                <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                  {quiz.explain}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-5 mb-2 rounded-xl border border-cinnabar/30 bg-cinnabar/5 px-3 py-2 text-xs text-cinnabar">
            {error}
          </div>
        )}

        {/* 快捷动作 */}
        <div className="flex flex-wrap gap-2 px-5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => onAction(a.key)}
              disabled={submitting}
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-ink-soft transition hover:border-cinnabar/40 hover:text-cinnabar disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* 输入区 */}
        <div className="flex items-center gap-2 border-t border-line/70 p-4">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            aria-label={recording ? '结束录音' : '语音提问'}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
              recording
                ? 'animate-pulse border-cinnabar bg-cinnabar text-white'
                : 'border-line bg-white text-ink-soft hover:border-cinnabar/40 hover:text-cinnabar'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(input)
              }
            }}
            placeholder={
              recording ? '正在录音，再点一次麦克风结束…' : `问问${persona.name}关于${persona.heritage}的事…`
            }
            disabled={recording || transcribing}
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-cinnabar/60 focus:ring-2 focus:ring-cinnabar/15 disabled:bg-paper"
          />
          <button
            type="button"
            onClick={() => ask(input)}
            disabled={!input.trim() || submitting}
            className="h-10 shrink-0 rounded-full bg-cinnabar px-5 text-sm font-medium text-white transition hover:bg-cinnabar-dark disabled:opacity-40"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}

/* 单条消息气泡 */
function Bubble({ role, text, sources = [], persona, onPlay }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[86%] ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <p className="mb-1 text-[11px] text-ink-mute">
            {persona?.name} · {persona?.title}
          </p>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-md bg-cinnabar text-white'
              : 'rounded-bl-md border border-line bg-white text-ink'
          }`}
        >
          {text}
        </div>
        {!isUser && onPlay && (
          <button
            type="button"
            onClick={() => onPlay(text)}
            aria-label="播放这条回答"
            title="播放这条回答"
            className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[11px] text-ink-mute transition hover:border-cinnabar/40 hover:text-cinnabar"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7Z" />
            </svg>
            播放
          </button>
        )}
        {sources?.length > 0 && (
          <div className="mt-2 space-y-1">
            {sources.slice(0, 2).map((s, i) => (
              <div key={i} className="rounded-lg bg-paper px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">{s.title}</span>
                {s.matchType && (
                  <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-ink-mute">
                    {s.matchType === 'vector' ? '语义命中' : '关键词命中'}
                  </span>
                )}
                <p className="mt-1 line-clamp-2 text-ink-mute">{s.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
