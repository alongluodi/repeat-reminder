/**
 * 客户档案 API
 * GET /tenantApp/customer/index   params: name | phone | project_name | status | page | limit
 * GET /tenantApp/customer/read    ?id=  → { customer, visits, tasks }
 * GET /tenantApp/customer/options params: name
 */
import { get } from './request'

export function fetchCustomerList(params = {}) {
  return get('/tenantApp/customer/index', {
    page: params.page || 1,
    limit: params.limit || 10,
    ...(params.name ? { name: params.name } : {}),
    ...(params.phone ? { phone: params.phone } : {}),
    ...(params.project_name ? { project_name: params.project_name } : {}),
    ...(params.status !== undefined ? { status: params.status } : {})
  })
}

/** 复购档案：客户 + 到店记录 + 提醒历史 */
export function fetchCustomerDetail(id) {
  return get('/tenantApp/customer/read', { id })
}

export function fetchCustomerOptions(name = '') {
  return get('/tenantApp/customer/options', name ? { name } : {})
}
