/* ============================================================
 * 全站主布局 MainLayout
 * ------------------------------------------------------------
 * 结构：Navbar（顶部导航） + <Outlet />（页面内容） + Footer（页脚）
 * Outlet 是"路由出口"：访问不同 URL 时，对应页面会渲染在这里。
 * 这样导航栏和页脚只需写一次，所有页面共享。
 *
 * 体验细节：
 *   1. 路由切换后自动滚回页面顶部（避免新页面停留在上一页的滚动位置）
 *   2. 内容区包一层带 key 的淡入容器，切页时有轻微的过渡动画
 *      （key = 当前路径，路径变化时容器重挂载并重放动画）
 *   3. 全站统一宣纸底纹（bg-paper + paper-texture.jpg），
 *      保证探索非遗/AI 导师/AI 识别/创作工坊/展厅等页面风格一致
 * ============================================================ */
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import { PersonaPetProvider } from '../context/PersonaPetContext.jsx'

export default function MainLayout() {
  const { pathname } = useLocation()

  // 路由变化 → 滚回顶部
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <PersonaPetProvider>
      <div
        className="flex min-h-screen flex-col bg-paper"
        style={{ backgroundImage: "url('/images/home/paper-texture.jpg')", backgroundSize: '720px' }}
      >
        <Navbar />
        {/* flex-1 让内容区撑满，页脚始终贴在页面底部 */}
        <main
          className="flex-1 bg-paper"
          style={{ backgroundImage: "url('/images/home/paper-texture.jpg')", backgroundSize: '720px' }}
        >
          <div key={pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
    </PersonaPetProvider>
  )
}
