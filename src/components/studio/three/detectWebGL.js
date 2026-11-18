/* ============================================================
 * WebGL 能力检测
 * ------------------------------------------------------------
 * 在挂载 Three.js Canvas【之前】调用：
 *   - 浏览器/设备不支持 WebGL 时直接走 2D 静态预览，
 *     避免 Canvas 创建上下文失败导致整段崩溃。
 * ============================================================ */

let cachedResult = null

export function isWebGLAvailable() {
  if (cachedResult !== null) return cachedResult
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    cachedResult = !!(gl && typeof gl.getParameter === 'function')
  } catch {
    cachedResult = false
  }
  return cachedResult
}
