/* ============================================================
 * AI 非遗导师 Chat
 * ------------------------------------------------------------
 * 页面职责：管理对话状态并把消息渲染成气泡（UI 细节在文件底部的
 * 内部子组件 MessageBubble / TypingBubble 中）。
 *
 * 数据流：
 *   用户输入 → chatService.sendChatMessage() → POST /api/chat
 *   → FastAPI(chat.py → chat_service → ai_service mock) → 返回回答
 *
 * 三种界面状态：
 *   - 正常：消息气泡依次排列
 *   - 加载中：对话区末尾显示"导师正在输入"气泡
 *   - 出错：输入框上方显示错误横幅（含"重试"按钮）
 * ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { checkChatHealth, sendChatMessage } from '../services/chatService.js'
import { InkBand } from '../components/decor/OrientalDecor.jsx'

/* 不同后端模式下的欢迎语与提示文案 */
const COPY = {
  checking: {
    welcome: '正在连接导师服务…',
    badge: '正在连接…',
    intro:
      '一位随时在线的非遗向导。正在确认后端服务状态，请稍候。',
    footer: '',
  },
  ai: {
    welcome:
      '嘿，你好呀！我是狮小灵，一只守护南派醒狮文化的红金小醒狮~\n' +
      '别看我长得毛绒绒的，我对非遗可是门儿清！' +
      '我的回答会优先参考本地非遗知识库，并在下方附上知识来源；' +
      '知识库里没有的内容嘛……我会老实告诉你"超出我的小脑瓜收藏啦"，绝不瞎编。\n' +
      '来，先试试下面的问题呗：',
    badge: '狮小灵在线',
    intro:
      '狮小灵，一位守护中国非遗南派醒狮文化的少年灵体，' +
      '优先依据本地非遗知识库回答，附上知识来源；资料不足时会坦诚说明，绝不编造历史与认定信息。',
    footer: '知识来自本地非遗知识库，仅供参考；非遗历史、流派与认定信息请以权威资料为准',
  },
  mock: {
    welcome:
      '嘿，你好呀！我是狮小灵，一只守护南派醒狮文化的红金小醒狮~\n' +
      '不过现在我处在"闭关修炼"模式（本地演示），没法调用大模型，' +
      '回答都是本地知识库里的存货，凑合着先聊两毛钱的呗！\n' +
      '你可以先试试下面的问题，或者直接问我别的非遗知识：',
    badge: '狮小灵（修炼中）',
    intro:
      '狮小灵，一位守护中国非遗南派醒狮文化的少年灵体。' +
      '当前为本地演示模式，回答来自本地知识库；后续接入大模型后会更机灵！',
    footer: '当前为本地演示模式，回答仅供开发调试与功能演示，不代表最终版本',
  },
  offline: {
    welcome: '导师服务未启动，请先在 backend 目录运行 uvicorn，然后刷新页面。',
    badge: '后端未启动',
    intro: '当前无法连接后端服务，发送消息会失败。请启动 FastAPI 后刷新本页。',
    footer: '',
  },
}

/* 快捷问题：方便演示，也方便测试 */
const QUICK_QUESTIONS = ['剪纸有哪些表现手法？', '昆曲的唱腔有什么特点？', '苏绣的双面绣是什么？']

export default function Chat() {
  // 后端模式：'checking' 检测中 | 'ai' 真实大模型 | 'mock' 演示 | 'offline' 后端未启动
  const [mode, setMode] = useState('checking')

  // 深链自动提问：/chat?topic=苏绣（详情页）或 /chat?q=...（首页探索框）
  // 参数只读取一次并立即清掉，避免刷新页面时重复发送
  const [searchParams, setSearchParams] = useSearchParams()
  const pendingQuestion = useRef(
    (searchParams.get('q') || searchParams.get('topic') || '').trim(),
  )
  const autoSent = useRef(false)
  useEffect(() => {
    if (!pendingQuestion.current) return
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 对话消息列表：{ role: 'user' | 'ai', text: string, sources?: Array }
  const [messages, setMessages] = useState([
    { role: 'ai', text: COPY.checking.welcome, sources: [] },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('') // 错误横幅文案
  const lastQuestion = useRef('') // 记录最近一次提问，用于"重试"

  // 会话标识：每次进入页面生成一个
  const sessionId = useRef(`session_${Date.now().toString(36)}`)

  // 页面加载时查询后端模式，决定徽章与欢迎语
  useEffect(() => {
    checkChatHealth()
      .then((info) => setMode(info.mode === 'ai' ? 'ai' : 'mock'))
      .catch(() => setMode('offline'))
  }, [])

  const copy = useMemo(() => COPY[mode] ?? COPY.checking, [mode])

  // 徽章颜色：真实 AI 用青瓷绿，Mock 用灰，未连接用朱砂
  const badgeClass = {
    ai: 'bg-celadon/15 text-celadon-dark',
    mock: 'bg-ink/10 text-ink-soft',
    checking: 'bg-ink/10 text-ink-mute',
    offline: 'bg-cinnabar/10 text-cinnabar-dark',
  }[mode]

  // 模式确定后，且用户还没开始对话时，把欢迎语替换成对应模式的版本
  useEffect(() => {
    if (mode === 'checking') return
    setMessages((prev) =>
      prev.length === 1 && prev[0].role === 'ai'
        ? [{ role: 'ai', text: COPY[mode].welcome, sources: [] }]
        : prev,
    )
  }, [mode])

  // 新消息 / 加载状态变化时，自动滚动到对话底部
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  /* 发送消息（点击发送按钮或回车） */
  const handleSend = async (rawText) => {
    const question = (rawText ?? input).trim()

    // 用户输入为空的友好校验
    if (!question) {
      setApiError('请输入问题后再发送')
      return
    }
    if (loading) return

    setApiError('')
    setInput('')
    lastQuestion.current = question
    setMessages((prev) => [...prev, { role: 'user', text: question, sources: [] }])
    setLoading(true)

    try {
      const data = await sendChatMessage(question, sessionId.current)
      // 保存回答 + 知识来源 + 检索状态（第四阶段）
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: data.answer,
          sources: data.sources ?? [],
          retrievalStatus: data.retrieval_status ?? 'empty',
        },
      ])
    } catch (e) {
      // 出错时保留对话记录，只显示错误横幅 + 重试按钮
      setApiError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // 深链自动提问：模式确定后（非 checking/offline）且用户还没开口时，自动发送一次
  useEffect(() => {
    if (autoSent.current) return
    if (mode === 'checking' || mode === 'offline') return
    const q = pendingQuestion.current
    if (!q || messages.length > 1) return
    autoSent.current = true
    handleSend(q)
    // 仅在模式就绪时触发一次；messages/handleSend 有意不加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  /* 清空对话：恢复到当前模式的欢迎语 */
  const handleClear = () => {
    setMessages([{ role: 'ai', text: COPY[mode]?.welcome ?? COPY.checking.welcome, sources: [] }])
    setApiError('')
    setInput('')
  }

  /* 「你还可以问」：基于最近一条 AI 回答命中的知识来源（第一个项目）
     生成 3 条追问建议——历史/技艺问题必然能命中知识库，
     创意建议类则展示导师"区分事实与创意"的能力。
     无来源（无答案拒答）时不显示，由输入区上方的快捷问题兜底。 */
  const followUps = useMemo(() => {
    if (loading) return []
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'ai' || !last.sources?.length) return []
    const name = (last.sources[0].title || '').match(/《(.+?)》/)?.[1]
    if (!name) return []
    return [
      `${name}的历史背景是什么？`,
      `${name}的技艺有什么特点？`,
      `帮我把「${name}」元素用在文创设计里，有什么建议？`,
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading])

  return (
    <div className="relative overflow-x-clip">
      {/* ---------- 页面头部：淡墨山水背景 + 标题 + 导师介绍 ---------- */}
      <section className="relative border-b border-line/70">
        <InkBand src="/images/decor/mentor-scenery.jpg" className="absolute inset-x-0 top-0 h-48 w-full sm:h-56" />
        <div className="container-page relative py-12 md:py-14">
          <div className="relative max-w-2xl">
            {/* 标题区柔光：让文字从山水中浮出来，边缘不可见 */}
            <div className="pointer-events-none absolute -inset-x-6 -inset-y-6 bg-[radial-gradient(ellipse_at_25%_50%,rgba(251,247,240,0.7)_0%,rgba(251,247,240,0.35)_52%,rgba(251,247,240,0)_80%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow">AI Tutor</p>
                {/* 模式徽章：由后端 /api/health 决定（真实 AI / Mock / 未启动） */}
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
                  {copy.badge}
                </span>
              </div>
              <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
                狮小灵
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                {copy.intro}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 聊天主体 ---------- */}
      <section className="container-page py-8">
        <div className="card flex h-[70vh] max-h-[720px] min-h-[480px] flex-col overflow-hidden">
          {/* 对话区域：超出高度时内部滚动 */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-paper/40 px-4 py-5 sm:px-6">
            {messages.map((msg, i) => (
              <div key={i}>
                <MessageBubble
                  role={msg.role}
                  text={msg.text}
                  sources={msg.sources}
                  retrievalStatus={msg.retrievalStatus}
                />
                {/* 「你还可以问」：只挂在最后一条 AI 回答下方 */}
                {!loading && i === messages.length - 1 && followUps.length > 0 && (
                  <FollowUps items={followUps} onAsk={handleSend} />
                )}
              </div>
            ))}

            {/* 加载中：导师"正在输入"气泡 */}
            {loading && <TypingBubble />}

            {/* 滚动锚点 */}
            <div ref={bottomRef} />
          </div>

          {/* 错误提示横幅（不影响已有对话内容） */}
          {apiError && (
            <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-cinnabar/10 px-4 py-2.5 text-xs text-cinnabar-dark sm:mx-6">
              <span className="flex-1 leading-relaxed">{apiError}</span>
              {lastQuestion.current && (
                <button
                  type="button"
                  onClick={() => handleSend(lastQuestion.current)}
                  className="shrink-0 rounded-full bg-cinnabar px-3 py-1 font-medium text-white transition hover:bg-cinnabar-dark"
                >
                  重试
                </button>
              )}
              <button
                type="button"
                onClick={() => setApiError('')}
                className="shrink-0 text-ink-mute transition hover:text-ink"
              >
                关闭
              </button>
            </div>
          )}

          {/* 快捷问题 */}
          <div className="mx-4 mt-3 flex flex-wrap gap-2 sm:mx-6">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => handleSend(q)}
                className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-ink-soft
                  transition hover:border-cinnabar/40 hover:text-cinnabar
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* 输入区 */}
          <div className="px-4 py-4 sm:px-6">
            <form
              className="flex items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
            >
              <textarea
                value={input}
                rows={1}
                maxLength={500}
                disabled={loading}
                onChange={(e) => {
                  setInput(e.target.value)
                  if (apiError) setApiError('') // 重新输入时清除旧错误
                }}
                onKeyDown={(e) => {
                  // 回车发送，Shift+回车 换行
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="输入你的问题，回车发送（Shift + 回车换行）"
                className="max-h-32 flex-1 resize-none rounded-2xl border border-line bg-paper/60 px-4 py-3
                  text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-mute
                  focus:border-cinnabar/50 focus:bg-white focus:ring-2 focus:ring-cinnabar/10
                  disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                发送
              </button>
            </form>

            {/* 清空对话 + 字数提示 */}
            <div className="mt-3 flex items-center justify-between text-xs text-ink-mute">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full px-2 py-1 transition hover:bg-cinnabar/10 hover:text-cinnabar"
              >
                清空对话
              </button>
              <span>{input.length}/500</span>
            </div>
          </div>
        </div>

        {copy.footer && (
          <p className="mt-4 text-center text-xs text-ink-mute">{copy.footer}</p>
        )}
      </section>

      {/* 底部水墨山峦收束，与页脚宣纸衔接 */}
      <InkBand src="/images/decor/mentor-scenery.jpg" anchor="bottom" flip className="h-24 w-full sm:h-36" />
    </div>
  )
}

/* ============================================================
 * 内部子组件 1：消息气泡
 * 用户消息：朱砂底白字，靠右；AI 消息：白底描边 + 印章头像，靠左
 * AI 消息附带 sources（知识来源）时，在气泡下方展示来源列表
 * ============================================================ */
function MessageBubble({ role, text, sources, retrievalStatus }) {
  const isUser = role === 'user'
  const showSources = !isUser && sources && sources.length > 0
  // 第四阶段：keyword_only 时来源证据弱，给轻量提示
  const weakEvidence = !isUser && retrievalStatus === 'keyword_only'

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cinnabar font-serif text-sm font-semibold text-white shadow-sm">
          遗
        </span>
      )}
      <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-md bg-cinnabar text-white'
              : 'rounded-bl-md border border-line bg-white text-ink-soft'
          }`}
        >
          {text}
        </div>

        {/* 知识来源：只有 AI 消息且有来源时展示 */}
        {showSources && (
          <div className="mt-2 w-full rounded-xl border border-celadon/30 bg-celadon/10 px-3.5 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-celadon-dark">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
              </svg>
              知识来源（{sources.length}）
            </p>

            {/* keyword_only 弱证据提示 */}
            {weakEvidence && (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
                以下资料仅为关键词字面命中，可能不完全切题，请谨慎参考
              </p>
            )}

            <ul className="mt-1.5 space-y-2">
              {sources.map((s, idx) => (
                <li key={idx} className="text-xs">
                  {/* 标题 + 机构链接 */}
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-ink-soft">{s.title}：</span>
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-cinnabar hover:underline"
                      >
                        {s.source}
                      </a>
                    ) : (
                      <span className="text-ink-mute">{s.source}</span>
                    )}
                  </div>

                  {/* 徽标行：核验状态 / 名录级别 / 匹配方式 */}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {/* 核验状态：绝不默认标真 */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.verified
                          ? 'bg-celadon/15 text-celadon-dark'
                          : 'bg-ink/10 text-ink-mute'
                      }`}
                    >
                      {s.verified ? '已核验' : '待核验'}
                    </span>

                    {/* 非遗分类 */}
                    {s.category && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink-soft">
                        {s.category}
                      </span>
                    )}

                    {/* 名录级别（截断过长） */}
                    {s.level && (
                      <span className="rounded-full bg-cinnabar/10 px-2 py-0.5 text-[11px] text-cinnabar-dark">
                        {s.level.length > 12 ? `${s.level.slice(0, 12)}…` : s.level}
                      </span>
                    )}

                    {/* 匹配方式：keyword 时提示证据弱 */}
                    {s.matchType === 'keyword' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                        关键词命中
                      </span>
                    )}
                  </div>

                  {/* 原文片段：让前端能直接展示证据 */}
                  {s.snippet && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-ink-mute hover:text-ink">
                        查看原文片段
                      </summary>
                      <p className="mt-1 rounded-lg bg-white/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-soft">
                        {s.snippet}
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
 * 内部子组件 2：加载中的"正在输入"气泡（三个跳动圆点）
 * ============================================================ */
function TypingBubble() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cinnabar font-serif text-sm font-semibold text-white shadow-sm">
        遗
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinnabar/60"
            style={{ animationDelay: `${i * 0.15}s` }}
            aria-hidden
          />
        ))}
        <span className="ml-1 text-xs text-ink-mute">狮小灵正在思考…</span>
      </div>
    </div>
  )
}

/* ============================================================
 * 内部子组件 3：「你还可以问」追问推荐
 * 挂在最后一条 AI 回答下方（左侧缩进对齐气泡内容），
 * 点击即发送该问题；问题由主组件根据命中的知识项目生成。
 * ============================================================ */
function FollowUps({ items, onAsk }) {
  return (
    <div className="ml-[46px] mt-2">
      <p className="flex items-center gap-1.5 text-xs text-ink-mute">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9a2.8 2.8 0 0 1 5.5.7c0 1.8-2.7 2.2-2.7 3.6" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
        你还可以问
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="rounded-full border border-celadon/40 bg-white px-3 py-1.5 text-xs text-ink-soft
              transition hover:border-celadon hover:bg-celadon/10 hover:text-celadon-dark"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
