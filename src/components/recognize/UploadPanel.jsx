/* ============================================================
 * 上传面板 UploadPanel（可复用组件）
 * ------------------------------------------------------------
 * 功能：点击选择图片 / 拖拽图片 / 大图预览 / 前端校验提示 /
 *       后端连接状态指示 / 开始识别按钮
 *
 * Props：
 *   file / previewUrl：当前选中的文件与预览地址
 *   localError：前端校验的错误提示（格式、大小不对时）
 *   backend：{ status: 'checking'|'online'|'offline', mode }
 *   loading：是否正在识别中
 *   onFileSelect(file)：选中/拖入文件时回调（校验逻辑在页面组件里）
 *   onClear：移除图片
 *   onRecognize：点击"开始识别"
 * ============================================================ */
import { Link } from 'react-router-dom'

// 前端校验规则（与后端保持一致，属于"第一道检查"，后端还会再校验一次）
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 10

export default function UploadPanel({
  file,
  previewUrl,
  localError,
  backend,
  loading,
  onFileSelect,
  onClear,
  onRecognize,
}) {
  return (
    <div className="h-full rounded-2xl bg-white/40 p-5 sm:p-7">
      <h2 className="font-serif text-lg font-semibold">上传图片</h2>

      {/* 后端连接状态指示条 */}
      <BackendStatus backend={backend} />

      {/* 上传区 / 预览区（二选一显示） */}
      {file ? (
        <div className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-paper">
            <img
              src={previewUrl}
              alt="待识别的图片预览"
              className="max-h-80 w-full object-contain"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-mute">
            <span className="truncate">{file.name}</span>
            <span className="shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={onClear} className="btn-ghost flex-1" disabled={loading}>
              移除图片
            </button>
            <button
              type="button"
              onClick={onRecognize}
              disabled={loading}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '识别中…' : '开始识别'}
            </button>
          </div>
        </div>
      ) : (
        // label 包裹 input：点击整块区域即可打开文件选择框
        <label
          className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line
            bg-paper/50 px-6 py-12 text-center transition hover:border-cinnabar/40 hover:bg-cinnabar/5"
          onDragOver={(e) => e.preventDefault()} // 必须阻止默认行为，drop 事件才会触发
          onDrop={(e) => {
            e.preventDefault()
            const dropped = e.dataTransfer.files?.[0]
            if (dropped) onFileSelect(dropped)
          }}
        >
          <input
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              if (picked) onFileSelect(picked)
              e.target.value = '' // 允许重复选择同一张图片
            }}
          />
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
            {/* 上传图标 */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M12 4 7 9M12 4l5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
          </span>
          <p className="mt-4 text-sm font-medium text-ink">点击选择图片，或拖拽到此处</p>
          <p className="mt-2 text-xs text-ink-mute">
            支持 JPG / PNG / WebP，不超过 {MAX_SIZE_MB}MB
          </p>
        </label>
      )}

      {/* 前端校验错误提示 */}
      {localError && (
        <p className="mt-3 rounded-xl bg-cinnabar/10 px-4 py-2.5 text-xs leading-relaxed text-cinnabar-dark">
          {localError}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-mute">
        识别结果由 AI 推测生成，仅供参考，不代表任何官方认定。
        想了解确定性的非遗知识，可前往
        <Link to="/heritage" className="mx-1 font-medium text-cinnabar hover:underline">
          探索非遗
        </Link>
        查阅。
      </p>
    </div>
  )
}

/* 后端连接状态小条（本文件内部子组件） */
function BackendStatus({ backend }) {
  const config = {
    checking: { dot: 'bg-gold', text: '正在连接后端服务…' },
    online: {
      dot: 'bg-celadon',
      text: `后端已连接 · ${
        backend.mode === 'ai' ? '真实 AI 模式' : '演示模式（mock）'
      }`,
    },
    offline: {
      dot: 'bg-cinnabar',
      text: '后端未启动，无法识别。请在 backend 目录运行 uvicorn（见 README/交付说明）',
    },
  }[backend.status]

  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-ink-mute">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} aria-hidden />
      <span>{config.text}</span>
    </div>
  )
}
