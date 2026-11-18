/* ============================================================
 * InkBackdrop：动态水墨氛围背景层
 * ------------------------------------------------------------
 * 只负责「氛围」，永远位于内容层下方（pointer-events-none + -z-10 由调用方控制），
 * 不参与交互、不遮挡文字与按钮。由三部分组成：
 *
 *   ① 墨晕层：3-4 团超大高斯模糊色斑，缓慢漂移 + 呼吸缩放
 *      （CSS 动画，GPU 合成，几乎无 CPU 开销）
 *   ② 墨点粒子：Canvas 绘制缓慢上浮的墨屑/纸纤维颗粒
 *      （预渲染精灵图 + drawImage，30 个粒子每帧开销可忽略）
 *   ③ 滚动视差：滚动时墨晕层以 0.12 倍速位移，产生轻微层次感
 *
 * 不同非遗主题使用不同色相：水墨（墨）/ 剪纸（朱砂）/ 刺绣（青绿）/ 陶瓷（青花蓝）。
 * 当系统开启「减弱动态效果」时：不启动粒子动画、关闭漂移，只保留静态晕染。
 * ============================================================ */
import { useEffect, useRef } from 'react'

/* 主题：墨晕色斑（位置/尺寸/颜色）与粒子颜色 */
const THEMES = {
  ink: {
    blobs: [
      { x: '8%', y: '12%', size: '46vw', color: 'rgba(42,39,34,0.16)', anim: 'animate-ink-drift' },
      { x: '62%', y: '-6%', size: '38vw', color: 'rgba(58,52,44,0.12)', anim: 'animate-ink-drift-slow' },
      { x: '72%', y: '48%', size: '42vw', color: 'rgba(42,39,34,0.10)', anim: 'animate-ink-drift' },
      { x: '26%', y: '58%', size: '34vw', color: 'rgba(122,152,138,0.10)', anim: 'animate-ink-drift-slow' },
    ],
    particle: '42,39,34',
  },
  papercut: {
    blobs: [
      { x: '10%', y: '8%', size: '42vw', color: 'rgba(178,58,46,0.13)', anim: 'animate-ink-drift' },
      { x: '66%', y: '4%', size: '36vw', color: 'rgba(196,120,60,0.10)', anim: 'animate-ink-drift-slow' },
      { x: '70%', y: '52%', size: '40vw', color: 'rgba(178,58,46,0.09)', anim: 'animate-ink-drift' },
      { x: '22%', y: '62%', size: '32vw', color: 'rgba(42,39,34,0.08)', anim: 'animate-ink-drift-slow' },
    ],
    particle: '178,58,46',
  },
  embroidery: {
    blobs: [
      { x: '6%', y: '10%', size: '44vw', color: 'rgba(122,152,138,0.16)', anim: 'animate-ink-drift' },
      { x: '64%', y: '-4%', size: '38vw', color: 'rgba(168,201,184,0.14)', anim: 'animate-ink-drift-slow' },
      { x: '74%', y: '50%', size: '40vw', color: 'rgba(122,152,138,0.10)', anim: 'animate-ink-drift' },
      { x: '24%', y: '60%', size: '32vw', color: 'rgba(196,160,90,0.08)', anim: 'animate-ink-drift-slow' },
    ],
    particle: '90,120,108',
  },
  porcelain: {
    blobs: [
      { x: '8%', y: '6%', size: '44vw', color: 'rgba(52,84,140,0.14)', anim: 'animate-ink-drift' },
      { x: '60%', y: '2%', size: '38vw', color: 'rgba(38,62,110,0.10)', anim: 'animate-ink-drift-slow' },
      { x: '70%', y: '52%', size: '42vw', color: 'rgba(52,84,140,0.09)', anim: 'animate-ink-drift' },
      { x: '20%', y: '58%', size: '34vw', color: 'rgba(122,152,138,0.08)', anim: 'animate-ink-drift-slow' },
    ],
    particle: '52,84,140',
  },
}

/* 预渲染一个柔边墨点精灵，避免每帧创建渐变对象 */
function makeSprite(rgb) {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, `rgba(${rgb},0.55)`)
  g.addColorStop(0.45, `rgba(${rgb},0.22)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

export default function InkBackdrop({ variant = 'ink', className = '' }) {
  const canvasRef = useRef(null)
  const driftRef = useRef(null)
  const theme = THEMES[variant] || THEMES.ink

  /* ---------- ① 墨点粒子 ---------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    const sprite = makeSprite(theme.particle)
    let raf = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      // 粒子数量随面积缩放：移动端更少，保证流畅
      const count = Math.round(Math.min(34, Math.max(12, (rect.width * rect.height) / 42000)))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        r: 4 + Math.random() * 20,
        vy: 0.06 + Math.random() * 0.18,
        sway: 0.4 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.10 + Math.random() * 0.20,
      }))
      if (reduce) drawStatic()
    }

    const drawStatic = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      particles.forEach((p) => {
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
      })
      ctx.restore()
    }

    let t = 0
    const tick = () => {
      const rect = canvas.getBoundingClientRect()
      t += 0.008
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      particles.forEach((p) => {
        p.y -= p.vy
        p.x += Math.sin(t * p.sway + p.phase) * 0.22
        if (p.y < -p.r) {
          p.y = rect.height + p.r
          p.x = Math.random() * rect.width
        }
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
      })
      ctx.restore()
      raf = requestAnimationFrame(tick)
    }

    resize()
    if (!reduce) raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // 页面不可见时暂停，避免后台空转
    const onVisibility = () => {
      if (reduce) return
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [theme.particle])

  /* ---------- ② 滚动视差（仅墨晕层，rAF 节流） ---------- */
  useEffect(() => {
    const el = driftRef.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let ticking = false
    let last = 0
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY || 0
        // 只跟随首屏滚动，超出后不再累积，避免整页错位
        last = Math.min(y, 900) * 0.12
        el.style.transform = `translate3d(0, ${last.toFixed(2)}px, 0)`
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* 墨晕层：超大模糊色斑 + 缓慢漂移 */}
      <div ref={driftRef} className="absolute inset-0 will-change-transform">
        {theme.blobs.map((b, i) => (
          <div
            key={i}
            className={`absolute rounded-full blur-[90px] ${b.anim}`}
            style={{
              left: b.x,
              top: b.y,
              width: b.size,
              height: b.size,
              background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, transparent 70%)`,
              animationDelay: `${i * -3.4}s`,
            }}
          />
        ))}
      </div>

      {/* 墨点粒子层 */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 底部渐隐：让背景自然过渡到下一页内容，不产生硬切边 */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-paper/55" />
    </div>
  )
}
