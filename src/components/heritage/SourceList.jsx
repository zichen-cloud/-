/* ============================================================
 * 资料来源 SourceList（可复用）
 * ------------------------------------------------------------
 * 渲染 JSON 中 sources 字段：来源名称、类型、说明与链接。
 * 有 url 时显示"前往查阅"外链（新窗口打开）；
 * 没有 url（如纸质工具书）时不显示链接。
 *
 * Props：
 *   sources：来源对象数组 [{ name, type, url, note }]
 * ============================================================ */

export default function SourceList({ sources = [] }) {
  if (!sources.length) return null

  return (
    <ul className="mt-4 space-y-3">
      {sources.map((source) => (
        <li
          key={source.name}
          className="flex flex-col gap-2 rounded-xl border border-line bg-paper/50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{source.name}</span>
              <span className="rounded-full bg-celadon/10 px-2 py-0.5 text-xs text-celadon">
                {source.type}
              </span>
            </div>
            {source.note && <p className="mt-1 text-xs leading-relaxed text-ink-mute">{source.note}</p>}
          </div>

          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-cinnabar hover:text-cinnabar-dark"
            >
              前往查阅
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          ) : (
            <span className="shrink-0 text-xs text-ink-mute">纸质资料 / 数据库查阅</span>
          )}
        </li>
      ))}
    </ul>
  )
}
