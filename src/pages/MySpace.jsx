/* ============================================================
 * 我的 MySpace（/me）——「我的非遗创作空间」
 * ------------------------------------------------------------
 * 聚合页：创作统计、最近作品、我的收藏、AI 学习记录。
 * 数据全部来自真实后端（/api/works、/api/favorites、/api/study-log），
 * 后端不可达时如实提示，不伪造数据。
 * ============================================================ */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listWorks } from '../services/studioService.js'
import { listFavorites, removeFavorite } from '../services/favoriteService.js'
import { listStudyLog } from '../services/studyLogService.js'
import { logout, currentUser } from '../utils/auth.js'
import { useIntro } from '../context/IntroContext.jsx'
import { InkBand } from '../components/decor/OrientalDecor.jsx'

export default function MySpace() {
  const navigate = useNavigate()
  const user = currentUser()
  const { replay } = useIntro()
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('')

  const [favorites, setFavorites] = useState([])
  const [favState, setFavState] = useState('loading') // loading | ready | offline
  const [removingId, setRemovingId] = useState('')

  const [logs, setLogs] = useState([])
  const [logState, setLogState] = useState('loading') // loading | ready | offline

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 作品
      try {
        const { works: list, source: src } = await listWorks()
        if (cancelled) return
        setWorks([...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
        setSource(src)
      } catch {
        if (!cancelled) setWorks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
      // 收藏
      try {
        const favs = await listFavorites()
        if (cancelled) return
        setFavorites(favs)
        setFavState('ready')
      } catch {
        if (!cancelled) setFavState('offline')
      }
      // 学习记录
      try {
        const records = await listStudyLog(20)
        if (cancelled) return
        setLogs(records)
        setLogState('ready')
      } catch {
        if (!cancelled) setLogState('offline')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRemoveFavorite(favId) {
    if (removingId) return
    setRemovingId(favId)
    try {
      await removeFavorite(favId)
      setFavorites((prev) => prev.filter((f) => f.id !== favId))
    } catch {
      // 删除失败保持原状；用户可重试
    } finally {
      setRemovingId('')
    }
  }

  /* 退出登录：清除本地登录态后回到登录页（路由守卫会拦截未登录请求） */
  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  /* 创作统计：全部来自真实数据 */
  const total = works.length
  const withVideo = works.filter((w) => w.videoUrl).length
  const favCount = favState === 'ready' ? favorites.length : 0
  const latest = works[0]
  const latestText = latest
    ? new Date(latest.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '—'

  const heritageFavs = favorites.filter((f) => f.type === 'heritage')
  const workFavs = favorites.filter((f) => f.type === 'work')

  return (
    <div className="relative overflow-x-clip">
      {/* 顶部青山：层叠远山铺满整幅，向下雾化融入宣纸底 */}
      {/* 页头：文人书房水墨静物（案几、兰草、画卷与窗外青山），左右镜像让画面重心避开居中标题 */}
      <InkBand
        src="/images/decor/myspace-scenery.jpg"
        flip
        className="absolute inset-x-0 top-0 h-56 w-full sm:h-72"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-16">
      {/* 页面头部：英文小标 + 大标题 + 一行说明，整体居中 */}
      <header className="relative text-center">
        {/* 标题区一层看不见边的柔光，让字从山水中浮出来 */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[min(720px,100%)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(251,247,240,0.72)_0%,rgba(251,247,240,0.4)_48%,rgba(251,247,240,0)_78%)]" />
        <div className="relative">
          <p className="eyebrow">My Space</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            我的非遗创作空间
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
            这里汇总你的创作足迹：从探索非遗到生成属于自己的数字文创。
          </p>
        </div>
      </header>

      {/* 创作统计：四张扁平数据卡，数字用宋体放大（真实数据） */}
      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <StatCard label="已保存作品" value={loading ? '—' : `${total} 件`} />
        <StatCard label="含介绍视频" value={loading ? '—' : `${withVideo} 件`} />
        <StatCard label="我的收藏" value={favState === 'loading' ? '—' : `${favCount} 项`} />
        <StatCard label="最近创作" value={loading ? '—' : latestText} />
      </div>

      {/* 快捷入口：朱砂主按钮 + 两枚鎏金描边按钮 */}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/studio" className="btn-primary px-7">
          去创作新作品
        </Link>
        <Link to="/works" className="btn-ghost border-gold/45 px-7">
          管理我的作品
        </Link>
        <Link to="/gallery" className="btn-ghost border-gold/45 px-7">
          参观作品展厅
        </Link>
      </div>

      {/* 账号条：低调的一行，放在主操作之后，不抢视觉重心 */}
      <div className="mt-12 flex flex-col items-center justify-between gap-3 border-y border-line/80 py-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cinnabar/10 font-serif text-sm font-bold text-cinnabar">
            {user?.name ? user.name.charAt(0).toUpperCase() : '游'}
          </span>
          <span className="text-xs text-ink-mute">
            <span className="font-medium text-ink-soft">{user?.name || '访客用户'}</span>
            {user ? ' · 已登录演示账号' : ' · 未登录'}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* 个人设置入口：重新观看开场卷轴（不改登录态、不跳登录页） */}
          <button
            type="button"
            onClick={replay}
            className="inline-flex items-center gap-1.5 text-xs text-ink-mute transition hover:text-gold-dark"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3.2-6.9" />
              <path d="M21 4v5h-5" />
            </svg>
            重看开场卷轴
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-ink-mute transition hover:text-cinnabar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            退出登录
          </button>
        </div>
      </div>

      {/* 最近作品：最多 3 件缩略卡（管理功能在 /works） */}
      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Recent Works</p>
            <h2 className="section-title mt-2">最近作品</h2>
          </div>
          <Link to="/works" className="shrink-0 text-sm text-ink-soft transition hover:text-cinnabar">
            管理全部 →
          </Link>
        </div>
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-3xl bg-paper" />
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#E6DCC5] bg-white/35 px-6 py-12 text-center">
            <p className="text-sm text-ink-soft">还没有作品，去创作工坊开始第一件吧。</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {works.slice(0, 3).map((w) => (
              <Link
                key={w.id}
                to="/works"
                className="group overflow-hidden rounded-2xl border border-[#EBE1CC] bg-white/65 transition hover:-translate-y-1 hover:border-gold/45 hover:shadow-md"
              >
                <div className="aspect-[4/3] overflow-hidden bg-paper">
                  {w.imageUrl ? (
                    <img
                      src={w.imageUrl}
                      alt={w.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-ink-mute">暂无效果图</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate font-serif text-sm font-semibold text-ink">{w.title}</p>
                  <p className="mt-1 truncate text-xs text-ink-mute">
                    {[w.themeName, w.createTypeName].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 我的收藏（真实数据：非遗项目 + 作品） */}
      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Favorites</p>
            <h2 className="section-title mt-2">我的收藏</h2>
          </div>
          <Link to="/heritage" className="shrink-0 text-sm text-ink-soft transition hover:text-cinnabar">
            去探索非遗 →
          </Link>
        </div>
        {favState === 'loading' ? (
          <div className="mt-8 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-paper" />
            ))}
          </div>
        ) : favState === 'offline' ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#E6DCC5] bg-white/35 px-6 py-10 text-center">
            <p className="text-sm text-ink-soft">收藏功能需要启动后端服务，当前无法读取收藏数据。</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#E6DCC5] bg-white/35 px-6 py-10 text-center">
            <p className="text-sm text-ink-soft">还没有收藏。在非遗详情页点击「收藏这项非遗」，就会出现在这里。</p>
            <Link to="/heritage" className="btn-ghost mt-5 inline-flex">
              去探索非遗
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* 收藏的非遗项目 */}
            {heritageFavs.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {heritageFavs.map((f) => (
                  <div key={f.id} className="rounded-3xl border border-[#EBE1CC] bg-white/60 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/heritage/${encodeURIComponent(f.targetId)}`}
                          className="truncate font-serif text-base font-semibold text-ink transition hover:text-cinnabar"
                        >
                          {f.snapshot?.name || f.targetId}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {f.snapshot?.category && <span className="chip">{f.snapshot.category}</span>}
                          {f.snapshot?.region && <span className="chip">{f.snapshot.region}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavorite(f.id)}
                        disabled={removingId === f.id}
                        title="取消收藏"
                        className="shrink-0 rounded-full p-1.5 text-ink-mute transition hover:bg-cinnabar/10 hover:text-cinnabar disabled:opacity-50"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {f.snapshot?.summary && (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-soft">{f.snapshot.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* 收藏的作品 */}
            {workFavs.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {workFavs.map((f) => (
                  <div key={f.id} className="rounded-3xl border border-[#EBE1CC] bg-white/60 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-serif text-base font-semibold text-ink">
                          {f.snapshot?.title || f.targetId}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="chip">作品</span>
                          {f.snapshot?.themeName && <span className="chip">{f.snapshot.themeName}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavorite(f.id)}
                        disabled={removingId === f.id}
                        title="取消收藏"
                        className="shrink-0 rounded-full p-1.5 text-ink-mute transition hover:bg-cinnabar/10 hover:text-cinnabar disabled:opacity-50"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <Link to="/works" className="mt-3 inline-block text-xs text-ink-soft transition hover:text-cinnabar">
                      在我的作品中查看 →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* AI 学习记录（真实数据：最近成功问答的摘要） */}
      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Study Log</p>
            <h2 className="section-title mt-2">AI 学习记录</h2>
          </div>
          <Link to="/chat" className="shrink-0 text-sm text-ink-soft transition hover:text-cinnabar">
            继续向 AI 导师提问 →
          </Link>
        </div>
        {logState === 'loading' ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-paper" />
            ))}
          </div>
        ) : logState === 'offline' ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#E6DCC5] bg-white/35 px-6 py-10 text-center">
            <p className="text-sm text-ink-soft">学习记录需要启动后端服务，当前无法读取。</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#E6DCC5] bg-white/35 px-6 py-10 text-center">
            <p className="text-sm text-ink-soft">还没有提问记录。向 AI 导师提一个问题，这里就会留下你的学习足迹。</p>
            <Link to="/chat" className="btn-ghost mt-5 inline-flex">
              去问问 AI 导师
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {logs.map((log, idx) => (
              <div key={`${log.ts}-${idx}`} className="rounded-2xl border border-[#EBE1CC] bg-white/60 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{log.question}</p>
                  <RetrievalBadge status={log.retrievalStatus} />
                  <span className="text-xs text-ink-mute">{formatTime(log.ts)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">{log.answerPreview}</p>
              </div>
            ))}
            <p className="pt-1 text-center text-xs text-ink-mute">仅保留最近 20 条提问摘要，完整回答请回到 AI 导师对话中查看。</p>
          </div>
        )}
      </section>

      {source === 'local' && (
        <p className="mt-10 text-center text-xs text-ink-mute">
          当前作品数据保存在本机浏览器，连上服务后会自动迁移到服务器。
        </p>
      )}
      </div>

      {/* 底部青山压脚：与页脚宣纸自然衔接 */}
      <InkBand anchor="bottom" flip className="h-32 w-full sm:h-48" />
    </div>
  )
}

/* ============================================================
 * 内部子组件
 * ============================================================ */
function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#EBE1CC] bg-gradient-to-b from-white/60 to-white/35 px-4 py-7 text-center backdrop-blur-[1px] transition hover:border-gold/45">
      <p className="font-serif text-3xl font-semibold leading-none text-ink">{value}</p>
      <p className="mt-3 text-xs tracking-wide text-ink-mute">{label}</p>
    </div>
  )
}

/* 检索质量徽标：与 AI 导师页的口径一致（仅区分"有资料支撑"与"弱证据"） */
function RetrievalBadge({ status }) {
  if (status === 'ok') {
    return <span className="shrink-0 rounded-full bg-celadon/10 px-2 py-0.5 text-[10px] text-celadon-dark">资料命中</span>
  }
  if (status === 'keyword_only') {
    return <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-ink-soft">关键词命中</span>
  }
  if (status === 'empty' || status === 'degraded') {
    return <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-mute">无资料命中</span>
  }
  return null
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
