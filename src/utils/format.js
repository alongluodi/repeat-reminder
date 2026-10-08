/**
 * 展示格式化工具
 */

/** 金额：¥1,280 / ¥68.50（整数不带小数） */
export function money(value) {
  const n = Number(value || 0)
  if (!isFinite(n)) return '¥0'
  const fixed = Math.round(n * 100) / 100
  const isInt = Number.isInteger(fixed)
  return (
    '¥' +
    fixed.toLocaleString('zh-CN', {
      minimumFractionDigits: isInt ? 0 : 2,
      maximumFractionDigits: 2
    })
  )
}

/** 手机号脱敏：138****8000（对外页面禁止展示完整号码） */
export function maskPhone(phone) {
  const s = String(phone || '').replace(/\s/g, '')
  if (!s) return ''
  if (s.length < 7) return s
  return `${s.slice(0, 3)}****${s.slice(-4)}`
}

/** 任务状态字典（与后端 后端任务逻辑::STATUS 一致） */
export const TASK_STATUS = {
  0: { text: '待提醒', cls: 'is-pending' },
  1: { text: '已提醒', cls: 'is-done' },
  2: { text: '已到店', cls: 'is-visit' },
  3: { text: '已忽略', cls: 'is-ignore' }
}

export function taskStatusText(status) {
  return (TASK_STATUS[Number(status)] || {}).text || '未知'
}

/** 复购周期文案：把「21」说人话 */
export function intervalText(days) {
  const n = Number(days || 0)
  return n > 0 ? `${n} 天没来就提醒` : '周期未设置'
}
