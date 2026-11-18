/* ============================================================
 * 文创工作台 CreativeStudio（阶段一：效果图 + 阶段二：3D 展示 + 阶段三：介绍视频）
 * ------------------------------------------------------------
 * 完整路线（分阶段建设）：
 *   ① 选择主题/产品/风格 → 生成 3 个产品效果图提案 → 选择方案
 *   ② 进入 3D 展示（旋转/缩放/视角/贴花纹样）
 *   ③ 生成产品介绍视频（10-15 秒短片，FFmpeg 本地合成）
 *   ④ 保存作品到"我的作品"
 *
 * 页面只做"状态编排"，UI 拆到 components/studio/ 下：
 *   status = 'idle' | 'loading' | 'success' | 'error'
 *   stage  = 'proposals' | 'viewer3d' | 'video'（仅 success 下有效）
 * ============================================================ */
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import StudioForm from '../components/studio/StudioForm.jsx'
import GeneratingState from '../components/studio/GeneratingState.jsx'
import WorkbenchSteps from '../components/studio/WorkbenchSteps.jsx'
import ProposalGallery from '../components/studio/ProposalGallery.jsx'
import FusionStudio from '../components/studio/FusionStudio.jsx'
import StudioIcon from '../components/studio/StudioIcons.jsx'
import VideoPanel from '../components/studio/VideoPanel.jsx'
import { proposalSteps, getThemeById, getCreateTypeById, getProductTypeById, getStyleById, getThemeForHeritage } from '../data/studioOptions.js'
import { generateProposals, saveWork, listWorks } from '../services/studioService.js'
import { validateDisplayName } from '../utils/naming.js'
import { InkBand } from '../components/decor/OrientalDecor.jsx'

/* 3D 依赖较重（three.js），懒加载为独立 chunk，不拖慢首屏 */
const ModelViewer3D = lazy(() => import('../components/studio/three/ModelViewer3D.jsx'))

/* 表单初始值：主题/风格默认选中第一项降低上手门槛；
   创作类型与产品类型为【选填】（空串 = 不选），用户可自由组合或直接输入创意 */
const initialForm = {
  title: '',
  theme: 'paper-cutting',
  createType: '',
  productType: '',
  style: 'minimal',
  requirement: '',
  reference: null, // { id, url, name }
}

export default function CreativeStudio() {
  /* 创作模式：single 单一非遗（原有链路）/ fusion 多非遗跨界融合 */
  const [mode, setMode] = useState('single')
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [formError, setFormError] = useState('')
  const [apiError, setApiError] = useState('')
  const [currentStep, setCurrentStep] = useState(0) // 生成中分步进度
  const [result, setResult] = useState(null) // 提案接口返回
  const [selectedId, setSelectedId] = useState('') // 选中的提案 id
  const [stage, setStage] = useState('proposals') // proposals | viewer3d | video
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false) // 保存请求进行中
  const [saveError, setSaveError] = useState('') // 保存失败的后端中文提示
  const [saveSource, setSaveSource] = useState('') // 'server' | 'local'，用于提示数据落点
  // 已保存作品的服务端身份；提案/3D/视频各阶段重复保存时带上 id+createdAt 走覆盖更新
  const savedWorkRef = useRef(null)

  /* 深链预填（两个入口，remake 优先）：
     1) 作品页/展厅「再次创作」→ navigate('/studio', { state: { remake: work } })，
        完整回填 title/theme/createType/productType/style/requirement
     2) 知识馆详情页「使用该非遗元素创作」→ /studio?theme=<项目id>，
        映射为工坊主题后预选
     注意：预填失败时保持默认表单，不打断正常使用。 */
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  useEffect(() => {
    const remake = location.state?.remake
    if (remake && typeof remake === 'object') {
      setForm((prev) => ({
        ...prev,
        title: remake.title || '',
        theme: getThemeById(remake.theme) ? remake.theme : prev.theme,
        createType: getCreateTypeById(remake.createType) ? remake.createType : prev.createType,
        productType: getProductTypeById(remake.productType) ? remake.productType : prev.productType,
        style: getStyleById(remake.style) ? remake.style : prev.style,
        requirement: remake.requirement || '',
      }))
      // 用掉 state，避免用户点浏览器"后退再前进"时重复回填
      window.history.replaceState({}, '')
      return
    }
    const heritageId = searchParams.get('theme')
    if (!heritageId) return
    const themeId = getThemeForHeritage(heritageId)
    if (themeId) {
      setForm((prev) => ({ ...prev, theme: themeId }))
    }
    // 用完即清，避免刷新页面重复预填、也避免参数残留在分享链接里
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 局部更新表单字段 */
  const handleChange = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    if (formError) setFormError('')
  }

  /* 生成中：推进分步进度；最后一步保持高亮直到请求结束 */
  useEffect(() => {
    if (status !== 'loading') return
    setCurrentStep(0)
    const timer = setInterval(() => {
      setCurrentStep((s) => Math.min(s + 1, proposalSteps.length - 1))
    }, 600)
    return () => clearInterval(timer)
  }, [status])

  /* 提交：校验 → 调用后端生成 3 个提案 */
  const handleSubmit = async () => {
    // 作品标题会作为商品名展示在「我的作品」中，必须是完整名称（不接受「123」这类随意命名）
    const titleError = validateDisplayName(form.title, {
      label: '作品标题',
      min: 2,
      max: 30,
      example: '剪韵青花茶盏',
    })
    if (titleError) {
      setFormError(titleError)
      return
    }
    // 创作类型 / 产品类型为选填：选了则约束方案载体，不选则由主题+创意驱动。
    // 主题与风格仍为必选（选项卡默认已选中，正常不会走到这个分支）。
    if (!form.theme || !form.style) {
      setFormError('请至少选择非遗主题与视觉风格，或填写你的创意描述。')
      return
    }

    setStatus('loading')
    setFormError('')
    setApiError('')
    setSaved(false)
    setSaveError('')
    setSaveSource('')
    savedWorkRef.current = null
    setSelectedId('')
    setStage('proposals')

    try {
      const data = await generateProposals(form)
      setResult(data)
      setStatus('success')
    } catch (e) {
      setApiError(e.message)
      setStatus('error')
    }
  }

  /* 保存当前选中的提案到「我的作品」（阶段五：优先后端持久化，失败降级本机）。
   * videoInfo 由 VideoPanel 完成页传入（videoUrl/duration/hasAudio/voiceName/speedName），
   * 提案列表与 3D 页无参调用时不覆盖视频字段。 */
  const handleSave = async (videoInfo = null) => {
    if (!result || saving) return
    const selected = result.proposals.find((p) => p.id === selectedId)
    if (!selected) return
    const payload = {
      title: form.title.trim(),
      theme: form.theme,
      themeName: getThemeById(form.theme)?.name ?? '',
      createType: form.createType,
      createTypeName: getCreateTypeById(form.createType)?.name ?? '',
      productType: form.productType,
      productTypeName: getProductTypeById(form.productType)?.name ?? '',
      style: form.style,
      styleName: getStyleById(form.style)?.name ?? '',
      requirement: form.requirement.trim(),
      // 提案内容
      promptSummary: result.promptSummary,
      designBrief: selected.concept,
      result: selected,
      imageUrl: selected.imageUrl,
      proposalTitle: selected.proposalTitle,
      mode: result.mode,
      imageMode: result.imageMode,
    }
    // 视频阶段保存：补齐成片信息；同一件作品跨阶段保存时覆盖更新而不是新建
    if (videoInfo && videoInfo.videoUrl) {
      Object.assign(payload, {
        videoUrl: videoInfo.videoUrl,
        duration: videoInfo.duration || 0,
        hasAudio: Boolean(videoInfo.hasAudio),
        voiceName: videoInfo.voiceName || '',
        speedName: videoInfo.speedName || '',
      })
    }
    if (savedWorkRef.current) {
      payload.id = savedWorkRef.current.id
      payload.createdAt = savedWorkRef.current.createdAt
    }

    setSaving(true)
    setSaveError('')
    try {
      const { work, source } = await saveWork(payload)
      savedWorkRef.current = { id: work.id, createdAt: work.createdAt }
      setSaved(true)
      setSaveSource(source)
    } catch (e) {
      // 业务错误（如空标题）显示后端中文提示，不标记为已保存
      setSaveError(e.message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  /* 重新生成：保留表单内容 */
  const handleRegenerate = () => {
    setStatus('idle')
    setResult(null)
    setSelectedId('')
    setStage('proposals')
    setSaved(false)
    setSaveError('')
    setSaveSource('')
    savedWorkRef.current = null
  }

  /* 进入 3D 展示前必须已选中方案，且选择了具体产品类型（纯视觉创作无 3D 形态） */
  const handleEnter3D = () => {
    if (!selectedId || !form.productType) return
    setStage('viewer3d')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* 进入视频阶段 */
  const handleEnterVideo = () => {
    if (!selectedId) return
    setStage('video')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* 跨文化融合方案 → 接入原有 3D / 视频链路
   * 把融合方案映射为工坊提案的字段结构（标题/理念/配色/效果图），
   * 这样 3D 贴图与视频分镜复用的是同一份数据，不需要新的渲染分支。 */
  const handleFusionTo3D = (p, meta = {}) => {
    const proposal = {
      id: `fusion-${Date.now()}`,
      title: p.proposalTitle,
      concept: p.concept,
      colorPalette: p.colorPalette || [],
      imageUrl: p.imageUrl || '',
      // elements 必须是字符串：后端 NarrationRequest / VideoRequest 的该字段为 str，
      // 传数组会被 Pydantic 拒绝（422），导致跨界融合旁白/视频生成失败
      elements: [...(p.fromA || []), ...(p.fromB || []), ...(p.fromC || [])].join('；'),
      designBrief: p.how || '',
    }
    setForm((prev) => ({
      ...prev,
      title: p.proposalTitle || prev.title,
      productType: meta.productType || prev.productType,
      style: getStyleById(meta.styleId) ? meta.styleId : prev.style,
    }))
    setResult({
      proposals: [proposal],
      mode: 'fusion',
      imageMode: p.mode || '',
      imageModel: '',
      disclaimer: '融合方案由 AI 生成，用于设计参考；非遗史实请以权威名录为准。',
    })
    setSelectedId(proposal.id)
    setSaved(false)
    setSaveError('')
    savedWorkRef.current = null
    setMode('single')
    setStatus('success')
    setStage('viewer3d')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="relative overflow-x-clip">
      {/* 页面头部：左侧标题说明，右上角一幅山水长卷（半展开卷轴 + 朱砂印） */}
      <section className="relative overflow-hidden">
        {/* 插画压在右上角：卷轴自右展开，青绿山水从卷面延伸而出，左缘化开融入宣纸 */}
        <img
          src="/images/decor/workbench-scroll-2.jpg"
          alt=""
          draggable="false"
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-[86%] select-none object-cover object-right opacity-90 mix-blend-multiply md:block"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 26%, #000 54%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 26%, #000 54%)',
          }}
        />

        <div className="container-page relative py-12 md:py-16">

          <p className="eyebrow">Creative Workbench</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
            AI 非遗文创工作台
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            完整创作流：选择非遗主题 → AI 生成 3 套效果图提案 → 选定方案进入 3D 展示 → 制作含 AI
            配音的介绍视频 → 保存到「我的作品」。也可以从知识馆详情页带着某个非遗元素直接进来。
            生成的是数字设计参考，与传统工艺实物有本质区别。
          </p>

          {/* 创作模式切换：单一非遗 / 跨界融合 */}
          <div className="mt-6 inline-flex rounded-full border border-line bg-white/80 p-1">
            {[
              { key: 'single', label: '单一非遗创作' },
              { key: 'fusion', label: '跨界融合创作' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition sm:text-sm ${
                  mode === m.key ? 'bg-cinnabar text-white shadow-sm' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {mode === 'fusion' && (
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ink-mute">
              跨界融合：选择 2-3 项非遗，AI 会先拆解各自的文化要素，再给出明确标注元素来源的融合方案。
              融合比例控制主次关系，而不是简单叠加图案。
            </p>
          )}

        </div>
      </section>

      <section className="container-page pb-14 pt-6">
        {mode === 'fusion' ? (
          <FusionStudio onEnter3D={handleFusionTo3D} />
        ) : (
        <>
        {/* 三步流程指示：随 stage 推进（仅单一创作模式） */}
        <div className="relative mb-10 mt-2 overflow-hidden rounded-3xl border border-[#E9DEC6] bg-[#FBF5E7]/60 px-4 pb-12 pt-7 sm:px-6 md:pt-9">
          <WorkbenchSteps
            current={stage === 'video' ? 3 : stage === 'viewer3d' ? 2 : 1}
            finished={stage === 'video' ? 2 : stage === 'viewer3d' ? 1 : 0}
          />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* 左列：表单（电脑端 sticky 跟随滚动） */}
          <div className="lg:sticky lg:top-20">
            <StudioForm
              form={form}
              loading={status === 'loading'}
              error={formError}
              onChange={handleChange}
              onSubmit={handleSubmit}
            />
          </div>

          {/* 右列：结果区（四种状态） */}
          <div>
            {status === 'idle' && <IdleGuide />}

            {status === 'loading' && (
              <GeneratingState
                currentStep={currentStep}
                steps={proposalSteps}
                title="狮小灵正在设计产品效果图"
                note="正在生成 3 套提案文案并渲染效果图，真实模式约需 10-20 秒"
              />
            )}

            {status === 'error' && (
              <div className="card p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
                  <StudioIcon name="sparkle" size={22} />
                </div>
                <h2 className="mt-4 font-serif text-lg font-semibold text-ink">生成失败</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{apiError}</p>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={handleSubmit} className="btn-primary">
                    重试
                  </button>
                  <button type="button" onClick={handleRegenerate} className="btn-ghost">
                    返回修改
                  </button>
                </div>
              </div>
            )}

            {status === 'success' && result && (
              <>
                {/* 保存反馈条：失败显示后端中文原因；成功提示数据实际保存位置 */}
                {saveError && (
                  <p className="mb-4 rounded-xl bg-cinnabar/10 px-4 py-3 text-sm text-cinnabar">
                    作品保存失败：{saveError}
                  </p>
                )}
                {!saveError && saved && (
                  /* 保存成功卡（第六步：保存作品 → 继续创作） */
                  <div className="mb-4 rounded-2xl border border-celadon/40 bg-celadon/5 p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-celadon text-white">
                        <StudioIcon name="check" size={18} strokeWidth={2.6} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">作品已保存到「我的作品」</p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                          {saveSource === 'local'
                            ? '当前仅保存在本机浏览器，连上服务后会自动迁移。'
                            : '已保存在服务器，刷新与重启后仍可查看。'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            to="/works"
                            className="rounded-full border border-celadon/50 bg-white px-4 py-1.5 text-xs font-medium text-celadon-dark transition hover:border-celadon hover:bg-celadon/10"
                          >
                            查看我的作品 →
                          </Link>
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            className="rounded-full border border-line bg-white px-4 py-1.5 text-xs text-ink-soft transition hover:border-cinnabar/40 hover:text-cinnabar"
                          >
                            再生成一套方案
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === 'success' && result && stage === 'proposals' && (
              <ProposalGallery
                proposals={result.proposals}
                mode={result.mode}
                imageMode={result.imageMode}
                imageModel={result.imageModel}
                disclaimer={result.disclaimer}
                selectedId={selectedId}
                productType={form.productType}
                onSelect={setSelectedId}
                saved={saved}
                saving={saving}
                onSave={handleSave}
                onRegenerate={handleRegenerate}
                onEnter3D={handleEnter3D}
              />
            )}

            {status === 'success' && result && stage === 'viewer3d' && (
              <Viewer3DPanel
                form={form}
                proposal={result.proposals.find((p) => p.id === selectedId)}
                imageMode={result.imageMode}
                saved={saved}
                saving={saving}
                onBack={() => setStage('proposals')}
                onSave={handleSave}
                onEnterVideo={handleEnterVideo}
              />
            )}

            {status === 'success' && result && stage === 'video' && (
              <VideoPanel
                form={form}
                proposal={result.proposals.find((p) => p.id === selectedId)}
                saved={saved}
                saving={saving}
                onBack={() => setStage('viewer3d')}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
        </>
        )}
      </section>

      {/* 底部作品预览：最近 5 件作品横排，空位显示待生成占位 */}
      <section className="container-page pb-10">
        <WorkPreviewStrip />
      </section>

      {/* 底部水墨山水：横向长卷收束整页，与页脚宣纸衔接 */}
      <InkBand anchor="bottom" flip className="h-36 w-full sm:h-52" />
    </div>
  )
}

/* 初始引导（本文件内部组件） */
function IdleGuide() {
  const tips = [
    { icon: 'bag', text: '选定具体产品：帆布袋、马克杯、手机壳、书签等 6 类载体' },
    { icon: 'image', text: '一次获得 3 个提案：效果图、标题、设计理念与非遗元素说明' },
    { icon: 'upload', text: '可上传一张参考图，让设计方向更贴近你的想法（选填）' },
  ]
  return (
    <div className="card flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
        <StudioIcon name="image" size={26} />
      </div>
      <h2 className="mt-5 font-serif text-lg font-semibold text-ink">第一步：生成产品效果图</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-mute">
        在左侧填好标题、主题、产品与风格，点击"生成 3 个产品效果图"。
      </p>
      <ul className="mt-6 w-full max-w-sm space-y-3 text-left">
        {tips.map((tip) => (
          <li key={tip.text} className="flex items-center gap-3 rounded-xl bg-paper/70 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-cinnabar shadow-sm">
              <StudioIcon name={tip.icon} size={16} />
            </span>
            <span className="text-xs leading-relaxed text-ink-soft">{tip.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-xs text-xs leading-relaxed text-ink-mute">
        当前图片服务为演示模式：效果图带明显"演示图"水印，并非真实生成；接通通义万相后自动替换为真实图片。
      </p>
    </div>
  )
}

/* 3D 展示面板（第二步）：本文件内部组件，ModelViewer3D 懒加载 */
function Viewer3DPanel({ form, proposal, imageMode, saved, saving, onBack, onSave, onEnterVideo }) {
  const productName = getProductTypeById(form.productType)?.name ?? '产品'
  const isDemo = imageMode !== 'real'

  return (
    <div className="space-y-4">
      {/* 顶部：返回 + 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="btn-ghost inline-flex items-center gap-1.5">
          <StudioIcon name="arrowRight" size={14} className="rotate-180" />
          返回提案列表
        </button>
        <h2 className="font-serif text-lg font-semibold text-ink">第二步：3D 展示</h2>
      </div>

      {/* 选中方案摘要 */}
      <div className="card flex items-center gap-4 p-3.5 sm:p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-paper">
          <img src={proposal.imageUrl} alt={proposal.proposalTitle} className="h-full w-full object-cover" />
          {isDemo && (
            <span className="absolute bottom-0 left-0 right-0 bg-amber-600/90 py-0.5 text-center text-[10px] font-medium text-white">
              演示图
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-semibold text-ink">{proposal.proposalTitle}</p>
          <p className="mt-1 text-xs text-ink-mute">
            产品载体：{productName} · 支持「纹样贴图 / 效果图贴图」两种模式，纹样按方案配色生成
          </p>
        </div>
      </div>

      {/* 真正的 3D 查看器（懒加载 chunk 期间显示等高占位） */}
      <Suspense
        fallback={
          <div className="flex h-[440px] flex-col items-center justify-center rounded-2xl border border-line bg-paper/60 sm:h-[520px]">
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-cinnabar/25 border-t-cinnabar" />
            <p className="mt-4 text-sm text-ink-mute">正在载入 3D 引擎（three.js）…</p>
          </div>
        }
      >
        <ModelViewer3D productType={form.productType} productName={productName} proposal={proposal} />
      </Suspense>

      {/* 下一步操作 */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <button type="button" onClick={onSave} disabled={saved || saving} className="btn-primary disabled:opacity-60">
          <StudioIcon name="save" size={15} />
          {saving ? '保存中…' : saved ? '已保存到我的作品' : '保存作品'}
        </button>

        {/* 阶段三入口：进入介绍视频 */}
        <button
          type="button"
          onClick={onEnterVideo}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <StudioIcon name="video" size={15} />
          生成产品介绍视频
        </button>
      </div>
    </div>
  )
}

/* 底部作品预览条：最近 5 件作品横排；不足 5 件时用"待生成"占位补齐 */
function WorkPreviewStrip() {
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listWorks()
      .then(({ works: list }) => {
        if (cancelled) return
        const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setWorks(sorted.slice(0, 5))
      })
      .catch(() => {
        // 读取失败时按空列表处理，页面主体不受影响
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const slots = [...works, ...Array(Math.max(0, 5 - works.length)).fill(null)]

  return (
    <div className="rounded-3xl border border-[#E9DEC6] bg-[#FBF4E4]/70 p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Work Preview</p>
          <h2 className="mt-1.5 font-serif text-xl font-semibold text-ink">最近作品</h2>
        </div>
        <Link to="/works" className="shrink-0 text-xs text-ink-soft transition hover:text-cinnabar">
          查看全部 →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="h-36 animate-pulse rounded-xl border border-[#E4D8BE] bg-white/60" />
            ))
          : slots.map((w, i) =>
              w ? (
                <Link
                  key={w.id}
                  to="/works"
                  className="group overflow-hidden rounded-xl border border-[#E4D8BE] bg-white transition hover:-translate-y-0.5 hover:border-gold/50"
                >
                  <p className="px-3 pb-1 pt-2 text-[11px] text-ink-mute">作品预览</p>
                  <div className="mx-3 aspect-[4/3] overflow-hidden rounded-lg bg-paper">
                    {w.imageUrl ? (
                      <img
                        src={w.imageUrl}
                        alt={w.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[11px] text-ink-mute">暂无效果图</div>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-xs font-medium text-ink">{w.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-mute">
                      {[w.themeName, w.styleName].filter(Boolean).join(' · ') || '数字文创方案'}
                    </p>
                  </div>
                </Link>
              ) : (
                <div key={`empty-${i}`} className="rounded-xl border border-dashed border-[#DCCDAE] bg-white/50">
                  <p className="px-3 pb-1 pt-2 text-[11px] text-ink-mute">作品预览</p>
                  <div className="mx-3 flex aspect-[4/3] items-center justify-center rounded-lg bg-paper/60 text-[11px] text-ink-mute">
                    待生成
                  </div>
                  <p className="px-3 py-2 text-[11px] leading-tight text-ink-mute">完成创作后显示于此</p>
                </div>
              ),
            )}
      </div>
    </div>
  )
}

