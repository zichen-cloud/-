/* ============================================================
 * HeritageHotspots：首页动态背景上的「可点击非遗纹样」
 * ------------------------------------------------------------
 * 背景本身仍是纯装饰层（pointer-events-none），这里叠一层轻量的
 * 热点按钮，只有按钮本身可点，不会挡住标题、轮播与任何正文交互。
 *
 * 交互：
 *   点击热点 → 弹出该非遗项目的知识卡（名称 / 门类 / 地区 / 简介 / 标签）
 *   知识卡里可直接「查看详情」进入 /heritage/:id 详情页
 *
 * 可访问性：
 *   · 使用真实 button / a 元素，键盘可 Tab 聚焦、Enter 打开；
 *   · Esc 关闭、点遮罩关闭；打开时锁滚动并把焦点移到关闭按钮；
 *   · 关闭后焦点回到触发它的热点，不打断键盘用户。
 * 性能：热点固定 4 个，无轮询；弹窗按需渲染（createPortal）。
 * ============================================================ */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getItemById } from '../../data/heritageService.js'

/* 热点与非遗项目一一对应：位置经过调整，避开中央标题与轮播圆点 */
const HOTSPOTS = [
  {
    id: 'paper-cutting',
    label: '剪纸 · 团花',
    className: 'left-3 top-[9%] sm:left-[6%] sm:top-[24%]',
    icon: 'papercut',
  },
  {
    id: 'jingdezhen-porcelain',
    label: '青花 · 瓷',
    className: 'right-3 top-[9%] sm:right-[6%] sm:top-[22%]',
    icon: 'porcelain',
  },
  {
    id: 'shadow-play',
    label: '皮影 · 灯影',
    className: 'hidden sm:inline-flex left-[8%] bottom-[16%]',
    icon: 'shadow',
  },
  {
    id: 'suzhou-embroidery',
    label: '苏绣 · 丝线',
    className: 'hidden sm:inline-flex right-[8%] bottom-[18%]',
    icon: 'embroidery',
  },
]

export default function HeritageHotspots() {
  const [activeId, setActiveId] = useState('')
  const [hoveredId, setHoveredId] = useState('')
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  const item = activeId ? getItemById(activeId) : null

  const open = (id, e) => {
    triggerRef.current = e.currentTarget
    setActiveId(id)
  }

  const close = useCallback(() => {
    setActiveId('')
    // 焦点还给触发按钮，键盘用户不会"丢位置"
    triggerRef.current?.focus?.()
  }, [])

  /* Esc 关闭 + 打开时锁背景滚动 */
  useEffect(() => {
    if (!item) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // 打开后把焦点移进弹窗
    const t = setTimeout(() => closeRef.current?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [item, close])

  return (
    <>
      {/* 热点层：整体不拦截鼠标，只有按钮可点 */}
      <div className="pointer-events-none absolute inset-0 z-20" aria-label="非遗纹样探索">
        {HOTSPOTS.map((h) => {
          const data = getItemById(h.id)
          if (!data) return null
          const isHover = hoveredId === h.id
          return (
            <button
              key={h.id}
              type="button"
              onClick={(e) => open(h.id, e)}
              onMouseEnter={() => setHoveredId(h.id)}
              onMouseLeave={() => setHoveredId('')}
              onFocus={() => setHoveredId(h.id)}
              onBlur={() => setHoveredId('')}
              aria-label={`了解${data.name}（${data.category}）`}
              title={`点击了解${data.name}`}
              className={`pointer-events-auto group absolute inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-white/70 px-2.5 py-1 text-[10px] tracking-wide text-ink-soft shadow-[0_4px_14px_rgba(38,36,31,0.10)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-cinnabar/50 hover:text-cinnabar hover:shadow-[0_8px_20px_rgba(38,36,31,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cinnabar/40 motion-reduce:transition-none ${h.className}`}
            >
              {/* 呼吸金点：提示"这里可以点" */}
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-gold/60 animate-ping motion-reduce:animate-none" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-gold" />
              </span>
              <span className="whitespace-nowrap">{h.label}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`transition-transform duration-300 ${isHover ? 'translate-x-0.5' : ''}`}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* 知识弹窗（Portal 到 body，避免被 hero 的 overflow-hidden 裁切） */}
      {item &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hs-modal-title"
          >
            {/* 遮罩：点击关闭 */}
            <div
              className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-fade-in"
              onClick={close}
              aria-hidden="true"
            />
            {/* 知识卡 */}
            <div className="hs-card relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_28px_70px_rgba(28,24,18,0.35)]">
              {/* 宣纸纹理 */}
              <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  backgroundImage: "url('/images/home/paper-texture.jpg')",
                  backgroundSize: '520px',
                }}
                aria-hidden="true"
              />
              {/* 右上朱砂印 */}
              <span
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-[5px] bg-cinnabar font-serif text-[11px] leading-none text-white shadow-sm"
                style={{ writingMode: 'vertical-rl' }}
                aria-hidden="true"
              >
                非遗
              </span>

              <div className="relative px-6 pb-6 pt-6">
                <p className="eyebrow">Heritage Knowledge</p>
                <h3 id="hs-modal-title" className="mt-2 pr-10 font-serif text-2xl font-semibold text-ink">
                  {item.name}
                </h3>
                <p className="mt-1 text-xs text-ink-mute">
                  {item.category} · {item.region}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-ink-soft">{item.summary}</p>

                {item.tags?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 4).map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <Link
                    to={`/heritage/${item.id}`}
                    className="btn-primary"
                    onClick={() => setActiveId('')}
                  >
                    查看详情
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h13M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                  <button ref={closeRef} type="button" onClick={close} className="btn-ghost">
                    知道了
                  </button>
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-ink-mute/80">
                  内容为演示用的常识性整理，非官方名录发布；详情页可查看来源与待核实说明。
                </p>
              </div>
            </div>

            <style>{`
              .hs-card { animation: hsCardIn .26s cubic-bezier(.2,.7,.3,1) both }
              @keyframes hsCardIn {
                from { opacity: 0; transform: translateY(10px) scale(.97) }
                to { opacity: 1; transform: none }
              }
              @media (prefers-reduced-motion: reduce) {
                .hs-card { animation: none }
              }
            `}</style>
          </div>,
          document.body,
        )}
    </>
  )
}
