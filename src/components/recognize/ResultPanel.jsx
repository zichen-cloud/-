/* ============================================================
 * 识别结果面板 ResultPanel（可复用组件）
 * ------------------------------------------------------------
 * 展示后端返回的结构化数据（两层结构）：
 *   第一层 观察：图片主要内容 + 视觉特征 + 无法确认的信息
 *   第二层 判断：候选非遗（可多个，由用户点选确认）+ RAG 知识库核验来源
 *
 * 用户确认原则：
 *   识别结果未经确认不得成为后续创作的权威事实——
 *   「使用该元素创作」只在用户选中某个候选后，才把对应非遗主题带进工坊；
 *   证据不足（uncertain）或与非遗无关（not_heritage）时，不提供主题预选。
 *
 * Props：
 *   data：接口返回的 data 对象（见 backend/schemas.py 的 RecognitionData）
 *   mode：'mock' | 'ai'
 *   disclaimer：免责声明文案（后端返回，前端原样展示）
 *   onReset：点击"重新识别"清空结果
 * ============================================================ */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllItems } from '../../data/heritageService.js'

/* 识别状态徽章文案与配色 */
const STATUS_META = {
  ok: { label: '给出候选', cls: 'bg-celadon/10 text-celadon' },
  uncertain: { label: '证据不足', cls: 'bg-amber-100 text-amber-800' },
  not_heritage: { label: '可能与非遗无关', cls: 'bg-ink/10 text-ink-soft' },
}

/**
 * 把候选名称/类别与本地知识馆数据做简单匹配。
 * 这是纯前端的关键词匹配（兜底），优先展示后端 RAG 核验来源。
 */
function matchHeritage(predictedText) {
  const tokens = String(predictedText)
    .split(/[·、，,/\s]+/)
    .filter((t) => t.length >= 2)
  return getAllItems().filter((item) =>
    tokens.some(
      (t) =>
        item.name.includes(t) ||
        item.category.includes(t) ||
        (item.tags ?? []).some((tag) => tag.includes(t)),
    ),
  )
}

export default function ResultPanel({ data, mode, disclaimer, onReset }) {
  const candidates = data.candidates ?? []
  const ragSources = data.ragSources ?? []
  const hasCandidates = candidates.length > 0

  /* 用户确认：默认选中第一个候选；uncertain / not_heritage 时无可选 */
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = hasCandidates ? candidates[Math.min(selectedIdx, candidates.length - 1)] : null

  /* 选中候选 → 知识馆项目匹配（优先后端 RAG 来源，前端关键词匹配兜底） */
  const related = useMemo(() => {
    if (!selected) return []
    const ragHit = ragSources.find((s) => s.id && s.title.includes(selected.name))
    const frontHits = matchHeritage(`${selected.name} ${selected.category}`)
    if (ragHit) {
      const rest = frontHits.filter((h) => h.id !== ragHit.id)
      return [{ id: ragHit.id, name: selected.name }, ...rest]
    }
    return frontHits
  }, [selected, ragSources])

  /* 「接下来，你可以」行动数据：
     有已确认候选时三步（详情→导师→创作），否则两步（导师→创作，不带主题预选）。 */
  const chatQuery = selected
    ? `我上传了一张图片，AI 推测可能是「${selected.name}」，请介绍相关的非遗知识`
    : `我上传了一张图片，AI 判断为「${data.predictedCategory}」，请介绍相关的非遗知识`
  const nextSteps = []
  if (related[0]) {
    nextSteps.push({
      key: 'detail',
      icon: 'eye',
      to: `/heritage/${related[0].id}`,
      title: `查看「${related[0].name}」详情`,
      desc: '在知识馆中查看这项非遗的完整档案与来源',
      action: '查看详情',
    })
  }
  nextSteps.push(
    {
      key: 'chat',
      icon: 'chat',
      to: `/chat?q=${encodeURIComponent(chatQuery)}`,
      title: '询问 AI 导师',
      desc: '导师会结合知识库回答这个问题，并附上资料来源',
      action: '开始提问',
    },
    {
      key: 'studio',
      icon: 'brush',
      // 只有用户选中候选且命中知识馆项目时，才把主题带进工坊
      to: related[0] ? `/studio?theme=${encodeURIComponent(related[0].id)}` : '/studio',
      title: '使用该元素创作',
      desc: related[0]
        ? `把「${related[0].name}」的元素带进创作工坊，AI 帮你转译成文创设计`
        : '进入创作工坊，选择非遗元素开始创作',
      action: '进入工坊',
    },
  )

  const statusMeta = STATUS_META[data.recognitionStatus] ?? STATUS_META.ok

  return (
    <div className="card p-5 sm:p-6">
      {/* 头部：徽章 + 重新识别 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-lg font-semibold">识别结果</span>
          {/* 来源徽章：明确告诉用户结果来自演示数据还是真实模型 */}
          {mode === 'mock' ? (
            <span className="rounded-full bg-ink/10 px-2.5 py-1 text-xs font-medium text-ink-soft">
              演示数据
            </span>
          ) : (
            <span className="rounded-full bg-celadon/10 px-2.5 py-1 text-xs font-medium text-celadon">
              AI 识别
            </span>
          )}
          {/* 识别状态徽章 */}
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-cinnabar transition hover:bg-cinnabar/10"
        >
          重新识别
        </button>
      </div>

      {/* 第一层：图片主要内容（客观观察） */}
      {data.imageContent && (
        <div className="mt-4 rounded-2xl bg-paper p-5">
          <p className="text-xs text-ink-mute">图片主要内容（客观观察）</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{data.imageContent}</p>
        </div>
      )}

      {/* 推测类别 + 置信度 */}
      <div className="mt-4 rounded-2xl bg-paper p-5">
        <p className="text-xs text-ink-mute">AI 推测的技艺类别</p>
        <p className="mt-1 font-serif text-2xl font-semibold text-ink">
          {data.predictedCategory}
        </p>
        <p className="mt-2 text-xs">
          {/* 模型不提供可靠置信度时显示"未提供"，绝不编造数值 */}
          {data.confidence != null ? (
            <span className="text-ink-soft">置信度 {Math.round(data.confidence * 100)}%（模型自评，仅供参考）</span>
          ) : (
            <span className="text-ink-mute">置信度：未提供（模型未给出可靠数值）</span>
          )}
        </p>
      </div>

      {/* 非官方认定提醒条 */}
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-gold-dark">
        <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 16.5h.01" />
        </svg>
        以上为 AI 推测结果，不是官方认定，请勿作为结论引用。
      </p>

      {/* 第二层：候选非遗（用户点选确认） */}
      {hasCandidates && (
        <Block title={candidates.length > 1 ? `候选非遗（${candidates.length} 个，请点选最符合的一项）` : '候选非遗（请确认）'}>
          <div className="space-y-3">
            {candidates.map((c, i) => {
              const active = i === selectedIdx
              return (
                <button
                  key={`${c.name}-${i}`}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active
                      ? 'border-cinnabar/50 bg-cinnabar/5 shadow-sm'
                      : 'border-line bg-white hover:border-celadon/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {c.name}
                      {c.category && (
                        <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-[11px] font-normal text-ink-soft">
                          {c.category}
                        </span>
                      )}
                      {c.region && (
                        <span className="ml-1.5 rounded-full bg-paper px-2 py-0.5 text-[11px] font-normal text-ink-soft">
                          {c.region}
                        </span>
                      )}
                    </p>
                    {/* 选中态圆点 */}
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? 'border-cinnabar bg-cinnabar' : 'border-line bg-white'
                      }`}
                    >
                      {active && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m4.5 12.5 5 5 10-11" />
                        </svg>
                      )}
                    </span>
                  </div>
                  {c.basis && (
                    <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                      <span className="font-medium text-ink">判断依据：</span>{c.basis}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
          {candidates.length > 1 && (
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-mute">
              存在多种可能性时，AI 不会强行输出唯一答案；请结合判断依据选择最符合的一项，或都不符合时仅参考下方学习建议。
            </p>
          )}
        </Block>
      )}

      {/* RAG 知识库核验来源（真实检索，不伪造） */}
      {ragSources.length > 0 && (
        <Block title="知识库核验来源">
          <ul className="space-y-3">
            {ragSources.map((s) => (
              <li key={s.id || s.title} className="rounded-xl border border-line bg-paper/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{s.title}</p>
                  {s.level && (
                    <span className="rounded-full bg-cinnabar/10 px-2 py-0.5 text-[11px] text-cinnabar">{s.level}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${s.verified ? 'bg-celadon/10 text-celadon' : 'bg-amber-100 text-amber-800'}`}>
                    {s.verified ? '已核验' : '待核验'}
                  </span>
                </div>
                {s.snippet && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{s.snippet}…</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-mute">
                  {s.source && <span>来源：{s.source}</span>}
                  {(s.category || s.province) && <span>{[s.category, s.province].filter(Boolean).join(' · ')}</span>}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-celadon underline-offset-2 hover:underline">
                      查看原始资料
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-mute">
            知识库只能辅助核对文化资料，不能凭空证明图片一定属于某项非遗。
          </p>
        </Block>
      )}

      {/* 视觉特征 */}
      {data.visualFeatures.length > 0 && (
        <Block title="图像视觉特征">
          <ul className="space-y-3">
            {data.visualFeatures.map((f) => (
              <li key={f.title} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 shrink-0 rounded-md bg-cinnabar/10 px-2 py-0.5 text-xs font-medium text-cinnabar">
                  {f.title}
                </span>
                <span className="text-ink-soft">{f.desc}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* 仅凭图片无法确认的信息 */}
      {(data.unconfirmedInfo ?? []).length > 0 && (
        <Block title="仅凭图片无法确认">
          <ul className="space-y-2">
            {data.unconfirmedInfo.map((info) => (
              <li key={info} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" aria-hidden />
                <span>{info}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* 需要核实的文化信息 */}
      {data.culturalInfoToVerify.length > 0 && (
        <Block title="需要核实的文化信息">
          <ul className="space-y-2">
            {data.culturalInfoToVerify.map((info) => (
              <li key={info} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                <span>{info}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* 学习建议 */}
      {data.learningSuggestions.length > 0 && (
        <Block title="下一步学习建议">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.learningSuggestions.map((s) => (
              <div key={s.title} className="rounded-xl border border-line bg-paper/60 p-4">
                <p className="text-sm font-medium text-ink">{s.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{s.desc}</p>
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* 继续你的非遗之旅：识别只是流程中的一个节点——
          确认候选 → 查看详情 → 问导师 → 去创作 */}
      <Block title="接下来，你可以">
        <div className={`grid gap-3 ${nextSteps.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {nextSteps.map((step, idx) => (
            <Link
              key={step.key}
              to={step.to}
              className={`group flex flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
                idx === nextSteps.length - 1
                  ? 'border-cinnabar/30 bg-cinnabar/5 hover:border-cinnabar/60'
                  : 'border-line bg-white hover:border-celadon/50'
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                  idx === nextSteps.length - 1 ? 'bg-cinnabar/10 text-cinnabar' : 'bg-celadon/10 text-celadon-dark'
                }`}
              >
                <StepIcon name={step.icon} />
              </span>
              <p className="mt-3 text-sm font-medium text-ink">{step.title}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-mute">{step.desc}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-cinnabar">
                {step.action}
                <svg className="transition group-hover:translate-x-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </Block>

      {/* 免责声明（后端返回原文，前端不加工） */}
      <p className="mt-6 border-t border-line/70 pt-4 text-xs leading-relaxed text-ink-mute">
        {disclaimer}
      </p>
    </div>
  )
}

/* 结果板块小容器（本文件内部子组件） */
function Block({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="h-3.5 w-1 rounded-full bg-cinnabar" aria-hidden />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/* 「接下来，你可以」行动卡图标（本文件内部子组件，内联 SVG） */
function StepIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'eye': // 查看详情
      return (
        <svg {...common}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'chat': // 问导师
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-3.2-6.4L21 4l-1.2 3.6A8 8 0 0 1 20 12Z" />
          <path d="M8.5 11.5h7M8.5 14h4.5" />
        </svg>
      )
    default: // brush 去创作
      return (
        <svg {...common}>
          <path d="M20 4c-4 2-9.5 6.5-12 10l2 2c3.5-2.5 8-8 10-12Z" />
          <path d="M8 14c-1.5.5-3 2-3.5 4.5 2.5-.5 4-2 4.5-3.5" />
          <path d="M4.5 18.5 3 21" />
        </svg>
      )
  }
}
