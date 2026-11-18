/* ============================================================
 * 创作需求表单 StudioForm（受控组件）
 * ------------------------------------------------------------
 * 表单本身不持有状态：所有值通过 value 传入、通过 onChange 回传，
 * 状态由页面组件统一管理（这是 React 推荐的"受控组件"模式，
 * 生成成功/失败后重置表单都很方便）。
 *
 * Props：
 *   form：{ title, theme, createType, style, requirement }
 *   loading：生成中（为 true 时禁用全部输入与按钮）
 *   error：表单校验错误文案（字符串或 null）
 *   onChange(patch)：修改任意字段
 *   onSubmit：点击"生成设计方案"
 * ============================================================ */
import { themes, createTypes, productTypes, styles } from '../../data/studioOptions.js'
import OptionCard from './OptionCard.jsx'
import ReferenceUploader from './ReferenceUploader.jsx'

export default function StudioForm({ form, loading, error, onChange, onSubmit }) {
  return (
    <form
      className="card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault() // 阻止表单默认刷新页面
        onSubmit()
      }}
    >
      {/* 1. 作品标题（必填，保存作品时使用） */}
      <div>
        <label htmlFor="work-title" className="text-sm font-medium text-ink">
          作品标题 <span className="text-cinnabar">*</span>
        </label>
        <input
          id="work-title"
          type="text"
          maxLength={30}
          value={form.title}
          disabled={loading}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="例如：给朋友的生日帆布袋"
          className="mt-2 w-full rounded-xl border border-line bg-paper/60 px-4 py-2.5 text-sm
            text-ink outline-none transition placeholder:text-ink-mute
            focus:border-cinnabar/50 focus:bg-white focus:ring-2 focus:ring-cinnabar/10
            disabled:opacity-60"
        />
        <p className="mt-1.5 text-right text-xs text-ink-mute">{form.title.length}/30</p>
      </div>

      {/* 2. 非遗主题（必选，默认已选中第一项） */}
      <FieldGroup label="非遗主题" required>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {themes.map((t) => (
            <OptionCard
              key={t.id}
              icon={t.icon}
              title={t.name}
              subtitle={t.tagline}
              selected={form.theme === t.id}
              onClick={() => !loading && onChange({ theme: t.id })}
            />
          ))}
        </div>
      </FieldGroup>

      {/* 3. 创作类型（选填，再点一次可取消） */}
      <FieldGroup label="创作类型（选填）" hint="可选择创作类型、具体产品，或直接输入你的创意。选择不同组合，AI 将生成对应的设计方案。">
        <div className="grid grid-cols-2 gap-3">
          {createTypes.map((t) => (
            <OptionCard
              key={t.id}
              title={t.name}
              subtitle={t.hint}
              selected={form.createType === t.id}
              onClick={() => !loading && onChange({ createType: form.createType === t.id ? '' : t.id })}
            />
          ))}
        </div>
      </FieldGroup>

      {/* 3.5 产品类型（选填，再点一次可取消；选择后效果图与 3D 展示会匹配对应载体） */}
      <FieldGroup label="产品类型（选填）" hint="选择后效果图与后续 3D 展示会落到该具体产品；不选则生成纯视觉创作方案">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {productTypes.map((t) => (
            <OptionCard
              key={t.id}
              icon={t.icon}
              title={t.name}
              subtitle={t.hint}
              selected={form.productType === t.id}
              onClick={() => !loading && onChange({ productType: form.productType === t.id ? '' : t.id })}
            />
          ))}
        </div>
      </FieldGroup>

      {/* 4. 视觉风格 */}
      <FieldGroup label="视觉风格" required>
        <div className="grid grid-cols-2 gap-3">
          {styles.map((s) => (
            <OptionCard
              key={s.id}
              title={s.name}
              subtitle={s.hint}
              selected={form.style === s.id}
              onClick={() => !loading && onChange({ style: s.id })}
            />
          ))}
        </div>
      </FieldGroup>

      {/* 5. 参考图上传（选填） */}
      <FieldGroup label="参考图片" hint="上传一张喜欢的产品图或纹样图，作为设计参考（选填）">
        <ReferenceUploader
          value={form.reference ?? null}
          disabled={loading}
          onChange={(reference) => onChange({ reference })}
        />
      </FieldGroup>

      {/* 6. 设计要求（选填，自由文字；字段名沿用 requirement 以兼容已保存作品） */}
      <FieldGroup label="设计要求" hint="描述使用场景、想表达的感觉或具体限制（选填）">
        <textarea
          value={form.requirement}
          maxLength={200}
          rows={3}
          disabled={loading}
          onChange={(e) => onChange({ requirement: e.target.value })}
          placeholder="例如：送给喜欢喝茶的同学，希望画面安静一点，颜色不要太艳"
          className="w-full resize-none rounded-xl border border-line bg-paper/60 px-4 py-3 text-sm
            leading-relaxed text-ink outline-none transition placeholder:text-ink-mute
            focus:border-cinnabar/50 focus:bg-white focus:ring-2 focus:ring-cinnabar/10
            disabled:opacity-60"
        />
        <p className="mt-1.5 text-right text-xs text-ink-mute">{form.requirement.length}/200</p>
      </FieldGroup>

      {/* 校验错误提示 */}
      {error && (
        <p className="mb-3 rounded-xl bg-cinnabar/10 px-4 py-2.5 text-xs text-cinnabar-dark">
          {error}
        </p>
      )}

      {/* 提交按钮：生成中时按钮禁用并显示旋转图标（页面唯一的加载反馈入口） */}
      <button type="submit" disabled={loading} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            正在生成产品效果图…
          </>
        ) : (
          <>生成 3 个产品效果图</>
        )}
      </button>

      <p className="mt-3 text-center text-xs text-ink-mute">
        由狮小灵 AI 驱动生成设计方案
      </p>
    </form>
  )
}

/* 表单分组容器：统一"标题 + 提示 + 内容"的排版（本文件内部组件） */
function FieldGroup({ label, hint, required, children }) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium text-ink">
        {label} {required && <span className="text-cinnabar">*</span>}
      </legend>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}
