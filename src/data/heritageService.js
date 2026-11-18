/* ============================================================
 * 非遗数据访问层（service）
 * ------------------------------------------------------------
 * 页面组件不直接读取 JSON，而是调用这里的函数获取数据。
 * 这样做的好处：
 *   现在数据来自本地 heritage.json；
 *   将来接入 FastAPI 时，只把函数内部改成 fetch('/api/...')，
 *   页面代码一行都不用动。
 *
 * 目前函数是"同步"的（本地数据立即返回）；
 * 接网络请求后会变成 async（返回 Promise），页面配合 useEffect 使用。
 * ============================================================ */
import heritageJson from './heritage.json'

// 全量数据。meta 中保存免责声明等说明性信息
const allItems = heritageJson.items
export const dataMeta = heritageJson.meta

/** 返回全部非遗项目（默认按 JSON 中的顺序） */
export function getAllItems() {
  return allItems
}

/** 按 id 查询单个项目；找不到时返回 null（页面据此显示"未找到"） */
export function getItemById(id) {
  return allItems.find((item) => item.id === id) ?? null
}

/** 提取所有门类，用于筛选按钮（去重） */
export function getCategories() {
  return [...new Set(allItems.map((item) => item.category))]
}

/** 提取所有省级地区，用于地区下拉筛选（去重） */
export function getProvinces() {
  return [...new Set(allItems.map((item) => item.province))]
}

/** 判断一个项目是否包含关键词（名称/简介/门类/地区/标签都参与匹配） */
function matchKeyword(item, keyword) {
  if (!keyword) return true
  // 统一转成小写，避免大小写影响英文搜索
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true

  const searchableText = [
    item.name,
    item.summary,
    item.category,
    item.region,
    ...(item.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()

  return searchableText.includes(kw)
}

/**
 * 组合筛选：门类 + 地区 + 关键词（三个条件可同时生效，是 AND 关系）
 * @param {{keyword?: string, category?: string, province?: string}} conditions
 */
export function filterItems({ keyword = '', category = '全部', province = '全部' } = {}) {
  return allItems.filter((item) => {
    const categoryOk = category === '全部' || item.category === category
    const provinceOk = province === '全部' || item.province === province
    const keywordOk = matchKeyword(item, keyword)
    return categoryOk && provinceOk && keywordOk
  })
}
