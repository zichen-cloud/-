/* ============================================================
 * 本地登录态 auth（演示环境，无后端鉴权）
 * ------------------------------------------------------------
 * 登录信息存 localStorage：{ name, at }
 * 后续接入真实后端时，只需把 login() 换成接口调用、
 * 在 storage 里改存 token 即可，页面与路由守卫无需改动。
 * ============================================================ */
const KEY = 'feiyi_auth'

export function login(name) {
  localStorage.setItem(KEY, JSON.stringify({ name, at: Date.now() }))
}

export function logout() {
  localStorage.removeItem(KEY)
}

export function isAuthed() {
  return Boolean(localStorage.getItem(KEY))
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}
