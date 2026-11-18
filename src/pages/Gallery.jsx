/* ============================================================
 * 作品展厅 Gallery（/gallery）
 * ------------------------------------------------------------
 * 「AI 非遗数字展厅」：
 *   · 顶部约 1/3：22 个非遗项目的错落画墙作为【背景装饰】，
 *     上面叠加页头标题（画墙不可交互，仅烘托氛围）；
 *   · 主体：本平台真实保存的用户作品（筛选 / 再创作，功能不变）。
 * 诚实边界：插画为 AI 文生图实时生成；作品无社区数据，不做伪社区功能。
 *
 * 视觉与首页一致：宣纸底纹 + 纸墨色系 + 朱砂点缀。
 * ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllItems } from '../data/heritageService.js'
import { getCoverImage } from '../utils/image.js'
import { listWorks } from '../services/studioService.js'
import Reveal from '../components/common/Reveal.jsx'
import { InkBand } from '../components/decor/OrientalDecor.jsx'

/* 照片墙画框尺寸循环：高低错落，模拟实景照片墙 */
const FRAME_SIZES = ['h-28', 'h-20', 'h-32', 'h-36', 'h-24', 'h-40', 'h-28', 'h-32', 'h-20', 'h-28', 'h-36']

/* 画框轻微倾斜角度，更接近手工陈列 */
const FRAME_TILT = [-2.2, 1.6, -1.2, 2.4, -1.8, 1.2, -0.8, 2.0, -1.6, 1.8, -2.4]

/* 青绿装裱色（与首页青绿山水一致） */
const FRAME = '#8fb5a3'

export default function Gallery() {
  const navigate = useNavigate()
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [source, setSource] = useState('') // 'server' | 'local'，数据落点说明
  const [filter, setFilter] = useState('全部')

  /* 背景画墙数据：22 个非遗项目（本地 JSON 同步可得） */
  const heritageItems = useMemo(() => getAllItems(), [])

  /* 用户作品（页面主体） */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { works: list, source: src } = await listWorks()
        if (cancelled) return
        const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setWorks(sorted)
        setSource(src)
      } catch (e) {
        if (!cancelled) setLoadError(e.message || '作品加载失败，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* 非遗主题筛选 chips：从作品中提取去重（不造假主题） */
  const themeOptions = useMemo(() => {
    const names = [...new Set(works.map((w) => w.themeName).filter(Boolean))]
    return ['全部', ...names]
  }, [works])

  const filtered = useMemo(
    () => (filter === '全部' ? works : works.filter((w) => w.themeName === filter)),
    [works, filter],
  )

  return (
    <div
      className="relative overflow-x-clip bg-paper"
      style={{ backgroundImage: "url('/images/home/paper-texture.jpg')", backgroundSize: '720px' }}
    >
      {/* ============ 页头水墨山水：铺在页面顶部，下缘化进宣纸 ============ */}
      <InkBand src="/images/decor/heritage-scenery.jpg" className="pointer-events-none absolute inset-x-0 top-0 h-40 w-full opacity-90 sm:h-52" />

      {/* ============ 背景：22 项非遗照片墙，左右两侧陈列、中间留白 ============ */}
      <PhotoWall items={heritageItems} />

      {/* ============ 页头：标题压在照片墙的留白处 ============ */}
      <section className="relative z-10 flex h-[38vh] min-h-[340px] flex-col items-center justify-center px-4 pt-10 text-center">
        {/* 轻纱柔光：只在中线附近微微提亮，画框保持清晰 */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(251,244,230,0.46)_0%,rgba(251,244,230,0.2)_58%,rgba(251,244,230,0)_100%)]" />
        <p
          className="relative text-sm tracking-[6px] text-cinnabar sm:text-base"
          style={{ fontFamily: '"Times New Roman", serif' }}
        >
          DIGITAL GALLERY
        </p>
        <h1 className="relative mt-2 font-serif text-3xl font-normal tracking-[8px] text-ink sm:text-[44px] sm:tracking-[12px]">
          作品展厅
        </h1>
        <p className="relative mx-auto mt-4 max-w-3xl text-sm leading-loose text-ink-soft sm:text-base">
          背景画墙陈列 22 项国家级非遗代表项目（插画为 AI 生成，仅供参考）；
          下方为本平台真实保存的创作作品，与传统工艺实物有本质区别。
          {source === 'local' && '（当前展示的是保存在本机浏览器的作品）'}
        </p>
      </section>

      {/* ============ 主体：用户作品 ============ */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* 筛选区：作品主题胶囊（有作品才显示） */}
        {works.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {themeOptions.map((name) => {
              const active = filter === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFilter(name)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    active
                      ? 'border-cinnabar bg-cinnabar text-white'
                      : 'border-line bg-white text-ink-soft hover:border-cinnabar/40 hover:text-cinnabar'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        )}

        {/* 结果区 */}
        <div className="mt-10">
          {loading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-3xl bg-white/70" />
              ))}
            </div>
          )}

          {!loading && loadError && (
            <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center">
              <p className="text-sm text-ink-soft">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <Reveal className="rounded-3xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
              <p className="font-serif text-lg text-ink">
                {works.length === 0 ? '展厅还没有作品' : '该主题下暂无作品'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                {works.length === 0
                  ? '去创作工坊用 AI 把非遗元素变成你的第一件数字文创，保存后会自动陈列在这里。'
                  : '换个主题看看，或去创作一件新的。'}
              </p>
              <Link to="/studio" className="btn-primary mt-6">
                进入创作工坊
              </Link>
            </Reveal>
          )}

          {!loading && !loadError && filtered.length > 0 && (
            <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((work) => (
                <GalleryCard key={work.id} work={work} onRemake={() => navigate('/studio', { state: { remake: work } })} />
              ))}
            </Reveal>
          )}
        </div>
      </div>

      {/* ============ 底部：水墨山水长卷收束（与全站一致） ============ */}
      <InkBand anchor="bottom" flip className="relative z-10 h-36 w-full sm:h-52" />
    </div>
  )
}

/* ============================================================
 * 照片墙背景：22 个非遗项目装裱成画框，沿左右两侧错落陈列
 * ============================================================ */
function PhotoWall({ items }) {
  const half = Math.ceil(items.length / 2)
  const columns = [items.slice(0, half), items.slice(half)]

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-16 z-0 hidden h-[46vh] min-h-[380px] max-h-[560px] overflow-hidden md:block"
      aria-hidden="true"
    >
      {columns.map((list, c) => (
        <div
          key={c}
          className={`absolute inset-y-0 w-[29%] max-w-[340px] px-2 py-4 ${c === 0 ? 'left-0' : 'right-0'}`}
          style={{
            opacity: 0.56,
            columnCount: 3,
            columnGap: '8px',
            maskImage:
              c === 0
                ? 'linear-gradient(to right, #000 0%, #000 62%, transparent 100%)'
                : 'linear-gradient(to left, #000 0%, #000 62%, transparent 100%)',
            WebkitMaskImage:
              c === 0
                ? 'linear-gradient(to right, #000 0%, #000 62%, transparent 100%)'
                : 'linear-gradient(to left, #000 0%, #000 62%, transparent 100%)',
          }}
        >
          {list.map((item, i) => (
            <figure
              key={item.id}
              className={`mb-2 w-full break-inside-avoid overflow-hidden rounded-[2px] bg-white p-1 shadow-[0_4px_12px_rgba(90,135,117,0.14)] ${FRAME_SIZES[i % FRAME_SIZES.length]}`}
              style={{
                border: `2px solid ${FRAME}`,
                transform: `rotate(${FRAME_TILT[i % FRAME_TILT.length]}deg)`,
              }}
            >
              <img
                src={getCoverImage(item.imagePrompt)}
                alt=""
                loading="lazy"
                draggable="false"
                className="h-full w-full bg-paper object-cover"
              />
            </figure>
          ))}
        </div>
      ))}

      {/* 底缘化进宣纸，画墙只留在页头 */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-paper" />
    </div>
  )
}

/* ============================================================
 * 展厅作品卡：图 + 信息 + 再创作（与首页白卡风格一致）
 * ============================================================ */
function GalleryCard({ work, onRemake }) {
  const dateText = new Date(work.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return (
    <article className="group overflow-hidden rounded-3xl border border-line bg-white transition hover:-translate-y-1 hover:shadow-lg">
      {/* 媒体区：优先效果图；含视频作品加角标 */}
      <div className="relative aspect-[4/3] overflow-hidden bg-paper">
        {work.imageUrl ? (
          <img
            src={work.imageUrl}
            alt={work.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-mute">暂无效果图</div>
        )}
        {work.videoUrl && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-white">
            含{work.hasAudio ? '配音' : ''}视频
          </span>
        )}
        {/* AI 生成角标（诚实性原则） */}
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs text-ink-soft">
          AI 生成
        </span>
      </div>

      <div className="p-5">
        <h2 className="font-serif text-base font-semibold text-ink">{work.title}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {[work.themeName, work.createTypeName, work.styleName].filter(Boolean).map((tag) => (
            <span key={tag} className="rounded-full bg-paper px-2.5 py-1 text-ink-soft">
              {tag}
            </span>
          ))}
        </div>
        {work.designBrief && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">{work.designBrief}</p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3">
          <span className="text-xs text-ink-mute">{dateText}</span>
          <button
            type="button"
            onClick={onRemake}
            className="rounded-full border border-celadon/50 bg-white px-3.5 py-1.5 text-xs font-medium text-celadon-dark transition hover:border-celadon hover:bg-celadon/10"
          >
            再次创作 →
          </button>
        </div>
      </div>
    </article>
  )
}
