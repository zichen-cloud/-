/* ============================================================
 * 非遗知识馆 Heritage（列表页）
 * ------------------------------------------------------------
 * 功能：
 *   1. 卡片网格展示全部非遗项目
 *   2. 门类筛选（传统戏剧 / 传统美术 / 传统技艺）
 *   3. 地区筛选（按省份下拉）
 *   4. 关键词搜索（名称 / 简介 / 门类 / 地区 / 标签）
 *   5. 三个条件可以叠加，点卡片进入详情页
 *
 * 学习要点：
 *   - useState：保存筛选条件
 *   - useMemo：只要筛选条件没变化，就复用上次计算结果（性能优化）
 * ============================================================ */
import { useMemo, useState } from 'react'
import {
  getAllItems,
  getCategories,
  getProvinces,
  filterItems,
} from '../data/heritageService.js'
import HeritageCard from '../components/heritage/HeritageCard.jsx'
import FilterBar from '../components/heritage/FilterBar.jsx'
import EmptyState from '../components/heritage/EmptyState.jsx'
import { InkBand } from '../components/decor/OrientalDecor.jsx'

export default function Heritage() {
  // 三个筛选条件（组件状态）。'全部' 是门类/地区的默认值，表示不限制
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部')
  const [province, setProvince] = useState('全部')

  // 可选项只需要计算一次：门类和地区列表来自数据，写死会导致新增数据时漏改
  const categories = useMemo(() => getCategories(), [])
  const provinces = useMemo(() => getProvinces(), [])

  // 只要 keyword/category/province 任一变化，就重新筛选；
  // 没变化时（比如其他组件引起刷新）直接复用上次结果
  const filteredItems = useMemo(
    () => filterItems({ keyword, category, province }),
    [keyword, category, province],
  )

  // 一键清空全部条件
  const handleReset = () => {
    setKeyword('')
    setCategory('全部')
    setProvince('全部')
  }

  return (
    <div className="relative overflow-x-clip">
      {/* 页面头部：淡墨山水背景 + 标题说明 */}
      <section className="relative border-b border-line/70">
        <InkBand src="/images/decor/heritage-scenery.jpg" className="absolute inset-x-0 top-0 h-48 w-full sm:h-56" />
        <div className="container-page relative py-12 md:py-14">
          <div className="relative max-w-2xl">
            {/* 标题区柔光：让文字从山水中浮出来，边缘不可见 */}
            <div className="pointer-events-none absolute -inset-x-6 -inset-y-6 bg-[radial-gradient(ellipse_at_25%_50%,rgba(251,247,240,0.7)_0%,rgba(251,247,240,0.35)_52%,rgba(251,247,240,0)_80%)]" />
            <div className="relative">
              <p className="eyebrow">Explore Heritage</p>
              <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
                探索非遗
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                按门类与地区浏览非遗项目，或直接搜索你感兴趣的技艺。内容中标注了「待核实」的信息，
                请以官方名录与权威出版物为准。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        {/* 筛选工具栏 */}
        <FilterBar
          keyword={keyword}
          category={category}
          province={province}
          categories={categories}
          provinces={provinces}
          resultCount={filteredItems.length}
          onKeywordChange={setKeyword}
          onCategoryChange={setCategory}
          onProvinceChange={setProvince}
          onReset={handleReset}
        />

        {/* 门类快速筛选 chips：与上方下拉共用同一个 category 状态，点谁筛谁
            （数字博物馆的"分类展厅"式浏览，每类显示收录数量） */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory('全部')}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              category === '全部'
                ? 'border-cinnabar bg-cinnabar text-white'
                : 'border-line bg-white text-ink-soft hover:border-cinnabar/40 hover:text-cinnabar'
            }`}
          >
            全部 <span className="opacity-70">{getAllItems().length}</span>
          </button>
          {categories.map((c) => {
            const count = getAllItems().filter((i) => i.category === c).length
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(active ? '全部' : c)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  active
                    ? 'border-cinnabar bg-cinnabar text-white'
                    : 'border-line bg-white text-ink-soft hover:border-cinnabar/40 hover:text-cinnabar'
                }`}
              >
                {c} <span className="opacity-70">{count}</span>
              </button>
            )
          })}
        </div>

        {/* 结果区：有结果显示卡片网格，无结果显示空状态 */}
        {filteredItems.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <HeritageCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState keyword={keyword} onReset={handleReset} />
          </div>
        )}

        {/* 数据总数说明（让用户知道筛选是在多少项里进行的） */}
        <p className="mt-8 text-center text-xs text-ink-mute">
          知识馆共收录 {getAllItems().length} 个非遗项目，与 AI 导师的知识库保持同步
        </p>
      </section>

      {/* 底部水墨山峦收束，与页脚宣纸衔接 */}
      <InkBand src="/images/decor/heritage-scenery.jpg" anchor="bottom" flip className="h-24 w-full sm:h-36" />
    </div>
  )
}
