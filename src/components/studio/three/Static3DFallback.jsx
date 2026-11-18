/* ============================================================
 * Static3DFallback：3D 不可用时的静态预览
 * ------------------------------------------------------------
 * 使用场景（必须明确标注「非 3D」，不伪装成立体模型）：
 *   - 浏览器不支持 / 未开启 WebGL
 *   - GLB 模型加载失败
 *   - 3D 渲染运行时异常（ErrorBoundary 捕获）
 * ============================================================ */
import StudioIcon from '../StudioIcons.jsx'

export default function Static3DFallback({ imageUrl, reason = 'error', productName = '产品' }) {
  const reasonText = {
    nowebgl: '当前浏览器未开启 WebGL，无法显示 3D 模型',
    error: '3D 渲染出现异常，已切换为静态预览',
    loaderror: '3D 模型文件加载失败，已切换为静态预览',
  }[reason]

  return (
    <div className="flex h-full flex-col">
      {/* 静态图片区 */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-paper">
        {imageUrl ? (
          <img src={imageUrl} alt={`${productName}静态预览图`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center text-ink-mute">
            <StudioIcon name="cube" size={36} />
            <span className="mt-2 text-xs">暂无效果图</span>
          </div>
        )}
        {/* 明确标识：这是静态图，不是 3D */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-xs font-medium text-white">
          <StudioIcon name="image" size={13} />
          静态预览（非 3D）
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50/80 px-4 py-3">
        <StudioIcon name="image" size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="text-xs leading-relaxed text-amber-800">
          <p className="font-medium">{reasonText}</p>
          <p className="mt-1">
            这里展示的是{productName}的平面效果图，不能旋转或缩放；更换支持 WebGL 的浏览器后可查看真实 3D 效果。
          </p>
        </div>
      </div>
    </div>
  )
}
