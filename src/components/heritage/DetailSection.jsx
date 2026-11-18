/* ============================================================
 * 详情页内容板块 DetailSection（可复用）
 * ------------------------------------------------------------
 * 详情页的"简介 / 历史背景 / 技艺特点"都用它做标题容器，
 * 保证标题样式统一。
 *
 * Props：
 *   title：板块标题
 *   unverified：为 true 时在标题旁显示"待核实"标记
 *   children：板块正文内容
 * ============================================================ */

export default function DetailSection({ title, unverified = false, children }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        {/* 标题前的小竖条，用色块代替繁复装饰 */}
        <span className="h-5 w-1 rounded-full bg-cinnabar" aria-hidden />
        <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>

        {unverified && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold"
            title="本板块内容存在尚待核实的信息，请结合资料来源判断"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v5M12 16.5h.01" />
              <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            待核实
          </span>
        )}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  )
}
