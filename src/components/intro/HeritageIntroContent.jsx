/* ============================================================
 * HeritageIntroContent：阶段五「呈现网站主题」
 * ------------------------------------------------------------
 * 深色画卷上的文字层，严格按「主题 → 介绍 → 四项能力 → 行动」
 * 的节奏依次浮现；顶部为非遗徽记预留空间（HeritageElements 渲染）。
 * 配色为银白正文 + 香槟金点缀，保证在深蓝墨底上清晰可读。
 * ============================================================ */

const FEATURES = [
  {
    no: '01',
    title: 'AI识非遗',
    desc: '上传非遗照片，AI 智能识别传统技艺，探索文化背后的故事。',
    color: '#2F5A8A',
  },
  {
    no: '02',
    title: '数字人传承',
    desc: '与狮小灵及非遗专属数字传承人对话，用文字和语音了解非遗知识。',
    color: '#B23A2E',
  },
  {
    no: '03',
    title: 'AI创作工坊',
    desc: '把传统纹样与技艺转化为现代文创产品，支持设计与创意生成。',
    color: '#B8862F',
  },
  {
    no: '04',
    title: '跨文化融合',
    desc: '选择多种非遗元素进行 AI 融合创作，让传统产生新的表达。',
    color: '#4E7F6B',
  },
]

export default function HeritageIntroContent({ mode = 'full', onEnter, className = '' }) {
  const brief = mode === 'brief'
  const base = brief ? 0.55 : 1
  const d = (ms) => ({ '--d': `${Math.round(ms * base)}ms` })

  return (
    <div className={`intro-scroll-area h-full overflow-y-auto ${className}`}>
      <div className="flex min-h-full flex-col justify-end px-5 pb-7 pt-[74px] sm:px-12 sm:pb-9 sm:pt-[104px]">
        {/* 眉标 */}
        <p className="ic-rise text-[9px] font-medium tracking-[0.24em] text-[#A8842F]/85 sm:text-[10.5px] sm:tracking-[0.4em]" style={d(0)}>
          HERITAGE × AI · 中国非物质文化遗产
        </p>

        {/* 主标题 + 朱砂印章（印章绝对定位，不挤压标题） */}
        <div className="ic-rise relative mt-3 pr-7 sm:mt-4 sm:pr-12" style={d(140)}>
          <h1 className="whitespace-nowrap font-serif text-[26px] font-bold leading-[1.25] tracking-[0.03em] text-ink sm:text-[50px] sm:tracking-[0.05em]">
            让非遗遇见未来
          </h1>
          <span
            className="absolute right-0 top-0 flex flex-col items-center rounded-[4px] border border-[#8E2119] bg-[#B23A2E] px-1 py-0.5 font-serif text-[8px] leading-[1.15] tracking-[0.08em] text-[#FDF3E4] shadow-[0_3px_10px_rgba(178,58,46,.28)] sm:rounded-[5px] sm:px-1.5 sm:py-1 sm:text-[10px] sm:leading-[1.18] sm:tracking-[0.1em]"
            aria-hidden="true"
          >
            <span>非</span>
            <span>遗</span>
            <span>灵</span>
            <span>境</span>
          </span>
        </div>

        {/* 副标题 */}
        <p
          className="ic-rise mt-2 text-balance font-serif text-[12.5px] tracking-[0.1em] text-[#8A6A2A] sm:mt-3 sm:text-lg sm:tracking-[0.14em]"
          style={d(280)}
        >
          让千年技艺，在数字时代焕发新生
        </p>

        {/* 金→朱砂渐隐分隔线 */}
        <span
          className="ic-rise mt-3 block h-px w-32 bg-gradient-to-r from-[#B8862F]/75 via-[#B23A2E]/40 to-transparent sm:mt-4"
          style={d(360)}
          aria-hidden="true"
        />

        {/* 项目介绍 */}
        <p
          className="ic-rise mt-3 max-w-2xl text-[12px] leading-relaxed text-ink-soft sm:mt-4 sm:text-[14.5px]"
          style={d(440)}
        >
          以人工智能为桥梁，连接文化传承、知识探索与创意设计，让非遗走进现代生活。
        </p>

        {/* 四项核心能力 */}
        <div className="mt-4 grid gap-x-5 gap-y-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-y-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.no}
              className="ic-rise group flex items-start gap-2.5 rounded-r-md border-l-2 pl-3 transition-colors duration-300 hover:bg-white/40 sm:gap-3"
              style={{ ...d(540 + i * 80), borderLeftColor: `${f.color}59` }}
            >
              <span
                className="mt-0.5 font-mono text-[11px] tracking-widest sm:text-xs"
                style={{ color: f.color }}
              >
                {f.no}
              </span>
              <div className="min-w-0">
                <p className="font-serif text-[13px] font-semibold tracking-wide text-ink sm:text-[15px]">
                  {f.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft sm:text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 进入按钮 */}
        <div className="mt-5 flex flex-col items-start gap-2 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onEnter}
            className="ic-rise group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-cinnabar/25 bg-cinnabar px-6 py-3 text-sm tracking-[0.14em] text-white shadow-[0_10px_26px_rgba(178,58,46,.28)] transition hover:bg-[#9C2F26] active:scale-[0.985]"
            style={d(900)}
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            开启非遗探索之旅
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </button>
          <p className="ic-rise text-[10px] tracking-[0.2em] text-ink-mute/85" style={d(1000)}>
            画卷将化为星屑 · 狮小灵已在首页等候
          </p>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
/* 深色画卷内的细滚动条：避免系统浅色滚动条在右侧形成一条白带 */
.intro-scroll-area { scrollbar-width: thin; scrollbar-color: rgba(227,200,139,.3) transparent }
.intro-scroll-area::-webkit-scrollbar { width: 5px; height: 5px }
.intro-scroll-area::-webkit-scrollbar-track { background: transparent }
.intro-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(227,200,139,.26);
  border-radius: 999px;
}
.intro-scroll-area::-webkit-scrollbar-thumb:hover { background: rgba(227,200,139,.45) }

.ic-rise { opacity: 0; transform: translateY(14px) }
[data-content='true'] .ic-rise {
  animation: icRise .82s cubic-bezier(.22,.61,.36,1) both;
  animation-delay: var(--d, 0ms);
}
@keyframes icRise {
  from { opacity: 0; transform: translateY(14px) }
  to { opacity: 1; transform: translateY(0) }
}
@media (prefers-reduced-motion: reduce) {
  .ic-rise { animation: none !important; opacity: 1 !important; transform: none !important }
}
`
