/* ============================================================
 * 入场动画偏好（本地存储）
 * ------------------------------------------------------------
 * 三个键：
 *   feiyi_intro_seen_v1  是否已经完整看过一次（决定下次登录放完整版还是简化版）
 *   feiyi_intro_pending  本次会话是否待播放（sessionStorage，刷新即失效）
 *   feiyi_intro_sound    音效开关（默认关闭，绝不自动播放声音）
 *
 * 为什么 pending 放 sessionStorage：
 *   1. 登录成功后写一次，进入首页后立刻消费掉；
 *   2. 用户刷新页面时 pending 已为空，不会重复触发第二个动画实例；
 *   3. 多标签页之间互不干扰。
 * ============================================================ */
const SEEN_KEY = 'feiyi_intro_seen_v1'
const PENDING_KEY = 'feiyi_intro_pending'
const SOUND_KEY = 'feiyi_intro_sound'

/* 动画结束后狮小灵的第一句话（用户要求原文） */
export const INTRO_LION_GREETING =
  '你好呀，欢迎来到非遗探索世界！今天想从哪一种传统技艺开始了解呢？'

export function markIntroPending() {
  try {
    sessionStorage.setItem(PENDING_KEY, String(Date.now()))
  } catch {
    /* 隐私模式下不可用：忽略即可，不影响登录 */
  }
}

/** 读取并清空待播放标记：返回 true 表示本次应当播放 */
export function consumeIntroPending() {
  try {
    const val = sessionStorage.getItem(PENDING_KEY)
    if (!val) return false
    sessionStorage.removeItem(PENDING_KEY)
    return true
  } catch {
    return false
  }
}

export function hasSeenIntro() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* 忽略写入失败 */
  }
}

export function readIntroSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
}

export function saveIntroSound(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* 忽略写入失败 */
  }
}
