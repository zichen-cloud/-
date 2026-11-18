/* ============================================================
 * IntroController（入场动画状态机）
 * ------------------------------------------------------------
 * 职责：只做「该不该播、播完整版还是简化版、什么时候关、关掉后说什么」，
 * 不负责任何视觉。视觉在 components/intro/ScrollIntro.jsx。
 *
 * 触发路径（只有两条，统一走 pending 标记，避免路由循环）：
 *   1. 登录页登录成功 → markIntroPending() → navigate('/') → 本 Provider 监听到
 *      路由变化后消费标记并播放；
 *   2. 我的页面点击「重看开场卷轴」→ replay() 直接置为打开并回到首页。
 *
 * 幂等保证：
 *   · pending 一次性消费，刷新页面标记已空，不会再触发；
 *   · openedRef 保证同一个 Provider 生命周期内只自动打开一次；
 *   · 不阻塞登录认证，关闭动画只改本地状态，不做任何请求。
 * ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  consumeIntroPending,
  hasSeenIntro,
  markIntroSeen,
  INTRO_LION_GREETING,
} from '../utils/introPrefs.js'

const IntroContext = createContext(null)

export function IntroProvider({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  // full：首次登录的完整版；brief：后续登录的简化版（自动收起）
  const [mode, setMode] = useState('full')
  // 动画结束后交给狮小灵的一次性问候语
  const [lionGreeting, setLionGreeting] = useState('')

  const autoOpenedRef = useRef(false)
  const greetingTimerRef = useRef(null)

  /* 登录成功跳转后自动播放（只在有 pending 标记时） */
  useEffect(() => {
    // 回到登录页说明用户退出登录了：重置自动播放标记，
    // 否则同一 SPA 会话内再次登录时（不刷新页面）卷轴会被永久挡掉
    if (pathname === '/login') {
      autoOpenedRef.current = false
      return
    }
    if (autoOpenedRef.current) return
    if (!consumeIntroPending()) return
    autoOpenedRef.current = true
    setMode(hasSeenIntro() ? 'brief' : 'full')
    setOpen(true)
  }, [pathname])

  useEffect(() => () => clearTimeout(greetingTimerRef.current), [])

  /** 关闭动画；withGreeting=true 时让狮小灵在首页主动打招呼 */
  const close = useCallback((withGreeting) => {
    setOpen(false)
    markIntroSeen()
    if (!withGreeting) return
    setLionGreeting(INTRO_LION_GREETING)
    // 桌宠挂载读取一次后即可清空，避免下次挂载复读旧话术
    clearTimeout(greetingTimerRef.current)
    greetingTimerRef.current = setTimeout(() => setLionGreeting(''), 6000)
  }, [])

  /** 用户点了「开启非遗探索之旅」 */
  const finish = useCallback(() => close(true), [close])

  /** 用户点了「跳过」 */
  const skip = useCallback(() => close(false), [close])

  /** 个人设置里的「再次观看」 */
  const replay = useCallback(() => {
    autoOpenedRef.current = true
    setMode('full')
    setOpen(true)
    if (pathname !== '/') navigate('/')
  }, [navigate, pathname])

  const value = useMemo(
    () => ({ open, mode, lionGreeting, finish, skip, replay }),
    [open, mode, lionGreeting, finish, skip, replay],
  )

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>
}

export function useIntro() {
  const ctx = useContext(IntroContext)
  if (!ctx) throw new Error('useIntro 必须在 IntroProvider 内使用')
  return ctx
}
