/* ============================================================
 * BottomEnergyField：卷轴下方的「数字水墨能量场」
 * ------------------------------------------------------------
 * 独立图层，挂在卷轴舞台之下（z 低于卷轴，不会遮住任何文字），
 * 从卷轴下边缘一直铺到屏幕底部，共五层：
 *   ① 远山剪影 + 水墨云海（远/中/近三层，速度不同，边缘带蓝银微光）
 *   ② 蓝金能量光带（由中央向两侧流动的弧线）
 *   ③ 祥云纹样（两侧缓缓升起，局部金线）
 *   ④ 粒子：金色微光 / 蓝色萤火 / 水墨碎片 / 细流光
 *   ⑤ 中央能量源（呼吸光核 + 两圈慢转细环）
 *
 * 出现顺序跟随 phase：
 *   unroll   → 底部一线蓝光 + 云海从两侧涌入
 *   elements → 祥云与光带浮现
 *   show     → 粒子升起、中央光源点亮，进入循环
 *   closing  → 云海向中央汇聚、光点消散
 * ============================================================ */
import { useEffect, useRef } from 'react'

export default function BottomEnergyField({ phase }) {
  const begun = ['unroll', 'elements', 'show', 'closing'].includes(phase)
  const mid = ['elements', 'show', 'closing'].includes(phase)
  const full = ['show', 'closing'].includes(phase)
  const closing = phase === 'closing'

  return (
    <div
      className="bef pointer-events-none absolute inset-x-0 bottom-0 z-[5]"
      data-lit={begun ? 'true' : 'false'}
      data-mid={mid ? 'true' : 'false'}
      data-full={full ? 'true' : 'false'}
      data-closing={closing ? 'true' : 'false'}
      aria-hidden="true"
    >
      {/* 底部整体氛围 */}
      <span className="bef-tint" />
      {/* 卷轴下缘的横向能量地平线 */}
      <span className="bef-horizon" />

      {/* ① 远山剪影 */}
      <svg className="bef-ridge" viewBox="0 0 1440 260" preserveAspectRatio="none">
        <path
          d="M0 210 C 120 176 210 150 320 170 C 430 190 500 148 610 156 C 720 164 780 196 900 182 C 1010 170 1090 140 1200 158 C 1300 174 1380 190 1440 178 L1440 260 L0 260 Z"
          fill="rgba(104,90,68,.5)"
        />
        <path
          d="M0 210 C 120 176 210 150 320 170 C 430 190 500 148 610 156 C 720 164 780 196 900 182 C 1010 170 1090 140 1200 158 C 1300 174 1380 190 1440 178"
          fill="none"
          stroke="rgba(184,134,47,.3)"
          strokeWidth="1"
        />
      </svg>

      {/* 云海：远 / 中 / 近三层 */}
      <span className="bef-sea bef-sea--far" />
      <span className="bef-sea bef-sea--mid" />
      <span className="bef-sea bef-sea--near" />

      {/* ② 能量光带 */}
      <svg className="bef-bands" viewBox="0 0 1440 240" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="befBand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7E9B7A" stopOpacity="0" />
            <stop offset="30%" stopColor="#7E9B7A" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#B8862F" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#7E9B7A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7E9B7A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="bef-band bef-band--1"
          d="M-20 150 C 260 132 420 176 720 158 C 1020 140 1180 176 1460 152"
          stroke="url(#befBand)"
          strokeWidth="1.4"
        />
        <path
          className="bef-band bef-band--2"
          d="M-20 182 C 300 200 460 152 720 176 C 980 200 1140 150 1460 180"
          stroke="url(#befBand)"
          strokeWidth="1"
        />
      </svg>

      {/* ③ 祥云（两侧） */}
      <Cloud className="bef-cloud bef-cloud--l" />
      <Cloud className="bef-cloud bef-cloud--r" />

      {/* ④ 粒子 */}
      <BefParticles active={full && !closing} />

      {/* ⑤ 中央能量源 */}
      <div className="bef-core">
        <svg className="bef-rings" viewBox="0 0 360 360" fill="none">
          <circle cx="180" cy="180" r="120" stroke="rgba(120,104,78,.3)" strokeWidth="0.9" strokeDasharray="2 8" className="bef-ring bef-ring--1" />
          <circle cx="180" cy="180" r="86" stroke="rgba(184,134,47,.42)" strokeWidth="0.9" strokeDasharray="34 200" className="bef-ring bef-ring--2" />
          <circle cx="180" cy="180" r="56" stroke="rgba(126,155,122,.36)" strokeWidth="0.8" strokeDasharray="1 6" className="bef-ring bef-ring--3" />
        </svg>
        <span className="bef-core-glow" />
        <span className="bef-core-dot" />
      </div>

      {/* 展开瞬间的底边蓝光 */}
      <span className="bef-edge-line" />

      <style>{CSS}</style>
    </div>
  )
}

function Cloud({ className = '' }) {
  return (
    <svg className={`pointer-events-none absolute ${className}`} viewBox="0 0 200 120" fill="none">
      <path
        d="M30 84c-12 0-20-8-20-18 0-11 9-19 20-18 2-16 15-27 31-27 13 0 24 8 28 20 5-4 11-6 18-6 16 0 29 12 29 27 0 2 0 4-1 6 8 2 14 9 14 17 0 10-8 18-19 18H30Z"
        stroke="rgba(96,84,64,.55)"
        strokeWidth="1"
      />
      <path d="M58 66c0-8 6-14 14-14s14 6 14 14" stroke="rgba(184,134,47,.5)" strokeWidth="0.9" />
      <path d="M100 68c0-7 5-12 12-12s12 5 12 12" stroke="rgba(96,84,64,.3)" strokeWidth="0.9" />
      <path d="M52 96h74" stroke="rgba(96,84,64,.22)" strokeWidth="0.9" strokeDasharray="2 6" />
    </svg>
  )
}

/* 粒子：金尘 / 蓝萤 / 墨屑 / 流光 */
function BefParticles({ active }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !active) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let list = []

    const makeSprite = (r, g, b) => {
      const s = document.createElement('canvas')
      s.width = s.height = 40
      const c = s.getContext('2d')
      const grad = c.createRadialGradient(20, 20, 0, 20, 20, 20)
      grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`)
      grad.addColorStop(0.35, `rgba(${r},${g},${b},0.38)`)
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
      c.fillStyle = grad
      c.fillRect(0, 0, 40, 40)
      return s
    }
    const gold = makeSprite(184, 134, 47)
    const blue = makeSprite(126, 155, 122)
    const ink = makeSprite(104, 92, 72)

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const count = rect.width < 640 ? 26 : 48
      list = Array.from({ length: count }, () => {
        const kind = Math.random()
        const type = kind > 0.72 ? 'ink' : kind > 0.36 ? 'blue' : 'gold'
        return {
          type,
          x: Math.random() * rect.width,
          y: rect.height * (0.15 + Math.random() * 0.85),
          size: type === 'ink' ? 2 + Math.random() * 4 : 0.6 + Math.random() * 2.1,
          vy: (type === 'ink' ? 0.06 : 0.12) + Math.random() * 0.26,
          sway: 0.25 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
          alpha: (type === 'ink' ? 0.08 : 0.24) + Math.random() * 0.3,
        }
      })
    }

    let t = 0
    const tick = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      t += 0.01
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      list.forEach((p) => {
        p.y -= p.vy
        p.x += Math.sin(t * p.sway + p.phase) * 0.18
        if (p.y < -12) {
          p.y = h + 10
          p.x = Math.random() * w
        }
        if (p.x < -12) p.x = w + 10
        if (p.x > w + 12) p.x = -10
        const sprite = p.type === 'gold' ? gold : p.type === 'blue' ? blue : ink
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8)
      })
      ctx.restore()
      raf = requestAnimationFrame(tick)
    }

    build()
    if (!reduce) raf = requestAnimationFrame(tick)
    const ro = new ResizeObserver(build)
    ro.observe(canvas)
    const onVis = () => {
      if (reduce) return
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}

const CSS = `
.bef {
  height: clamp(210px, 36vh, 400px);
  /* 只在最顶部轻微渐隐，主体交给卷轴遮挡，避免"断层" */
  mask-image: linear-gradient(to top, #000 88%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, #000 88%, transparent 100%);
  transition: opacity .85s ease;
}
.bef[data-closing='true'] { opacity: 0 }

/* 地平线光带：贴着卷轴下缘，最先把底部"托"起来 */
.bef-horizon {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 40%;
  height: 54px;
  filter: blur(12px);
  opacity: 0;
  transform: scaleX(.82);
  transition: opacity 2s ease .7s, transform 2.4s cubic-bezier(.22,.61,.36,1) .7s;
  background: radial-gradient(ellipse 44% 100% at 50% 50%, rgba(255,252,242,.85) 0%, rgba(224,162,63,.22) 46%, transparent 74%);
}
[data-lit='true'] .bef-horizon { opacity: 1; transform: none }
[data-lit='true'] .bef-horizon { animation: befHorizon 7s ease-in-out infinite }
@keyframes befHorizon {
  0%, 100% { opacity: .7 }
  50% { opacity: 1 }
}

.bef-tint {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 2s ease;
  background:
    radial-gradient(ellipse 54% 100% at 50% 108%, rgba(224,162,63,.20) 0%, rgba(180,150,90,.08) 42%, transparent 74%),
    radial-gradient(ellipse 26% 46% at 50% 108%, rgba(178,58,46,.10) 0%, transparent 72%),
    linear-gradient(180deg, rgba(244,239,228,0) 0%, rgba(243,235,220,.55) 54%, rgba(233,222,201,.82) 100%);
}
[data-lit='true'] .bef-tint { opacity: 1 }

/* ① 远山 */
.bef-ridge {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  width: 100%;
  height: 74%;
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 1.8s ease .2s, transform 2.2s cubic-bezier(.22,.61,.36,1) .2s;
}
[data-lit='true'] .bef-ridge { opacity: .8; transform: none }

/* 云海三层：左右涌入、速度不同 */
.bef-sea {
  position: absolute;
  left: -30%;
  width: 160%;
  height: 56%;
  opacity: 0;
  filter: blur(26px);
  transition: opacity 2s ease, transform 2.6s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}
.bef-sea--far {
  bottom: 20%;
  height: 64%;
  background:
    radial-gradient(ellipse 46% 68% at 30% 60%, rgba(255,253,246,.66) 0%, transparent 70%),
    radial-gradient(ellipse 40% 58% at 72% 68%, rgba(150,136,112,.16) 0%, transparent 72%);
  transform: translateX(-10%);
}
.bef-sea--mid {
  bottom: 2%;
  height: 72%;
  background:
    radial-gradient(ellipse 38% 60% at 24% 64%, rgba(255,254,249,.8) 0%, transparent 70%),
    radial-gradient(ellipse 44% 56% at 78% 62%, rgba(140,126,102,.18) 0%, transparent 72%);
  transform: translateX(10%);
  transition-delay: .25s;
}
.bef-sea--near {
  bottom: -8%;
  height: 64%;
  filter: blur(18px);
  background:
    radial-gradient(ellipse 50% 62% at 50% 84%, rgba(255,255,252,.92) 0%, transparent 72%),
    radial-gradient(ellipse 34% 50% at 16% 88%, rgba(146,132,106,.2) 0%, transparent 70%),
    radial-gradient(ellipse 34% 50% at 84% 88%, rgba(146,132,106,.2) 0%, transparent 70%);
  transform: translateY(18px);
  transition-delay: .4s;
}
[data-lit='true'] .bef-sea { opacity: 1; transform: none }
[data-lit='true'] .bef-sea--far { animation: befSeaFar 26s ease-in-out infinite alternate }
[data-lit='true'] .bef-sea--mid { animation: befSeaMid 19s ease-in-out infinite alternate }
[data-lit='true'] .bef-sea--near { animation: befSeaNear 14s ease-in-out infinite alternate }
@keyframes befSeaFar {
  0% { transform: translate3d(-3%, 0, 0) }
  100% { transform: translate3d(3%, -1%, 0) }
}
@keyframes befSeaMid {
  0% { transform: translate3d(4%, 0, 0) }
  100% { transform: translate3d(-4%, -1.5%, 0) }
}
@keyframes befSeaNear {
  0% { transform: translate3d(-2%, 1%, 0) scaleX(1) }
  100% { transform: translate3d(2%, -1%, 0) scaleX(1.03) }
}

/* ② 光带 */
.bef-bands {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  width: 100%;
  height: 62%;
  opacity: 0;
  transition: opacity 2s ease .5s;
}
[data-mid='true'] .bef-bands { opacity: 1 }
.bef-band { stroke-dasharray: 260 180; }
[data-mid='true'] .bef-band--1 { animation: befDash 9s linear infinite }
[data-mid='true'] .bef-band--2 { animation: befDash 13s linear infinite reverse }

@keyframes befDash {
  0% { stroke-dashoffset: 0; opacity: .35 }
  50% { opacity: 1 }
  100% { stroke-dashoffset: -880; opacity: .35 }
}

/* ③ 祥云 */
.bef-cloud {
  width: 200px;
  height: 120px;
  bottom: 16%;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 2.2s ease .7s, transform 3s cubic-bezier(.22,.61,.36,1) .7s;
}
.bef-cloud--l { left: 2% }
.bef-cloud--r { right: 2%; transform: translateY(16px) scaleX(-1) }
[data-mid='true'] .bef-cloud { opacity: .5; transform: none }
[data-mid='true'] .bef-cloud--r { transform: scaleX(-1) }
[data-mid='true'] .bef-cloud--l { animation: befRiseL 16s ease-in-out infinite }
[data-mid='true'] .bef-cloud--r { animation: befRiseR 19s ease-in-out infinite }
@keyframes befRiseL {
  0%, 100% { transform: translate3d(0,0,0); opacity: .28 }
  50% { transform: translate3d(10px, -16px, 0); opacity: .55 }
}
@keyframes befRiseR {
  0%, 100% { transform: translate3d(0,0,0) scaleX(-1); opacity: .3 }
  50% { transform: translate3d(-10px, -14px, 0) scaleX(-1); opacity: .52 }
}

/* ⑤ 中央能量源 */
.bef-core {
  position: absolute;
  left: 50%;
  bottom: -66px;
  width: 320px;
  height: 320px;
  margin-left: -160px;
  opacity: 0;
  transform: translateY(24px) scale(.9);
  transition: opacity 2.4s ease .6s, transform 2.6s cubic-bezier(.22,.61,.36,1) .6s;
}
[data-full='true'] .bef-core { opacity: 1; transform: none }
.bef-rings { position: absolute; inset: 0; width: 100%; height: 100% }
.bef-ring { transform-origin: 180px 180px }
[data-full='true'] .bef-ring--1 { animation: befSpin 64s linear infinite }
[data-full='true'] .bef-ring--2 { animation: befSpin 42s linear infinite reverse }
[data-full='true'] .bef-ring--3 { animation: befSpin 28s linear infinite }
@keyframes befSpin { to { transform: rotate(360deg) } }

.bef-core::before {
  content: '';
  position: absolute;
  inset: -22%;
  border-radius: 9999px;
  background: radial-gradient(circle at 50% 62%, rgba(224,162,63,.22) 0%, rgba(184,134,47,.10) 44%, transparent 72%);
  filter: blur(38px);
  animation: befCore 7.5s ease-in-out infinite;
}
.bef-core-glow {
  position: absolute;
  inset: 16%;
  border-radius: 9999px;
  filter: blur(30px);
  background: radial-gradient(circle at 50% 55%, rgba(255,250,232,.95) 0%, rgba(232,190,104,.42) 38%, rgba(184,134,47,.2) 62%, transparent 80%);
  animation: befCore 6s ease-in-out infinite;
}
@keyframes befCore {
  0%, 100% { opacity: .55; transform: scale(.96) }
  50% { opacity: 1; transform: scale(1.05) }
}
.bef-core-dot {
  position: absolute;
  left: 50%;
  top: 62%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 9999px;
  background: #FFF8E6;
  box-shadow: 0 0 20px 7px rgba(232,190,104,.7), 0 0 60px 20px rgba(184,134,47,.32);
  animation: befDot 4.4s ease-in-out infinite;
}
@keyframes befDot {
  0%, 100% { opacity: .6; transform: scale(.9) }
  50% { opacity: 1; transform: scale(1.15) }
}

/* 底边蓝光：卷轴刚开始展开时先出现 */
.bef-edge-line {
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 0;
  height: 1px;
  opacity: 0;
  background: linear-gradient(90deg, transparent, rgba(184,134,47,.6) 50%, transparent);
  box-shadow: 0 0 18px 4px rgba(224,162,63,.28);
  transition: opacity 1.4s ease;
}
[data-lit='true'] .bef-edge-line { opacity: 1 }

/* 收场：云海向中央汇聚，能量源收敛 */
[data-closing='true'] .bef-sea--far { transform: translateX(26%) scaleX(.6) }
[data-closing='true'] .bef-sea--mid { transform: translateX(-24%) scaleX(.62) }
[data-closing='true'] .bef-sea--near { transform: translateY(16%) scaleX(.55) }
[data-closing='true'] .bef-core { opacity: 0; transform: translateY(18px) scale(.8) }
[data-closing='true'] .bef-cloud { opacity: 0; transition-duration: .6s }

@media (max-width: 640px) {
  .bef { height: clamp(170px, 31vh, 280px) }
  .bef-horizon { bottom: 34%; height: 40px }
  .bef-cloud { width: 132px; height: 80px; bottom: 8% }
  .bef-core { width: 210px; height: 210px; margin-left: -105px; bottom: -42px }
  .bef-core-dot { width: 8px; height: 8px; margin: -4px 0 0 -4px }
}

@media (prefers-reduced-motion: reduce) {
  .bef-sea, .bef-band, .bef-cloud, .bef-core-glow, .bef-core-dot, .bef-ring {
    animation: none !important;
    transition: none !important;
  }
  .bef-sea, .bef-cloud { opacity: .5 !important; transform: none !important }
}
`
