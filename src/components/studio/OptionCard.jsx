/* ============================================================
 * 选项卡片 OptionCard（可复用）
 * ------------------------------------------------------------
 * 主题、创作类型、风格三组选择器都用它渲染，保证交互一致。
 * Props：
 *   icon：图标名（可选）/ title：标题 / subtitle：副标题或提示
 *   selected：是否选中 / onClick：点击回调
 * ============================================================ */
import StudioIcon from './StudioIcons.jsx'

export default function OptionCard({ icon, title, subtitle, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex h-full flex-col items-start rounded-2xl border p-4 text-left transition
        ${
          selected
            ? 'border-cinnabar bg-cinnabar/5 shadow-[0_6px_20px_rgba(178,58,46,0.10)]'
            : 'border-line bg-white hover:border-cinnabar/35 hover:bg-paper/50'
        }`}
    >
      {/* 选中态右上角对勾（父卡片是 relative，定位锚点不会漂移） */}
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-cinnabar text-white">
          <StudioIcon name="check" size={12} strokeWidth={2.6} />
        </span>
      )}

      {icon && (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            selected ? 'bg-cinnabar text-white' : 'bg-cinnabar/10 text-cinnabar'
          }`}
        >
          <StudioIcon name={icon} size={20} />
        </span>
      )}

      <span className={`mt-3 text-sm font-medium ${selected ? 'text-cinnabar-dark' : 'text-ink'}`}>
        {title}
      </span>
      {subtitle && <span className="mt-1 text-xs leading-relaxed text-ink-mute">{subtitle}</span>}
    </button>
  )
}
