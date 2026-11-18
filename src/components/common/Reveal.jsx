/* ============================================================
 * Reveal 滚动出现动画（全站统一）
 * ------------------------------------------------------------
 * 用 IntersectionObserver 让区块进入视口时淡入上移。
 * - 一次性触发，触发后立即断开观察，不做滚动反向动画
 * - 尊重系统"减少动态效果"偏好（motion-reduce 时直接显示）
 * - 用法：<Reveal delay={100}>…</Reveal>，delay 为毫秒级错峰
 * ============================================================ */
import { useEffect, useRef, useState } from 'react'

export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div', ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    // 无 IntersectionObserver（极旧浏览器）时直接显示，不隐藏内容
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      // 提前 40px 触发，避免用户看到"空白等待"
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      } ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
