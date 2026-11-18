/* ============================================================
 * 空状态 EmptyState（可复用）
 * ------------------------------------------------------------
 * 当筛选 / 搜索没有任何结果时显示，引导用户调整条件。
 * Props：
 *   keyword：当前搜索词（可选，用于提示文案）
 *   onReset：点击"清空筛选条件"的回调
 * ============================================================ */
import { Link } from 'react-router-dom'

export default function EmptyState({ keyword, onReset }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      {/* 放大镜图标 */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>

      <h3 className="mt-5 font-serif text-lg font-semibold text-ink">没有找到相关非遗</h3>
      {keyword && keyword.trim() ? (
        <p className="mt-2 text-sm text-ink-mute">
          没有与「{keyword.trim()}」匹配的项目，换个关键词或放宽筛选条件试试。
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-mute">当前门类与地区的组合下暂无项目，试试放宽条件。</p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onReset} className="btn-primary">
          清空筛选条件
        </button>
        <Link to="/chat" className="btn-ghost">
          去问问 AI 导师
        </Link>
      </div>
    </div>
  )
}
