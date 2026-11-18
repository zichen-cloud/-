/* ============================================================
 * 顶部导航栏 Navbar
 * - 桌面端：横向菜单
 * - 移动端：右上角汉堡按钮，点击展开纵向菜单
 * - NavLink 是 react-router 提供的链接，当前页自动高亮
 * ============================================================ */
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'

// 导航菜单配置：以后新增页面，只要在这里加一项即可
// 命名对齐产品信息架构：探索非遗 / AI 导师 / AI 识别 / 创作工坊 / 作品展厅 / 我的
const navItems = [
  { to: '/', label: '首页' },
  { to: '/heritage', label: '探索非遗' },
  { to: '/chat', label: 'AI 导师' },
  { to: '/recognize', label: 'AI 识别' },
  { to: '/studio', label: '创作工坊' },
  { to: '/gallery', label: '作品展厅' },
  { to: '/me', label: '我的' },
]

export default function Navbar() {
  // 控制移动端菜单的展开 / 收起
  const [menuOpen, setMenuOpen] = useState(false)

  // 根据是否当前页返回不同样式
  const linkClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm transition ${
      isActive
        ? 'bg-cinnabar/10 font-medium text-cinnabar'
        : 'text-ink-soft hover:text-cinnabar'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        {/* 左侧 Logo：朱砂方印 + 站名，点击回首页 */}
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cinnabar font-serif text-lg font-semibold text-white shadow-sm">
            遗
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-serif text-lg font-semibold tracking-wide">非遗灵境</span>
            <span className="mt-1 text-[10px] tracking-[0.3em] text-ink-mute">AI HERITAGE</span>
          </span>
        </Link>

        {/* 桌面端导航（md 以上屏幕显示） */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'} // 只有精确等于 "/" 时首页才高亮
              className={linkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 移动端汉堡按钮（md 以下显示） */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
          aria-label="打开导航菜单"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            // 关闭图标 X
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            // 汉堡图标 三
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* 移动端展开菜单 */}
      {menuOpen && (
        <nav className="border-t border-line bg-paper md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={linkClass}
                onClick={() => setMenuOpen(false)} // 点击后自动收起菜单
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
