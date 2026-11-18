/* ============================================================
 * 我的作品 Works
 * ------------------------------------------------------------
 * 阶段五：作品优先读取后端 /api/works（data/works 落盘，重启不丢）；
 * 首次进入页面时把旧 localStorage 作品一次性迁移到后端；
 * 后端不可达时自动降级显示本机缓存，并在页面上诚实标注数据来源。
 * ============================================================ */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import WorkCard from '../components/studio/WorkCard.jsx'
import StudioIcon from '../components/studio/StudioIcons.jsx'
import { listWorks, deleteWork, migrateLocalWorks } from '../services/studioService.js'

export default function Works() {
  const [works, setWorks] = useState([])
  const [source, setSource] = useState('server') // 'server' | 'local'
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')

  /* 首次进入：先迁移本机旧作品，再从后端（或降级本机缓存）读取列表 */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await migrateLocalWorks()
      const { works: list, source: src } = await listWorks()
      if (!cancelled) {
        setWorks(list)
        setSource(src)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteWork(id)
      const { works: list, source: src } = await listWorks()
      setWorks(list)
      setSource(src)
    } finally {
      setDeletingId('')
    }
  }

  const sourceText =
    source === 'local'
      ? '后端暂不可用，当前显示本机浏览器中的作品（连上服务后会自动迁移）'
      : '作品保存在服务器，重启与更换浏览器后仍可查看'

  return (
    <>
      {/* 页面头部 */}
      <section className="border-b border-line bg-[#F4EFE6]/60">
        <div className="container-page py-12 md:py-14">
          <p className="eyebrow">My Works</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
            我的作品
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            这里收藏你在创作工坊生成的数字设计方案。它们是 AI 辅助的数字作品，
            与传统工艺实物不同，仅用于学习与灵感记录。
          </p>
        </div>
      </section>

      <section className="container-page py-10">
        {loading ? (
          <div className="card mx-auto flex max-w-md items-center justify-center gap-3 px-6 py-16 text-sm text-ink-mute">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cinnabar/25 border-t-cinnabar" />
            正在加载作品…
          </div>
        ) : works.length > 0 ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-mute">
                共 {works.length} 件作品 · {sourceText}
              </p>
              <Link to="/studio" className="inline-flex items-center gap-1.5 text-sm font-medium text-cinnabar hover:text-cinnabar-dark">
                <StudioIcon name="sparkle" size={15} />
                创作新作品
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {works.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  deleting={deletingId === work.id}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        ) : (
          /* 空状态：引导用户去创作工坊 */
          <div className="card mx-auto max-w-md px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
              <StudioIcon name="save" size={26} />
            </div>
            <h2 className="mt-5 font-serif text-xl font-semibold text-ink">还没有保存作品</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-mute">
              在创作工坊生成设计方案后点击"保存到我的作品"，就会出现在这里。
            </p>
            <Link to="/studio" className="btn-primary mt-7">
              去文化创作工坊
            </Link>
          </div>
        )}
      </section>
    </>
  )
}
