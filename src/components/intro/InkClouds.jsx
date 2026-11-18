/* ============================================================
 * InkClouds：阶段二「水墨云雾涌现」
 * ------------------------------------------------------------
 * 三层水墨，全部由代码生成，没有贴图：
 *   ① 墨团：多个不同半径、不同模糊度的暗蓝墨块，缓慢膨胀、错峰呼吸
 *   ② 云雾带：左右两侧向中央涌动的半透明雾带（漫射渐变，不是硬边烟雾）
 *   ③ 银蓝流丝：细长光影，速度更快，制造"气在流动"的层次
 *
 * 用 data-active / data-converge 控制两种形态：
 *   active    云雾从两侧涌入，中央略微透亮
 *   converge  收场时向中轴汇聚、压扁、淡出（配合画卷消散）
 * ============================================================ */

export default function InkClouds({ phase }) {
  const active = ['clouds', 'unroll', 'elements', 'show', 'closing'].includes(phase)
  const converge = phase === 'closing'

  return (
    <div
      className="ink-clouds pointer-events-none absolute inset-0 overflow-hidden"
      data-active={active ? 'true' : 'false'}
      data-converge={converge ? 'true' : 'false'}
      aria-hidden="true"
    >
      {/* ① 墨团 */}
      <span className="ic-blob ic-blob--1" />
      <span className="ic-blob ic-blob--2" />
      <span className="ic-blob ic-blob--3" />
      <span className="ic-blob ic-blob--4" />

      {/* ② 左右云雾带 */}
      <span className="ic-cloud ic-cloud--l" />
      <span className="ic-cloud ic-cloud--r" />

      {/* ③ 水墨流丝（SVG，静态形状 + CSS 位移动画） */}
      <svg className="ic-wisp ic-wisp--l" viewBox="0 0 700 900" preserveAspectRatio="none" fill="none">
        <path
          d="M-40 620C120 470 180 300 340 260c120-30 180 60 250 30"
          stroke="url(#icWispGrad)"
          strokeWidth="26"
          strokeLinecap="round"
          filter="url(#icBlur)"
          opacity="0.45"
        />
        <path
          d="M-30 760C140 660 210 520 380 500c110-14 170 40 240 10"
          stroke="url(#icWispGrad)"
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#icBlur)"
          opacity="0.32"
        />
      </svg>
      <svg className="ic-wisp ic-wisp--r" viewBox="0 0 700 900" preserveAspectRatio="none" fill="none">
        <path
          d="M740 300C580 420 520 560 360 600c-120 30-180-50-250-20"
          stroke="url(#icWispGrad2)"
          strokeWidth="24"
          strokeLinecap="round"
          filter="url(#icBlur)"
          opacity="0.42"
        />
        <path
          d="M750 180C600 280 540 400 380 430c-110 20-170-30-240 0"
          stroke="url(#icWispGrad2)"
          strokeWidth="14"
          strokeLinecap="round"
          filter="url(#icBlur)"
          opacity="0.3"
        />
      </svg>

      {/* 银蓝流丝 */}
      <span className="ic-streak ic-streak--1" />
      <span className="ic-streak ic-streak--2" />

      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="icWispGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8A7A60" stopOpacity="0" />
            <stop offset="55%" stopColor="#8A7A60" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#B8862F" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="icWispGrad2" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#8A7A60" stopOpacity="0" />
            <stop offset="55%" stopColor="#8A7A60" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#B8862F" stopOpacity="0.16" />
          </linearGradient>
          <filter id="icBlur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
      </svg>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.ink-clouds { opacity: 0; transition: opacity 1.2s ease }
.ink-clouds[data-active='true'] { opacity: 1 }

.ic-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0;
  transform: scale(.7);
  transition: opacity 1.6s ease, transform 2.4s cubic-bezier(.22,.61,.36,1);
  mix-blend-mode: multiply;
}
.ic-blob--1 {
  left: -12%; top: 6%; width: 66vw; height: 66vw;
  background: radial-gradient(circle at 40% 45%, rgba(92,82,66,.34) 0%, rgba(118,106,86,.16) 45%, transparent 72%);
}
.ic-blob--2 {
  right: -14%; top: 0%; width: 70vw; height: 70vw;
  background: radial-gradient(circle at 60% 50%, rgba(88,78,62,.3) 0%, rgba(116,104,84,.14) 48%, transparent 74%);
  transition-delay: .18s;
}
.ic-blob--3 {
  left: 8%; bottom: -18%; width: 62vw; height: 62vw;
  mix-blend-mode: normal;
  background: radial-gradient(circle at 45% 55%, rgba(255,252,244,.9) 0%, rgba(244,236,219,.45) 45%, transparent 72%);
  transition-delay: .3s;
}
.ic-blob--4 {
  right: 4%; bottom: -14%; width: 56vw; height: 56vw;
  mix-blend-mode: normal;
  background: radial-gradient(circle at 55% 45%, rgba(255,253,247,.8) 0%, rgba(238,229,210,.4) 50%, transparent 74%);
  transition-delay: .42s;
}
[data-active='true'] .ic-blob { opacity: 1; transform: scale(1) }
[data-active='true'] .ic-blob--1 { animation: icBlobA 22s ease-in-out infinite }
[data-active='true'] .ic-blob--2 { animation: icBlobB 26s ease-in-out infinite }
[data-active='true'] .ic-blob--3 { animation: icBlobB 30s ease-in-out infinite reverse }
[data-active='true'] .ic-blob--4 { animation: icBlobA 34s ease-in-out infinite reverse }
@keyframes icBlobA {
  0%, 100% { transform: translate3d(0,0,0) scale(1) }
  50% { transform: translate3d(3%, -2%, 0) scale(1.06) }
}
@keyframes icBlobB {
  0%, 100% { transform: translate3d(0,0,0) scale(1) }
  50% { transform: translate3d(-3%, 2%, 0) scale(1.05) }
}

/* 左右云雾带：从两侧向中央涌动 */
.ic-cloud {
  position: absolute;
  top: 50%;
  width: 84%;
  height: 104%;
  margin-top: -52%;
  filter: blur(34px);
  opacity: 0;
  transition: transform 2.6s cubic-bezier(.22,.61,.36,1), opacity 1.8s ease;
  background:
    radial-gradient(ellipse 60% 50% at 70% 40%, rgba(255,254,249,.92) 0%, rgba(255,252,244,.35) 46%, transparent 70%),
    radial-gradient(ellipse 55% 46% at 38% 62%, rgba(122,110,90,.20) 0%, transparent 70%),
    radial-gradient(ellipse 72% 62% at 55% 50%, rgba(255,253,246,.66) 0%, transparent 76%);
}
.ic-cloud--l { left: -62%; transform: translateX(-8%) }
.ic-cloud--r { right: -62%; transform: translateX(8%) scaleX(-1) }
[data-active='true'] .ic-cloud--l { opacity: 1; transform: translateX(30%) }
[data-active='true'] .ic-cloud--r { opacity: 1; transform: translateX(-14%) scaleX(-1); transition-delay: .2s }

.ic-wisp {
  position: absolute;
  top: 0;
  height: 100%;
  width: 52%;
  opacity: 0;
  transition: opacity 2s ease, transform 3s cubic-bezier(.22,.61,.36,1);
}
.ic-wisp--l { left: -18%; transform: translateX(-16%) }
.ic-wisp--r { right: -18%; transform: translateX(16%) }
[data-active='true'] .ic-wisp--l { opacity: .9; transform: translateX(4%); animation: icWispA 16s ease-in-out infinite }
[data-active='true'] .ic-wisp--r { opacity: .85; transform: translateX(-4%); animation: icWispB 19s ease-in-out infinite }
@keyframes icWispA {
  0%, 100% { transform: translate3d(4%, 0, 0) }
  50% { transform: translate3d(8%, -1.5%, 0) }
}
@keyframes icWispB {
  0%, 100% { transform: translate3d(-4%, 0, 0) }
  50% { transform: translate3d(-8%, 1.2%, 0) }
}

.ic-streak {
  position: absolute;
  height: 1px;
  width: 42%;
  background: linear-gradient(90deg, transparent, rgba(168,132,60,.45), transparent);
  filter: blur(.4px);
  opacity: 0;
  transition: opacity 1.4s ease 1s;
}
.ic-streak--1 { left: 2%; top: 34%; transform: rotate(-8deg); animation: icStreak 9s ease-in-out infinite }
.ic-streak--2 { right: 2%; top: 66%; transform: rotate(7deg); animation: icStreak 11s ease-in-out infinite reverse }
[data-active='true'] .ic-streak { opacity: .6 }
@keyframes icStreak {
  0%, 100% { opacity: .15; transform: translateX(-4%) rotate(-8deg) }
  50% { opacity: .55; transform: translateX(4%) rotate(-8deg) }
}

/* 收场：整片云雾向中轴汇聚、压扁、淡出 */
.ink-clouds[data-converge='true'] { opacity: 0; transition: opacity .9s ease .15s }
.ink-clouds[data-converge='true'] .ic-cloud--l { transform: translateX(-34%) scaleX(.5) }
.ink-clouds[data-converge='true'] .ic-cloud--r { transform: translateX(34%) scaleX(-.5) }
.ink-clouds[data-converge='true'] .ic-wisp { opacity: 0; transform: translateX(0) scaleX(.3) }

@media (prefers-reduced-motion: reduce) {
  .ic-blob, .ic-cloud, .ic-wisp, .ic-streak { animation: none !important }
  [data-active='true'] .ic-blob { opacity: .9; transform: none }
}
`
