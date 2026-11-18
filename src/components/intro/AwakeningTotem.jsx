/* ============================================================
 * AwakeningTotem：阶段一「文化印记苏醒」
 * ------------------------------------------------------------
 * 纯 SVG 圆形图腾，五层结构由内到外依次点亮：
 *   ① 中心光核（脉动）
 *   ② 八瓣剪纸曼陀罗（慢速正转）
 *   ③ 云雷纹刻度环（反转）
 *   ④ 二十四枚符号环（缓慢正转、呼吸）
 *   ⑤ 最外细银环 + 扫光弧（描边生长）
 *
 * 全部动画为 transform / stroke-dashoffset / opacity，
 * 不触发布局；reduced-motion 下一律静止（直接呈现完成态）。
 * ============================================================ */

const GOLD = '#B8862F'
const SILVER = '#6C6152'
const ICE = '#7E9B7A'

export default function AwakeningTotem({ phase, mode = 'full' }) {
  const lit = phase !== 'in'
  const dimmed = phase === 'unroll' || phase === 'elements' || phase === 'show' || phase === 'closing'

  return (
    <div
      className="totem pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
      data-lit={lit ? 'true' : 'false'}
      data-dim={dimmed ? 'true' : 'false'}
      data-speed={mode === 'brief' ? 'brief' : 'full'}
      aria-hidden="true"
    >
      {/* 中心光晕 */}
      <span className="totem-halo" />

      <svg className="totem-svg" viewBox="0 0 560 560" fill="none">
        <defs>
          <radialGradient id="totemCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFDF6" stopOpacity="0.95" />
            <stop offset="32%" stopColor="#F3DFAE" stopOpacity="0.6" />
            <stop offset="68%" stopColor={GOLD} stopOpacity="0.22" />
            <stop offset="100%" stopColor="#EFE5D2" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="totemRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={SILVER} stopOpacity="0.55" />
            <stop offset="45%" stopColor={ICE} stopOpacity="0.45" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="totemArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
            <stop offset="50%" stopColor={GOLD} stopOpacity="0.85" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ① 光核 */}
        <circle cx="280" cy="280" r="120" fill="url(#totemCore)" className="totem-core" />
        <circle cx="280" cy="280" r="7" fill="#FFFFFF" fillOpacity="0.9" className="totem-core-dot" />

        {/* ② 八瓣剪纸曼陀罗 */}
        <g className="totem-spin-slow" style={{ transformOrigin: '280px 280px' }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4
            const x = 280 + Math.cos(a) * 66
            const y = 280 + Math.sin(a) * 66
            return (
              <g key={i}>
                <ellipse
                  cx={x}
                  cy={y}
                  rx="34"
                  ry="15"
                  stroke="url(#totemRing)"
                  strokeWidth="1"
                  transform={`rotate(${i * 45} ${x} ${y})`}
                  className="totem-petal"
                  style={{ animationDelay: `${i * 90}ms` }}
                />
                <path
                  d={`M280 280 L${x} ${y}`}
                  stroke={ICE}
                  strokeOpacity="0.18"
                  strokeWidth="0.8"
                />
              </g>
            )
          })}
          <circle cx="280" cy="280" r="96" stroke="url(#totemRing)" strokeWidth="0.9" strokeOpacity="0.5" />
          <circle cx="280" cy="280" r="34" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1" />
        </g>

        {/* ③ 云雷纹刻度环（反向） */}
        <g className="totem-spin-rev" style={{ transformOrigin: '280px 280px' }}>
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i * Math.PI) / 24
            const r1 = 128
            const r2 = i % 4 === 0 ? 142 : 135
            return (
              <line
                key={i}
                x1={280 + Math.cos(a) * r1}
                y1={280 + Math.sin(a) * r1}
                x2={280 + Math.cos(a) * r2}
                y2={280 + Math.sin(a) * r2}
                stroke={SILVER}
                strokeOpacity={i % 4 === 0 ? 0.55 : 0.28}
                strokeWidth={i % 4 === 0 ? 1.3 : 0.8}
              />
            )
          })}
          <circle cx="280" cy="280" r="128" stroke="url(#totemRing)" strokeOpacity="0.35" strokeWidth="0.8" />
        </g>

        {/* ④ 符号环：二十四枚抽象纹样（云头 / 回纹 / 涡纹交替） */}
        <g className="totem-spin-mid" style={{ transformOrigin: '280px 280px' }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i * Math.PI) / 12 - Math.PI / 2
            const r = 186
            const x = 280 + Math.cos(a) * r
            const y = 280 + Math.sin(a) * r
            const kind = i % 3
            return (
              <g
                key={i}
                transform={`translate(${x} ${y}) rotate(${(i * 360) / 24})`}
                className="totem-glyph"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {kind === 0 && (
                  <path d="M-6 2c0-4 3-7 7-7 3 0 5 2 5 4 0 2-1.6 3.2-3.4 3.2" stroke={GOLD} strokeOpacity="0.85" strokeWidth="1" />
                )}
                {kind === 1 && (
                  <path d="M-6-5h6v6h6" stroke={SILVER} strokeOpacity="0.6" strokeWidth="1" />
                )}
                {kind === 2 && (
                  <path d="M-6 0c3-6 9-6 12 0-3 6-9 6-12 0Z" stroke={ICE} strokeOpacity="0.55" strokeWidth="1" />
                )}
              </g>
            )
          })}
          <circle cx="280" cy="280" r="186" stroke="url(#totemRing)" strokeOpacity="0.28" strokeWidth="0.8" strokeDasharray="2 7" />
        </g>

        {/* ⑤ 最外细银环 + 扫光弧 */}
        <circle
          cx="280"
          cy="280"
          r="232"
          stroke={SILVER}
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeDasharray="3 10"
          className="totem-spin-slow"
          style={{ transformOrigin: '280px 280px' }}
        />
        <circle
          cx="280"
          cy="280"
          r="246"
          stroke={GOLD}
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="70 640"
          className="totem-sweep"
          style={{ transformOrigin: '280px 280px' }}
        />
      </svg>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.totem {
  width: min(78vmin, 560px);
  height: min(78vmin, 560px);
  opacity: 0;
  transform: translate(-50%, -50%) scale(.86);
  transition: opacity 1.1s ease, transform 1.4s cubic-bezier(.22,.61,.36,1);
}
.totem[data-lit='true'] { opacity: 1; transform: translate(-50%, -50%) scale(1) }
.totem[data-dim='true'] { opacity: .16; transform: translate(-50%, -50%) scale(1.12) }
.totem[data-speed='brief'] { transition-duration: .5s, .6s }

.totem-svg { position: relative; width: 100%; height: 100%; overflow: visible }

.totem-halo {
  position: absolute;
  inset: 12%;
  border-radius: 9999px;
  filter: blur(46px);
  background: radial-gradient(circle, rgba(224,162,63,.30) 0%, rgba(126,155,122,.10) 45%, transparent 72%);
  animation: totemHalo 6s ease-in-out infinite;
}
@keyframes totemHalo {
  0%, 100% { opacity: .65; transform: scale(.96) }
  50% { opacity: 1; transform: scale(1.04) }
}

.totem-core { opacity: .55; animation: totemCore 4.5s ease-in-out infinite }
@keyframes totemCore {
  0%, 100% { opacity: .45 }
  50% { opacity: .85 }
}
.totem-core-dot { animation: totemDot 3s ease-in-out infinite }
@keyframes totemDot {
  0%, 100% { opacity: .6; r: 6 }
  50% { opacity: 1; r: 8 }
}

.totem-spin-slow { animation: totemSpin 160s linear infinite }
.totem-spin-rev { animation: totemSpin 120s linear infinite reverse }
.totem-spin-mid { animation: totemSpin 200s linear infinite }
.totem-sweep { animation: totemSpin 22s linear infinite }
@keyframes totemSpin { to { transform: rotate(360deg) } }

.totem-petal { animation: totemPetal 4.8s ease-in-out infinite }
@keyframes totemPetal {
  0%, 100% { opacity: .35 }
  50% { opacity: .9 }
}
.totem-glyph { animation: totemGlyph 5.2s ease-in-out infinite }
@keyframes totemGlyph {
  0%, 100% { opacity: .3 }
  50% { opacity: .95 }
}

@media (max-width: 640px) {
  .totem { width: min(96vw, 460px); height: min(96vw, 460px) }
}

@media (prefers-reduced-motion: reduce) {
  .totem, .totem-halo, .totem-core, .totem-core-dot,
  .totem-spin-slow, .totem-spin-rev, .totem-spin-mid, .totem-sweep,
  .totem-petal, .totem-glyph { animation: none !important; transition: none !important }
  .totem-core, .totem-petal, .totem-glyph { opacity: .85 }
}
`
