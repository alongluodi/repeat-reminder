/**
 * 时间工具
 * 后端返回的时间统一为 `YYYY-MM-DD HH:mm:ss` 字符串，
 * 这里只做「字符串 → 天数差 / 友好文案」，不走 Date 时区转换以免误差一天。
 */

/** 把 `YYYY-MM-DD[ HH:mm:ss]` 转成 Date（本地时区，Safari 不认 `-` 分隔的带时间串，故手工拆分） */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0)
  )
}

export function todayStr() {
  return fmtDate(new Date())
}

export function fmtDate(d) {
  const dt = toDate(d)
  if (!dt) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

export function fmtDateTime(d) {
  const dt = toDate(d)
  if (!dt) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${fmtDate(dt)} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

/** input[type=datetime-local] 需要的本地格式 */
export function toLocalInput(d) {
  const dt = toDate(d) || new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(
    dt.getMinutes()
  )}`
}

/** 距今天数（正数=已过去 N 天，负数=还有 N 天） */
export function daysSince(value) {
  const dt = toDate(value)
  if (!dt) return null
  const start = new Date().setHours(0, 0, 0, 0)
  const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
  return Math.round((start - target) / 86400000)
}

/** 「X 天前 / 今天 / X 天后」 */
export function daysText(value) {
  const d = daysSince(value)
  if (d === null) return '暂无记录'
  if (d === 0) return '今天'
  if (d > 0) return `${d} 天前`
  return `${Math.abs(d)} 天后`
}

/** 距今天数的展示口径：任务卡上要的是「隔了多少天没来」 */
export function gapText(value) {
  const d = daysSince(value)
  if (d === null) return '—'
  if (d <= 0) return '今天'
  return `${d} 天`
}

/** 剩余天数（用于共建剩余天数） */
export function remainDays(value) {
  const d = daysSince(value)
  if (d === null) return null
  return -d
}

export function recent7() {
  const list = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    list.push({ date: fmtDate(d), label: `${d.getMonth() + 1}/${d.getDate()}` })
  }
  return list
}
