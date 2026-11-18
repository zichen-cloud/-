/* ============================================================
 * FusionStudio：多非遗跨界融合创作
 * ------------------------------------------------------------
 * 三步：
 *   ① 选择 2-3 项非遗 + 融合比例 + 产品/风格 → ② AI 拆解文化要素并给出
 *   融合方案 → ③ 生成产品效果图，可选一套进入原有 3D / 视频链路。
 *
 * 设计原则（对应需求）：
 *   · 比例控制"主次关系"，不是图片叠加透明度；
 *   · 方案必须标明元素来自哪一项非遗（fromA / fromB）；
 *   · 生成前展示"融合前的文化要素"，让用户看懂融合逻辑；
 *   · 图片生成是真实 AI 调用，失败如实提示。
 * ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { getAllItems } from '../../data/heritageService.js'
import { analyzeFusion, generateFusionImages } from '../../services/fusionService.js'
import { getProductTypeById, getStyleById, productTypes, styles } from '../../data/studioOptions.js'

const MAX_PICK = 3

export default function FusionStudio({ onEnter3D }) {
  const [items, setItems] = useState([])
  const [picked, setPicked] = useState([]) // [{id,name,category}]
  const [ratios, setRatios] = useState({}) // { [id]: number }
  const [productType, setProductType] = useState('tote-bag')
  const [styleId, setStyleId] = useState('minimal')
  const [idea, setIdea] = useState('')
  const [count, setCount] = useState(2)

  const [status, setStatus] = useState('idle') // idle | analyzing | result
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState([])
  const [proposals, setProposals] = useState([])
  const [themeName, setThemeName] = useState('')
  const [mode, setMode] = useState('')
  const [imgLoading, setImgLoading] = useState(false)
  const [imgError, setImgError] = useState('')
  const [imgNotice, setImgNotice] = useState('')
  const [imgProgress, setImgProgress] = useState(null) // { stage, progress } 轮询进度

  useEffect(() => {
    setItems(getAllItems() || [])
  }, [])

  /* 按门类分组，便于快速找到想融合的项目 */
  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((it) => {
      const key = it.category || '其他'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    })
    return [...map.entries()]
  }, [items])

  const toggle = (it) => {
    setError('')
    setPicked((prev) => {
      const exists = prev.find((p) => p.id === it.id)
      if (exists) return prev.filter((p) => p.id !== it.id)
      if (prev.length >= MAX_PICK) return prev
      return [...prev, { id: it.id, name: it.name, category: it.category }]
    })
  }

  /* 比例：初始均分；调整某一项后按剩余比例缩放其余项，保持合计 100 */
  useEffect(() => {
    if (picked.length < 2) {
      setRatios({})
      return
    }
    const base = Math.floor(100 / picked.length)
    const init = {}
    picked.forEach((p, i) => {
      init[p.id] = i === 0 ? 100 - base * (picked.length - 1) : base
    })
    setRatios(init)
  }, [picked.map((p) => p.id).join('|')])

  const setRatio = (id, value) => {
    const v = Math.max(0, Math.min(100, Number(value)))
    const others = picked.filter((p) => p.id !== id)
    if (!others.length) return setRatios({ [id]: 100 })
    const remain = 100 - v
    const sumOthers = others.reduce((s, p) => s + (ratios[p.id] || 0), 0) || others.length
    const next = { [id]: v }
    let acc = 0
    others.forEach((p, i) => {
      if (i === others.length - 1) {
        next[p.id] = Math.max(0, 100 - acc - v)
      } else {
        const share = Math.round(((ratios[p.id] || 0) / sumOthers) * remain)
        next[p.id] = share
        acc += share
      }
    })
    setRatios(next)
  }

  const handleAnalyze = async () => {
    if (picked.length < 2) {
      setError('请至少选择 2 项非遗，才能进行跨界融合')
      return
    }
    setStatus('analyzing')
    setError('')
    setImgError('')
    setProposals([])
    try {
      const res = await analyzeFusion({
        heritages: picked,
        productType,
        productName: getProductTypeById(productType)?.name || '',
        styleName: getStyleById(styleId)?.name || '',
        ratios: picked.map((p) => ratios[p.id] || 0),
        idea,
        count,
      })
      setAnalysis(res.analysis || [])
      setProposals(res.proposals || [])
      setThemeName(res.themeName || '')
      setMode(res.mode || '')
      setStatus('result')
    } catch (e) {
      setError(e.message || '融合分析失败')
      setStatus('idle')
    }
  }

  const handleImages = async () => {
    if (!proposals.length || imgLoading) return
    setImgLoading(true)
    setImgError('')
    setImgNotice('')
    setImgProgress({ stage: '任务已提交', progress: 5 })
    try {
      const res = await generateFusionImages({
        proposals,
        themeName,
        productName: getProductTypeById(productType)?.name || '',
        styleName: getStyleById(styleId)?.name || '',
        onProgress: setImgProgress,
      })
      setProposals(res.proposals || [])
      if (res.notice) setImgNotice(res.notice)
    } catch (e) {
      setImgError(e.message || '效果图生成失败')
    } finally {
      setImgLoading(false)
      setImgProgress(null)
    }
  }

  const hasImages = proposals.some((p) => p.imageUrl)

  return (
    <div className="space-y-6">
      {/* ============ 选择区 ============ */}
      <div
        className={`rounded-3xl border border-line bg-white/85 p-5 sm:p-6 ${
          imgLoading ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Cross-Cultural Fusion</p>
            <h2 className="mt-2 font-serif text-xl font-semibold text-ink">选择要融合的非遗</h2>
          </div>
          <p className="text-xs text-ink-mute">
            已选 <span className="font-semibold text-cinnabar">{picked.length}</span> / {MAX_PICK}
          </p>
        </div>

        {/* 已选标签 + 比例 */}
        {picked.length > 0 && (
          <div className="mt-4 rounded-2xl bg-paper/70 p-4">
            <div className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full border border-cinnabar/30 bg-white px-3 py-1.5 text-xs text-ink"
                >
                  {p.name}
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    className="text-ink-mute transition hover:text-cinnabar"
                    aria-label={`移除 ${p.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {picked.length >= 2 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-ink-mute">
                  融合比例（控制主次关系，不是图片叠加透明度）
                </p>
                {picked.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs text-ink-soft">{p.name}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={ratios[p.id] ?? 0}
                      onChange={(e) => setRatio(p.id, e.target.value)}
                      className="h-1.5 flex-1 cursor-pointer accent-[#B23A2E]"
                    />
                    <span className="w-10 shrink-0 text-right text-xs text-ink">{ratios[p.id] ?? 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 项目多选（按门类分组，可滚动） */}
        <div className="mt-5 max-h-64 overflow-y-auto pr-1">
          {groups.map(([cat, list]) => (
            <div key={cat} className="mb-4">
              <p className="mb-2 text-[11px] tracking-wide text-ink-mute">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((it) => {
                  const on = picked.some((p) => p.id === it.id)
                  const disabled = !on && picked.length >= MAX_PICK
                  return (
                    <button
                      key={it.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(it)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        on
                          ? 'border-cinnabar bg-cinnabar text-white'
                          : disabled
                            ? 'cursor-not-allowed border-line bg-paper text-ink-mute/50'
                            : 'border-line bg-white text-ink-soft hover:border-cinnabar/40 hover:text-cinnabar'
                      }`}
                    >
                      {it.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 产品 / 风格 / 想法 */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-ink-mute">产品载体</span>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-cinnabar/60"
            >
              {productTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-ink-mute">视觉风格</span>
            <select
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-cinnabar/60"
            >
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-xs text-ink-mute">补充想法（可选）</span>
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={200}
            placeholder="例如：希望纹样疏朗一些，主色偏青"
            className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-mute/70 focus:border-cinnabar/60"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-cinnabar/10 px-3 py-2 text-xs text-cinnabar">{error}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={picked.length < 2 || status === 'analyzing'}
            className="btn-primary disabled:opacity-40"
          >
            {status === 'analyzing' ? 'AI 正在分析文化要素…' : '开始融合分析'}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-ink-mute">
            方案数量
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink outline-none focus:border-cinnabar/60"
            >
              <option value={2}>2 套</option>
              <option value={3}>3 套</option>
            </select>
          </label>
          <span className="text-xs text-ink-mute">至少选择 2 项非遗</span>
        </div>
      </div>

      {/* ============ 分析结果 ============ */}
      {status === 'result' && (
        <>
          {/* 融合前的文化要素 */}
          <div className="rounded-3xl border border-line bg-white/85 p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold text-ink">融合前的文化要素</h3>
              <span className="text-xs text-ink-mute">
                主题：{themeName}
                {mode === 'mock' && '（演示模式：模板化分析）'}
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.map((a) => (
                <div key={a.heritage} className="rounded-2xl border border-line/80 bg-paper/50 p-4">
                  <p className="font-serif text-sm font-semibold text-ink">{a.heritage}</p>
                  <dl className="mt-3 space-y-2 text-xs leading-relaxed">
                    <div>
                      <dt className="text-ink-mute">纹样 / 符号</dt>
                      <dd className="mt-0.5 text-ink-soft">{a.elements.join('、') || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">色彩体系</dt>
                      <dd className="mt-0.5 text-ink-soft">{a.colors.join('、') || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">材料与工艺</dt>
                      <dd className="mt-0.5 text-ink-soft">{a.craft || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">可融合点</dt>
                      <dd className="mt-0.5 text-ink-soft">{a.potential || '—'}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>

          {/* 融合方案 */}
          <div className="rounded-3xl border border-line bg-white/85 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-serif text-lg font-semibold text-ink">AI 融合创意方案</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={imgLoading}
                  className="rounded-full border border-line bg-white px-4 py-1.5 text-xs text-ink-soft transition hover:border-cinnabar/40 hover:text-cinnabar disabled:opacity-40"
                >
                  重新分析
                </button>
                <button
                  type="button"
                  onClick={handleImages}
                  disabled={imgLoading}
                  className="rounded-full bg-cinnabar px-4 py-1.5 text-xs font-medium text-white transition hover:bg-cinnabar-dark disabled:opacity-50"
                >
                  {imgLoading ? '正在渲染效果图…' : hasImages ? '重新生成效果图' : '生成产品效果图'}
                </button>
              </div>
            </div>

            {imgError && (
              <p className="mt-3 rounded-xl bg-cinnabar/10 px-3 py-2 text-xs text-cinnabar">{imgError}</p>
            )}
            {imgNotice && (
              <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-xs text-ink-soft">{imgNotice}</p>
            )}
            {imgLoading && (
              <div className="mt-3 rounded-xl bg-paper px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
                  <span>{imgProgress?.stage || '正在生成效果图…'}</span>
                  <span className="text-ink-mute">{imgProgress?.progress ?? 0}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
                  <div
                    className="h-full rounded-full bg-cinnabar transition-all duration-500"
                    style={{ width: `${Math.max(3, imgProgress?.progress ?? 3)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                  任务在后台执行，通常 1–2 分钟完成；请保持本页打开，进度会自动更新。
                </p>
              </div>
            )}

            <div className={`mt-5 grid gap-5 ${proposals.length > 1 ? 'lg:grid-cols-2' : ''}`}>
              {proposals.map((p, idx) => (
                <article key={idx} className="overflow-hidden rounded-3xl border border-line bg-white">
                  {/* 效果图 */}
                  <div className="relative aspect-[4/3] bg-paper">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.proposalTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-ink-mute">
                        <span className="h-8 w-8 rounded-full border-2 border-dashed border-line" />
                        尚未生成效果图
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] text-white">
                      方案 {idx + 1}
                    </span>
                    {p.mode === 'demo' && (
                      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-ink-soft">
                        演示图
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h4 className="font-serif text-base font-semibold text-ink">{p.proposalTitle}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.concept}</p>

                    {/* 配色 */}
                    <div className="mt-3 flex items-center gap-2">
                      {p.colorPalette.map((c) => (
                        <span key={c.hex} className="flex items-center gap-1 text-[11px] text-ink-mute">
                          <span className="h-4 w-4 rounded-full border border-line" style={{ background: c.hex }} />
                          {c.name}
                        </span>
                      ))}
                    </div>

                    {/* 融合来源：明确区分 A / B（三项融合时补上 C） */}
                    <div
                      className={`mt-4 grid gap-3 sm:grid-cols-2 ${
                        picked.length >= 3 ? 'lg:grid-cols-3' : ''
                      }`}
                    >
                      <div className="rounded-xl bg-paper/70 p-3">
                        <p className="text-[11px] font-medium text-ink-mute">
                          来自「{picked[0]?.name}」
                        </p>
                        <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-soft">
                          {(p.fromA || []).map((x) => (
                            <li key={x}>· {x}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl bg-paper/70 p-3">
                        <p className="text-[11px] font-medium text-ink-mute">
                          来自「{picked[1]?.name}」
                        </p>
                        <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-soft">
                          {(p.fromB || []).map((x) => (
                            <li key={x}>· {x}</li>
                          ))}
                        </ul>
                      </div>
                      {picked[2] && (
                        <div className="rounded-xl bg-paper/70 p-3">
                          <p className="text-[11px] font-medium text-ink-mute">
                            来自「{picked[2].name}」
                          </p>
                          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-soft">
                            {(p.fromC || []).length > 0 ? (
                              p.fromC.map((x) => <li key={x}>· {x}</li>)
                            ) : (
                              <li>本方案未单独标注，可在补充想法里强调它的作用</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 text-xs leading-relaxed">
                      <p>
                        <span className="font-medium text-ink">如何融合：</span>
                        <span className="text-ink-soft">{p.how}</span>
                      </p>
                      <p>
                        <span className="font-medium text-ink">创新点：</span>
                        <span className="text-ink-soft">{p.innovation}</span>
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!p.imageUrl || !onEnter3D}
                        onClick={() => onEnter3D?.(p, { productType, styleId, themeName })}
                        className="rounded-full border border-celadon/50 bg-white px-4 py-1.5 text-xs font-medium text-celadon-dark transition hover:border-celadon hover:bg-celadon/10 disabled:opacity-40"
                      >
                        进入 3D 展示 →
                      </button>
                      <span className="self-center text-[11px] text-ink-mute">
                        3D 与视频将沿用同一套方案数据
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
