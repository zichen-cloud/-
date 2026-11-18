/* ============================================================
 * DynamicHeritageBackground：首页沉浸式东方动态背景
 * ------------------------------------------------------------
 * 六层叠加，全部 pointer-events-none，永远位于内容下方：
 *   ① 柔光层：金 / 青绿两团超大模糊光晕，缓慢呼吸
 *   ② 远山：淡墨剪影，极慢横移（80s 一轮，几乎察觉不到但"活着"）
 *   ③ 近山：更实的墨色剪影，反向漂移
 *   ④ 云雾：横向半透明雾带缓慢流动
 *   ⑤ 纹样：剪纸团花 / 青花纹 / 缠枝纹 / 祥云，缓慢浮动与呼吸
 *   ⑥ 金色微粒：Canvas 绘制，数量随屏幕面积缩放，移动端更少
 * 另外：滚动时各层以不同速度位移，形成轻微空间层次（parallax）。
 *
 * 约束：
 *   · 装饰强度刻意压低（最大不透明度 ~0.18），不遮挡标题与按钮；
 *   · 只在浏览器可见时跑 rAF，切到后台立刻停止；
 *   · 系统「减少动态效果」时全部静态化。
 * ============================================================ */
import { useEffect, useRef } from 'react'

const VARIANTS = {
  ink: {
    far: 'rgba(58,52,44,0.11)',
    mid: 'rgba(42,39,34,0.17)',
    mist: 'rgba(255,255,255,0.55)',
    particle: '214,178,110',
    motif: 'cloud',
    motifColor: 'rgba(140,120,90,0.55)',
  },
  papercut: {
    far: 'rgba(178,58,46,0.10)',
    mid: 'rgba(140,42,34,0.14)',
    mist: 'rgba(255,250,240,0.5)',
    particle: '224,162,63',
    motif: 'papercut',
    motifColor: 'rgba(178,58,46,0.5)',
  },
  porcelain: {
    far: 'rgba(52,84,140,0.10)',
    mid: 'rgba(38,62,110,0.14)',
    mist: 'rgba(248,250,255,0.5)',
    particle: '150,180,210',
    motif: 'porcelain',
    motifColor: 'rgba(52,84,140,0.45)',
  },
  embroidery: {
    far: 'rgba(78,127,107,0.10)',
    mid: 'rgba(52,92,76,0.14)',
    mist: 'rgba(252,255,250,0.5)',
    particle: '196,160,90',
    motif: 'embroidery',
    motifColor: 'rgba(78,127,107,0.45)',
  },
}

const ALL_LAYERS = ['light', 'far', 'mid', 'mist', 'pattern', 'gold']

export default function DynamicHeritageBackground({
  variant = 'ink',
  layers = ALL_LAYERS,
  intensity = 1,
  className = '',
}) {
  const theme = VARIANTS[variant] || VARIANTS.ink
  const parallaxRef = useRef(null)
  const has = (name) => layers.includes(name)

  /* 滚动视差：按 data-speed 位移外层包裹，内层保留自己的 CSS 漂移动画 */
  useEffect(() => {
    const root = parallaxRef.current
    if (!root) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    let ticking = false
    const apply = () => {
      const y = Math.min(window.scrollY || 0, 1100)
      root.querySelectorAll('[data-speed]').forEach((el) => {
        const f = Number(el.dataset.speed) || 0
        el.style.transform = `translate3d(0, ${(-y * f).toFixed(2)}px, 0)`
      })
      ticking = false
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={parallaxRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ opacity: intensity }}
    >
      {/* ① 柔光 */}
      {has('light') && (
        <>
          <span className="dhb-glow dhb-glow--gold" />
          <span className="dhb-glow dhb-glow--celadon" />
        </>
      )}

      {/* ② 远山 + ③ 近山 */}
      {has('far') && (
        <div className="absolute inset-x-[-4%] bottom-0 h-[62%]" data-speed="0.06">
          <svg className="dhb-drift-slow h-full w-full" viewBox="0 0 1440 420" preserveAspectRatio="none">
            <path
              d="M0 300 C 150 250, 260 200, 420 240 C 580 280, 660 205, 820 225 C 980 245, 1080 180, 1230 230 C 1330 262, 1390 286, 1440 268 L1440 420 L0 420 Z"
              fill={theme.far}
            />
          </svg>
        </div>
      )}
      {has('mid') && (
        <div className="absolute inset-x-[-3%] bottom-[-2%] h-[46%]" data-speed="0.11">
          <svg className="dhb-drift h-full w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path
              d="M0 250 C 120 200, 240 172, 380 210 C 520 248, 620 176, 780 200 C 940 224, 1040 158, 1200 196 C 1310 222, 1380 246, 1440 228 L1440 320 L0 320 Z"
              fill={theme.mid}
            />
          </svg>
        </div>
      )}

      {/* ④ 云雾 */}
      {has('mist') && (
        <div className="absolute inset-0" data-speed="0.16">
          <span className="dhb-mist dhb-mist--1" style={{ background: `linear-gradient(90deg, transparent, ${theme.mist}, transparent)` }} />
          <span className="dhb-mist dhb-mist--2" style={{ background: `linear-gradient(90deg, transparent, ${theme.mist}, transparent)` }} />
          <span className="dhb-mist dhb-mist--3" style={{ background: `linear-gradient(90deg, transparent, ${theme.mist}, transparent)` }} />
        </div>
      )}

      {/* ⑤ 纹样 */}
      {has('pattern') && (
        <div className="absolute inset-0" data-speed="0.2">
          <Motif
            kind={theme.motif}
            color={theme.motifColor}
            className="dhb-float-a left-[4%] top-[14%] h-[190px] w-[190px] hidden sm:block"
          />
          <Motif
            kind={theme.motif}
            color={theme.motifColor}
            className="dhb-float-b right-[6%] top-[38%] h-[230px] w-[230px] hidden md:block"
          />
          <Motif
            kind="cloud"
            color={theme.motifColor}
            className="dhb-float-c left-[46%] top-[8%] h-[120px] w-[120px] hidden lg:block"
          />
        </div>
      )}

      {/* ⑥ 金色微粒（低于雾层，避免像噪点） */}
      {has('gold') && <GoldParticles rgb={theme.particle} />}

      <style>{CSS}</style>
    </div>
  )
}

/* ---------------- 纹样 ---------------- */
function Motif({ kind, color, className = '' }) {
  const common = {
    viewBox: '0 0 200 200',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (kind === 'papercut') {
    // 剪纸团花：中心花 + 八瓣 + 外圈锯齿
    return (
      <svg className={`pointer-events-none absolute ${className}`} {...common}>
        <circle cx="100" cy="100" r="16" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4
          const x = 100 + Math.cos(a) * 52
          const y = 100 + Math.sin(a) * 52
          return <ellipse key={i} cx={x} cy={y} rx="20" ry="13" transform={`rotate(${(i * 45)} ${x} ${y})`} />
        })}
        <circle cx="100" cy="100" r="80" strokeDasharray="2 6" />
        <circle cx="100" cy="100" r="70" />
      </svg>
    )
  }

  if (kind === 'porcelain') {
    // 青花：同心圈 + 缠枝卷草
    return (
      <svg className={`pointer-events-none absolute ${className}`} {...common}>
        <circle cx="100" cy="100" r="72" strokeDasharray="10 8" />
        <circle cx="100" cy="100" r="52" />
        <path d="M100 34c22 14 34 30 34 46 0 18-16 24-16 38 0 10 10 16 18 16" />
        <path d="M100 166c-22-14-34-30-34-46 0-18 16-24 16-38 0-10-10-16-18-16" />
        <path d="M66 100c10-14 24-18 34-8 10 10 24 6 34-8" />
        <circle cx="100" cy="100" r="10" />
      </svg>
    )
  }

  if (kind === 'embroidery') {
    // 刺绣：细密弧线与花瓣
    return (
      <svg className={`pointer-events-none absolute ${className}`} {...common} strokeWidth="1">
        {Array.from({ length: 6 }).map((_, i) => (
          <path key={i} d={`M20 ${60 + i * 16} C 60 ${28 + i * 16}, 130 ${92 + i * 16}, 180 ${58 + i * 16}`} strokeDasharray="3 5" />
        ))}
        <circle cx="100" cy="88" r="8" />
        <path d="M100 88c-16-6-24-22-16-34 12 2 20 14 16 34Z" />
        <path d="M100 88c16-6 24-22 16-34-12 2-20 14-16 34Z" />
      </svg>
    )
  }

  // cloud：祥云
  return (
    <svg className={`pointer-events-none absolute ${className}`} {...common}>
      <path d="M34 128c-12 0-20-8-20-18 0-11 9-19 20-18 2-16 15-27 31-27 13 0 24 8 28 20 5-4 11-6 18-6 16 0 29 12 29 27 0 2 0 4-1 6 8 2 14 9 14 17 0 10-8 18-19 18H34Z" />
      <path d="M62 106c0-8 6-14 14-14s14 6 14 14" />
      <path d="M104 108c0-7 5-12 12-12s12 5 12 12" />
      <path d="M56 146h74" strokeDasharray="2 6" />
    </svg>
  )
}

/* ---------------- 金色微粒 ---------------- */
function GoldParticles({ rgb = '224,162,63' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let list = []

    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = 40
    const sctx = sprite.getContext('2d')
    const g = sctx.createRadialGradient(20, 20, 0, 20, 20, 20)
    g.addColorStop(0, `rgba(${rgb},0.9)`)
    g.addColorStop(0.4, `rgba(${rgb},0.35)`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    sctx.fillStyle = g
    sctx.fillRect(0, 0, 40, 40)

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const area = rect.width * rect.height
      const count = Math.round(
        Math.min(20, Math.max(6, area / 60000)),
      )
      list = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        r: 0.7 + Math.random() * 2.2,
        vy: 0.05 + Math.random() * 0.16,
        sway: 0.3 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.14 + Math.random() * 0.34,
      }))
      if (reduce) draw()
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      list.forEach((p) => {
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8)
      })
      ctx.restore()
    }

    let t = 0
    const tick = () => {
      const h = canvas.height / dpr
      const w = canvas.width / dpr
      t += 0.01
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      list.forEach((p) => {
        p.y -= p.vy
        p.x += Math.sin(t * p.sway + p.phase) * 0.12
        if (p.y < -10) {
          p.y = h + 10
          p.x = Math.random() * w
        }
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8)
      })
      ctx.restore()
      raf = requestAnimationFrame(tick)
    }

    build()
    if (!reduce) raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(build)
    ro.observe(canvas)
    const onVisibility = () => {
      if (reduce) return
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [rgb])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}

const CSS = `
.dhb-glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  pointer-events: none;
}
.dhb-glow--gold {
  left: 6%;
  top: 8%;
  width: 42vw;
  height: 42vw;
  background: radial-gradient(circle, rgba(224,162,63,.13) 0%, transparent 68%);
  animation: dhbBreathe 18s ease-in-out infinite;
}
.dhb-glow--celadon {
  right: 4%;
  top: 26%;
  width: 38vw;
  height: 38vw;
  background: radial-gradient(circle, rgba(122,152,138,.12) 0%, transparent 70%);
  animation: dhbBreathe 24s ease-in-out infinite reverse;
}
@keyframes dhbBreathe {
  0%, 100% { transform: scale(1); opacity: .85 }
  50% { transform: scale(1.08); opacity: 1 }
}

.dhb-drift { animation: dhbDrift 60s ease-in-out infinite alternate }
.dhb-drift-slow { animation: dhbDriftSlow 90s ease-in-out infinite alternate }
@keyframes dhbDrift {
  0% { transform: translate3d(-1.6%, 0, 0) }
  100% { transform: translate3d(1.6%, -0.6%, 0) }
}
@keyframes dhbDriftSlow {
  0% { transform: translate3d(1.2%, 0, 0) }
  100% { transform: translate3d(-1.2%, 0.8%, 0) }
}

.dhb-mist {
  position: absolute;
  left: -30%;
  width: 160%;
  height: 22%;
  filter: blur(26px);
  opacity: .45;
  will-change: transform;
}
.dhb-mist--1 { top: 26%; animation: dhbMist 46s linear infinite }
.dhb-mist--2 { top: 52%; height: 16%; opacity: .35; animation: dhbMist 62s linear infinite reverse }
.dhb-mist--3 { top: 72%; height: 12%; opacity: .28; animation: dhbMist 78s linear infinite }
@keyframes dhbMist {
  0% { transform: translate3d(-8%, 0, 0) }
  50% { transform: translate3d(8%, -1%, 0) }
  100% { transform: translate3d(-8%, 0, 0) }
}

.dhb-float-a { animation: dhbFloatA 26s ease-in-out infinite }
.dhb-float-b { animation: dhbFloatB 34s ease-in-out infinite }
.dhb-float-c { animation: dhbFloatA 42s ease-in-out infinite reverse }
@keyframes dhbFloatA {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: .55 }
  50% { transform: translate3d(0, -14px, 0) rotate(3deg); opacity: .8 }
}
@keyframes dhbFloatB {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg); opacity: .45 }
  50% { transform: translate3d(-10px, 10px, 0) rotate(2deg); opacity: .7 }
}

@media (prefers-reduced-motion: reduce) {
  .dhb-glow--gold, .dhb-glow--celadon,
  .dhb-drift, .dhb-drift-slow,
  .dhb-mist--1, .dhb-mist--2, .dhb-mist--3,
  .dhb-float-a, .dhb-float-b, .dhb-float-c { animation: none !important }
}
`
