/* ============================================================
 * 展示型名称校验（账号名 / 作品名）
 * ------------------------------------------------------------
 * 这类名称会展示给用户，必须是"完整、可识别"的名称：
 *   · 不能用纯数字、纯符号（如 123、!!!、___）
 *   · 不能是 test / admin / 匿名 / 未命名 等占位词
 *   · 需要包含中英文文字，并满足长度要求
 * 登录页与创作工坊共用同一套规则，避免各处判断不一致。
 * ============================================================ */

const PLACEHOLDER_NAMES = new Set([
  'test', 'test1', 'test123', 'tests', 'tester',
  'admin', 'root', 'user', 'user1', 'guest', 'demo',
  '123', '1234', '12345', '123456', '111', '000',
  'abc', 'abcd', 'aaa', 'xxx', 'sample', 'null', 'undefined',
  '匿名', '未命名', '无名', '佚名',
])

/**
 * @return 空字符串表示通过；否则返回可直接展示的中文提示
 */
export function validateDisplayName(raw, { label = '名称', min = 2, max = 30, example = '林小满' } = {}) {
  const value = (raw || '').trim()
  if (!value) return `请填写${label}`
  if (value.length < min) return `${label}太短了，请填写完整的${label}（如「${example}」）`
  if (value.length > max) return `${label}不能超过 ${max} 个字`

  // 纯数字 / 纯符号 / 数字符号混合（无任何中英文字符）
  if (/^[\d\s\p{P}\p{S}]+$/u.test(value)) {
    return `${label}不能只用数字或符号，请填写完整的${label}（如「${example}」）`
  }
  if (PLACEHOLDER_NAMES.has(value.toLowerCase())) {
    return `「${value}」属于随意填写的占位名称，请改用完整、真实的${label}`
  }
  if (!/[\u4e00-\u9fa5a-zA-Z]/.test(value)) {
    return `${label}需要包含中文或英文字母`
  }
  return ''
}
