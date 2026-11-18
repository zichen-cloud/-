/* ============================================================
 * PersonaPetProvider：全站唯一桌宠 + 角色唤醒状态机
 * ------------------------------------------------------------
 * 状态：
 *   lion_active          狮小灵常驻（默认，也是识别失败/回归后的状态）
 *   recognition_processing 正在识别（保持狮小灵在场）
 *   heritage_waking      狮小灵介绍 → 专属传承人苏醒的过渡
 *   heritage_active      专属传承人互动
 *   returning_lion       专属传承人告别 → 狮小灵回归
 *
 * 规则：
 *   · 全站只渲染一个 PersonaPet 实例，页面切换不卸载；
 *   · 未识别时不出现任何专属传承人；
 *   · 专属角色关闭后自动回到狮小灵；
 *   · 识别失败只让狮小灵说明情况，绝不随机匹配。
 * ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import PersonaPet from '../components/persona/PersonaPet.jsx'
import { LION_PERSONA } from '../data/personaLion.js'
import { useIntro } from './IntroContext.jsx'

const PersonaPetContext = createContext(null)
const WAKE_MS = 1700

export function PersonaPetProvider({ children }) {
  const { open: introOpen, lionGreeting } = useIntro()
  const [persona, setPersona] = useState(LION_PERSONA)
  const [mode, setMode] = useState('lion_active')
  const [recognition, setRecognition] = useState('')
  const [bridgeText, setBridgeText] = useState('')
  const [notice, setNotice] = useState(null)
  const personaRef = useRef(persona)
  const timerRef = useRef(null)

  useEffect(() => {
    personaRef.current = persona
  }, [persona])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  /** 回到狮小灵（关闭专属角色 / 手动返回） */
  const returnToLion = useCallback(() => {
    clearTimeout(timerRef.current)
    setMode('returning_lion')
    setPersona(LION_PERSONA)
    setRecognition('')
    setBridgeText('')
    setNotice(null)
    setMode('lion_active')
  }, [])

  /** 识别失败或结果不确定：狮小灵继续陪伴并给出提示 */
  const notifyRecognitionFailed = useCallback((text) => {
    clearTimeout(timerRef.current)
    setPersona(LION_PERSONA)
    setMode('lion_active')
    setRecognition('')
    setBridgeText('')
    setNotice({ id: `n-${Date.now()}`, text })
  }, [])

  /** 开始识别：狮小灵在场，不出专属角色 */
  const markRecognitionProcessing = useCallback(
    (text) => {
      clearTimeout(timerRef.current)
      setPersona(LION_PERSONA)
      setMode('recognition_processing')
      setRecognition('')
      setBridgeText('')
      setNotice(text ? { id: `r-${Date.now()}`, text } : null)
    },
    [],
  )

  /** 识别成功：狮小灵先介绍，再让专属传承人苏醒 */
  const wakeHeritage = useCallback((next, options = {}) => {
    if (!next || next.id === 'lion') {
      returnToLion()
      return
    }
    const label = (options.recognition || next.heritage || '').trim()
    if (personaRef.current.id === next.id) {
      // 同一个角色被再次唤醒：只刷新识别信息，不重复播放苏醒
      setRecognition(label)
      setMode('heritage_active')
      setBridgeText('')
      setNotice(null)
      return
    }
    clearTimeout(timerRef.current)
    setRecognition(label)
    setNotice(null)
    setPersona(LION_PERSONA)
    setMode('heritage_waking')
    setBridgeText(`哇！我认出来了——${label || next.heritage}！让我们请「${next.name}」出来给你介绍吧！`)
    timerRef.current = setTimeout(() => {
      setPersona(next)
      setBridgeText('')
      setMode('heritage_active')
    }, WAKE_MS)
  }, [returnToLion])

  const value = useMemo(
    () => ({
      persona,
      mode,
      recognition,
      bridgeText,
      notice,
      // 兼容旧调用：openPet(专属角色) 等价于唤醒
      openPet: wakeHeritage,
      wakeHeritage,
      notifyRecognitionFailed,
      markRecognitionProcessing,
      returnToLion,
    }),
    [persona, mode, recognition, bridgeText, notice, wakeHeritage, notifyRecognitionFailed, markRecognitionProcessing, returnToLion],
  )

  return (
    <PersonaPetContext.Provider value={value}>
      {children}
      {/* 卷轴入场期间不渲染桌宠：动画结束后它才从右下角"出现"。
          lionGreeting 是入场结束交给狮小灵的一次性问候语 */}
      {!introOpen && (
        <PersonaPet
          key={persona.id}
          persona={persona}
          mode={mode}
          recognition={recognition}
          bridgeText={bridgeText}
          notice={notice}
          greetingOverride={lionGreeting}
          onReturnToLion={returnToLion}
          onSwitch={(next) => wakeHeritage(next)}
        />
      )}
    </PersonaPetContext.Provider>
  )
}

export function usePersonaPet() {
  const ctx = useContext(PersonaPetContext)
  if (!ctx) throw new Error('usePersonaPet 必须在 PersonaPetProvider 内使用')
  return ctx
}
