/* ============================================================
 * HeritageElements：阶段四「非遗文化逐渐苏醒」
 * ------------------------------------------------------------
 * 六枚非遗徽记从雾气中依次浮现（不是同时出现）：
 *   剪纸 / 青花瓷 / 苏绣 / 皮影 / 舞狮 / 山水楼阁
 * 统一为银蓝线描 + 香槟金点光，出现时带一层柔光"点亮"。
 * 文案阶段开始后自动降为背景水印，避免干扰正文阅读。
 * ============================================================ */

const ITEMS = [
  { key: 'papercut', label: '剪纸', icon: Papercut },
  { key: 'porcelain', label: '青花瓷', icon: Porcelain },
  { key: 'embroidery', label: '苏绣', icon: Embroidery },
  { key: 'shadow', label: '皮影', icon: ShadowPuppet },
  { key: 'lion', label: '舞狮', icon: LionDance },
  { key: 'landscape', label: '山水', icon: Landscape },
]

export default function HeritageElements({ phase, mode = 'full' }) {
  const active = ['elements', 'show', 'closing'].includes(phase)
  const muted = phase === 'show' || phase === 'closing'

  return (
    <div
      className="heritage-emblems pointer-events-none absolute inset-x-0 top-[4%] z-[2] grid grid-cols-6 place-items-start gap-x-1 px-4 sm:top-[6%] sm:flex sm:flex-wrap sm:justify-center sm:gap-x-9 sm:px-6"
      data-active={active ? 'true' : 'false'}
      data-muted={muted ? 'true' : 'false'}
      data-speed={mode === 'brief' ? 'brief' : 'full'}
      aria-hidden="true"
    >
      {ITEMS.map((it, i) => {
        const Icon = it.icon
        return (
          <figure
            key={it.key}
            className="he-item flex w-full flex-col items-center gap-1 sm:w-14 sm:gap-1.5"
            style={{ '--d': `${i * 150}ms` }}
          >
            <span className="he-halo" />
            <Icon />
            <figcaption className="text-[8px] tracking-[0.12em] text-ink-soft/75 sm:text-[10px] sm:tracking-[0.22em]">
              {it.label}
            </figcaption>
          </figure>
        )
      })}

      <style>{CSS}</style>
    </div>
  )
}

/* 统一线描参数 */
const stroke = {
  fill: 'none',
  stroke: 'url(#heStroke)',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Wrap({ children }) {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" className="he-svg" aria-hidden="true">
      <defs>
        <linearGradient id="heStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5F5443" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#7E9B7A" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#B8862F" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  )
}

/* 剪纸：对称团花 + 锯齿边 */
function Papercut() {
  return (
    <Wrap>
      <circle cx="24" cy="24" r="5" {...stroke} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4
        const x = 24 + Math.cos(a) * 11
        const y = 24 + Math.sin(a) * 11
        return <ellipse key={i} cx={x} cy={y} rx="5.4" ry="3.2" transform={`rotate(${i * 45} ${x} ${y})`} {...stroke} strokeWidth="1" />
      })}
      <circle cx="24" cy="24" r="19" {...stroke} strokeDasharray="1.5 3" strokeWidth="1" />
      <path d="M24 2v3M24 43v3M2 24h3M43 24h3" {...stroke} strokeWidth="1" />
    </Wrap>
  )
}

/* 青花瓷：梅瓶 + 缠枝纹 */
function Porcelain() {
  return (
    <Wrap>
      <path d="M20 8h8M22 8c0 3-1 4-2.6 6C17 16.6 16 20 16 24c0 6 2.4 10 2.4 13.5V40h11.2v-2.5c0-3.5 2.4-7.5 2.4-13.5 0-4-.9-7.4-3.4-10C27 12 26 11 26 8" {...stroke} />
      <path d="M17.4 30c2 1.6 4 1.6 6 0s4-1.6 6 0" {...stroke} strokeWidth="1" strokeOpacity="0.8" />
      <path d="M19 22c1.6-2 3.2-2 4.8 0s3.2 2 4.8 0" {...stroke} strokeWidth="1" strokeOpacity="0.7" />
      <path d="M24 15v3" {...stroke} strokeWidth="1" />
    </Wrap>
  )
}

/* 苏绣：绣绷 + 花枝 + 丝线 */
function Embroidery() {
  return (
    <Wrap>
      <circle cx="22" cy="24" r="13" {...stroke} />
      <circle cx="22" cy="24" r="10.5" {...stroke} strokeWidth="0.9" strokeDasharray="2 2.5" />
      <path d="M22 27c-2.6-.6-4-2.8-3.2-4.8 1.6.2 3.4 2 3.2 4.8Z" {...stroke} strokeWidth="1" />
      <path d="M13 34c3 1.4 6 1.8 9 .8" {...stroke} strokeWidth="1" />
      <path d="M38 10c2.6 2.4 4.6 5.2 6 8.8" {...stroke} strokeWidth="1" strokeOpacity="0.8" />
      <path d="M36 12l3 3" {...stroke} strokeWidth="1" />
    </Wrap>
  )
}

/* 皮影：侧脸 + 长身 + 操作杆 */
function ShadowPuppet() {
  return (
    <Wrap>
      <path d="M27 8c-3 0-5 2.4-5 5.4 0 2 1 3.5 2.4 4.6-3.4 1.6-5 5-5.6 9.6-.4 3.4-.6 7.4 1 10.4 1 1.8 2.6 2.6 4.4 2.2" {...stroke} />
      <path d="M29 26l6.6 2.6-3.4 8.8M29 30l7.4 6.4" {...stroke} strokeWidth="1.1" />
      <path d="M25 40c2 .6 3.4.2 4.6-1.2" {...stroke} strokeWidth="1" />
      <path d="M24.6 13.6h3.2M34 16l6-3" {...stroke} strokeWidth="1" strokeOpacity="0.75" />
      <circle cx="27.6" cy="18.6" r="9" {...stroke} strokeWidth="0.7" strokeDasharray="2 3" strokeOpacity="0.45" />
    </Wrap>
  )
}

/* 舞狮：醒狮头 + 鬃毛 + 铃铛 */
function LionDance() {
  return (
    <Wrap>
      <path d="M15 18c-1.6-2.4-.6-4.8 1.6-6M33 18c1.6-2.4.6-4.8-1.6-6M12 26c-2.4-.6-3.6-2.4-3-4.4M36 26c2.4-.6 3.6-2.4 3-4.4" {...stroke} strokeWidth="1" />
      <path d="M24 9c-8 0-13 6.4-13 14 0 7.4 5.6 13 13 13s13-5.6 13-13C37 15.4 32 9 24 9Z" {...stroke} />
      <circle cx="19" cy="22" r="2.6" {...stroke} />
      <circle cx="29" cy="22" r="2.6" {...stroke} />
      <path d="M20 31c1.4 1.6 2.6 2.4 4 2.4s2.6-.8 4-2.4" {...stroke} strokeWidth="1.1" />
      <path d="M24 33.4v3.2" {...stroke} strokeWidth="1" strokeOpacity="0.7" />
      <circle cx="24" cy="38.6" r="1.8" {...stroke} strokeWidth="1" />
    </Wrap>
  )
}

/* 山水：远山 + 楼阁 + 云 */
function Landscape() {
  return (
    <Wrap>
      <path d="M4 34c5-7 9-11 13-11s6.4 3 9 6c2 2.4 4 3.6 6.4 3.6 4 0 7-3.6 11.6-3.6" {...stroke} strokeWidth="1.1" />
      <path d="M27 23V12l6-3v14" {...stroke} strokeWidth="1" />
      <path d="M27 17h6M27 21h6" {...stroke} strokeWidth="0.9" strokeOpacity="0.8" />
      <path d="M33 9l3-1.6" {...stroke} strokeWidth="0.9" strokeOpacity="0.7" />
      <path d="M6 40h36" {...stroke} strokeWidth="0.9" strokeDasharray="2 3" strokeOpacity="0.6" />
    </Wrap>
  )
}

const CSS = `
.he-item {
  position: relative;
  opacity: 0;
  transform: translateY(12px);
  filter: blur(5px);
  transition: opacity .9s ease, transform 1s cubic-bezier(.22,.61,.36,1), filter .9s ease;
  transition-delay: var(--d, 0ms);
}
.heritage-emblems[data-active='true'] .he-item { opacity: 1; transform: none; filter: blur(0) }
.heritage-emblems[data-speed='brief'] .he-item { transition-duration: .45s }

.he-svg {
  position: relative;
  width: 44px;
  height: 44px;
  filter: drop-shadow(0 0 6px rgba(150,120,70,.28));
  animation: heFloat 7s ease-in-out infinite;
}
.he-item:nth-child(2n) .he-svg { animation-delay: -2s }
.he-item:nth-child(3n) .he-svg { animation-delay: -4s }

.he-halo {
  position: absolute;
  left: 50%;
  top: 18px;
  width: 56px;
  height: 56px;
  margin-left: -28px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(224,162,63,.24) 0%, rgba(126,155,122,.10) 45%, transparent 70%);
  filter: blur(10px);
  opacity: 0;
  transition: opacity .8s ease;
  transition-delay: var(--d, 0ms);
}
.heritage-emblems[data-active='true'] .he-halo { opacity: 1; animation: heHalo 4.5s ease-in-out infinite }

@keyframes heFloat {
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-5px) }
}
@keyframes heHalo {
  0%, 100% { opacity: .55 }
  50% { opacity: 1 }
}

/* 正文出现后，徽记降为背景水印 */
.heritage-emblems[data-muted='true'] .he-item { opacity: .38; transform: scale(.94) }
.heritage-emblems[data-muted='true'] .he-svg { animation: none }
.heritage-emblems[data-muted='true'] .he-halo { opacity: .25 }

@media (max-width: 640px) {
  .he-svg { width: 30px; height: 30px }
  .he-halo { width: 38px; height: 38px; margin-left: -19px; top: 10px; filter: blur(8px) }
}
@media (min-width: 641px) {
  .he-svg { width: 44px; height: 44px }
}

@media (prefers-reduced-motion: reduce) {
  .he-item, .he-svg, .he-halo { animation: none !important; transition: none !important }
  .heritage-emblems[data-active='true'] .he-item { opacity: 1; transform: none; filter: none }
}
`
