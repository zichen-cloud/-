/* ============================================================
 * 作品卡片 WorkCard（"我的作品"页使用）
 * ------------------------------------------------------------
 * 展示一件已保存作品的关键信息：
 *   标题、数字作品徽章、主题/类型/风格、保存时间、
 *   创作需求、提示词、设计说明（可展开查看）、删除
 * Props：work（localStorage 中保存的对象）、onDelete(id)
 * ============================================================ */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudioIcon from './StudioIcons.jsx'

export default function WorkCard({ work, onDelete, deleting = false }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const navigate = useNavigate()

  const dateText = new Date(work.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <article className="card overflow-hidden">
      {/* 顶部媒体区：效果图；含视频时可点击切换到成片播放 */}
      <div className="relative flex aspect-[16/8] items-center justify-center bg-paper">
        {showVideo && work.videoUrl ? (
          <video
            src={work.videoUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : work.imageUrl ? (
          <img src={work.imageUrl} alt={work.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-ink-mute">
            <StudioIcon name="palette" size={24} />
            <span className="mt-2 text-xs">设计图待生成</span>
          </div>
        )}
        {/* 视频角标：点击播放；正在播放时显示"返回效果图" */}
        {work.videoUrl && (
          <button
            type="button"
            onClick={() => setShowVideo((v) => !v)}
            className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-paper backdrop-blur transition hover:bg-ink"
          >
            <StudioIcon name="video" size={12} />
            {showVideo ? '返回效果图' : work.hasAudio ? '含配音视频' : '含介绍视频'}
          </button>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold text-ink">{work.title}</h3>
          {/* 明确标注：数字作品 */}
          <span className="shrink-0 rounded-full bg-celadon/10 px-2.5 py-1 text-xs font-medium text-celadon">
            数字作品
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {[work.themeName, work.productTypeName || work.createTypeName, work.styleName].filter(Boolean).map((b) => (
            <span key={b} className="chip">{b}</span>
          ))}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
              work.imageMode === 'demo'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-ink/10 text-ink-soft'
            }`}
          >
            {work.imageMode === 'demo' ? '演示效果图' : work.mode === 'mock' ? 'Mock 生成' : 'AI 生成'}
          </span>
        </div>

        {work.requirement && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">
            <span className="text-ink-mute">设计要求：</span>
            {work.requirement}
          </p>
        )}

        {/* 展开后显示提示词与设计说明 */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-line/70 pt-4">
            <div>
              <p className="text-xs font-medium text-ink">成图提示词</p>
              <p className="mt-1 rounded-lg bg-paper p-3 text-xs leading-relaxed text-ink-soft">
                {work.promptSummary}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink">设计说明</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{work.designBrief}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-4">
          <span className="text-xs text-ink-mute">{dateText}</span>
          <div className="flex items-center gap-1">
            {/* 再次创作：把这件作品的参数带回工坊表单，改一改重新生成 */}
            <button
              type="button"
              onClick={() => navigate('/studio', { state: { remake: work } })}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-celadon-dark transition hover:bg-celadon/10"
            >
              再次创作
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-cinnabar transition hover:bg-cinnabar/10"
            >
              {expanded ? '收起' : '查看详情'}
            </button>
            {confirming ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDelete(work.id)}
                  disabled={deleting}
                  className="rounded-full bg-cinnabar px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cinnabar-dark disabled:opacity-60"
                >
                  {deleting ? '删除中…' : '确认删除'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="rounded-full px-3 py-1.5 text-xs text-ink-mute transition hover:bg-paper disabled:opacity-60"
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="删除作品"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-mute transition hover:bg-cinnabar/10 hover:text-cinnabar"
              >
                <StudioIcon name="trash" size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
