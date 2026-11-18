/* ============================================================
 * 通用"建设中"占位组件
 * ------------------------------------------------------------
 * 本轮先交付项目框架与首页，其余 6 个页面用该组件占位：
 * 既能点击导航看到页面切换效果，也清楚标注了后续要做什么。
 *
 * 用法：
 *   <PagePlaceholder title="非遗知识馆" plans={['...', '...']} />
 * ============================================================ */

export default function PagePlaceholder({ eyebrow, title, desc, plans = [] }) {
  return (
    <section className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        {/* 印章风格小图标 */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>

        {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        {desc && <p className="mt-4 leading-relaxed text-ink-mute">{desc}</p>}
      </div>

      {/* 后续规划卡片 */}
      {plans.length > 0 && (
        <div className="card mx-auto mt-10 max-w-xl p-6 sm:p-8">
          <h2 className="text-sm font-medium text-ink">后续迭代规划</h2>
          <ul className="mt-4 space-y-3">
            {plans.map((plan, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cinnabar" />
                <span>{plan}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-xl bg-paper px-4 py-3 text-xs leading-relaxed text-ink-mute">
            提示：当前页面为路由占位，AI 相关功能尚未接入。后续将由
            Python FastAPI 后端提供接口服务。
          </p>
        </div>
      )}
    </section>
  )
}
