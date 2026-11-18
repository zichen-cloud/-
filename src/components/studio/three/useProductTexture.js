/* ============================================================
 * useProductTexture：产品贴花纹理
 * ------------------------------------------------------------
 * 两种贴图（由用户在控制条切换）：
 *   pattern：用提案【配色】在 canvas 上程序化绘制的平铺纹样
 *            （不加载外部图片，得到的是干净的产品印花）
 *   image  ：阶段一的提案效果图（demo 模式下图片本身带水印，如实呈现）
 *
 * 所有 THREE.Texture 在切换/卸载时都会 dispose，避免显存泄漏。
 * ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

function hexToRgb(hex, fallback = [192, 57, 43]) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return fallback
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return fallback
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(c, a = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

/* 椭圆羽化：把 canvas 边缘溶为透明（单位圆坐标系，适配任意长宽比） */
function featherEdges(ctx, W, H) {
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(W / 2, H / 2)
  const grad = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.62, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = grad
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}

/* ---- 三种平铺纹样（512×512 无缝瓷砖） ---- */

function drawMotifDots(ctx, main, sub, bg, S) {
  ctx.fillStyle = rgba(bg)
  ctx.fillRect(0, 0, S, S)
  const gap = S / 4
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = x * gap + gap / 2 + (y % 2 ? gap / 2 : 0)
      const cy = y * gap + gap / 2
      ctx.beginPath()
      ctx.arc(cx % S, cy, gap * 0.16, 0, Math.PI * 2)
      ctx.fillStyle = rgba(main, 0.9)
      ctx.fill()
      ctx.beginPath()
      ctx.arc((cx + gap / 2) % S, (cy + gap / 2) % S, gap * 0.07, 0, Math.PI * 2)
      ctx.fillStyle = rgba(sub, 0.8)
      ctx.fill()
    }
  }
}

function drawMotifSawtooth(ctx, main, sub, bg, S) {
  ctx.fillStyle = rgba(bg)
  ctx.fillRect(0, 0, S, S)
  // 横向锯齿带（呼应剪纸锯齿纹的形式语言，仅装饰）
  const bands = [S * 0.22, S * 0.78]
  bands.forEach((by, bi) => {
    const step = S / 12
    for (let x = -step; x < S + step; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, by)
      ctx.lineTo(x + step / 2, by + (bi === 0 ? step / 1.6 : -step / 1.6))
      ctx.lineTo(x + step, by)
      ctx.closePath()
      ctx.fillStyle = rgba(bi === 0 ? main : sub, 0.85)
      ctx.fill()
    }
  })
  // 中央月牙弧
  ctx.strokeStyle = rgba(main, 0.9)
  ctx.lineWidth = S * 0.028
  for (let i = 0; i < 4; i++) {
    const cx = S * (0.18 + i * 0.22)
    const cy = S / 2
    ctx.beginPath()
    ctx.arc(cx, cy, S * 0.07, 0.25 * Math.PI, 1.75 * Math.PI)
    ctx.stroke()
  }
}

function drawMotifDiamond(ctx, main, sub, bg, S) {
  ctx.fillStyle = rgba(bg)
  ctx.fillRect(0, 0, S, S)
  const cell = S / 4
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = x * cell + cell / 2
      const cy = y * cell + cell / 2
      const r = cell * 0.3
      // 菱形外框 + 中心小方块
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r, cy)
      ctx.closePath()
      ctx.strokeStyle = rgba((x + y) % 2 ? main : sub, 0.85)
      ctx.lineWidth = S * 0.012
      ctx.stroke()
      ctx.fillStyle = rgba((x + y) % 2 ? sub : main, 0.9)
      const s = cell * 0.08
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s)
    }
  }
}

const MOTIFS = [drawMotifDots, drawMotifSawtooth, drawMotifDiamond]

/* 产品胚体暖白（各程序化模型素体色的均值）：纹样底色向它调和，
 * 避免印花片底色与胚体色相冲突、看起来像"贴了张卡片" */
const BODY_BASE = [235, 228, 214]

function _harmonizeBg(rgb) {
  // 25% 色板倾向 + 75% 胚体暖白：保留一点主题色倾向，同时融入胚体
  const mix = (a, b) => Math.round(a * 0.25 + b * 0.75)
  const c = [mix(rgb[0], BODY_BASE[0]), mix(rgb[1], BODY_BASE[1]), mix(rgb[2], BODY_BASE[2])]
  const luminance = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
  if (luminance < 170) {
    // 调和后仍偏深 → 提亮，保证印花底不发闷
    const f = 1.25
    return [Math.min(255, Math.round(c[0] * f + 30)),
            Math.min(255, Math.round(c[1] * f + 30)),
            Math.min(255, Math.round(c[2] * f + 30))]
  }
  return c
}

function makePatternCanvas(colors, variant) {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const main = hexToRgb(colors[0]?.hex)
  const sub = hexToRgb(colors[1]?.hex, main)
  const bg = _harmonizeBg(hexToRgb(colors[2]?.hex, BODY_BASE))
  MOTIFS[variant % MOTIFS.length](ctx, main, sub, bg, S)
  return canvas
}

/* ---- 各产品印花面规格（与 ProceduralModels.jsx 中印花贴片尺寸一致） ----
 * aspect = 印花面宽/高；size = 从效果图取样的比例；
 * offsetY = 取样窗口相对源图中心的下移量（占源图高比例）：
 *   AI 效果图产品居中，但提手/摄像头等「产品结构」在画面上部。
 * size 取 0.75~0.85：尽量覆盖效果图中完整的产品主体与纹样设计
 * （取样窗口过小会把效果图局部放大，导致贴图内容残缺、图案过大）。 */
const PRINT_SPEC = {
  'tote-bag':      { aspect: 1.95 / 1.98, size: 0.80, offsetY: 0.04 }, // 略下移避开 AI 图中的提手
  mug:             { aspect: 2.0,         size: 0.85 },               // 环绕杯身，宽幅横向取图
  'phone-case':    { aspect: 1.08 / 2.28, size: 0.78, offsetY: 0.03 }, // 略下移避开顶部摄像头开孔
  bookmark:        { aspect: 0.68 / 2.7,  size: 0.75 },
  'fridge-magnet': { aspect: 1,           size: 0.80 },
  cushion:         { aspect: 1,           size: 0.80 },
  default:         { aspect: 1,           size: 0.80 },
}

/**
 * 把【完整产品效果图】处理为【印花贴图】：
 * 效果图包含产品实体+背景+阴影，不能整图直接贴（会在 3D 产品上叠出"第二个产品"）。
 * 这里按该产品印花面的真实长宽比，从效果图中心裁出印花所在区域，
 * 再用匹配比例的椭圆羽化把边缘溶为透明，使印花自然融入产品胚体。
 * 这是"设计内容预览"级近似：无法从单张照片无损还原平面稿，UI 上如实标注偏差可能。
 */
function makeImageCanvas(img, productType) {
  const spec = PRINT_SPEC[productType] || PRINT_SPEC.default
  const { aspect, size, offsetY = 0 } = spec

  // 1. 源图取样窗口：以短边为基准取 size 比例，按印花面长宽比内接，
  //    再按 offsetY 下移避开效果图上部的提手/摄像头等产品结构
  const base = Math.min(img.naturalWidth, img.naturalHeight) * size
  const srcW = aspect >= 1 ? base : base * aspect
  const srcH = aspect >= 1 ? base / aspect : base
  const srcX = (img.naturalWidth - srcW) / 2
  const srcY = (img.naturalHeight - srcH) / 2 + img.naturalHeight * offsetY

  // 2. 画布尺寸按长宽比分配（长边 1024），避免拉伸变形
  const W = aspect >= 1 ? 1024 : Math.round(1024 * aspect)
  const H = aspect >= 1 ? Math.round(1024 / aspect) : 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, W, H)

  // 3. 椭圆羽化蒙版：边缘溶为透明，使印花自然融入产品胚体
  featherEdges(ctx, W, H)

  return canvas
}

/**
 * @param {object} opts
 * @param {'pattern'|'image'} opts.mode
 * @param {Array} opts.colors 提案色板 [{hex}]
 * @param {number} opts.variant 纹样变体 0/1/2
 * @param {string} opts.imageUrl 效果图地址（image 模式）
 * @param {string} opts.productType 产品类型 id（image 模式按印花面比例裁切）
 * @param {[number, number]} opts.repeat 平铺次数 [x, y]
 * @returns {{texture: THREE.Texture|null, loading: boolean}}
 */
export function useProductTexture({ mode, colors = [], variant = 0, imageUrl = '', productType = '', repeat = [1, 1] }) {
  const [imageTexture, setImageTexture] = useState(null)
  const [loading, setLoading] = useState(false)

  // 纹样纹理：同步生成
  const patternTexture = useMemo(() => {
    if (mode !== 'pattern') return null
    const canvas = makePatternCanvas(colors, variant)
    // 单次平铺的产品（袋/壳/书签等）：羽化印花片边缘，使其融入胚体，
    // 消除"贴了张卡片"的硬边；马克杯环绕平铺（repeat 2×1）不羽化，避免接缝色带
    if (repeat[0] === 1 && repeat[1] === 1) {
      featherEdges(canvas.getContext('2d'), canvas.width, canvas.height)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat[0], repeat[1])
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
    // colors 是数组，用稳定的 hex 串作为依赖，避免引用变化重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, variant, repeat[0], repeat[1], colors.map((c) => c?.hex).join('|')])

  // 效果图纹理：异步加载 → 中心裁切 + 圆角羽化遮罩 → CanvasTexture
  useEffect(() => {
    if (mode !== 'image' || !imageUrl) return
    setLoading(true)
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      imageUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        // 把原纹理画到 canvas 做后处理（按印花面比例裁切+羽化），
        // 避免整张效果图（含产品实体/背景）贴上去产生"第二个产品"的堆叠感
        const img = tex.image
        if (img && img.naturalWidth) {
          const canvas = makeImageCanvas(img, productType)
          const processed = new THREE.CanvasTexture(canvas)
          processed.wrapS = processed.wrapT = THREE.ClampToEdgeWrapping
          processed.colorSpace = THREE.SRGBColorSpace
          processed.anisotropy = 4
          tex.dispose() // 释放原始纹理
          setImageTexture(processed)
        } else {
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
          tex.colorSpace = THREE.SRGBColorSpace
          setImageTexture(tex)
        }
        setLoading(false)
      },
      undefined,
      () => {
        if (!cancelled) setLoading(false) // 加载失败保持无贴图状态，由上层提示
      },
    )
    return () => {
      cancelled = true
    }
  }, [mode, imageUrl, productType])

  // 切换/卸载时释放纹理
  useEffect(() => {
    return () => {
      patternTexture?.dispose()
      imageTexture?.dispose()
    }
  }, [patternTexture, imageTexture])

  if (mode === 'image') {
    return { texture: imageTexture, loading }
  }
  return { texture: patternTexture, loading: false }
}
