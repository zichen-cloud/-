/* ============================================================
 * 参考图上传 ReferenceUploader（受控组件）
 * ------------------------------------------------------------
 * 只负责：选图 → 前端预校验 → 调后端上传 → 展示缩略图 / 删除。
 * 真正的图片安全校验在后端（类型白名单 + PIL 结构校验 + 重编码）。
 *
 * Props：
 *   value：{ id, url, name } | null
 *   disabled：生成中禁用
 *   error：外部传入的错误文案（暂未使用，预留）
 *   onChange(reference | null)
 * ============================================================ */
import { useRef, useState } from 'react'
import StudioIcon from './StudioIcons.jsx'
import { uploadReferenceImage } from '../../services/studioService.js'

const MAX_MB = 10
const ACCEPT = 'image/png,image/jpeg,image/webp'

export default function ReferenceUploader({ value, disabled, onChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handlePick = () => {
    if (!disabled && !uploading) inputRef.current?.click()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    // 允许重复选择同一文件（清空 input 的值，否则删图后再选同名文件不触发 change）
    e.target.value = ''
    if (!file) return

    // 前端预校验（后端还会再校验一次，这里只是更早给出提示）
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG / PNG / WebP 图片')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`图片不能超过 ${MAX_MB}MB`)
      return
    }

    setError('')
    setUploading(true)
    try {
      const info = await uploadReferenceImage(file)
      onChange({ id: info.id, url: info.url, name: file.name })
    } catch (err) {
      setError(err.message || '上传失败，请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  /* 已上传：展示缩略图 + 移除按钮 */
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 p-3">
        <img
          src={value.url}
          alt={value.name || '参考图'}
          className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{value.name || '已上传参考图'}</p>
          <p className="mt-0.5 text-xs text-ink-mute">将作为产品设计的视觉参考</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-mute transition hover:bg-cinnabar/10 hover:text-cinnabar disabled:opacity-50"
          aria-label="移除参考图"
        >
          <StudioIcon name="trash" size={15} />
        </button>
      </div>
    )
  }

  /* 未上传：虚线上传区 */
  return (
    <div>
      <button
        type="button"
        onClick={handlePick}
        disabled={disabled || uploading}
        className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper/40 px-4 py-6 text-center transition hover:border-cinnabar/40 hover:bg-paper/70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cinnabar/10 text-cinnabar">
          {uploading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cinnabar/30 border-t-cinnabar" />
          ) : (
            <StudioIcon name="upload" size={18} />
          )}
        </span>
        <span className="mt-2.5 text-sm font-medium text-ink">
          {uploading ? '正在上传参考图…' : '点击上传参考图（选填）'}
        </span>
        <span className="mt-1 text-xs text-ink-mute">JPG / PNG / WebP，不超过 {MAX_MB}MB</span>
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFile} />
      {error && <p className="mt-2 text-xs text-cinnabar">{error}</p>}
    </div>
  )
}
