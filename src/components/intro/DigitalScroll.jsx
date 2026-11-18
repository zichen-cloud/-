/* ============================================================
 * DigitalScroll：阶段三「数字画卷展开」
 * ------------------------------------------------------------
 * 结构是真实的画卷：
 *   · 纸面用 clip-path 从中缝向两侧揭开（不是拉伸图片）；
 *   · 两侧「墨玉轴」跟着纸边向外移动，轴头为香槟金；
 *   · 纸内是深蓝墨底 + 数字点阵 + 中央蓝银光晕 + 水墨晕染；
 *   · 上下各有金线 & 四角银灰云纹，边缘保留传统卷轴装饰。
 *
 * 深浅两层阴影制造纵深；所有动画为 clip-path / transform，
 * 不触发布局。reduced-motion 直接呈现展开完成态。
 * ============================================================ */

export default function DigitalScroll({ phase, mode = 'full', reduce = false, children }) {
  const opened = ['unroll', 'elements', 'show', 'closing'].includes(phase)
  const closing = phase === 'closing'

  return (
    <div
      className="ds-scroll relative h-full w-full"
      data-open={opened ? 'true' : 'false'}
      data-closing={closing ? 'true' : 'false'}
      data-speed={mode === 'brief' ? 'brief' : 'full'}
      data-content={phase === 'show' ? 'true' : 'false'}
      data-reduce={reduce ? 'true' : 'false'}
    >
      {/* 纵深投影层 */}
      <span className="ds-depth" aria-hidden="true" />

      {/* 纸面 */}
      <div className="ds-paper">
        <span className="ds-wash" aria-hidden="true" />
        <span className="ds-grid" aria-hidden="true" />
        <span className="ds-glow" aria-hidden="true" />
        <span className="ds-vignette" aria-hidden="true" />

        {/* 上下金线 + 四角云纹 */}
        <span className="ds-rule ds-rule--t" aria-hidden="true" />
        <span className="ds-rule ds-rule--b" aria-hidden="true" />
        <Corner className="left-2 top-2" />
        <Corner className="right-2 top-2 -scale-x-100" />
        <Corner className="bottom-2 left-2 -scale-y-100" />
        <Corner className="bottom-2 right-2 -scale-100" />

        {/* 纸面分区色晕：上青花、下青绿，避免整张纸一个颜色 */}
        <span className="ds-head-wash" aria-hidden="true" />
        <span className="ds-tail-wash" aria-hidden="true" />

        {/* 角落纹样水印：右上是青花缠枝，左下是朱砂剪纸团花 */}
        <svg className="ds-motif ds-motif--blue" viewBox="0 0 80 80" fill="none" aria-hidden="true">
          <path d="M12 52c8-2 14-8 16-16 2-9 8-14 16-14 3 0 6 1 8 3" stroke="#2F5A8A" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M40 60c6-6 8-14 6-22-1-6 2-11 8-13" stroke="#2F5A8A" strokeWidth="1" strokeLinecap="round" />
          <path d="M44 26c0-5 4-9 9-9s9 4 9 9-4 9-9 9" stroke="#2F5A8A" strokeWidth="1" strokeLinecap="round" />
          <path d="M22 34c-5-1-8-5-8-10s4-9 9-9" stroke="#2F5A8A" strokeWidth="1" strokeLinecap="round" />
          <circle cx="24" cy="53" r="1.6" fill="#2F5A8A" />
          <circle cx="52" cy="44" r="1.4" fill="#2F5A8A" />
        </svg>
        <svg className="ds-motif ds-motif--red" viewBox="0 0 80 80" fill="none" aria-hidden="true">
          <circle cx="40" cy="40" r="8" stroke="#B23A2E" strokeWidth="1.2" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4
            const x = 40 + Math.cos(a) * 20
            const y = 40 + Math.sin(a) * 20
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="9.5"
                ry="5.6"
                transform={`rotate(${i * 45} ${x} ${y})`}
                stroke="#B23A2E"
                strokeWidth="1"
              />
            )
          })}
          <circle cx="40" cy="40" r="32" stroke="#B23A2E" strokeWidth="0.8" strokeDasharray="2 5" />
        </svg>

        {/* 内框与两侧回纹边饰 */}
        <span className="ds-frame" aria-hidden="true" />
        <span className="ds-edgeband ds-edgeband--l" aria-hidden="true" />
        <span className="ds-edgeband ds-edgeband--r" aria-hidden="true" />

        <div className="relative z-10 h-full">{children}</div>
      </div>

      {/* 左右墨玉轴 */}
      <span className="ds-roller ds-roller--l" aria-hidden="true" />
      <span className="ds-roller ds-roller--r" aria-hidden="true" />

      <style>{CSS}</style>
    </div>
  )
}

function Corner({ className = '' }) {
  return (
    <svg
      className={`pointer-events-none absolute z-20 h-8 w-8 text-ink/25 ${className}`}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 18c0-6 4-10 9-10 4 0 6 2 6 5 0 2-1.6 3.4-3.4 3.4" />
      <path d="M4 26c3.5 0 6-1.6 7.4-4.4" />
      <path d="M18 4v5M4 4h5" />
    </svg>
  )
}

const CSS = `
.ds-scroll { --unroll: 2.8s; --close: 1.6s; --ease: cubic-bezier(.22,.61,.36,1) }
.ds-scroll[data-speed='brief'] { --unroll: 1.4s; --close: .9s }
.ds-scroll[data-reduce='true'] { --unroll: 0s; --close: 0s }

/* 纸面：从中缝向两侧揭开 */
.ds-paper {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: 3px;
  border-top: 1px solid rgba(138,112,74,.28);
  border-bottom: 1px solid rgba(138,112,74,.28);
  background:
    linear-gradient(168deg, #FFFDF8 0%, #FCF6E9 30%, #F7EFDD 58%, #F2EFE4 82%, #EDEFE6 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.8),
    inset 0 0 90px rgba(198,178,142,.26),
    inset 0 0 22px rgba(138,112,74,.12),
    0 24px 60px rgba(92,74,46,.28);
  clip-path: inset(0 50% 0 50%);
  transition: clip-path var(--unroll) var(--ease);
  will-change: clip-path;
}
/* 宣纸纤维 */
.ds-paper::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-image: url('/images/home/paper-texture.jpg');
  background-size: 520px;
  opacity: .22;
  mix-blend-mode: multiply;
}

/* 纸面分区色晕：上部青花蓝 + 朱砂，底部青绿，避免整张纸一个单调色 */
.ds-head-wash {
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 40%;
  z-index: 0;
  background:
    radial-gradient(ellipse 58% 100% at 16% 0%, rgba(47,90,138,.13) 0%, transparent 70%),
    radial-gradient(ellipse 44% 88% at 86% 2%, rgba(178,58,46,.09) 0%, transparent 72%);
}
.ds-tail-wash {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 36%;
  z-index: 0;
  background:
    radial-gradient(ellipse 62% 100% at 50% 100%, rgba(126,155,122,.17) 0%, transparent 72%),
    radial-gradient(ellipse 38% 78% at 90% 92%, rgba(184,134,47,.11) 0%, transparent 72%);
}

/* 角纹水印 */
.ds-motif {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  opacity: .3;
}
.ds-motif--blue {
  right: 18px;
  top: 30px;
  width: 76px;
  height: 76px;
}
.ds-motif--red {
  left: 18px;
  bottom: 26px;
  width: 84px;
  height: 84px;
  opacity: .26;
}

/* 装裱内框 + 两侧回纹细边 */
.ds-frame {
  position: absolute;
  inset: 8px;
  z-index: 2;
  pointer-events: none;
  border: 1px solid rgba(184,134,47,.3);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.5);
}
.ds-edgeband {
  position: absolute;
  top: 16px;
  bottom: 16px;
  width: 1px;
  z-index: 2;
  opacity: .5;
  background-image: repeating-linear-gradient(180deg, rgba(184,134,47,.55) 0 6px, transparent 6px 14px);
}
.ds-edgeband--l { left: 16px }
.ds-edgeband--r { right: 16px }
[data-open='true'] .ds-paper { clip-path: inset(0 0 0 0) }
[data-closing='true'] .ds-paper {
  clip-path: inset(0 50% 0 50%);
  transition-duration: var(--close);
  filter: blur(4px);
  opacity: .55;
}
[data-closing='true'] .ds-scroll {
  transform: scale(.94);
  transition: transform var(--close) var(--ease);
  filter: blur(1.5px);
}

/* 纵深投影：比纸面略大、更暗，展开后淡出，制造"画卷浮起" */
.ds-depth {
  position: absolute;
  inset: -10px -16px;
  border-radius: 8px;
  background: radial-gradient(ellipse at 50% 50%, rgba(160,124,58,.20) 0%, rgba(0,0,0,0) 68%);
  filter: blur(22px);
  opacity: 0;
  transition: opacity 1.4s ease .4s;
}
[data-open='true'] .ds-depth { opacity: 1 }

/* 纸内水墨晕染 */
.ds-wash {
  position: absolute;
  inset: 0;
  opacity: .9;
  background:
    radial-gradient(ellipse 46% 40% at 22% 30%, rgba(122,108,84,.12) 0%, transparent 66%),
    radial-gradient(ellipse 40% 44% at 78% 66%, rgba(150,130,96,.12) 0%, transparent 68%),
    radial-gradient(ellipse 70% 50% at 50% 50%, rgba(255,252,244,.55) 0%, transparent 72%);
  mix-blend-mode: multiply;
}

/* 数字点阵 */
.ds-grid {
  position: absolute;
  inset: 0;
  opacity: .5;
  background-image: radial-gradient(rgba(92,78,56,.16) 0.7px, transparent 0.7px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 70% 70% at 50% 46%, black 30%, transparent 82%);
  -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 46%, black 30%, transparent 82%);
}

/* 中央光晕 */
.ds-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 62%;
  height: 70%;
  transform: translate(-50%, -50%);
  background: radial-gradient(ellipse at center, rgba(224,162,63,.20) 0%, rgba(180,150,90,.07) 42%, transparent 70%);
  filter: blur(18px);
  animation: dsGlow 8s ease-in-out infinite;
}
@keyframes dsGlow {
  0%, 100% { opacity: .7; transform: translate(-50%, -50%) scale(.98) }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.04) }
}

.ds-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 78% 74% at 50% 50%, transparent 55%, rgba(126,104,70,.16) 100%);
}

/* 上下金线 */
.ds-rule {
  position: absolute;
  left: 26px;
  right: 26px;
  height: 1px;
  z-index: 20;
  opacity: 0;
  transition: opacity .7s ease .45s;
}
.ds-rule--t {
  top: 13px;
  background: linear-gradient(90deg, transparent, rgba(184,134,47,.45) 14%, rgba(184,134,47,.7) 50%, rgba(184,134,47,.45) 86%, transparent);
}
.ds-rule--b {
  bottom: 13px;
  background: linear-gradient(90deg, transparent, rgba(126,155,122,.35) 14%, rgba(126,155,122,.55) 50%, rgba(126,155,122,.35) 86%, transparent);
}
[data-open='true'] .ds-rule { opacity: 1 }

/* 墨玉轴：从中央向外移动 */
.ds-roller {
  position: absolute;
  top: -14px;
  bottom: -14px;
  z-index: 30;
  width: 16px;
  border-radius: 9px;
  background: linear-gradient(90deg, #3E2C1D 0%, #5B4029 22%, #8A6539 42%, #D9B978 50%, #7A5730 60%, #4A3321 84%, #2E2015 100%);
  box-shadow: 0 12px 28px rgba(80,62,38,.35), inset 0 0 8px rgba(0,0,0,.45);
  transition: left var(--unroll) var(--ease), right var(--unroll) var(--ease);
  will-change: left, right;
}
.ds-roller--l { left: calc(50% - 8px) }
.ds-roller--r { right: calc(50% - 8px) }
[data-open='true'] .ds-roller--l { left: -8px }
[data-open='true'] .ds-roller--r { right: -8px }
[data-closing='true'] .ds-roller--l { left: calc(50% - 8px); transition-duration: var(--close) }
[data-closing='true'] .ds-roller--r { right: calc(50% - 8px); transition-duration: var(--close) }

/* 轴头 */
.ds-roller::before,
.ds-roller::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 24px;
  height: 10px;
  margin-left: -12px;
  border-radius: 5px;
  background: linear-gradient(180deg, #F0DDAE 0%, #C8B384 45%, #6B5B38 100%);
  box-shadow: 0 2px 6px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.4);
}
.ds-roller::before { top: -5px }
.ds-roller::after { bottom: -5px }

@media (max-width: 640px) {
  .ds-roller { width: 12px }
  .ds-roller--l { left: calc(50% - 6px) }
  .ds-roller--r { right: calc(50% - 6px) }
  [data-open='true'] .ds-roller--l { left: -6px }
  [data-open='true'] .ds-roller--r { right: -6px }
  .ds-roller::before, .ds-roller::after { width: 18px; margin-left: -9px; height: 8px }
  .ds-rule { left: 16px; right: 16px }
}

@media (prefers-reduced-motion: reduce) {
  .ds-paper, .ds-roller, .ds-rule, .ds-depth { transition: none !important }
  .ds-glow { animation: none }
}
`
