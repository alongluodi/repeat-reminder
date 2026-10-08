/**
 * 提醒任务（待跟进清单）API
 * GET  /tenantApp/task/index   params: status | due_date | all | send_status | page | limit
 * POST /tenantApp/task/action  { id, action }
 * GET  /tenantApp/task/logs    ?task_id=
 *
 * 2026-10-10 起：copy_script 即记已提醒（后端 status 0→1 + remind_time），
 * 不再要求回 H5「标记为已发送」；mark_sent 仅保留兼容旧链路数据。
 */

import { get, post } from './request'

/** 动作字典 —— 与后端 后端任务逻辑::action 的 $allow 一一对应 */
export const TASK_ACTION = {
  /** 复制话术 = 已执行提醒（status 0→1，并落沟通日志） */
  COPY: 'copy_script',
  /** 系统分享面板走完 = 真送出去了（status 0→1，send_status 推导为「已发送」） */
  SHARE: 'share_script',
  DONE: 'mark_done',
  /** 旧链路「标记为已发送」，保留兼容 */
  SENT: 'mark_sent',
  VISIT: 'mark_visit',
  IGNORE: 'ignore',
  /** 退回待提醒：撤销忽略 / 复制错了人重新提醒 */
  RESTORE: 'restore'
}

/**
 * 待跟进列表
 * @param {object} params
 * @param {'today'|'all'|'handled'} [params.scope] 前端口径，映射到后端参数
 * @param {number|string} [params.status] 0待提醒 1已提醒 2已到店 3忽略
 * @param {number|string} [params.send_status] 1已复制·待发送 2已发送
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export function fetchTaskList(params = {}) {
  const { scope = 'today', page = 1, limit = 10, status, send_status } = params
  const query = { page, limit }
  if (scope === 'all' || scope === 'handled') {
    // all=1 → 不加日期/状态默认过滤，否则后端只返回「今天到期且未闭环」
    query.all = 1
  }
  if (status !== undefined && status !== null && status !== '') {
    query.status = status
  }
  if (send_status !== undefined && send_status !== null && send_status !== '') {
    query.send_status = send_status
  }
  if (params.due_date) query.due_date = params.due_date
  return get('/tenantApp/task/index', query)
}

/** 任务操作：copy_script / mark_sent / mark_done / mark_visit / ignore */
export function actionTask(id, action) {
  return post('/tenantApp/task/action', { id, action })
}

/** 复制话术：先落一条 copy_script 日志（审计留痕），失败不阻断复制本身 */
export function logCopy(id) {
  return actionTask(id, TASK_ACTION.COPY)
}

/** 分享送出：落 share_script 日志 —— 有送出证据，send_status 记为「已发送」 */
export function logShare(id) {
  return actionTask(id, TASK_ACTION.SHARE)
}

/** 标记为已发送：话术已在微信发出去（不切微信也可直接标记完成） */
export function markSent(id) {
  return actionTask(id, TASK_ACTION.SENT)
}

export function fetchTaskLogs(taskId) {
  return get('/tenantApp/task/logs', { task_id: taskId })
}
