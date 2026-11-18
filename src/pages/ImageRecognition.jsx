/* ============================================================
 * AI 图像识别页面 ImageRecognition
 * ------------------------------------------------------------
 * 页面职责（本文件只做"状态编排"，UI 细节在子组件里）：
 *   1. 管理选中的图片与预览地址
 *   2. 前端校验（格式 / 大小）——后端还会再校验一次（双保险）
 *   3. 调用 recognizeService 请求后端
 *   4. 管理四种状态：idle（未识别）/ loading / success / error
 *
 * 学习要点：
 *   - URL.createObjectURL 把文件变成 <img> 可用的临时地址
 *   - useEffect 的清理函数：组件卸载/换图时释放临时地址，防止内存泄漏
 * ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import UploadPanel from '../components/recognize/UploadPanel.jsx'
import ResultPanel from '../components/recognize/ResultPanel.jsx'
import PersonaAvatar from '../components/persona/PersonaAvatar.jsx'
import { checkBackendHealth, recognizeImage } from '../services/recognizeService.js'
import { matchPersona } from '../services/personaService.js'
import { usePersonaPet } from '../context/PersonaPetContext.jsx'
import { InkBand, CloudMotif } from '../components/decor/OrientalDecor.jsx'

// 前端校验规则（与后端 config.py 保持一致）
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 10

export default function ImageRecognition() {
  // --- 图片相关状态 ---
  const [file, setFile] = useState(null) // 用户选中的文件
  const [previewUrl, setPreviewUrl] = useState('') // 本地预览地址
  const [localError, setLocalError] = useState('') // 前端校验错误

  // --- 请求与结果状态 ---
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [resultData, setResultData] = useState(null) // 成功时的 data 部分
  const [resultMode, setResultMode] = useState('mock') // mock | ai
  const [disclaimer, setDisclaimer] = useState('')
  const [apiError, setApiError] = useState('')

  // --- 后端连接状态：checking | online | offline ---
  const [backend, setBackend] = useState({ status: 'checking', mode: null })

  // --- 数字传承人：识别成功后按真实结果唤醒 ---
  const [personaMatch, setPersonaMatch] = useState(null) // {matched, persona, alternatives, reason}
  const [activePersona, setActivePersona] = useState(null)
  const {
    wakeHeritage,
    notifyRecognitionFailed,
    markRecognitionProcessing,
  } = usePersonaPet()

  /* 识别结果里最能代表这张图片的名称，用于桌宠问候语 */
  const recognitionLabel = () =>
    resultData?.candidates?.[0]?.name || resultData?.predictedCategory || ''

  // 页面加载时做一次健康检查
  useEffect(() => {
    checkBackendHealth()
      .then((info) => setBackend({ status: 'online', mode: info.mode }))
      .catch(() => setBackend({ status: 'offline', mode: null }))
  }, [])

  // 预览地址是浏览器分配的临时资源，换图/离开页面时要手动释放
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  /* 选择或拖入文件：先在前端做校验，通过后才设置预览 */
  const handleFileSelect = (rawFile) => {
    setLocalError('')

    // 1. 格式校验（accept 属性只能"建议"，用户仍可能绕过，所以代码再查一次）
    if (!ALLOWED_TYPES.includes(rawFile.type)) {
      setFile(null)
      setPreviewUrl('')
      setLocalError('不支持的图片格式，请选择 JPG / PNG / WebP 格式的图片。')
      return
    }
    // 2. 大小校验
    if (rawFile.size > MAX_SIZE_MB * 1024 * 1024) {
      setFile(null)
      setPreviewUrl('')
      setLocalError(`图片超过了 ${MAX_SIZE_MB}MB，请压缩后再上传。`)
      return
    }

    setFile(rawFile)
    setPreviewUrl(URL.createObjectURL(rawFile))
    // 换新图片时清空上一次的结果
    setStatus('idle')
    setResultData(null)
    setApiError('')
    setPersonaMatch(null)
    setActivePersona(null)
  }

  /* 移除图片，回到初始状态 */
  const handleClear = () => {
    setFile(null)
    setPreviewUrl('')
    setLocalError('')
    setStatus('idle')
    setResultData(null)
    setApiError('')
    setPersonaMatch(null)
    setActivePersona(null)
  }

  /* 调用后端识别接口；成功后按【真实识别结果】匹配数字传承人 */
  const handleRecognize = async () => {
    if (!file) return
    setStatus('loading')
    setApiError('')
    setPersonaMatch(null)
    setActivePersona(null)
    // 识别期间由狮小灵陪着，不出任何专属传承人
    markRecognitionProcessing('我正在辨认这张照片，稍等一下～')
    try {
      const json = await recognizeImage(file)
      setResultData(json.data)
      setResultMode(json.mode)
      setDisclaimer(json.disclaimer)
      setStatus('success')

      // 匹配与识别解耦：匹配失败不影响上方识别结果的展示
      try {
        const m = await matchPersona({
          candidates: json.data?.candidates || [],
          predictedCategory: json.data?.predictedCategory || '',
        })
        setPersonaMatch(m)
        const label = json.data?.candidates?.[0]?.name || json.data?.predictedCategory || ''
        if (m.matched && m.persona) {
          setActivePersona(m.persona)
          // 唯一匹配：狮小灵先介绍，再由对应传承人苏醒接管
          wakeHeritage(m.persona, { recognition: label })
        } else if (m.alternatives?.length > 0) {
          const names = m.alternatives.map((p) => p.name).join('、')
          notifyRecognitionFailed(
            `这张图我拿不太准，可能是${names}其中之一。你在下面点一下更接近的那一项，我再请对应的传承人来给你讲。`,
          )
        } else {
          notifyRecognitionFailed(
            '这张照片我暂时认不出是哪一门非遗。可以换一张主体更完整、更清晰的照片，或者手动选择一位传承人。',
          )
        }
      } catch (e) {
        setPersonaMatch({
          matched: false,
          persona: null,
          alternatives: [],
          reason: e.message || '传承人匹配服务暂不可用，你可以手动选择一位传承人。',
        })
        notifyRecognitionFailed(
          '匹配传承人时出了点小问题。你可以换一张照片再试，或者手动选择一位传承人。',
        )
      }
    } catch (e) {
      setApiError(e.message)
      setStatus('error')
      notifyRecognitionFailed('这次没能看清这张图片，别急，换一张更清晰的我们再试一次。')
    }
  }

  return (
    <div className="relative overflow-x-clip">
      {/* 页面头部：左侧标题说明，右侧竖排「AI 图像识别」签条 */}
      <section className="relative">
        <InkBand className="absolute inset-x-0 top-0 h-52 w-full sm:h-72" />

        <div className="container-page relative py-12 md:py-16">
          <div className="relative max-w-2xl">
            {/* 标题区柔光：让文字从山水中浮出来，边缘不可见 */}
            <div className="pointer-events-none absolute -inset-x-8 -inset-y-8 bg-[radial-gradient(ellipse_at_25%_50%,rgba(251,247,240,0.7)_0%,rgba(251,247,240,0.35)_52%,rgba(251,247,240,0)_80%)]" />
            <div className="relative">
              <p className="eyebrow">AI Recognition</p>
              <h1 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
                AI 图像识别
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                上传一张传统剪纸、刺绣或传统纹样图片，AI 会推测它可能对应的技艺类别、
                描述视觉特征，并给出需要核实的信息与学习建议。
                识别结果仅供参考，不代表官方认定。
              </p>
            </div>
          </div>

          {/* 竖排标签：桌面端显示，纯装饰 */}
          <div className="pointer-events-none absolute right-8 top-10 hidden md:block" aria-hidden="true">
            <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-gold/50 bg-white/60 px-2.5 py-4">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
              <span className="font-serif text-sm tracking-[0.35em] text-gold-dark [writing-mode:vertical-rl]">
                AI 图像识别
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
            </div>
          </div>
        </div>
      </section>

      {/* 主体：一整幅"画卷"承载上传区与结果区，中间以卷轴分隔 */}
      <section className="container-page pb-16 pt-4">
        <div className="relative overflow-hidden rounded-[26px] border border-[#EADFC8] bg-gradient-to-b from-[#FDF8EC]/65 via-[#FDF8EC]/45 to-[#FBF4E4]/35 p-3 sm:p-4">
          {/* 中间卷轴杆 */}
          <div
            className="pointer-events-none absolute bottom-10 left-1/2 top-10 hidden w-[6px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#E9DECB] via-[#D8C8A8] to-[#E9DECB] opacity-50 lg:block"
            aria-hidden="true"
          />
          {/* 卷轴中点的祥云装饰 */}
          <CloudMotif className="pointer-events-none absolute left-1/2 top-1/2 hidden w-20 -translate-x-1/2 -translate-y-1/2 lg:block" />

          <div className="grid items-stretch gap-4 lg:grid-cols-2 lg:gap-8">
            {/* 左列：上传面板 */}
            <UploadPanel
              file={file}
              previewUrl={previewUrl}
              localError={localError}
              backend={backend}
              loading={status === 'loading'}
              onFileSelect={handleFileSelect}
              onClear={handleClear}
              onRecognize={handleRecognize}
            />

            {/* 右列：结果区（四种状态） */}
            <div className="min-w-0">
              {status === 'idle' && <IdleGuide />}
              {status === 'loading' && <LoadingState />}
              {status === 'error' && (
                <div className="h-full rounded-2xl bg-white/40 p-6 sm:p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                      <path d="M12 9v4M12 16.5h.01" />
                    </svg>
                  </div>
                  <h2 className="mt-4 font-serif text-lg font-semibold text-ink">识别失败</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{apiError}</p>
                  <button
                    type="button"
                    onClick={handleRecognize}
                    disabled={!file}
                    className="btn-primary mt-5"
                  >
                    重试
                  </button>
                </div>
              )}
              {status === 'success' && resultData && (
                <ResultPanel
                  data={resultData}
                  mode={resultMode}
                  disclaimer={disclaimer}
                  onReset={handleClear}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 数字传承人：识别成功后唤醒右下角萌宠 ============ */}
      {status === 'success' && personaMatch && (
        <section className="container-page pb-16">
          {activePersona ? (
            <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-white/80 p-4 sm:p-5">
              <PersonaAvatar persona={activePersona} state="happy" size={104} />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Digital Inheritor</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-ink">
                  {activePersona.name} 已苏醒
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {personaMatch.reason}
                  它正在页面右下角等你：可以拖着走、点开聊天、直接提问或用语音聊。
                </p>
              </div>
              <button
                type="button"
                onClick={() => wakeHeritage(activePersona, { recognition: recognitionLabel() })}
                className="btn-secondary shrink-0"
              >
                再和它聊聊
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-line bg-white/70 p-6 text-center sm:p-8">
              <p className="font-serif text-lg text-ink">暂时没有匹配到确定的传承人</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                {personaMatch.reason}
              </p>

              {/* 多个候选：交给用户确认，确认后才唤醒 */}
              {personaMatch.alternatives?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-ink-mute">请确认更接近哪一项：</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {personaMatch.alternatives.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActivePersona(p)
                          wakeHeritage(p, { recognition: recognitionLabel() })
                        }}
                        className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-4 text-sm text-ink-soft transition hover:-translate-y-0.5 hover:border-cinnabar/40 hover:text-cinnabar"
                      >
                        <PersonaAvatar persona={p} state="idle" size={30} />
                        {p.name} · {p.title.replace(' · 数字传承人', '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={handleClear} className="btn-secondary">
                  换一张更清晰的图片
                </button>
                <Link to="/persona" className="btn-primary">
                  手动选择传承人
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 底部青山：整页收束，与页脚宣纸衔接 */}
      <InkBand anchor="bottom" flip className="h-32 w-full sm:h-44" />
    </div>
  )
}

/* 未识别时的引导文案（本文件内部子组件） */
function IdleGuide() {
  const steps = [
    '选择或拖入一张图片（支持 JPG / PNG / WebP）',
    '点击"开始识别"，后端会校验图片并调用模型',
    '查看推测类别、视觉特征与学习建议，注意识别结果仅供参考',
  ]
  return (
    <div className="flex h-full flex-col justify-center rounded-2xl bg-white/35 px-6 py-14 sm:px-10">
      <h2 className="font-serif text-xl font-semibold text-ink">还没有识别任务</h2>
      <p className="mt-2 text-xs leading-relaxed text-ink-mute">
        上传一张图片，按下面的步骤完成第一次识别。
      </p>
      <ul className="mt-6 space-y-3.5 text-left">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cinnabar/10 text-[11px] font-medium text-cinnabar">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ul>

      {/* 识别进度：第一步的起步状态 + STEP 徽标 */}
      <div className="mt-8 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/12 rounded-full bg-gradient-to-r from-celadon to-gold" />
        </div>
        <span className="shrink-0 rounded-full border border-gold/40 px-3 py-1 text-[10px] tracking-[0.16em] text-gold-dark">
          STEP 01
        </span>
      </div>
    </div>
  )
}

/* 识别中的加载状态（本文件内部子组件） */
function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-white/35 px-6 py-20 text-center">
      {/* 旋转圆环 */}
      <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-cinnabar/20 border-t-cinnabar" aria-hidden />
      <h2 className="mt-5 font-serif text-lg font-semibold text-ink">正在识别图片…</h2>
      <p className="mt-2 text-sm text-ink-mute">
        AI 正在分析图像特征，通常需要几秒到十几秒，请稍候。
      </p>
    </div>
  )
}
