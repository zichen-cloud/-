/* ============================================================
 * 路由配置 App
 * ------------------------------------------------------------
 * 使用嵌套路由：
 *   /                    → 首页
 *   /heritage            → 非遗知识馆
 *   /heritage/:id        → 非遗详情（:id 是动态参数，如 kunqu）
 *   /chat                → AI 非遗导师
 *   /persona             → AI 数字传承人（五位角色互动）
 *   /recognize           → AI 图像识别
 *   /studio              → 文化创作工坊
 *   /gallery             → 作品展厅
 *   /works               → 我的作品（管理）
 *   /me                  → 我的非遗创作空间
 *
 * 所有页面都套在 MainLayout 里，自动拥有导航栏与页脚。
 * ============================================================ */
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import { isAuthed } from './utils/auth.js'
import { IntroProvider } from './context/IntroContext.jsx'
import ScrollIntro from './components/intro/ScrollIntro.jsx'
import FishCursor from './components/cursor/FishCursor.jsx'

import Home from './pages/Home.jsx'
import Heritage from './pages/Heritage.jsx'
import HeritageDetail from './pages/HeritageDetail.jsx'
import Chat from './pages/Chat.jsx'
import ImageRecognition from './pages/ImageRecognition.jsx'
import CreativeStudio from './pages/CreativeStudio.jsx'
import Persona from './pages/Persona.jsx'
import Gallery from './pages/Gallery.jsx'
import Works from './pages/Works.jsx'
import MySpace from './pages/MySpace.jsx'
import Login from './pages/Login.jsx'

/* 路由守卫：未登录一律跳回 /login */
function RequireAuth({ children }) {
  if (!isAuthed()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    /* IntroProvider 只管「登录后的卷轴入场」，包裹全部路由，
       ScrollIntro 覆盖在页面之上，不参与路由，因此不会产生路由循环 */
    <IntroProvider>
      <Routes>
        {/* 登录页：独立全屏，不套 MainLayout */}
        <Route path="/login" element={<Login />} />
        {/* MainLayout 通过 <Outlet /> 渲染下面的子页面（需登录） */}
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/heritage" element={<Heritage />} />
          <Route path="/heritage/:id" element={<HeritageDetail />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/recognize" element={<ImageRecognition />} />
          <Route path="/persona" element={<Persona />} />
          <Route path="/studio" element={<CreativeStudio />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/works" element={<Works />} />
          <Route path="/me" element={<MySpace />} />
          {/* 访问不存在的路径时，回到首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {/* 登录成功后的东方卷轴入场（全站唯一实例） */}
      <ScrollIntro />
      {/* 全站游鱼光标（仅桌面精确指针设备启用） */}
      <FishCursor />
    </IntroProvider>
  )
}
