/* ============================================================
 * 非遗项目卡片 HeritageCard（可复用）
 * ------------------------------------------------------------
 * 首页和知识馆列表页都使用它展示单个项目。
 * Props：
 *   item：一个非遗项目对象（字段见 src/data/heritage.json）
 * 点击整张卡片跳转到详情页 /heritage/:id
 * ============================================================ */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCoverImage } from '../../utils/image.js'

export default function HeritageCard({ item }) {
  // 封面是外部文生图接口实时生成的：加载中有骨架底、失败时有兜底版式，
  // 弱网或接口异常都不会出现刺眼空白
  const [coverState, setCoverState] = useState('loading') // loading | loaded | error

  return (
    <Link
      to={`/heritage/${item.id}`}
      className="card group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(38,36,31,0.1)]"
    >
      {/* 封面图：group-hover 时图片轻微放大；加载中/失败有兜底 */}
      <div className="relative overflow-hidden">
        {coverState === 'error' ? (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-paper">
            <div className="text-center">
              <span className="font-serif text-4xl font-semibold text-cinnabar/30">
                {item.name.slice(0, 1)}
              </span>
              <p className="mt-2 px-4 text-xs text-ink-mute">{item.name}</p>
            </div>
          </div>
        ) : (
          <>
            {coverState === 'loading' && (
              <div className="absolute inset-0 animate-pulse bg-paper" aria-hidden />
            )}
            <img
              src={getCoverImage(item.imagePrompt)}
              alt={`${item.name}主题插画`}
              loading="lazy"
              onLoad={() => setCoverState('loaded')}
              onError={() => setCoverState('error')}
              className={`aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105 ${
                coverState === 'loaded' ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        )}
      </div>

      {/* 文字内容 */}
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="chip">{item.category}</span>
          <span className="text-xs text-ink-mute">{item.region}</span>
        </div>

        <h3 className="mt-3 font-serif text-xl font-semibold text-ink transition group-hover:text-cinnabar">
          {item.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {item.summary}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-4">
          {/* line-clamp-1 防止名录名称过长时换行 */}
          <span className="line-clamp-1 text-xs text-ink-mute">{item.level}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-cinnabar">
            了解详情
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
