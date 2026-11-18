/* ============================================================
 * 待核实事项 PendingNotes（可复用）
 * ------------------------------------------------------------
 * 把 JSON 中 factsPending 字段渲染成醒目的提示框，
 * 明确告诉读者"这些信息团队还没有核实"，避免以讹传讹。
 *
 * Props：
 *   notes：字符串数组，例如 ['起源的具体年代', '名称由来']
 * ============================================================ */

export default function PendingNotes({ notes = [] }) {
  if (!notes.length) return null

  return (
    <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/10 p-5">
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#8a6d3b' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5h.01" />
        </svg>
        以下信息尚待核实，请勿作为确定结论引用
      </div>
      <ul className="mt-3 space-y-2">
        {notes.map((note) => (
          <li key={note} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
            {note}
          </li>
        ))}
      </ul>
    </div>
  )
}
