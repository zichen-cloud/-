/* ============================================================
 * 生成中状态 GeneratingState
 * ------------------------------------------------------------
 * 用分步进度模拟 AI 的工作过程。
 * 当前步骤 currentStep 由页面组件驱动，本组件只负责展示。
 * Props：
 *   currentStep：当前高亮步骤下标
 *   steps：分步文案（默认旧版设计方案的四步）
 *   title / note：标题与等待提示
 * ============================================================ */
import { generatingSteps } from '../../data/studioOptions.js'

export default function GeneratingState({
  currentStep,
  steps = generatingSteps,
  title = 'AI 正在为你创作',
  note = '方案由本地 Mock 模板生成，预计约 2 秒',
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center sm:py-20">
      {/* 旋转圆环（全页面唯一的生成中动画，避免多处重复反馈） */}
      <span
        className="h-12 w-12 animate-spin rounded-full border-[3px] border-cinnabar/20 border-t-cinnabar"
        aria-hidden
      />
      <h2 className="mt-6 font-serif text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-mute">{note}</p>

      {/* 分步清单：已完成显示对勾、当前步骤高亮、未开始置灰 */}
      <ul className="mt-8 w-full max-w-xs space-y-3 text-left">
        {steps.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <li
              key={step}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                done
                  ? 'text-ink-soft'
                  : active
                    ? 'bg-cinnabar/10 font-medium text-cinnabar-dark'
                    : 'text-ink-mute'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  done
                    ? 'bg-celadon text-white'
                    : active
                      ? 'bg-cinnabar text-white'
                      : 'bg-line text-ink-mute'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              {step}
              {active && (
                <span className="ml-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-cinnabar/30 border-t-cinnabar" aria-hidden />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
