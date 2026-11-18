/* ============================================================
 * FishCursor：把鼠标箭头换成一抹游鱼
 * ------------------------------------------------------------
 * · 鱼头固定在鼠标真实位置，整条鱼朝向恒定（像普通箭头一样不转向）
 * · 游动时鱼身周围泛出淡蓝水光，身后跟几颗小气泡上浮，像小鱼在水里穿行
 * · 点击时从鱼身四周晕开一圈圈水波（同心圆逐层扩散），很快散尽
 * · 只在精确指针设备（鼠标 / 触控板）且未开「减少动效」时启用，
 *   触屏与低动效偏好下完全隐藏，保留系统原生光标
 * ============================================================ */
import { useEffect, useRef } from 'react'

/* public/images/cursor-fish.png：鱼头朝左上（与普通箭头同向），长尾拖向右下 */
const FISH_W = 50
const FISH_H = 42
const HEAD_X = FISH_W * 0.006 // 鱼嘴在图层内的横坐标
const HEAD_Y = FISH_H * 0.096 // 鱼嘴在图层内的纵坐标
/* 鱼身中心：光晕、气泡与点击水波都以它为基准 */
const BODY_CX = FISH_W * 0.48
const BODY_CY = FISH_H * 0.5

const BLUE = [104, 170, 216] // 淡蓝水光
const BUBBLE = [150, 205, 238] // 气泡描边（淡蓝）
const HOVER_SEL = 'a,button,[role="button"],summary,label,input,textarea,select'

export default function FishCursor() {
  const canvasRef = useRef(null)
  const fishRef = useRef(null)

  useEffect(() => {
    const fine = window.matchMedia?.('(pointer: fine)').matches
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return undefined

    const canvas = canvasRef.current
    const fish = fishRef.current
    if (!canvas || !fish) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    document.documentElement.classList.add('fish-cursor-on')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = window.innerWidth
    let H = window.innerHeight

    const sizeCanvas = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()

    /* 蓝色水光贴图：预渲染一次，逐帧 drawImage 即可，避免每帧现算渐变 */
    const glow = document.createElement('canvas')
    glow.width = 128
    glow.height = 128
    const gctx = glow.getContext('2d')
    const gg = gctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gg.addColorStop(0, `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},0.72)`)
    gg.addColorStop(0.4, `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},0.26)`)
    gg.addColorStop(1, `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},0)`)
    gctx.fillStyle = gg
    gctx.fillRect(0, 0, 128, 128)

    const mouse = { x: W / 2, y: H / 2, seen: false, hovering: false }
    const pos = { x: W / 2, y: H / 2 }
    let prevX = pos.x
    let prevY = pos.y
    let moveAngle = 0 // 游动方向（决定水波落在鱼身后哪一侧）
    let scale = 1
    let scaleTarget = 1
    let bob = 0
    let bobT = 0
    let raf = 0
    let running = false
    let last = performance.now()
    let idleSince = performance.now()
    let shown = false

    const bubbles = [] // 游动时身后的小气泡
    const rings = [] // 点击时从四周晕开的水波
    let glowStrength = 0 // 蓝色水光的强度（随游速淡入淡出）
    let lastBubbleAt = 0

    /* 身后冒一颗小气泡：略偏后、略偏上，慢慢浮起散掉 */
    const spawnBubble = (x, y, dir) => {
      bubbles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        r: 1.2 + Math.random() * 2.2,
        vx: -Math.cos(dir) * 0.18 + (Math.random() - 0.5) * 0.16,
        vy: -0.16 - Math.random() * 0.22,
        sway: Math.random() * Math.PI * 2,
        t: 0,
        life: 700 + Math.random() * 500,
        a: 0.3 + Math.random() * 0.28,
      })
      if (bubbles.length > 24) bubbles.shift()
    }

    /* 点击：一次晕开三圈同心水波，错开出发时间 */
    const spawnRings = (x, y) => {
      for (let i = 0; i < 3; i += 1) {
        rings.push({
          x,
          y,
          delay: i * 110,
          t: 0,
          life: 820 - i * 70,
          r0: 9 + i * 5,
          grow: 32 + i * 9,
          a: 0.38 - i * 0.08,
          phase: Math.random() * Math.PI * 2,
        })
      }
      if (rings.length > 15) rings.splice(0, rings.length - 15)
    }

    const frame = (now) => {
      const dt = Math.min(now - last, 48)
      last = now
      bobT += dt

      /* 弹簧跟随：留一点滞后，才像在"游"而不是贴着鼠标 */
      pos.x += (mouse.x - pos.x) * 0.24
      pos.y += (mouse.y - pos.y) * 0.24

      const stepX = pos.x - prevX
      const stepY = pos.y - prevY
      const spd = Math.hypot(stepX, stepY)
      prevX = pos.x
      prevY = pos.y
      if (spd > 0.3) {
        idleSince = now
        /* 平滑游动方向（最短弧），避免方向抖动 */
        const target = Math.atan2(stepY, stepX)
        let d = target - moveAngle
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        moveAngle += d * 0.2
      }

      scale += (scaleTarget - scale) * 0.18
      const idle = now - idleSince > 320
      bob = Math.sin(bobT * 0.0016) * (idle ? 1.5 : 0.4)

      /* 蓝色水光随游速增强，停下游光也慢慢收 */
      const glowTarget = spd > 0.4 ? Math.min(1, spd / 8) : 0
      glowStrength += (glowTarget - glowStrength) * 0.12

      /* 气泡：身后每隔一小段冒一颗，游得越快冒得越勤 */
      if (spd > 0.6 && now - lastBubbleAt > 95) {
        lastBubbleAt = now
        spawnBubble(
          pos.x + BODY_CX - Math.cos(moveAngle) * 16,
          pos.y + bob + BODY_CY - Math.sin(moveAngle) * 16,
          moveAngle,
        )
      }

      /* 鱼本身只平移，不转向 —— 始终朝左上 */
      fish.style.transform = `translate3d(${pos.x}px, ${pos.y + bob}px, 0) scale(${scale})`

      /* ---- 画布：蓝色水光 + 身后气泡 + 点击晕开的水波 ---- */
      ctx.clearRect(0, 0, W, H)
      ctx.lineCap = 'round'

      const cx = pos.x + BODY_CX
      const cy = pos.y + bob + BODY_CY

      /* 1. 水光：鱼身周围一圈淡蓝柔光，游得越快越明显 */
      if (glowStrength > 0.015) {
        const R = 30 + glowStrength * 16
        ctx.globalAlpha = 0.14 + glowStrength * 0.2
        ctx.drawImage(glow, cx - R, cy - R, R * 2, R * 2)
        ctx.globalAlpha = 1
      }

      /* 2. 气泡：白白的小水泡边浮边散 */
      for (let i = bubbles.length - 1; i >= 0; i -= 1) {
        const b = bubbles[i]
        b.t += dt
        const k = b.t / b.life
        if (k >= 1) {
          bubbles.splice(i, 1)
          continue
        }
        b.x += b.vx + Math.sin(b.sway + b.t * 0.005) * 0.14
        b.y += b.vy
        const r = b.r * (1 + k * 0.3)
        const a = b.a * (1 - k)
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${BUBBLE[0]},${BUBBLE[1]},${BUBBLE[2]},${a})`
        ctx.lineWidth = 0.9
        ctx.stroke()
        // 气泡左上的一点高光
        ctx.beginPath()
        ctx.arc(b.x - r * 0.3, b.y - r * 0.35, Math.max(0.4, r * 0.26), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`
        ctx.fill()
      }

      /* 3. 点击水波：三圈同心圆从鱼身四周晕开 */
      ctx.shadowColor = `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},0.4)`
      ctx.shadowBlur = 6
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i]
        if (r.delay > 0) {
          r.delay -= dt
          continue
        }
        r.t += dt
        const k = r.t / r.life
        if (k >= 1) {
          rings.splice(i, 1)
          continue
        }
        const ease = 1 - Math.pow(1 - k, 2.2)
        const rad = r.r0 + r.grow * ease
        const alpha = r.a * Math.pow(1 - k, 1.5)

        ctx.beginPath()
        const seg = 44
        for (let j = 0; j <= seg; j += 1) {
          const ang = (j / seg) * Math.PI * 2
          // 手绘感：半径轻微起伏，圆不完全规整
          const wob = Math.sin(ang * 3 + r.phase + k * 1.6) * 1.6
          const rr = rad + wob
          const px = r.x + Math.cos(ang) * rr
          const py = r.y + Math.sin(ang) * rr * 0.9
          if (j === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.strokeStyle = `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},${alpha})`
        ctx.lineWidth = Math.max(0.6, 1.5 * (1 - k))
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      /* 停稳且气泡、水波散尽后停帧，避免空转耗电；下次移动再唤醒 */
      const settled = Math.hypot(mouse.x - pos.x, mouse.y - pos.y) < 0.15
      if (settled && rings.length === 0 && bubbles.length === 0 && now - idleSince > 800) {
        running = false
        return
      }
      raf = requestAnimationFrame(frame)
    }

    const ensureLoop = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    const show = () => {
      if (shown) return
      shown = true
      fish.classList.add('is-on')
      canvas.classList.add('is-on')
      ensureLoop()
    }

    const hide = () => {
      shown = false
      fish.classList.remove('is-on')
      canvas.classList.remove('is-on')
    }

    const onMove = (e) => {
      const x = e.clientX
      const y = e.clientY
      if (!mouse.seen) {
        mouse.seen = true
        pos.x = x
        pos.y = y
        prevX = x
        prevY = y
      }
      mouse.x = x
      mouse.y = y
      mouse.hovering = !!(e.target instanceof Element && e.target.closest(HOVER_SEL))
      scaleTarget = mouse.hovering ? 1.08 : 1
      show()
      ensureLoop()
    }

    const onDown = () => {
      scaleTarget = 0.86
      // 点击才晕开：以鱼身为圆心荡出三圈水波
      spawnRings(pos.x + BODY_CX, pos.y + bob + BODY_CY)
      ensureLoop()
    }

    const onUp = () => {
      scaleTarget = mouse.hovering ? 1.08 : 1
      ensureLoop()
    }

    const onBlur = () => hide()

    const onVis = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (shown) {
        ensureLoop()
      }
    }

    const onResize = () => sizeCanvas()

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onResize)
    document.addEventListener('mouseleave', hide)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      running = false
      document.documentElement.classList.remove('fish-cursor-on')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mouseleave', hide)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="fish-cursor-ink" aria-hidden="true" />
      <div ref={fishRef} className="fish-cursor-fish" aria-hidden="true">
        <img
          src="/images/cursor-fish.png"
          alt=""
          draggable="false"
          style={{
            width: `${FISH_W}px`,
            height: `${FISH_H}px`,
            marginLeft: `${-HEAD_X}px`,
            marginTop: `${-HEAD_Y}px`,
          }}
        />
      </div>
      <style>{CSS}</style>
    </>
  )
}

const CSS = `
.fish-cursor-ink {
  position: fixed;
  inset: 0;
  z-index: 9998;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity .45s ease;
}
.fish-cursor-ink.is-on { opacity: 1 }

.fish-cursor-fish {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 9999;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity .3s ease;
  will-change: transform;
}
.fish-cursor-fish.is-on { opacity: 1 }
.fish-cursor-fish img {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  max-width: none; /* Tailwind preflight 的 max-width:100% 会把 0 宽父容器里的鱼压没 */
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 1px 1px rgba(42,36,25,.12));
}

/* 只在鱼可见时隐藏系统光标 */
html.fish-cursor-on,
html.fish-cursor-on * { cursor: none !important }

@media (pointer: coarse) {
  .fish-cursor-ink, .fish-cursor-fish { display: none }
}
@media (prefers-reduced-motion: reduce) {
  .fish-cursor-ink, .fish-cursor-fish { display: none }
}
`
