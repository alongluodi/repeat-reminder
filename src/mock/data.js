/**
 * mock 种子数据
 * 口径与真实建表 SQL 对齐（后端建表脚本）：
 *   客户表 / 到店记录 / 提醒规则 / 话术模板
 *   提醒任务 / 任务日志 / 扫描日志
 * 时间全部用「相对今天」生成，任何一天打开演示都是新鲜的。
 */

export const SHOP = {
  app_id: 10001,
  name: '小美美甲美睫（示例店）',
  industry: '美甲美睫',
  contact_name: '阿美',
  contact_phone: '13800138000',
  // 共建期截止日期（真实来源：店铺表.expire_time）；offsetDate 传负数 = 未来
  expire_time: offsetDate(-76),
  status: 1
}

export const OPERATOR = {
  id: 9002,
  username: 'amei',
  realname: '阿美',
  nickname: '阿美',
  email: '',
  phone: '13800138000',
  gender: '',
  signed: '',
  avatar: '',
  roles: ['tenant_manager'],
  buttons: []
}

/** 客户：cycle_days 与 last_visit_time 决定「该不该提醒」 */
export const CUSTOMERS = [
  {
    id: 9001,
    name: '小雅',
    phone: '13801380001',
    wechat: 'xiaoya_nail',
    project_name: '猫眼胶',
    cycle_days: 21,
    last_visit_time: offsetDate(24),
    tags: '老客,高频',
    remark: '只做裸色系，怕化学味',
    status: 1
  },
  {
    id: 9002,
    name: '莉莉',
    phone: '13801380002',
    wechat: 'lili_demo',
    project_name: '纯色甲油胶',
    cycle_days: 21,
    last_visit_time: offsetDate(22),
    tags: '老客',
    remark: '',
    status: 1
  },
  {
    id: 9003,
    name: '小雨',
    phone: '13801380003',
    wechat: '',
    project_name: '日式通勤短甲',
    cycle_days: 21,
    last_visit_time: offsetDate(30),
    tags: '临期',
    remark: '周末才有空，工作日勿扰',
    status: 1
  },
  {
    id: 9004,
    name: '张姐',
    phone: '13801380004',
    wechat: 'zhangjie88',
    project_name: '光疗延长',
    cycle_days: 28,
    last_visit_time: offsetDate(45),
    tags: '高客单',
    remark: '',
    status: 1
  },
  {
    id: 9005,
    name: '阿May',
    phone: '13801380005',
    wechat: '',
    project_name: '猫眼胶',
    cycle_days: 21,
    last_visit_time: offsetDate(23),
    tags: '',
    remark: '',
    status: 1
  },
  {
    id: 9006,
    name: '小鹿',
    phone: '13801380006',
    wechat: 'xiaolu',
    project_name: '跳色美甲',
    cycle_days: 21,
    // 今天刚回来（对应状态「已到店」的任务，闭环后距上次到店归零）
    last_visit_time: todayAt(11, 20),
    tags: '新客',
    remark: '首单体验 98 套餐',
    status: 1
  },
  {
    id: 9007,
    name: '王女士',
    phone: '13801380007',
    wechat: '',
    project_name: '手部护理',
    cycle_days: 30,
    last_visit_time: offsetDate(52),
    tags: '睡眠',
    remark: '',
    status: 1
  },
  {
    id: 9008,
    name: '婷婷',
    phone: '13801380008',
    wechat: 'ting_ting',
    project_name: '猫眼胶',
    cycle_days: 21,
    // 今天也来了
    last_visit_time: todayAt(15, 40),
    tags: '高频',
    remark: '每次都要加闪粉',
    status: 1
  },
  {
    id: 9010,
    name: '阿珍',
    phone: '13801380010',
    wechat: 'azhen_demo',
    project_name: '纯色甲油胶',
    // 0 = 未设置复购周期，不参与提醒扫描（演示「没配周期就不会打扰客人」）
    cycle_days: 0,
    last_visit_time: todayAt(13, 5),
    tags: '新客',
    remark: '朋友介绍来的',
    status: 1
  }
]

/** 到店记录：每条对应客户的一次真实消费 */
export const VISITS = [
  { id: 9101, customer_id: 9001, project_name: '猫眼胶', amount: 268, visit_time: offsetDate(24) },
  { id: 9102, customer_id: 9001, project_name: '猫眼胶', amount: 248, visit_time: offsetDate(46) },
  { id: 9103, customer_id: 9001, project_name: '卸甲+纯色', amount: 128, visit_time: offsetDate(70) },
  { id: 9104, customer_id: 9002, project_name: '纯色甲油胶', amount: 158, visit_time: offsetDate(22) },
  { id: 9105, customer_id: 9002, project_name: '纯色甲油胶', amount: 158, visit_time: offsetDate(45) },
  { id: 9106, customer_id: 9003, project_name: '日式通勤短甲', amount: 188, visit_time: offsetDate(30) },
  { id: 9107, customer_id: 9003, project_name: '日式通勤短甲', amount: 188, visit_time: offsetDate(58) },
  { id: 9108, customer_id: 9004, project_name: '光疗延长', amount: 398, visit_time: offsetDate(45) },
  { id: 9109, customer_id: 9004, project_name: '光疗延长', amount: 368, visit_time: offsetDate(88) },
  { id: 9110, customer_id: 9005, project_name: '猫眼胶', amount: 268, visit_time: offsetDate(23) },
  { id: 9111, customer_id: 9006, project_name: '跳色美甲', amount: 98, visit_time: offsetDate(27) },
  { id: 9112, customer_id: 9007, project_name: '手部护理', amount: 128, visit_time: offsetDate(52) },
  { id: 9113, customer_id: 9008, project_name: '猫眼胶', amount: 268, visit_time: offsetDate(26) },
  { id: 9114, customer_id: 9008, project_name: '猫眼胶', amount: 268, visit_time: offsetDate(2) },
  { id: 9115, customer_id: 9008, project_name: '卸甲', amount: 38, visit_time: offsetDate(50) },
  // 下面 3 条是「今天已到店」：让看板今日数据、本月复购率都有真实感
  { id: 9116, customer_id: 9006, project_name: '跳色美甲', amount: 168, visit_time: todayAt(11, 20) },
  { id: 9117, customer_id: 9008, project_name: '猫眼胶', amount: 268, visit_time: todayAt(15, 40) },
  { id: 9118, customer_id: 9010, project_name: '纯色甲油胶', amount: 298, visit_time: todayAt(13, 5) },
  { id: 9119, customer_id: 9010, project_name: '纯色甲油胶', amount: 158, visit_time: offsetDate(5) }
]

/** 提醒规则：只暴露老板看得懂的字段 */
export const RULES = [
  {
    id: 9201,
    rule_name: '通用复购提醒',
    project_name: '',
    interval_days: 21,
    template_id: 9001,
    benefit_text: '老客专享 8 折',
    enabled: 1,
    create_time: offsetDate(120)
  },
  {
    id: 9202,
    rule_name: '猫眼胶专属',
    project_name: '猫眼胶',
    interval_days: 21,
    template_id: 9002,
    benefit_text: '猫眼胶第二指免费加钻',
    enabled: 1,
    create_time: offsetDate(120)
  },
  {
    id: 9203,
    rule_name: '沉睡客唤醒',
    project_name: '',
    interval_days: 45,
    template_id: 9001,
    benefit_text: '回店立减 50',
    enabled: 1,
    create_time: offsetDate(60)
  }
]

export const TEMPLATES = [
  {
    id: 9001,
    title: '通用复购',
    content:
      '{name}您好呀～我是{shop}的{staff}，您上次做的{project}已经{days}天啦，最近新到了几款{benefit}，给您留了时间，方便回店吗？',
    industry: 'meijia'
  },
  {
    id: 9002,
    title: '猫眼胶复购',
    content:
      '{name}！您常做的{project}这都{days}天了，甲面该补啦～这周{benefit}，我帮您留个位置？',
    industry: 'meijia'
  }
]

/** 扫描心跳：让「扫描超时」提示可控（true 时看板会出立即刷新） */
export const SCAN = {
  create_time: offsetDate(0, 8, 5),
  scan_date: fmt(new Date()),
  hit_count: 5,
  duration_ms: 1280
}

/* ---------------- 内部工具 ---------------- */

function pad(n) {
  return String(n).padStart(2, '0')
}

export function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtTime(d) {
  return `${fmt(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 相对今天偏移 N 天（负数为将来），可带具体时刻 */
export function offsetDate(daysAgo, h = 10, m = 30) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return fmtTime(d)
}

export function offsetOnlyDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return fmt(d)
}

export function todayAt(h, m) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return fmtTime(d)
}
