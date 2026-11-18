/* ============================================================
 * 工作台步骤条 WorkbenchSteps
 * ------------------------------------------------------------
 * 三步流程：①产品效果图 → ②3D 展示 → ③介绍视频
 * 三个步骤均已开放；已完成的步骤显示对勾。
 *
 * 视觉：三张圆角卡片紧凑阶梯排布，飘逸曲线箭头串联；
 * 背景是新中式淡水墨山水——淡青绿层叠远山 + 半展开的悬挂卷轴，
 * 卷轴下角盖一枚朱砂篆印（纯装饰，不影响交互）。
 *
 * Props：
 *   current：当前步骤（1-3）
 *   finished：已完成的步骤数（用于显示对勾）
 * ============================================================ */
import StudioIcon from './StudioIcons.jsx'

const STEPS = [
  { id: 1, name: '产品效果图', desc: 'AI 生成 3 套提案', icon: 'image' },
  { id: 2, name: '3D 展示', desc: '模型旋转与贴图', icon: 'cube' },
  { id: 3, name: '介绍视频', desc: 'AI 配音短片', icon: 'video' },
]

export default function WorkbenchSteps({ current = 1, finished = 0 }) {
  return (
    <div className="relative">

      {/* 装饰层：飘逸曲线 + 祥云 */}
      <svg
        className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        viewBox="0 0 1000 240"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M40 208 C 190 168 300 212 430 182 C 560 152 660 118 790 92 C 880 74 940 62 1000 48"
          stroke="#AFC6B0"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* 第一步 → 第二步 */}
        <path d="M318 116 C 344 98 372 96 398 112" stroke="#8FAF9A" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
        <path d="M390 103 l 12 10 -14 6" stroke="#8FAF9A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* 第二步 → 第三步 */}
        <path d="M648 132 C 676 114 704 112 730 128" stroke="#8FAF9A" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
        <path d="M722 119 l 12 10 -14 6" stroke="#8FAF9A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* 祥云：只在宽屏出现 */}
      <svg
        className="pointer-events-none absolute bottom-1 left-[24%] hidden w-20 opacity-60 md:block"
        viewBox="0 0 120 64"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M18 42c-8 0-14-6-14-13S10 16 18 16c1-9 10-15 19-12 6-10 21-9 25 3 10-4 21 4 20 15 8 1 12 7 10 13-2 6-8 9-15 7H18Z"
          stroke="#8FB09B"
          strokeWidth="1.6"
          opacity="0.7"
        />
        <path d="M14 52c14 7 34 7 48 0 8-4 17-4 22 0" stroke="#8FB09B" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-5 left-[58%] hidden w-16 opacity-50 md:block"
        viewBox="0 0 120 64"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M18 42c-8 0-14-6-14-13S10 16 18 16c1-9 10-15 19-12 6-10 21-9 25 3 10-4 21 4 20 15 8 1 12 7 10 13-2 6-8 9-15 7H18Z"
          stroke="#8FB09B"
          strokeWidth="1.6"
          opacity="0.7"
        />
        <path d="M14 52c14 7 34 7 48 0 8-4 17-4 22 0" stroke="#8FB09B" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      </svg>

      <ol className="relative z-20 grid gap-3 md:grid-cols-3 md:gap-4">
        {STEPS.map((step, i) => {
          const done = step.id <= finished
          const active = step.id === current
          return (
            <li
              key={step.id}
              className={`relative ${i === 1 ? 'md:translate-y-3' : i === 2 ? 'md:translate-y-6' : ''}`}
            >
              <div
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition ${
                  active
                    ? 'border-cinnabar/55 bg-[#FBF0E7]/95 shadow-[0_10px_22px_-16px_rgba(178,58,46,0.35)]'
                    : done
                      ? 'border-[#CBDCCD] bg-white/90 shadow-[0_10px_22px_-18px_rgba(58,58,56,0.4)]'
                      : 'border-[#EADFC8] bg-white/90 shadow-[0_10px_22px_-18px_rgba(58,58,56,0.3)]'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    active
                      ? 'bg-cinnabar text-white'
                      : done
                        ? 'bg-celadon text-white'
                        : 'bg-[#EFE8D9] text-ink-mute'
                  }`}
                >
                  {done ? (
                    <StudioIcon name="check" size={17} strokeWidth={2.6} />
                  ) : (
                    <StudioIcon name={step.icon} size={18} />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={`flex items-center gap-1.5 whitespace-nowrap text-sm font-medium ${
                      active ? 'text-cinnabar-dark' : done ? 'text-ink' : 'text-ink-soft'
                    }`}
                  >
                    <span className="font-serif">{step.id}.</span>
                    {step.name}
                  </p>
                  <p className="truncate text-xs text-ink-mute">{step.desc}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
