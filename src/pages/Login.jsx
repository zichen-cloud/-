/* ============================================================
 * 登录页 Login
 * ------------------------------------------------------------
 * 山水水墨全屏背景（public/images/login-bg-art.jpg）+ 右侧登录卡牌。
 * 演示环境本地鉴权：任意非空账号密码即可登录（utils/auth.js）。
 * 已登录用户访问 /login 会被直接送回首页。
 * ============================================================ */
import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import { login, isAuthed } from '../utils/auth.js'
import { validateDisplayName } from '../utils/naming.js'
import { markIntroPending } from '../utils/introPrefs.js'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ account: '', password: '' })
  const [error, setError] = useState('')

  // 已登录则不必再看到登录页
  if (isAuthed()) return <Navigate to="/" replace />

  const handleSubmit = (e) => {
    e.preventDefault()
    // 账号会展示给其他用户，必须是完整姓名或常用昵称，不能是 123 这类随意命名
    const nameError = validateDisplayName(form.account, {
      label: '用户名',
      min: 2,
      max: 20,
      example: '林小满',
    })
    if (nameError) {
      setError(nameError)
      return
    }
    if (!form.password || form.password.length < 6) {
      setError('请输入至少 6 位的登录密码')
      return
    }
    login(form.account.trim())
    // 标记「本次会话待播放开场卷轴」：整页跳转后由 IntroProvider 消费并播放，
    // 只写 sessionStorage，不影响登录态，也不会在刷新后重复触发
    markIntroPending()
    navigate('/', { replace: true })
  }

  const inputCls =
    'h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-cinnabar/60 focus:ring-2 focus:ring-cinnabar/15'

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-paper">
      {/* 山水水墨背景（AI 生成水墨画，铺满全屏）—— 降低透明度避免抢戏 */}
      <div className="absolute inset-0 bg-[url('/images/login-bg-art.jpg')] bg-cover bg-center opacity-55" />

      {/* 顶部导航（与全站一致的视觉） */}
      <div className="relative z-10">
        <Navbar />
      </div>

      {/* 主体：左侧品牌文案 + 右侧登录卡牌 */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-between gap-10 px-6">
        {/* 左侧品牌文案（移动端隐藏） */}
        <div className="hidden max-w-md lg:block">
          <p className="text-xs font-medium tracking-[0.35em] text-ink-mute">
            HERITAGE × AI · 中国非物质文化遗产
          </p>
          <h1 className="mt-4 font-serif text-6xl font-bold text-ink">非遗灵境</h1>
          <p className="mt-4 text-base text-ink-soft">AI，让千年非遗走进当代生活</p>
        </div>

        {/* 登录卡牌 */}
        <div className="mx-auto w-full max-w-[400px] lg:mx-0">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-3xl border border-[#E4DDCB] bg-[#FCFAF3]/95 p-6 shadow-[0_24px_60px_rgba(60,48,32,0.18)] backdrop-blur-sm sm:p-10"
          >
            {/* 右上角朱砂印章 */}
            <span
              className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-md bg-cinnabar font-serif text-[13px] leading-none text-white shadow-sm"
              style={{ writingMode: 'vertical-rl' }}
            >
              灵境
            </span>

            <h2 className="text-center font-serif text-2xl font-semibold text-ink">欢迎回来</h2>

            <div className="mt-6 space-y-4 sm:mt-8">
              <input
                className={inputCls}
                placeholder="用户名（姓名或常用昵称，如：林小满）"
                autoComplete="username"
                maxLength={20}
                value={form.account}
                onChange={(e) => {
                  setForm({ ...form, account: e.target.value })
                  setError('')
                }}
              />
              <input
                className={inputCls}
                type="password"
                placeholder="密码（至少 6 位）"
                autoComplete="current-password"
                minLength={6}
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value })
                  setError('')
                }}
              />
            </div>

            {error && <p className="mt-3 text-xs text-cinnabar">{error}</p>}

            <button
              type="submit"
              className="mt-6 h-12 w-full rounded-xl bg-cinnabar text-sm font-medium tracking-[0.3em] text-white transition hover:bg-cinnabar-dark active:scale-[0.99] sm:mt-8"
            >
              登录
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-mute/80">
            演示环境 · 请使用完整姓名或常用昵称登录（如「林小满」）
          </p>
        </div>
      </div>
    </div>
  )
}
