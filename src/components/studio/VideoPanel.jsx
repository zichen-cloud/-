/* ============================================================
 * 产品介绍视频面板 VideoPanel（第三步，阶段四支持 AI 配音）
 * ------------------------------------------------------------
 * 流程：配音设置（VoiceoverPanel）→ 后台合成任务 → 成片预览
 *   - 可合成【有声视频】（带逐句 TTS 配音 + 对应字幕）或【无声视频】；
 *   - POST /api/studio/generate-video → taskId
 *   - 轮询 GET /api/studio/video-status/{taskId}（1 秒一次）
 * 状态机：setup → working → done / failed
 * 展示：进度条与当前阶段文案、失败原因（可重试/返回改旁白）、成片预览、
 *       视频脚本（标题/介绍/分镜旁白字幕）、配音标识、模式标识与声明。
 * ============================================================ */
import { useEffect, useRef, useState } from 'react'
import StudioIcon from './StudioIcons.jsx'
import VoiceoverPanel from './VoiceoverPanel.jsx'
import { generateVideo, pollVideoStatus } from '../../services/studioService.js'
import { getProductTypeById, getThemeById, getStyleById } from '../../data/studioOptions.js'

export default function VideoPanel({ form, proposal, saved, saving, onBack, onSave }) {
  // setup（配音设置）| working（合成中）| done | failed
  const [phase, setPhase] = useState('setup')
  const [task, setTask] = useState(null)        // 最近一次任务状态
  // 本轮合成携带的配音信息（无声视频为 null）；返回修改旁白时用于回填
  const [audioPayload, setAudioPayload] = useState(null)
  // 配音设置回填缓存（sentences / voice / speed / 最近一次成功的 audio）
  const [setupInitial, setSetupInitial] = useState(null)
  const pollTimer = useRef(null)

  // 产品类型为选填：空时按「纯视觉作品」处理（不虚构产品载体），与提案阶段保持一致
  const productName = getProductTypeById(form.productType)?.name ?? ''
  const themeName = getThemeById(form.theme)?.name ?? ''
  const styleName = getStyleById(form.style)?.name ?? ''

  /* 旁白生成 / 视频合成共用的作品上下文 */
  const context = {
    title: form.title.trim(),
    themeName,
    productTypeName: productName,
    styleName,
    proposalTitle: proposal.proposalTitle,
    concept: proposal.concept,
    elements: proposal.elements,
  }

  /* 启动一次合成任务；audio 为 null 时合成无声视频；opts 为可控选项（用途/风格/叙事重点） */
  const start = async (audio = null, opts = {}) => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    setAudioPayload(audio)
    setPhase('working')
    setTask({
      progress: 0.02,
      message: '正在创建视频任务…',
      hasAudio: Boolean(audio),
      voiceName: audio?.voiceName || '',
      speedName: audio?.speedName || '',
    })

    let taskId
    try {
      ;({ taskId } = await generateVideo({
        ...context,
        imageUrl: proposal.imageUrl,
        colorPalette: proposal.colorPalette || [],
        // 阶段四：配音字段（为空即无声视频，完全沿用阶段三行为）
        audioSentenceUrls: audio?.audioSentenceUrls || [],
        audioDurations: audio?.audioDurations || [],
        audioSentences: audio?.audioSentences || [],
        voiceName: audio?.voiceName || '',
        speedName: audio?.speedName || '',
        // 阶段五：可控选项
        videoPurpose: opts.videoPurpose || audio?.videoPurpose || '',
        videoStyle: opts.videoStyle || audio?.videoStyle || '',
        narrativeFocus: opts.narrativeFocus || audio?.narrativeFocus || '',
      }))
    } catch (e) {
      setPhase('failed')
      setTask({ error: e.message, progress: 0, message: '任务创建失败', hasAudio: Boolean(audio) })
      return
    }

    pollTimer.current = setInterval(async () => {
      try {
        const t = await pollVideoStatus(taskId)
        setTask(t)
        if (t.status === 'done') {
          clearInterval(pollTimer.current)
          pollTimer.current = null
          setPhase('done')
        } else if (t.status === 'failed') {
          clearInterval(pollTimer.current)
          pollTimer.current = null
          setPhase('failed')
        }
      } catch (e) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
        setPhase('failed')
        setTask((prev) => ({ ...prev, error: e.message, message: '状态查询失败' }))
      }
    }, 1000)
  }

  /* 卸载时停止轮询与朗读（朗读实例在子组件内，卸载子组件会自行清理） */
  useEffect(() => () => {
    if (pollTimer.current) clearInterval(pollTimer.current)
  }, [])

  /* 从配音设置进入合成（同时缓存设置，供"返回修改旁白"回填） */
  const handleComposeAudio = (payload) => {
    setSetupInitial({
      sentences: payload.audioSentences,
      voice: payload.voice,
      speed: payload.speed,
      audio: {
        sentenceUrls: payload.audioSentenceUrls,
        durations: payload.audioDurations,
        totalDuration: payload.audioDurations.reduce((a, b) => a + b, 0),
        voiceName: payload.voiceName,
        speedName: payload.speedName,
      },
    })
    start(payload)
  }

  const handleComposeSilent = (opts = {}) => {
    start(null, opts)
  }

  /* 返回配音设置：setupInitial 已保留上次文本/选项/配音，直接切回即可 */
  const backToSetup = () => setPhase('setup')

  const progress = Math.round((task?.progress ?? 0) * 100)
  const isDemo = task?.mode !== 'real'
  const withAudio = Boolean(task?.hasAudio)

  return (
    <div className="space-y-4">
      {/* 顶部：返回 + 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="btn-ghost inline-flex items-center gap-1.5">
          <StudioIcon name="arrowRight" size={14} className="rotate-180" />
          返回 3D 展示
        </button>
        <h2 className="font-serif text-lg font-semibold text-ink">第三步：产品介绍视频{phase === 'setup' ? ' · AI 配音' : ''}</h2>
      </div>

      {/* 方案摘要 */}
      <div className="card flex items-center gap-4 p-3.5 sm:p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-paper">
          <img src={proposal.imageUrl} alt={proposal.proposalTitle} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-semibold text-ink">{proposal.proposalTitle}</p>
          <p className="mt-1 text-xs text-ink-mute">
            {productName ? `产品载体：${productName}` : '纯视觉创作 · 无具体产品载体'} · 视频将基于该方案的效果图与文案合成
            {withAudio ? ` · 含 AI 配音（${task?.voiceName || ''}${task?.speedName ? ` · ${task.speedName}` : ''}）` : ''}
          </p>
        </div>
      </div>

      {/* 阶段一：配音设置 */}
      {phase === 'setup' && (
        <VoiceoverPanel
          context={context}
          initial={setupInitial}
          onComposeAudio={handleComposeAudio}
          onComposeSilent={handleComposeSilent}
        />
      )}

      {/* 阶段二：进行中 */}
      {phase === 'working' && (
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 shrink-0 animate-spin rounded-full border-[3px] border-cinnabar/25 border-t-cinnabar" />
            <div>
              <p className="text-sm font-medium text-ink">
                {withAudio ? '正在合成有声视频' : '正在合成介绍视频'}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">{task?.message || '准备中…'}</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-cinnabar transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs text-ink-mute">{progress}%</p>
        </div>
      )}

      {/* 失败：明确原因 + 重试 / 返回修改旁白 */}
      {phase === 'failed' && (
        <div className="card p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cinnabar/10 text-cinnabar">
            <StudioIcon name="video" size={22} />
          </div>
          <h3 className="mt-4 font-serif text-lg font-semibold text-ink">视频合成失败</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{task?.error || '未知错误，请稍后重试'}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => start(audioPayload)} className="btn-primary">
              <StudioIcon name="refresh" size={15} />
              重试合成
            </button>
            {withAudio && (
              <button type="button" onClick={backToSetup} className="btn-secondary">
                <StudioIcon name="microphone" size={15} />
                返回修改旁白
              </button>
            )}
            <button type="button" onClick={onBack} className="btn-ghost">
              返回 3D 展示
            </button>
          </div>
        </div>
      )}

      {/* 阶段三：完成：视频预览 + 脚本 + 模式标识 */}
      {phase === 'done' && task && (
        <>
          <div className="card overflow-hidden">
            <div className="relative bg-ink">
              {/* controls 自带播放/音量/全屏控制 */}
              <video
                key={task.videoUrl}
                src={task.videoUrl}
                controls
                playsInline
                className="mx-auto max-h-[420px] w-full"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
              <p className="text-xs text-ink-mute">
                时长约 {task.duration || 12} 秒 · 1280×720 · {task.hasAudio ? '含配音 MP4' : '无声 MP4'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {task.hasAudio && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-celadon/15 px-2.5 py-1 text-[11px] font-medium text-celadon">
                    <StudioIcon name="microphone" size={12} />
                    含 AI 配音 · {task.voiceName} · {task.speedName}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    isDemo ? 'bg-amber-100 text-amber-800' : 'bg-celadon/15 text-celadon'
                  }`}
                >
                  <StudioIcon name={isDemo ? 'sparkle' : 'check'} size={12} />
                  {isDemo
                    ? `演示模式：FFmpeg 本地合成 · 文案${task.scriptMode === 'ai' ? '由 AI 生成' : '为本地模板'}`
                    : '真实视频生成'}
                </span>
              </div>
            </div>
          </div>

          {/* 视频脚本（标题 / 介绍 / 分镜）；有声视频的分镜字幕以实际旁白为准 */}
          {task.script && (
            <div className="card p-5 sm:p-6">
              <h3 className="font-serif text-base font-semibold text-ink">
                {task.script.videoTitle || '视频脚本'}
              </h3>
              {task.script.intro && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{task.script.intro}</p>
              )}
              <ol className="mt-4 space-y-2.5">
                {(task.script.scenes || []).map((s, i) => (
                  <li key={i} className="flex gap-3 rounded-xl bg-paper/70 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-cinnabar shadow-sm">
                      {i + 1}
                    </span>
                    <div className="min-w-0 text-xs leading-relaxed">
                      <p className="font-medium text-ink">
                        {s.subtitle}
                        <span className="ml-2 font-normal text-ink-mute">约 {s.seconds} 秒</span>
                      </p>
                      <p className="mt-1 text-ink-soft">
                        {task.hasAudio ? '字幕/旁白' : '旁白'}：{s.narration}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {task.disclaimer && (
                <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-mute">
                  {task.disclaimer}
                </p>
              )}
            </div>
          )}

          {/* 下一步操作 */}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <button
              type="button"
              onClick={() => onSave({
                // 保存作品时把成片信息一并持久化（阶段五）
                videoUrl: task.videoUrl,
                duration: task.duration,
                hasAudio: task.hasAudio,
                voiceName: task.voiceName,
                speedName: task.speedName,
              })}
              disabled={saved || saving}
              className="btn-primary disabled:opacity-60"
            >
              <StudioIcon name="save" size={15} />
              {saving ? '保存中…' : saved ? '已保存到我的作品' : '保存作品'}
            </button>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={backToSetup} className="btn-secondary inline-flex items-center gap-1.5">
                <StudioIcon name="microphone" size={14} />
                {task.hasAudio ? '重新设置配音' : '添加 AI 配音'}
              </button>
              <button type="button" onClick={() => start(audioPayload)} className="btn-ghost inline-flex items-center gap-1.5">
                <StudioIcon name="refresh" size={14} />
                重新生成视频
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
