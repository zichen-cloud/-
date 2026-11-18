/* ============================================================
 * 收藏数据服务层（MySpace 收藏夹）
 * ------------------------------------------------------------
 * 对接后端 /api/favorites：
 *   - POST /api/favorites {type:'heritage'|'work', targetId}
 *     快照由服务端从事实来源（知识库/作品库）生成，前端伪造无效；
 *   - GET /api/favorites?type=
 *   - DELETE /api/favorites/{id}
 * 重复收藏同一目标时后端幂等返回已有记录（不会重复建）。
 * ============================================================ */

/**
 * 获取收藏列表。
 * @param {{type?: 'heritage'|'work'}} [opts]
 * @returns {Promise<Array<{id, type, targetId, createdAt, snapshot}>>}
 */
export async function listFavorites(opts = {}) {
  const qs = opts.type ? `?type=${encodeURIComponent(opts.type)}` : ''
  const resp = await fetch(`/api/favorites${qs}`)
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error?.message || `收藏列表获取失败（HTTP ${resp.status}）`)
  }
  return Array.isArray(json.favorites) ? json.favorites : []
}

/**
 * 收藏一个目标（幂等：已收藏时返回已有记录，isCreated=false）。
 * @param {{type:'heritage'|'work', targetId:string}} payload
 * @returns {Promise<{favorite: object, isCreated: boolean}>}
 */
export async function addFavorite(payload) {
  const resp = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: payload.type, targetId: payload.targetId }),
  })
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    // 409 语义上不会出现（后端幂等），这里统一抛业务错误
    throw new Error(json?.error?.message || `收藏失败（HTTP ${resp.status}）`)
  }
  return { favorite: json, isCreated: true }
}

/**
 * 取消收藏。
 * @param {string} favId
 * @returns {Promise<void>}
 */
export async function removeFavorite(favId) {
  const resp = await fetch(`/api/favorites/${encodeURIComponent(favId)}`, { method: 'DELETE' })
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.ok) {
    // 404 视为已取消，其余抛错
    if (resp.status !== 404) {
      throw new Error(json?.error?.message || `取消收藏失败（HTTP ${resp.status}）`)
    }
  }
}

/**
 * 查询某个目标是否已收藏。
 * @param {string} type 'heritage' | 'work'
 * @param {string} targetId
 * @returns {Promise<{favorited: boolean, favorite?: object}>}
 */
export async function checkFavorite(type, targetId) {
  const favorites = await listFavorites({ type })
  const hit = favorites.find((f) => f.targetId === targetId)
  return { favorited: Boolean(hit), favorite: hit }
}
