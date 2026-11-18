/* ============================================================
 * 筛选工具栏 FilterBar（可复用）
 * ------------------------------------------------------------
 * 包含三个"受控组件"（值由父组件通过 props 管理）：
 *   1. 关键词搜索框
 *   2. 门类筛选按钮组（单选）
 *   3. 地区下拉选择
 * 并显示当前结果数量与"重置"按钮。
 *
 * Props：
 *   keyword/category/province：当前选中的值
 *   onKeywordChange/onCategoryChange/onProvinceChange：修改回调
 *   categories/provinces：可选项数组
 *   resultCount：筛选后的结果数量
 *   onReset：一键清空全部筛选条件
 * ============================================================ */

export default function FilterBar({
  keyword,
  category,
  province,
  categories,
  provinces,
  resultCount,
  onKeywordChange,
  onCategoryChange,
  onProvinceChange,
  onReset,
}) {
  // 是否存在任意筛选条件（决定"重置"按钮是否可点）
  const hasActiveFilter =
    keyword.trim() !== '' || category !== '全部' || province !== '全部'

  return (
    <div className="card p-5 sm:p-6">
      {/* 第一行：搜索框 + 地区下拉 */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* 搜索框（relative 给内部搜索图标做定位锚点） */}
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜索非遗名称、门类或标签，如：昆曲、刺绣、皮影"
            className="w-full rounded-full border border-line bg-paper/60 py-2.5 pl-11 pr-4 text-sm
              text-ink outline-none transition placeholder:text-ink-mute
              focus:border-cinnabar/50 focus:bg-white focus:ring-2 focus:ring-cinnabar/10"
          />
        </div>

        {/* 地区筛选 */}
        <div className="relative sm:w-44">
          <select
            value={province}
            onChange={(e) => onProvinceChange(e.target.value)}
            aria-label="按地区筛选"
            className="w-full appearance-none rounded-full border border-line bg-paper/60 py-2.5 pl-4 pr-10
              text-sm text-ink outline-none transition
              focus:border-cinnabar/50 focus:bg-white focus:ring-2 focus:ring-cinnabar/10"
          >
            <option value="全部">全部地区</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {/* 下拉箭头装饰 */}
          <svg
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-mute"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* 第二行：门类按钮组 + 结果数 + 重置 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FilterPill
          label="全部"
          active={category === '全部'}
          onClick={() => onCategoryChange('全部')}
        />
        {categories.map((c) => (
          <FilterPill
            key={c}
            label={c}
            active={category === c}
            onClick={() => onCategoryChange(c)}
          />
        ))}

        <div className="ml-auto flex items-center gap-3 text-xs text-ink-mute">
          <span aria-live="polite">共 {resultCount} 项结果</span>
          <button
            type="button"
            disabled={!hasActiveFilter}
            onClick={onReset}
            className="rounded-full px-3 py-1.5 font-medium text-cinnabar transition
              hover:bg-cinnabar/10 disabled:cursor-not-allowed disabled:text-ink-mute disabled:hover:bg-transparent"
          >
            重置筛选
          </button>
        </div>
      </div>
    </div>
  )
}

/* 门类小药丸按钮（本文件内部使用的子组件） */
function FilterPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm transition ${
        active
          ? 'bg-cinnabar font-medium text-white shadow-sm'
          : 'bg-paper text-ink-soft hover:bg-cinnabar/10 hover:text-cinnabar'
      }`}
    >
      {label}
    </button>
  )
}
