/* ============================================================
 * 页脚 Footer（全站共享）
 * 品牌简介 + 快捷入口 + 项目说明
 * ============================================================ */
import { Link } from 'react-router-dom'

// 快捷入口：与顶部导航保持一致（命名与顺序对齐）
const quickLinks = [
  { to: '/heritage', label: '探索非遗' },
  { to: '/chat', label: 'AI 导师' },
  { to: '/recognize', label: 'AI 识别' },
  { to: '/studio', label: '创作工坊' },
  { to: '/gallery', label: '作品展厅' },
  { to: '/me', label: '我的' },
]

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-[#F4EFE6]">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        {/* 品牌 */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cinnabar font-serif text-base font-semibold text-white">
              遗
            </span>
            <span className="font-serif text-lg font-semibold">非遗灵境</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-mute">
            以人工智能为舟楫，寻访千年技艺之美。让每一项非物质文化遗产，都被看见、被理解、被续写。
          </p>
        </div>

        {/* 快捷入口 */}
        <div>
          <h3 className="text-sm font-medium text-ink">快捷入口</h3>
          <ul className="mt-4 space-y-2.5">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-sm text-ink-mute transition hover:text-cinnabar"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 项目说明 */}
        <div>
          <h3 className="text-sm font-medium text-ink">关于项目</h3>
          <p className="mt-4 text-sm leading-relaxed text-ink-mute">
            本网站为「非遗灵境」AI Web 项目：基于 FastAPI 后端与 RAG
            知识检索的非遗探索与创作平台，AI 导师回答附资料来源，创作结果均明确标注生成方式。
          </p>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-mute sm:flex-row">
          <span>© 2026 非遗灵境团队 · 保留所有权利</span>
          <span>React + Vite + Tailwind CSS</span>
        </div>
      </div>
    </footer>
  )
}
