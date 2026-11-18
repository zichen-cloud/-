/* ============================================================
 * 数字传承人 Persona（/persona）
 * ------------------------------------------------------------
 * 角色选择页：五位非遗萌宠 + 一张通用形象「小灵」。
 *   ① 点击角色卡 → 从右下角唤醒对应萌宠（全局唯一实例）
 *   ② 页面上只保留轻量的角色介绍，不再占用大块空间做聊天面板
 *   ③ 支持 ?id=papercut 直达
 *
 * 聊天、语音、拖动等交互全部在桌宠小窗内完成，
 * 因此离开本页后对话也不会中断。
 * ============================================================ */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Reveal from '../components/common/Reveal.jsx'
import PersonaAvatar from '../components/persona/PersonaAvatar.jsx'
import { listPersonas } from '../services/personaService.js'
import { usePersonaPet } from '../context/PersonaPetContext.jsx'

export default function Persona() {
  const [params] = useSearchParams()
  const [personas, setPersonas] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { wakeHeritage } = usePersonaPet()

  // 唤醒专属传承人：狮小灵先介绍，再让对应角色苏醒
  const wake = (p) => {
    setActive(p)
    wakeHeritage(p)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listPersonas()
        if (cancelled) return
        setPersonas(list)
        // 支持 ?id=papercut 直达
        const wanted = params.get('id')
        if (wanted) {
          const hit = list.find((p) => p.id === wanted)
          if (hit) {
            setActive(hit)
            wakeHeritage(hit)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || '数字传承人加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
      <header className="text-center">
        <p className="eyebrow">Digital Inheritors</p>
        <h1 className="section-title mt-2">AI 非遗萌宠</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
          狮小灵是常驻全站的 AI 导师；下面这五位是「识别成功后才苏醒」的专属数字传承人。
          点一下卡片，它们会听过狮小灵的引荐，再从各自的纹样里苏醒过来。
        </p>
      </header>

      {loading && (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/70" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-10 rounded-2xl border border-line bg-white px-6 py-10 text-center">
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {/* ============ 已选择：轻量介绍，聊天在桌宠里 ============ */}
      {!loading && active && (
        <div className="mt-10 flex flex-wrap items-center gap-5 rounded-3xl border border-line bg-white/85 p-5 sm:p-6">
          <PersonaAvatar persona={active} state="happy" size={150} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Awake</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">{active.name}</h2>
            <p className="mt-1 text-xs tracking-wide text-ink-mute">{active.title}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{active.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => wakeHeritage(active)} className="btn-primary">
                请它再讲一次
              </button>
              <button type="button" onClick={() => setActive(null)} className="btn-secondary">
                换一位传承人
              </button>
            </div>
            {active.story && (
              <div className="mt-4 max-w-xl rounded-2xl border border-line/70 bg-paper/60 px-4 py-3">
                <p className="text-[11px] font-medium tracking-wide text-ink-mute">它的来历 · 角色设定故事</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{active.story}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-mute">
              专属传承人会先听狮小灵引荐，再从自己的纹样里苏醒；右下角的狮小灵随时可以陪你聊。
            </p>
          </div>
        </div>
      )}

      {/* ============ 角色卡 ============ */}
      {!loading && !error && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <button
                type="button"
                onClick={() => wake(p)}
                className={`group relative flex w-full flex-col items-center overflow-hidden rounded-3xl border bg-white/85 px-5 pb-6 pt-4 text-center transition duration-300 hover:-translate-y-1 hover:border-cinnabar/30 hover:shadow-[0_16px_40px_rgba(38,36,31,0.12)] ${
                  active?.id === p.id ? 'border-cinnabar/45' : 'border-line'
                }`}
              >
                {/* 右上角朱砂小印 */}
                <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-[3px] bg-cinnabar/85" />
                <PersonaAvatar persona={p} state="idle" size={172} />
                <p className="mt-1 font-serif text-lg font-semibold text-ink">{p.name}</p>
                <p className="mt-1 text-xs tracking-wide text-ink-mute">{p.title}</p>
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-soft">{p.tagline}</p>
                <span className="mt-4 rounded-full border border-line px-4 py-1.5 text-xs text-ink-soft transition group-hover:border-cinnabar/40 group-hover:text-cinnabar">
                  {active?.id === p.id ? '已在右下角 · 点我再叫一次' : '唤醒 · 开始聊天'}
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
