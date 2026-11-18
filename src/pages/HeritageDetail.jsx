/* ============================================================
 * 非遗详情页 HeritageDetail
 * ------------------------------------------------------------
 * 路由：/heritage/:id（在 App.jsx 中配置）
 * 网址示例：/heritage/kunqu → 用 useParams() 取出 'kunqu'
 *
 * 展示内容：项目名称、类别、地区、名录级别、简介、
 *           历史背景（含待核实提示）、技艺特点、资料来源
 *
 * 数据原则（重要）：
 *   - 不展示官方名录编号、不展示传承人身份
 *   - 历史背景中不确定的信息，通过 factsPending 明确标注"待核实"
 *   - 每条内容都给出可查阅的资料来源
 * ============================================================ */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getItemById, getAllItems, dataMeta } from '../data/heritageService.js'
import { getCoverImage } from '../utils/image.js'
import { addFavorite, removeFavorite, checkFavorite } from '../services/favoriteService.js'
import HeritageCard from '../components/heritage/HeritageCard.jsx'
import Reveal from '../components/common/Reveal.jsx'
import DetailSection from '../components/heritage/DetailSection.jsx'
import PendingNotes from '../components/heritage/PendingNotes.jsx'
import SourceList from '../components/heritage/SourceList.jsx'

export default function HeritageDetail() {
  // 1. 从网址中拿到项目 id
  const { id } = useParams()

  // 2. 通过数据访问层查找项目；找不到时 item 为 null
  const item = getItemById(id)

  // 收藏状态：进入页面时向后端查询是否已收藏；点击时增删
  const [fav, setFav] = useState({ checked: false, favorited: false, favId: '', busy: false, err: '' })

  // 主视觉图状态：首次请求时服务端要现生成插画，需要骨架屏兜底，避免出现空白
  const [cover, setCover] = useState('loading')
  useEffect(() => {
    setCover('loading')
  }, [id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // 切换项目时重新查询收藏状态（后端不可用时静默保持未收藏，点击时再报错）
  useEffect(() => {
    let cancelled = false
    setFav({ checked: false, favorited: false, favId: '', busy: false, err: '' })
    ;(async () => {
      try {
        const { favorited, favorite } = await checkFavorite('heritage', id)
        if (cancelled) return
        setFav({ checked: true, favorited, favId: favorite?.id || '', busy: false, err: '' })
      } catch {
        if (!cancelled) setFav((f) => ({ ...f, checked: true }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function toggleFavorite() {
    if (fav.busy) return
    setFav((f) => ({ ...f, busy: true, err: '' }))
    try {
      if (fav.favorited && fav.favId) {
        await removeFavorite(fav.favId)
        setFav((f) => ({ ...f, favorited: false, favId: '', busy: false }))
      } else {
        const { favorite } = await addFavorite({ type: 'heritage', targetId: id })
        setFav((f) => ({ ...f, favorited: true, favId: favorite.id, busy: false }))
      }
    } catch (e) {
      setFav((f) => ({ ...f, busy: false, err: e.message || '收藏操作失败，请稍后重试' }))
    }
  }

  // 3. "继续探索"推荐：同门类优先，不足 3 个时用其他门类补足（不造假数据）
  let relatedItems = []
  if (item) {
    const all = getAllItems()
    const sameCategory = all.filter((i) => i.id !== item.id && i.category === item.category)
    const others = all.filter((i) => i.id !== item.id && i.category !== item.category)
    relatedItems = [...sameCategory, ...others].slice(0, 3)
  }

  // 3. 未找到数据时的兜底页面
  if (!item) {
    return (
      <section className="container-page py-20">
        <div className="card mx-auto max-w-md px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 8.5h7v7M15.5 8.5 8 16" />
            </svg>
          </div>
          <h1 className="mt-5 font-serif text-2xl font-semibold text-ink">没有找到这项非遗</h1>
          <p className="mt-2 text-sm text-ink-mute">
            项目「{id}」不在当前知识库中，可能是链接有误或数据尚未收录。
          </p>
          <div className="mt-7">
            <Link to="/heritage" className="btn-primary">
              返回探索非遗
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // 4. 正常渲染详情
  return (
    <article className="container-page py-8 md:py-12">
      {/* 返回链接 */}
      <Link
        to="/heritage"
        className="inline-flex items-center gap-1.5 text-sm text-ink-mute transition hover:text-cinnabar"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        返回探索非遗
      </Link>

      {/* 标题区 */}
      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">{item.category}</span>
          <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {item.region}
          </span>
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
          {item.name}
        </h1>
        <p className="mt-3 text-sm text-ink-mute">{item.level}</p>
      </header>

      {/* 主视觉图：插画由服务端按 prompt 现生成，慢的时候用骨架屏占位，失败也不留破图 */}
      <div className="relative mt-6 overflow-hidden rounded-3xl border border-line bg-paper">
        {cover !== 'loaded' && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#FBF4E6] via-[#F6EDDC] to-[#EFE6D3]"
            aria-hidden="true"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-md border border-cinnabar/25 bg-cinnabar/8 font-serif text-[11px] leading-tight text-cinnabar/70 ${cover === 'loading' ? 'animate-pulse' : ''}`}>
              非遗
            </span>
            <p className="text-xs tracking-wide text-ink-mute">
              {cover === 'error' ? '主题插画暂不可用，可先阅读下方文字介绍' : '正在生成主题插画…'}
            </p>
          </div>
        )}
        <img
          src={getCoverImage(item.imagePrompt, 'landscape_16_9')}
          alt={`${item.name}主题插画`}
          loading="lazy"
          onLoad={() => setCover('loaded')}
          onError={() => setCover('error')}
          className={`aspect-[16/9] w-full object-cover transition-opacity duration-700 ${
            cover === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_300px]">
        {/* 左侧：主要文字内容 */}
        <div className="max-w-3xl">
          {/* 全局数据声明：提醒读者内容性质 */}
          <div className="rounded-2xl bg-cinnabar/10 px-5 py-4 text-xs leading-relaxed text-cinnabar-dark">
            {dataMeta.disclaimer}
          </div>

          {/* 简介 */}
          <DetailSection title="项目简介">
            <p className="text-[15px] leading-loose text-ink-soft">{item.summary}</p>
          </DetailSection>

          {/* 历史背景：内容含待核实事项，标题显示"待核实"标记 */}
          <DetailSection title="历史背景" unverified>
            <p className="text-[15px] leading-loose text-ink-soft">{item.historyBackground}</p>
            <PendingNotes notes={item.factsPending} />
          </DetailSection>

          {/* 技艺特点：编号卡片呈现，强化"工艺要点"的步骤感 */}
          <DetailSection title="技艺特点">
            <div className="grid gap-4 sm:grid-cols-3">
              {item.techniqueFeatures.map((feature, idx) => (
                <div key={feature.title} className="rounded-2xl border border-line bg-white p-5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-cinnabar/10 font-serif text-sm font-bold text-cinnabar"
                    aria-hidden
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 font-serif text-base font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.desc}</p>
                </div>
              ))}
            </div>
          </DetailSection>

          {/* 资料来源 */}
          <DetailSection title="资料来源">
            <p className="text-sm leading-relaxed text-ink-mute">
              以下为建议进一步查阅的权威来源。本页不含官方名录编号与传承人身份信息，
              如需用于正式场合，请先在下列来源中核对原文。
            </p>
            <SourceList sources={item.sources} />
          </DetailSection>
        </div>

        {/* 右侧：信息速览（电脑端 sticky 跟随滚动） */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-serif text-lg font-semibold">信息速览</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <InfoRow label="项目名称" value={item.name} />
              <InfoRow label="门类" value={item.category} />
              <InfoRow label="地区" value={item.region} />
              <InfoRow label="名录级别" value={item.level} />
              <div>
                <dt className="text-xs text-ink-mute">关键词</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </dd>
              </div>
            </dl>

            {/* 延伸操作：形成 知识馆→详情→AI导师→创作工坊 的完整链路 */}
            <div className="mt-6 space-y-2.5">
              {/* 收藏：数据由服务端校验并落盘，可在「我的」页查看 */}
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={fav.busy || !fav.checked}
                className={`btn-ghost w-full justify-center ${fav.favorited ? 'border-cinnabar/50 text-cinnabar' : ''}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={fav.favorited ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20.5S3.5 15 3.5 8.9A4.4 4.4 0 0 1 12 6a4.4 4.4 0 0 1 8.5 2.9c0 6.1-8.5 11.6-8.5 11.6Z" />
                </svg>
                {fav.favorited ? '已收藏 · 点击取消' : '收藏这项非遗'}
              </button>
              {fav.err && <p className="text-xs text-cinnabar">{fav.err}</p>}
              {/* 创作入口：跳转创作工坊并预选对应主题（非遗项目 id → 工坊主题映射） */}
              <Link
                to={`/studio?theme=${encodeURIComponent(item.id)}`}
                className="btn-primary w-full justify-center"
              >
                使用该非遗元素创作
              </Link>
              {/* AI 入口：带完整问题跳转 AI 导师（Chat 页读取 q 参数自动发送） */}
              <Link
                to={`/chat?q=${encodeURIComponent(`请介绍一下非遗项目「${item.name}」`)}`}
                className="btn-ghost w-full justify-center"
              >
                向 AI 导师追问这项非遗
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* 继续探索：数字博物馆式的内容串联，引导用户在馆内持续浏览 */}
      <Reveal as="section" className="mt-16 border-t border-line pt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Keep Exploring</p>
            <h2 className="section-title mt-2">继续探索</h2>
          </div>
          <Link to="/heritage" className="shrink-0 text-sm text-ink-soft transition hover:text-cinnabar">
            查看全部 →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {relatedItems.map((r) => (
            <HeritageCard key={r.id} item={r} />
          ))}
        </div>
      </Reveal>
    </article>
  )
}

/* 信息速览中的一行（本文件内部子组件） */
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/70 pb-3 last:border-0 last:pb-0">
      <dt className="text-xs text-ink-mute">{label}</dt>
      <dd className="leading-relaxed text-ink">{value}</dd>
    </div>
  )
}
