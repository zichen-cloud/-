/* ============================================================
 * 图片工具
 * ------------------------------------------------------------
 * 非遗数据（heritage.json）中只保存图片"描述文字 imagePrompt"，
 * 由这里的函数拼接成文生图接口地址。
 * 将来替换为真实图片 URL（如后端返回的 coverUrl）时，
 * 只需修改这一个文件，所有页面自动生效。
 * ============================================================ */

const IMAGE_API = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

/**
 * 生成封面图地址
 * @param {string} prompt 图片描述
 * @param {string} size 尺寸：square_hd / square / portrait_4_3 / portrait_16_9 / landscape_4_3 / landscape_16_9
 */
export function getCoverImage(prompt, size = 'landscape_4_3') {
  return `${IMAGE_API}?prompt=${encodeURIComponent(prompt)}&image_size=${size}`
}
