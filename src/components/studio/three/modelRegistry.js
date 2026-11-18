/* ============================================================
 * 3D 模型注册表 modelRegistry
 * ------------------------------------------------------------
 * 每个产品类型对应：
 *   glbUrl   真实 GLB/GLTF 模型地址（放到 public/models/ 下）。
 *            留空则使用「程序化 3D 模型」（真 3D 网格，不是图片）。
 *            只要把同名文件放进 public/models/ 并在此登记，无需改其他代码。
 *   views    视角预设（相机位置）
 *
 * 重要：三种展示模式在界面上明确区分，绝不混用：
 *   glb         → 角标「真实 3D 模型（GLB）」
 *   procedural  → 角标「程序化 3D 模型」
 *   static      → 兜底「静态预览（非 3D）」
 * ============================================================ */

/* 通用视角预设（相机看向原点）；不同产品只做轻微微调 */
const VIEW_PRESETS = {
  persp: { label: '45°视角', pos: [3.4, 2.3, 4.2] },
  front: { label: '正面', pos: [0, 0.4, 5.2] },
  side: { label: '侧面', pos: [5.2, 0.4, 0] },
  top: { label: '俯视', pos: [0, 5.6, 0.6] },
}

/* 按产品微调的视角（竖向产品把相机抬高一点；小件产品拉近相机），未配置则用通用预设 */
const PRODUCT_VIEW_TWEAKS = {
  bookmark: {
    front: [0, 0.9, 5.8],
    persp: [3.6, 3.0, 4.6],
    side: [5.6, 0.9, 0],
  },
  'phone-case': {
    front: [0, 0.6, 5.6],
    persp: [3.5, 2.8, 4.4],
    side: [5.4, 0.6, 0],
  },
  'tote-bag': {
    front: [0, 0.9, 5.4],
    persp: [3.5, 2.6, 4.5],
    side: [5.2, 0.9, 0],
  },
  // 冰箱贴是小件（直径 0.7），相机必须拉近，否则在画面中几乎不可见
  'fridge-magnet': {
    front: [0, -0.6, 2.2],
    persp: [1.3, 0.2, 1.7],
    side: [2.2, -0.6, 0],
    top: [0, 2.0, 0.4],
  },
}

/* 按产品适配的接触阴影盘尺寸：阴影应贴合产品实际占地，过大像"灰色底座" */
const SHADOW_SCALE = {
  'tote-bag': 5,
  mug: 4,
  'phone-case': 3,
  bookmark: 3,
  'fridge-magnet': 1.6,
  cushion: 5,
}

export const MODEL_REGISTRY = {
  // 真实 GLB：脚本 scripts/export-mug-glb.mjs 生成，用来验证 GLB 加载与贴图替换链路
  mug: {
    glbUrl: '/models/mug.glb',
  },
  // 以下产品暂无 GLB 文件，使用程序化真 3D 模型
  'tote-bag': { glbUrl: '' },
  'phone-case': { glbUrl: '' },
  bookmark: { glbUrl: '' },
  'fridge-magnet': { glbUrl: '' },
  cushion: { glbUrl: '' },
}

/** 获取某产品的 GLB 地址（未配置返回空串） */
export function getGlbUrl(productType) {
  return MODEL_REGISTRY[productType]?.glbUrl || ''
}

/** 获取某产品某视角的相机位置 */
export function getViewPosition(productType, viewKey) {
  const tweak = PRODUCT_VIEW_TWEAKS[productType]?.[viewKey]
  if (tweak) return tweak
  return VIEW_PRESETS[viewKey]?.pos || VIEW_PRESETS.persp.pos
}

/** 视角按钮列表（顺序即 UI 顺序） */
export const VIEW_BUTTONS = Object.entries(VIEW_PRESETS).map(([key, v]) => ({
  key,
  label: v.label,
}))

/** 获取某产品的接触阴影盘尺寸 */
export function getShadowScale(productType) {
  return SHADOW_SCALE[productType] ?? 5
}
