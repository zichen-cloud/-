/* ============================================================
 * ScrollIntro：登录成功后的「东方数字非遗画卷」开场
 * ------------------------------------------------------------
 * 五幕结构（时间线在 TIMELINE 中统一管理）：
 *   ① in      画面渐暗，深墨空间浮现
 *   ② awaken  圆形文化图腾由微光点亮，纹样开始旋转
 *   ③ clouds  蓝银水墨云雾从两侧向中央涌动
 *   ④ unroll  数字画卷从中缝向两侧真实展开（墨玉轴随纸边外移）
 *   ⑤ elements 六枚非遗徽记依次从雾中苏醒
 *   ⑥ show    主题、介绍、四项能力、进入按钮逐层出现
 *   ⑦ closing 云雾向中轴汇聚，画卷收拢并化为星屑，回到首页
 *
 * 只由 IntroController 控制开合；自身不碰路由与登录态。
 * 支持：跳过（Esc 同效）、音效开关（默认关）、简化版自动收起、
 *       reduced-motion、移动端（减少粒子与层数）。
 * ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIntro } from '../../context/IntroContext.jsx'
import { readIntroSound, saveIntroSound } from '../../utils/introPrefs.js'
import AwakeningTotem from './AwakeningTotem.jsx'
import InkClouds from './InkClouds.jsx'
import DigitalScroll from './DigitalScroll.jsx'
import HeritageElements from './HeritageElements.jsx'
import HeritageIntroContent from './HeritageIntroContent.jsx'
import BottomEnergyField from './BottomEnergyField.jsx'

/* 阶段时间（毫秒） */
const TIMELINE = {
  full: { awaken: 260, clouds: 1280, unroll: 2400, elements: 4200, show: 6000, auto: 0 },
  brief: { awaken: 120, clouds: 520, unroll: 900, elements: 1650, show: 2200, auto: 6500 },
}

const PHASE_ORDER = ['in', 'awaken', 'clouds', 'unroll', 'elements', 'show']

export default function ScrollIntro() {
  const { open, mode, finish, skip } = useIntro()
  const [phase, setPhase] = useState('in')
  const [visible, setVisible] = useState(false)
  const [sound, setSound] = useState(() => readIntroSound())
  const [reduced, setReduced] = useState(false)

  const closedRef = useRef(false)
  const audioCtxRef = useRef(null)
  const soundRef = useRef(sound)

  useEffect(() => {
    soundRef.current = sound
  }, [sound])

  /* ---------------- 极轻的合成音（无音频文件，不自动播放） ---------------- */
  const playChime = useCallback((deep = false) => {
    if (!soundRef.current || typeof window === 'undefined') return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    try {
      const ctx = audioCtxRef.current || (audioCtxRef.current = new Ctx())
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      const freqs = deep ? [396, 594] : [528, 792]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.05 : 0.022, now + 0.06)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 1.7)
      })
    } catch {
      /* 浏览器不支持 WebAudio 时静默降级 */
    }
  }, [])

  /* ---------------- 进入：收拢 → 星屑 → 交回控制器 ---------------- */
  const handleEnter = useCallback(
    (auto = false) => {
      if (closedRef.current) return
      closedRef.current = true
      setPhase('closing')
      playChime(true)
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      setTimeout(
        () => {
          finish()
          if (auto) playChime()
        },
        reduce ? 320 : 2400,
      )
    },
    [finish, playChime],
  )

  const handleSkip = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    skip()
  }, [skip])

  /* ---------------- 阶段推进 ---------------- */
  useEffect(() => {
    if (!open) return undefined
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setReduced(reduce)
    closedRef.current = false
    setVisible(false)
    setPhase('in')

    const plan = TIMELINE[mode] || TIMELINE.full
    const fix = (v) => (reduce ? Math.min(v, 100) : v)
    const timers = []
    timers.push(requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true))))
    timers.push(setTimeout(() => setPhase('awaken'), fix(plan.awaken)))
    timers.push(setTimeout(() => setPhase('clouds'), fix(plan.clouds)))
    timers.push(setTimeout(() => setPhase('unroll'), fix(plan.unroll)))
    timers.push(setTimeout(() => setPhase('elements'), fix(plan.elements)))
    timers.push(setTimeout(() => setPhase('show'), fix(plan.show)))
    if (plan.auto) timers.push(setTimeout(() => handleEnter(true), fix(plan.auto)))
    const chime = setTimeout(() => playChime(), fix(plan.awaken) + 120)
    timers.push(chime)

    return () => {
      timers.forEach((id) => {
        clearTimeout(id)
        cancelAnimationFrame(id)
      })
    }
  }, [open, mode, handleEnter, playChime])

  /* 打开期间锁背景滚动 */
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  /* Esc = 跳过 */
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') handleSkip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleSkip])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    saveIntroSound(next)
    soundRef.current = next
    if (next) playChime()
  }

  const stageIndex = Math.max(0, PHASE_ORDER.indexOf(phase))

  if (!open) return null

  return (
    <div
      className="intro-wrap fixed inset-0 z-[70] overflow-hidden bg-[#F4EFE4]"
      data-state={phase === 'closing' ? 'closing' : visible ? 'visible' : 'hidden'}
      role="dialog"
      aria-modal="true"
      aria-label="非遗灵境开场画卷"
    >
      {/* 深墨空间 */}
      <div className="absolute inset-0 intro-stage" aria-hidden="true" />
      <div className="absolute inset-0 intro-noise" aria-hidden="true" />
      <div className="absolute inset-0 intro-vignette" aria-hidden="true" />
      <span className="intro-aurora" aria-hidden="true" />

      {/* 蓝银微光粒子 */}
      <Motes />

      {/* 水墨云雾 */}
      <InkClouds phase={phase} />

      {/* 卷轴下方的数字水墨能量场（位于卷轴之下，不遮挡文字） */}
      <BottomEnergyField phase={phase} />

      {/* 舞台 */}
      <div className="relative z-10 flex h-full items-center justify-center px-3 pb-[16vh] pt-16 sm:px-8 sm:pb-[15vh]">
        <div className="relative h-[min(66vh,600px)] w-full max-w-[1040px]">
          {/* 图腾（画卷后方，展开后淡为背景） */}
          <AwakeningTotem phase={phase} mode={mode} />

          <DigitalScroll phase={phase} mode={mode} reduce={reduced}>
            <HeritageElements phase={phase} mode={mode} />
            <HeritageIntroContent mode={mode} onEnter={() => handleEnter(false)} />
          </DigitalScroll>
        </div>
      </div>

      {/* 收场星屑 */}
      <DissolveDust active={phase === 'closing'} />

      {/* 顶栏 */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5 text-ink/85">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#8E2119] bg-[#B23A2E] font-serif text-sm leading-none text-[#FDF3E4] shadow-[0_3px_10px_rgba(178,58,46,.25)]">
            遗
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-serif text-sm tracking-wide">非遗灵境</span>
            <span className="mt-1 text-[9px] tracking-[0.3em] text-ink-mute/70">AI HERITAGE</span>
          </span>
          {/* 五幕进度：细小的银线，提示"正在开场" */}
          <span className="ml-1 hidden items-center gap-1.5 md:flex" aria-hidden="true">
            {PHASE_ORDER.slice(1).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= stageIndex - 1 ? 'w-4 bg-[#B8862F]/75' : 'w-1.5 bg-ink/20'
                }`}
              />
            ))}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            title={sound ? '关闭音效' : '开启音效'}
            className="flex h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white/55 px-3 text-xs text-ink-soft backdrop-blur-sm transition hover:border-cinnabar/45 hover:text-cinnabar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
              {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" /> : <path d="m16 9 5 6M21 9l-5 6" />}
            </svg>
            {sound ? '音效开' : '音效关'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="flex h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white/55 px-4 text-xs tracking-[0.14em] text-ink-soft backdrop-blur-sm transition hover:border-cinnabar/45 hover:text-cinnabar"
          >
            跳过
          </button>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  )
}

/* ---------------- 蓝银微光粒子（Canvas） ---------------- */
function Motes() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let list = []

    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = 48
    const sctx = sprite.getContext('2d')
    const g = sctx.createRadialGradient(24, 24, 0, 24, 24, 24)
    g.addColorStop(0, 'rgba(150,112,40,0.8)')
    g.addColorStop(0.32, 'rgba(184,134,47,0.32)')
    g.addColorStop(1, 'rgba(184,134,47,0)')
    sctx.fillStyle = g
    sctx.fillRect(0, 0, 48, 48)

    const build = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const count = w < 640 ? 14 : 30
      list = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.7 + Math.random() * 2.2,
        vy: 0.08 + Math.random() * 0.2,
        sway: 0.3 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.12 + Math.random() * 0.38,
      }))
      if (reduce) draw()
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      list.forEach((p) => {
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8)
      })
      ctx.restore()
    }

    let t = 0
    const tick = () => {
      const h = window.innerHeight
      t += 0.01
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      list.forEach((p) => {
        p.y -= p.vy
        p.x += Math.sin(t * p.sway + p.phase) * 0.14
        if (p.y < -10) {
          p.y = h + 10
          p.x = Math.random() * window.innerWidth
        }
        ctx.globalAlpha = p.alpha
        ctx.drawImage(sprite, p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8)
      })
      ctx.restore()
      raf = requestAnimationFrame(tick)
    }

    build()
    if (!reduce) raf = requestAnimationFrame(tick)
    const onResize = () => build()
    window.addEventListener('resize', onResize)
    const onVis = () => {
      if (reduce) return
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
}

/* ---------------- 收场星屑：画卷化粒消散 ---------------- */
function DissolveDust({ active }) {
  const dots = useMemo(
    () =>
      Array.from({ length: 34 }).map(() => {
        const angle = Math.random() * Math.PI * 2
        const dist = 40 + Math.random() * 220
        return {
          x: 42 + Math.random() * 16, // 集中在画卷中轴附近
          y: 30 + Math.random() * 40,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 40,
          size: 1 + Math.random() * 2.4,
          delay: Math.random() * 260,
          gold: Math.random() > 0.6,
        }
      }),
    [],
  )

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[25]" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className="dd-dot"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            background: d.gold ? '#E3C88B' : '#CFE4FF',
            boxShadow: d.gold ? '0 0 6px rgba(227,200,139,.9)' : '0 0 6px rgba(143,208,255,.9)',
            '--dx': `${d.dx}px`,
            '--dy': `${d.dy}px`,
            animationDelay: `${d.delay}ms`,
          }}
        />
      ))}
      <style>{`
        .dd-dot { position: absolute; border-radius: 9999px; opacity: 0; animation: ddFly .95s cubic-bezier(.2,.7,.3,1) forwards }
        @keyframes ddFly {
          0% { opacity: .95; transform: translate(0,0) scale(1) }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3) }
        }
        @media (prefers-reduced-motion: reduce) { .dd-dot { display: none } }
      `}</style>
    </div>
  )
}

const CSS = `
.intro-wrap { opacity: 0 }
.intro-wrap[data-state='visible'] { opacity: 1; transition: opacity .7s ease }
.intro-wrap[data-state='closing'] { opacity: 0; transition: opacity 1.4s ease .1s }

/* 宣纸空间：与首页同一套暖米色，向四周轻轻压暗 */
.intro-stage {
  background:
    radial-gradient(ellipse 62% 58% at 50% 44%, #FFFDF7 0%, #F8F2E5 42%, #F0E7D6 78%, #E8DDC7 100%);
}
/* 纸纹，避免纯色渐变的塑料感 */
.intro-noise {
  background-image: url('/images/home/paper-texture.jpg');
  background-size: 560px;
  opacity: .16;
  mix-blend-mode: multiply;
}
.intro-vignette {
  background: radial-gradient(ellipse 74% 68% at 50% 48%, transparent 42%, rgba(110,92,66,.16) 100%);
}
/* 极缓慢的暖金光晕 */
.intro-aurora {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 120vmin;
  height: 82vmin;
  transform: translate(-50%, -50%);
  filter: blur(80px);
  border-radius: 9999px;
  background: radial-gradient(ellipse at 50% 50%, rgba(224,162,63,.18) 0%, rgba(180,150,90,.08) 45%, transparent 72%);
  animation: introAurora 18s ease-in-out infinite;
}
@keyframes introAurora {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .8 }
  50% { transform: translate(-50%, -52%) scale(1.08); opacity: 1 }
}

@media (prefers-reduced-motion: reduce) {
  .intro-wrap[data-state='visible'], .intro-wrap[data-state='closing'] { transition-duration: .2s }
  .intro-aurora { animation: none }
}
`
