/**
 * 提醒规则 API（老板端只用「看 / 启停 / 新增」三件事）
 * GET  /tenantApp/rule/index   params: rule_name | enabled | page | limit
 * POST /tenantApp/rule/save    { rule_name, project_name, interval_days, benefit_text }
 * POST /tenantApp/rule/toggle  { id }
 */
import { get, post } from './request'

export function fetchRuleList(params = {}) {
  return get('/tenantApp/rule/index', {
    page: params.page || 1,
    limit: params.limit || 20,
    ...(params.enabled !== undefined && params.enabled !== '' ? { enabled: params.enabled } : {})
  })
}

export function toggleRule(id) {
  return post('/tenantApp/rule/toggle', { id })
}

/**
 * 新增规则
 * @param {object} form rule_name / interval_days 必填（后端 后端校验 校验）
 */
export function saveRule(form) {
  return post('/tenantApp/rule/save', {
    rule_name: form.rule_name,
    project_name: form.project_name || '',
    interval_days: Number(form.interval_days),
    template_id: form.template_id ? Number(form.template_id) : 0,
    benefit_text: form.benefit_text || '',
    enabled: 1
  })
}
