/* ============================================================
 * 设计方案结果 DesignPlanResult
 * ------------------------------------------------------------
 * 展示 Mock / 真实 AI 返回的结构化方案：
 *   数字作品声明 → 文生图预留区 → 提示词 → 设计说明
 *   → 配色建议 → 构图建议 → 传统元素说明
 * 顶部操作：保存到我的作品、重新生成。
 *
 * Props：
 *   title：作品标题
 *   badges：[{label}] 主题/类型/风格小标签
 *   mode：'mock' | 'ai'
 *   promptSummary：文生图提示词
 *   plan：{ designBrief, colorPalette, composition, traditionalElements }
 *   saved：是否已保存（保存后按钮变为"已保存 · 查看作品"）
 *   onSave / onRegenerate
 * ============================================================ */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import StudioIcon from './StudioIcons.jsx'
import { DIGITAL_WORK_DISCLAIMER } from '../../services/studioService.js'

export default function DesignPlanResult({
  title,
  badges,
  mode,
  promptSummary,
  plan,
  saved,
  onSave,
  onRegenerate,
}) {
  // 复制提示词的反馈
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptSummary)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 部分浏览器要求 https 才允许剪贴板，失败时静默（提示词本身已完整可见、可手动复制）
      setCopied(false)
    }
  }

  return (
    <div className="card p-5 sm:p-6">
      {/* 头部：标题与标签 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((b) => (
              <span key={b} className="chip">{b}</span>
            ))}
          </div>
          <h2 className="mt-2.5 font-serif text-xl font-semibold text-ink">{title}</h2>
        </div>
        {/* 来源徽章：与识别页保持一致的口径 */}
        <span className="rounded-full bg-ink/10 px-2.5 py-1 text-xs font-medium text-ink-soft">
          {mode === 'mock' ? 'Mock 演示生成' : 'AI 生成'}
        </span>
      </div>

      {/* ★ 数字作品声明：明确区分传统工艺实物与 AI 数字作品 */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-celadon/30 bg-celadon/10 px-4 py-3">
        <StudioIcon name="sparkle" size={16} className="mt-0.5 shrink-0 text-celadon" />
        <p className="text-xs leading-relaxed text-ink-soft">{DIGITAL_WORK_DISCLAIMER}</p>
      </div>

      {/* ★ 文生图接口预留区：当前只展示提示词，后续接入图像生成后在此显示图片 */}
      <section className="mt-6">
        <SectionTitle icon="palette" title="成图提示词" />
        <div className="mt-3 rounded-2xl border border-dashed border-line bg-paper/60 p-4">
          <p className="text-sm leading-relaxed text-ink-soft">{promptSummary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink transition hover:border-cinnabar/40 hover:text-cinnabar"
            >
              <StudioIcon name="copy" size={13} />
              {copied ? '已复制' : '复制提示词'}
            </button>
            <span className="text-xs text-ink-mute">
              文生图接口预留：接入后端后可用此提示词直接生成设计图
            </span>
          </div>
          {/* 图片占位 */}
          <div className="mt-4 flex aspect-[16/9] flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-white/60 text-center">
            <StudioIcon name="palette" size={26} className="text-ink-mute" />
            <p className="mt-2 text-xs text-ink-mute">
              设计图区域（待接入 POST /api/studio/generate-image）
            </p>
          </div>
        </div>
      </section>

      {/* 设计说明 */}
      <section className="mt-7">
        <SectionTitle icon="sparkle" title="设计说明" />
        <p className="mt-3 text-sm leading-loose text-ink-soft">{plan.designBrief}</p>
      </section>

      {/* 配色建议 */}
      <section className="mt-7">
        <SectionTitle icon="palette" title="配色建议" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plan.colorPalette.map((color) => (
            <div key={color.hex} className="overflow-hidden rounded-xl border border-line">
              {/* 色块 */}
              <div className="h-14" style={{ backgroundColor: color.hex }} aria-hidden />
              <div className="bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{color.name}</span>
                  <span className="text-xs uppercase text-ink-mute">{color.hex}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">{color.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 构图建议 */}
      <section className="mt-7">
        <SectionTitle icon="layout" title="构图建议" />
        <ul className="mt-3 space-y-2.5">
          {plan.composition.map((tip, i) => (
            <li key={tip} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cinnabar/10 text-xs font-medium text-cinnabar">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {/* 传统元素说明（每条都附"请核实历史与寓意"的提醒） */}
      <section className="mt-7">
        <SectionTitle icon="pattern" title="传统元素说明" />
        <div className="mt-3 space-y-3">
          {plan.traditionalElements.map((el) => (
            <div key={el.name} className="rounded-xl border border-line bg-paper/50 p-4">
              <p className="text-sm font-medium text-ink">{el.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{el.desc}</p>
              <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-gold-dark">
                <StudioIcon name="sparkle" size={12} className="mt-0.5 shrink-0" />
                {el.verifyNote}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 底部操作 */}
      <div className="mt-8 flex flex-col gap-3 border-t border-line/70 pt-5 sm:flex-row">
        {saved ? (
          <Link to="/works" className="btn-primary flex-1">
            <StudioIcon name="check" size={16} strokeWidth={2.4} />
            已保存 · 前往我的作品
          </Link>
        ) : (
          <button type="button" onClick={onSave} className="btn-primary flex-1">
            <StudioIcon name="save" size={16} />
            保存到我的作品
          </button>
        )}
        <button type="button" onClick={onRegenerate} className="btn-ghost flex-1">
          <StudioIcon name="refresh" size={15} />
          重新生成
        </button>
      </div>
    </div>
  )
}

/* 板块小标题（本文件内部组件） */
function SectionTitle({ icon, title }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cinnabar/10 text-cinnabar">
        <StudioIcon name={icon} size={14} />
      </span>
      {title}
    </h3>
  )
}
