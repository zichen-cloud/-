/* ============================================================
 * 产品提案画廊 ProposalGallery
 * ------------------------------------------------------------
 * 展示 3 个产品设计提案（效果图 + 标题 + 设计理念 + 非遗元素说明），
 * 用户选择其中 1 个后进入下一步（阶段二 3D 展示，当前置灰）。
 *
 * 真实 / 演示必须一眼可分：
 *   imageMode='demo' → 琥珀色"演示图"角标
 *   imageMode='real' → 青绿"AI 生成"角标
 *
 * Props：
 *   proposals / mode（文案模式） / imageMode / imageModel / disclaimer
 *   selectedId / onSelect(id) / saved / onSave / onRegenerate
 *   onEnter3D：选中方案后进入阶段二 3D 展示
 *   productType：当前选择的产品类型 id；为空（纯视觉创作）时不提供 3D 入口
 * ============================================================ */
import StudioIcon from './StudioIcons.jsx'

export default function ProposalGallery({
  proposals,
  mode,
  imageMode,
  imageModel,
  disclaimer,
  selectedId,
  productType,
  onSelect,
  saved,
  saving,
  onSave,
  onRegenerate,
  onEnter3D,
}) {
  const isDemo = imageMode !== 'real'
  const selected = proposals.find((p) => p.id === selectedId) || null

  return (
    <div className="space-y-5">
      {/* 顶部状态行：说明这批提案的生成方式 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-ink">
          共 {proposals.length} 个设计提案
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isDemo ? 'bg-amber-50 text-amber-700' : 'bg-celadon/10 text-celadon'
          }`}
        >
          <StudioIcon name={isDemo ? 'image' : 'sparkle'} size={13} />
          {isDemo ? '演示效果图（非真实生成）' : `AI 真实生成 · ${imageModel || '万相'}`}
        </span>
      </div>

      {/* 提案卡片网格 */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {proposals.map((p) => {
          const active = p.id === selectedId
          return (
            <article
              key={p.id}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition ${
                active
                  ? 'border-cinnabar shadow-[0_10px_30px_rgba(178,58,46,0.12)]'
                  : 'border-line hover:border-cinnabar/35'
              }`}
            >
              {/* 效果图（demo 图本身带水印，角标再做一次明确区分） */}
              <div className="relative aspect-square bg-paper">
                <img src={p.imageUrl} alt={p.proposalTitle} className="h-full w-full object-cover" />
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium text-white shadow-sm ${
                    isDemo ? 'bg-amber-600/90' : 'bg-celadon/90'
                  }`}
                >
                  {isDemo ? '演示图' : 'AI 生成'}
                </span>
                {active && (
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-cinnabar text-white">
                    <StudioIcon name="check" size={15} strokeWidth={2.6} />
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-serif text-base font-semibold text-ink">{p.proposalTitle}</h3>

                <div className="mt-2.5 space-y-2.5 text-xs leading-relaxed text-ink-soft">
                  <div>
                    <p className="font-medium text-ink">设计理念</p>
                    <p className="mt-0.5">{p.concept}</p>
                  </div>
                  <div>
                    <p className="font-medium text-ink">非遗元素应用</p>
                    <p className="mt-0.5">{p.elements}</p>
                  </div>
                  {Array.isArray(p.composition) && p.composition.length > 0 && (
                    <ul className="space-y-1">
                      {p.composition.slice(0, 2).map((c) => (
                        <li key={c} className="flex gap-1.5">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cinnabar" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 色板 */}
                {Array.isArray(p.colorPalette) && p.colorPalette.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    {p.colorPalette.slice(0, 3).map((c) => (
                      <span key={c.hex + c.name} className="flex items-center gap-1.5" title={c.name}>
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="hidden text-[11px] text-ink-mute sm:inline">{c.name}</span>
                      </span>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={`mt-4 w-full rounded-xl py-2.5 text-sm font-medium transition ${
                    active
                      ? 'cursor-default bg-cinnabar/10 text-cinnabar-dark'
                      : 'bg-ink text-white hover:bg-ink/85'
                  }`}
                >
                  {active ? '✓ 已选择此方案' : '选择此方案'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* 选中方案后的操作区 */}
      {selected && (
        <div className="card space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-mute">已选择方案</p>
              <p className="mt-0.5 font-serif text-base font-semibold text-ink">
                {selected.proposalTitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {/* 阶段二入口：选择了具体产品类型才有 3D 形态；纯视觉创作直接保存即可 */}
              {productType ? (
                <button
                  type="button"
                  onClick={onEnter3D}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink/85"
                >
                  进入 3D 展示
                  <StudioIcon name="arrowRight" size={15} />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper/70 px-4 py-2.5 text-xs text-ink-mute">
                  纯视觉创作 · 无 3D 形态
                </span>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={saved || saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cinnabar px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cinnabar-dark disabled:opacity-60"
              >
                <StudioIcon name="save" size={15} />
                {saving ? '保存中…' : saved ? '已保存到我的作品' : '保存作品'}
              </button>
              <button type="button" onClick={onRegenerate} className="btn-ghost inline-flex items-center gap-1.5">
                <StudioIcon name="refresh" size={15} />
                重新生成
              </button>
            </div>
          </div>
          {disclaimer && (
            <p className="rounded-xl bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-800">
              {disclaimer}
            </p>
          )}
          <p className="text-xs text-ink-mute">
            文案生成模式：{mode === 'mock' ? '本地演示' : '真实 AI（qwen-plus）'}；
            效果图模式：{isDemo ? '本地演示图' : '真实 AI 生图'}。
          </p>
        </div>
      )}
    </div>
  )
}
