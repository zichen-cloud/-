/* ============================================================
 * ModelViewer3D：产品 3D 展示主组件
 * ------------------------------------------------------------
 * 能力：旋转 / 滚轮缩放 / 四个预设视角 / 自动旋转 /
 *      设计纹样与效果图两种贴图切换。
 *
 * 三级展示模式（界面明确标识，绝不混淆）：
 *   ① 真实 GLB 模型（public/models/ 下有对应文件）
 *   ② 程序化 3D 模型（真 3D 网格）
 *   ③ 静态图片预览（WebGL 不可用 / 加载或渲染失败时兜底）
 * ============================================================ */
import { Component, Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Html, useProgress } from '@react-three/drei'
import ProductModel, { getTextureRepeat } from './ProductModel.jsx'
import { GROUND_Y, MODEL_HALF_HEIGHT } from './ProceduralModels.jsx'
import CameraRig from './CameraRig.jsx'
import Static3DFallback from './Static3DFallback.jsx'
import StudioIcon from '../StudioIcons.jsx'
import { getGlbUrl, getShadowScale, getViewPosition, VIEW_BUTTONS } from './modelRegistry.js'
import { useProductTexture } from './useProductTexture.js'
import { isWebGLAvailable } from './detectWebGL.js'

/* ---------------- 3D 渲染错误边界 ----------------
 * 捕获 GLB 加载失败 / WebGL 运行时异常后，【整个查看器】降级为
 * 静态预览（连带隐藏视角、贴图等只对 3D 有意义的控制条）。 */
class ThreeBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    // 保留错误现场，方便在控制台定位（不影响降级展示）
    console.warn('[ModelViewer3D] 3D 渲染异常，已降级为静态预览：', error)
  }

  render() {
    const { error } = this.state
    if (error) {
      const msg = String(error?.message || '')
      const reason = /load|fetch|404|glb|gltf|network|could not|failed/i.test(msg)
        ? 'loaderror'
        : 'error'
      return (
        <Static3DFallback
          reason={reason}
          imageUrl={this.props.imageUrl}
          productName={this.props.productName}
        />
      )
    }
    return this.props.children
  }
}

/* ---------------- GLB / 模型加载指示 ---------------- */
function ModelLoading() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center rounded-2xl bg-white/90 px-6 py-5 shadow-lg">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-cinnabar/25 border-t-cinnabar" />
        <p className="mt-3 whitespace-nowrap text-xs font-medium text-ink-soft">
          3D 模型加载中 {progress ? `${progress.toFixed(0)}%` : '…'}
        </p>
      </div>
    </Html>
  )
}

/* ---------------- 场景内容（灯光 + 模型） ---------------- */
function SceneContent({ productType, glbUrl, texture }) {
  // 阴影盘按产品占地适配：过大的阴影盘会被看成"灰色底座"
  const shadowScale = getShadowScale(productType)
  return (
    <>
      {/* 程序化灯光：不依赖任何远程 HDR，内网/离线也能正常显色 */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#FFFBEF', '#D9CFBB', 0.5]} />
      <directionalLight
        position={[4.5, 6.5, 4]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-5, 2.5, -3.5]} intensity={0.4} color="#CFE0F5" />

      <group>
        <ProductModel productType={productType} glbUrl={glbUrl} texture={texture} />
        {/* 接触阴影，与 GROUND_Y 基线一致，尺寸按产品占地适配 */}
        <ContactShadows position={[0, -1.5, 0]} opacity={0.3} scale={shadowScale} blur={2.6} far={4.2} color="#5B4636" />
      </group>
    </>
  )
}

/* ---------------- 控制条小按钮 ---------------- */
function ToolButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-cinnabar text-white shadow-sm'
          : 'bg-white text-ink-soft hover:bg-cinnabar/10 hover:text-cinnabar-dark'
      }`}
    >
      {children}
    </button>
  )
}

/* ---------------- 主组件 ---------------- */
export default function ModelViewer3D({ productType, productName, proposal }) {
  const [texMode, setTexMode] = useState('pattern') // pattern | image
  const [autoRotate, setAutoRotate] = useState(false)
  const [viewKey, setViewKey] = useState('persp')

  const glbUrl = getGlbUrl(productType)
  const isRealGlb = Boolean(glbUrl)
  const repeat = useMemo(() => getTextureRepeat(productType), [productType])
  const targetPos = useMemo(() => getViewPosition(productType, viewKey), [productType, viewKey])
  // 相机注视点 = 模型中心（模型底部在 GROUND_Y 基线上），避免小件/大件偏离画面中心
  const lookAtY = useMemo(
    () => GROUND_Y + (MODEL_HALF_HEIGHT[productType] ?? 1),
    [productType],
  )
  const variant = Number(String(proposal?.id || 'p1').replace(/\D/g, '')) - 1 || 0

  const { texture, loading: texLoading } = useProductTexture({
    mode: texMode,
    colors: proposal?.colorPalette || [],
    variant,
    imageUrl: proposal?.imageUrl || '',
    productType,
    repeat,
  })

  const webglOk = isWebGLAvailable()

  /* 兜底：静态预览（明确不是 3D） */
  if (!webglOk) {
    return <Static3DFallback reason="nowebgl" imageUrl={proposal?.imageUrl} productName={productName} />
  }

  return (
    <ThreeBoundary
      key={`${productType}-${glbUrl}`}
      imageUrl={proposal?.imageUrl}
      productName={productName}
    >
      <div>
        {/* 3D 画布区 */}
        <div
          className="relative h-[440px] overflow-hidden rounded-2xl border border-line sm:h-[520px]"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 0%, #FBF8F1 0%, #F1EADB 55%, #E8DFCC 100%)',
          }}
        >
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: getViewPosition(productType, 'persp'), fov: 42, near: 0.1, far: 100 }}
            gl={{ antialias: true }}
            onCreated={({ camera, size }) => {
              // 竖屏窄画幅开场适度拉远（上限 1.5，避免产品显得过小）
              if (size.width > 0 && size.width / size.height < 1) {
                camera.position.multiplyScalar(Math.min(1.5, size.height / size.width))
              }
            }}
          >
            <CameraRig targetPos={targetPos} autoRotate={autoRotate} lookAtY={lookAtY} />
            <Suspense fallback={<ModelLoading />}>
              <SceneContent productType={productType} glbUrl={glbUrl} texture={texture} />
            </Suspense>
          </Canvas>

          {/* 左上角：真实模型 / 程序化模型角标 */}
          <span
            className={`pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm ${
              isRealGlb ? 'bg-celadon/90' : 'bg-ink/75'
            }`}
          >
            <StudioIcon name="cube" size={13} />
            {isRealGlb ? '真实 3D 模型 · GLB' : '程序化 3D 模型'}
          </span>

          {/* 右上角：操作提示 */}
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/80 px-3 py-1 text-xs text-ink-mute">
            拖动旋转 · 滚轮缩放
          </span>
        </div>

      {/* 控制条 */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {/* 视角预设 */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper/60 p-1">
          {VIEW_BUTTONS.map((v) => (
            <ToolButton key={v.key} active={viewKey === v.key} onClick={() => setViewKey(v.key)}>
              {v.label}
            </ToolButton>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* 贴图切换 */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-paper/60 p-1">
            <ToolButton active={texMode === 'pattern'} onClick={() => setTexMode('pattern')}>
              纹样贴图
            </ToolButton>
            <ToolButton active={texMode === 'image'} onClick={() => setTexMode('image')}>
              {texMode === 'image' && texLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-cinnabar/30 border-t-cinnabar" />
                  效果图加载
                </span>
              ) : (
                '效果图贴图'
              )}
            </ToolButton>
          </div>

          {/* 自动旋转 */}
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              autoRotate ? 'bg-cinnabar text-white' : 'border border-line bg-white text-ink-soft hover:bg-paper'
            }`}
          >
            <StudioIcon name="refresh" size={14} />
            自动旋转
          </button>
        </div>
      </div>

      {/* 说明 */}
      <p className="mt-3 text-xs leading-relaxed text-ink-mute">
        {isRealGlb
          ? '当前加载的是 public/models/ 中的真实 GLB 模型，已将选中方案的设计纹样替换到模型主体表面。'
          : '当前为程序化生成的基础 3D 模型（真实三维网格，可交互）；把对应产品的 .glb 文件放入 public/models/ 并在 modelRegistry.js 登记后，将自动切换为真实模型。'}
        {texMode === 'image'
          ? ' 「效果图贴图」自动提取方案效果图的中心区域并按印花面比例贴合，属于设计内容预览，可能存在图案偏差。'
          : ' 「纹样贴图」按方案配色程序化生成平铺纹样，是装饰性预览，非设计原图。'}
      </p>
      </div>
    </ThreeBoundary>
  )
}
