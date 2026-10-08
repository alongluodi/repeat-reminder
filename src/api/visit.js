/**
 * 到店记录 API
 * POST /tenantApp/visit/save   { customer_id, project_name, amount, visit_time, remark }
 * GET  /tenantApp/visit/index  params: customer_id | page | limit
 *
 * 后端 后端到店逻辑 会同步回写 客户表.last_visit_time，
 * 所以录完到店无需再手工更新客户。
 */
import { get, post } from './request'

/**
 * 录入到店
 * @param {object} form
 * @param {number} form.customer_id 必填
 * @param {string} form.visit_time  必填，YYYY-MM-DD HH:mm:ss
 */
export function addVisit(form) {
  return post('/tenantApp/visit/save', {
    customer_id: form.customer_id,
    project_name: form.project_name || '',
    amount: form.amount === '' || form.amount === null ? 0 : Number(form.amount),
    visit_time: normalizeTime(form.visit_time),
    remark: form.remark || ''
  })
}

export function fetchVisitList(params = {}) {
  return get('/tenantApp/visit/index', {
    page: params.page || 1,
    limit: params.limit || 20,
    ...(params.customer_id ? { customer_id: params.customer_id } : {})
  })
}

/** input[type=datetime-local] 给的是 `YYYY-MM-DDTHH:mm`，后端要 datetime 字符串 */
export function normalizeTime(value) {
  if (!value) return ''
  const s = String(value).replace('T', ' ')
  return s.length === 16 ? `${s}:00` : s
}
