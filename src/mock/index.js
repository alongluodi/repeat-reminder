/**
 * 本地 mock 后端
 *
 * 目的：boss-h5 不依赖后端 也能把 9 个页面的交互全部跑通（任务流转、录到店、规则启停）。
 * 路由与真实后端一一对应（见 后端路由配置 的 /tenantApp 分组），
 * 响应结构与 标准分页结构 对齐，切到真实接口时前端无需改动。
 *
 * 状态保存在模块内存中：刷新页面即重置，方便反复演示。
 */
import {
  SHOP,
  OPERATOR,
  CUSTOMERS,
  VISITS,
  RULES,
  TEMPLATES,
  offsetOnlyDate,
  fmt,
  fmtTime,
  todayAt
} from './data.js'

const TASK_STATUS_TEXT = ['待提醒', '已提醒', '已到店', '忽略']
// 发送状态文案（0 无 / 1 已复制待微信发 / 2 已发送），与后端 后端任务状态常量 对齐
const SEND_STATUS_TEXT = ['', '已复制·待微信发', '已发送']
// 「送出证据」动作（真发出去了）与「提醒动作」动作集合 —— 与后端 后端任务逻辑 常量保持一致
const SENT_ACTIONS = ['share_script', 'mark_sent']
const REMIND_ACTIONS = ['copy_script', 'share_script', 'mark_sent']
const inActions = (logs, tid, actions) =>
  logs.some((l) => Number(l.task_id) === Number(tid) && actions.includes(l.action))

/* ---------------- 内存库 ---------------- */

const db = {
  customers: clone(CUSTOMERS),
  visits: clone(VISITS),
  rules: clone(RULES),
  tasks: [],
  taskLogs: [],
  seq: 9900,
  /** 扫描心跳是否超时（用于演示看板的「立即刷新」） */
  scanStale: true,
  scanTime: null
}

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

function nextId() {
  db.seq += 1
  return db.seq
}

function daysBetween(from, to) {
  const a = new Date(String(from).replace(/-/g, '/')).setHours(0, 0, 0, 0)
  const b = new Date(String(to).replace(/-/g, '/')).setHours(0, 0, 0, 0)
  return Math.round((b - a) / 86400000)
}

function addDays(dateStr, days) {
  const d = new Date(String(dateStr).replace(/-/g, '/'))
  d.setDate(d.getDate() + Number(days || 0))
  return fmt(d)
}

function lastVisitOf(customerId) {
  const list = db.visits
    .filter((v) => Number(v.customer_id) === Number(customerId))
    .sort((a, b) => (a.visit_time < b.visit_time ? 1 : -1))
  return list[0] || null
}

/**
 * 今天之前的最后一次到店
 *
 * 为什么需要它：任务是**今天到店之前**由扫描生成的。
 * 若某位客户今天刚回来（任务已被标为「已到店」），用 latest 算出的应提醒日会落到未来，
 * 与「已闭环的过期提醒」这一事实矛盾。故生成任务时统一按「今天之前的最后一次」推算。
 */
function lastVisitBeforeToday(customerId) {
  const today = fmt(new Date())
  const list = db.visits
    .filter((v) => Number(v.customer_id) === Number(customerId))
    .filter((v) => String(v.visit_time).slice(0, 10) < today)
    .sort((a, b) => (a.visit_time < b.visit_time ? 1 : -1))
  return list[0] || null
}

function buildScript(customer, rule) {
  const last = lastVisitBeforeToday(customer.id)
  const tpl =
    TEMPLATES.find((t) => t.id === Number(rule.template_id)) ||
    TEMPLATES.find((t) => t.id === 9001)
  const gapDays = last ? Math.max(daysBetween(last.visit_time, fmtTime(new Date())), 0) : 0
  return String(tpl.content)
    .replace(/\{name\}/g, customer.name)
    .replace(/\{project\}/g, customer.project_name || last?.project_name || '美甲')
    .replace(/\{days\}/g, String(gapDays))
    .replace(/\{benefit\}/g, rule.benefit_text || '老客专属优惠')
    .replace(/\{shop\}/g, SHOP.name)
    .replace(/\{staff\}/g, OPERATOR.realname)
}

function pickRule(customer) {
  return (
    db.rules.find((r) => r.project_name && r.project_name === customer.project_name) ||
    db.rules.find((r) => !r.project_name) ||
    db.rules[0]
  )
}

/**
 * 生成提醒任务（对应后端 DailyScan 定时扫描的物化结果）
 *
 * 命中条件：距上次到店 >= 规则周期。为了让「今日/全部/已处理」三档筛选都有内容，
 * 这里按客户显式指定演示状态（真实环境由扫描任务按规则自动决定）。
 * cycle_days = 0 的客户（如阿珍）不参与扫描 —— 没配周期就不打扰客人。
 */
const SEED_STATUS = { 9001: 0, 9002: 0, 9003: 1, 9004: 0, 9005: 0, 9006: 2, 9007: 3 }

function seedTasks() {
  db.tasks = []
  db.customers.forEach((customer) => {
    if (!(customer.id in SEED_STATUS)) return
    const rule = pickRule(customer)
    const last = lastVisitBeforeToday(customer.id)
    if (!rule || !last) return
    const dueDate = addDays(last.visit_time, rule.interval_days)
    const status = SEED_STATUS[customer.id]
    db.tasks.push({
      id: nextId(),
      app_id: SHOP.app_id,
      customer_id: customer.id,
      rule_id: rule.id,
      due_date: dueDate,
      status,
      script_text: buildScript(customer, rule),
      benefit_text: rule.benefit_text,
      remind_time: status === 1 ? last.visit_time : null,
      create_time: last.visit_time,
      update_time: null
    })
  })
}

seedTasks()

/* ---------------- 查询组装（对齐后端 todoList 的回填逻辑） ---------------- */

function decorate(task) {
  const c = db.customers.find((x) => x.id === Number(task.customer_id)) || {}
  const st = Number(task.status)
  // send_status 推导（与后端 todoList 一致）：
  //   已提醒 + 送出证据（share_script / mark_sent）→ 2 已发送
  //   已提醒 + 只做过提醒动作（copy_script 等）     → 1 已复制·待微信发（仅提示）
  //   其余（含退回待提醒的）                      → 0
  let sendStatus = 0
  if (st === 1) {
    sendStatus = inActions(db.taskLogs, task.id, SENT_ACTIONS)
      ? 2
      : inActions(db.taskLogs, task.id, REMIND_ACTIONS)
        ? 1
        : 0
  }
  return {
    ...task,
    customer_name: c.name || '',
    customer_phone: c.phone || '',
    customer_wechat: c.wechat || '',
    project_name: c.project_name || '',
    cycle_days: c.cycle_days || 0,
    last_visit_time: c.last_visit_time || null,
    status_text: TASK_STATUS_TEXT[st] || '未知',
    send_status: sendStatus,
    send_status_text: SEND_STATUS_TEXT[sendStatus] || ''
  }
}

function paginate(list, params = {}) {
  const page = Number(params.page || 1)
  const limit = Number(params.limit || 10)
  const start = (page - 1) * limit
  return {
    total: list.length,
    per_page: limit,
    current_page: page,
    last_page: Math.max(Math.ceil(list.length / limit), 1),
    data: list.slice(start, start + limit)
  }
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
    return a.id - b.id
  })
}

function taskList(params = {}) {
  const today = fmt(new Date())
  let list = [...db.tasks]

  if (!params.all) {
    list = list.filter((t) => t.due_date <= today && [0, 1].includes(Number(t.status)))
  }
  if (params.status !== undefined && params.status !== '' && params.status !== null) {
    list = list.filter((t) => Number(t.status) === Number(params.status))
  }
  // 发送状态筛选（与后端一致）：待微信发=已提醒且复制过、没标过已发送；已发送=有 mark_sent 日志
  if (params.send_status !== undefined && params.send_status !== '' && params.send_status !== null) {
    const ss = Number(params.send_status)
    if (ss === 1) {
      list = list.filter(
        (t) =>
          Number(t.status) === 1 &&
          inActions(db.taskLogs, t.id, REMIND_ACTIONS) &&
          !inActions(db.taskLogs, t.id, SENT_ACTIONS)
      )
    } else if (ss === 2) {
      list = list.filter((t) => Number(t.status) === 1 && inActions(db.taskLogs, t.id, SENT_ACTIONS))
    }
  }
  if (params.due_date) {
    list = list.filter((t) => t.due_date === params.due_date)
  }

  // 今日清单按「逾期越久越靠前」排序，老板先处理最该打的电话
  const rows = sortTasks(list).map(decorate)

  // 首页卡片流只取前 N 条：limit 参数由前端传 5
  return paginate(rows, params)
}

function customerDetail(id) {
  const customer = db.customers.find((c) => c.id === Number(id))
  if (!customer) throw mockError('客户不存在')
  const visits = db.visits
    .filter((v) => Number(v.customer_id) === Number(id))
    .sort((a, b) => (a.visit_time < b.visit_time ? 1 : -1))
  const tasks = db.tasks
    .filter((t) => Number(t.customer_id) === Number(id))
    .map(decorate)
    .sort((a, b) => (a.due_date < b.due_date ? 1 : -1))
  return { customer, visits, tasks }
}

function boardData() {
  const today = fmt(new Date())
  const monthStart = today.slice(0, 8) + '01'

  const todayVisits = db.visits.filter((v) => String(v.visit_time).slice(0, 10) === today)
  const todayVisitCount = todayVisits.length
  const todayVisitAmount = todayVisits.reduce((s, v) => s + Number(v.amount || 0), 0)

  const pending = db.tasks.filter((t) => t.due_date <= today && [0, 1].includes(Number(t.status)))
  // 今日进度（新口径：复制话术即已提醒）：已提醒 / 待微信发（复制过、没标过已发送，仅展示）
  const remindedToday = pending.filter((t) => Number(t.status) === 1).length
  const pendingSend = pending.filter(
    (t) =>
      Number(t.status) === 1 &&
      inActions(db.taskLogs, t.id, REMIND_ACTIONS) &&
      !inActions(db.taskLogs, t.id, SENT_ACTIONS)
  ).length

  // 提醒→回店转化率：本月提醒过的任务里，已回店的比例
  const remindedTasks = db.tasks.filter(
    (t) => String(t.remind_time || '').slice(0, 10) >= monthStart && [1, 2].includes(Number(t.status))
  )
  const recallReminded = remindedTasks.length
  const recallClosed = remindedTasks.filter((t) => Number(t.status) === 2).length
  const recallRate = recallReminded > 0 ? Math.round((recallClosed / recallReminded) * 1000) / 10 : 0

  // 本月复购率 = 本月到店 >=2 次客户数 / 本月有到店客户数
  const monthVisits = db.visits.filter((v) => String(v.visit_time).slice(0, 10) >= monthStart)
  const byCustomer = {}
  monthVisits.forEach((v) => {
    byCustomer[v.customer_id] = (byCustomer[v.customer_id] || 0) + 1
  })
  const visitCustomers = Object.keys(byCustomer).length
  const repeatCustomers = Object.values(byCustomer).filter((n) => n >= 2).length
  const repurchaseRate = visitCustomers
    ? Math.round((repeatCustomers / visitCustomers) * 1000) / 10
    : 0

  // 预计挽回 = 待提醒客户最近一次到店金额之和
  const estimated = pending.reduce((sum, t) => {
    const last = lastVisitOf(t.customer_id)
    return sum + (last ? Number(last.amount || 0) : 0)
  }, 0)

  const trend = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const day = fmt(d)
    trend.push({
      date: day,
      visits: db.visits.filter((v) => String(v.visit_time).slice(0, 10) === day).length,
      tasks: db.tasks.filter((t) => t.due_date === day).length
    })
  }

  return {
    today_visit_count: todayVisitCount,
    today_visit_amount: Math.round(todayVisitAmount * 100) / 100,
    pending_count: pending.length,
    today_reminded: remindedToday,
    pending_send: pendingSend,
    repurchase_rate: repurchaseRate,
    // 提醒→回店转化率（本月有 remind_time 且状态为已提醒/已到店的任务中，已回店的占比）
    recall_reminded: recallReminded,
    recall_closed: recallClosed,
    recall_recovery_rate: recallRate,
    estimated_recovery: Math.round(estimated * 100) / 100,
    customer_count: db.customers.filter((c) => Number(c.status) === 1).length,
    trend,
    last_scan_time: db.scanStale ? offsetOnlyDate(2) + ' 08:05:00' : fmtTime(new Date()),
    scan_stale: db.scanStale
  }
}

/* ---------------- 路由表 ---------------- */

const routes = [
  /** 验证码：真实后端返回 data:image/png;base64，这里给一个 1x1 透明图占位 */
  ['GET', '/tenantApp/captcha', () => ({ result: 1, uuid: 'mock-uuid-' + Date.now(), image: BLANK_PNG })],

  [
    'POST',
    '/tenantApp/login',
    () => ({
      token_type: 'Bearer',
      expires_in: 10800,
      access_token: 'mock-token-' + Date.now(),
      refresh_token: 'mock-refresh-' + Date.now()
    })
  ],

  ['GET', '/tenantApp/system/user', () => OPERATOR],

  ['GET', '/tenantApp/shop/info', () => shopInfo()],

  ['GET', '/tenantApp/task/index', (p) => taskList(p)],

  [
    'POST',
    '/tenantApp/task/action',
    (p) => {
      const task = db.tasks.find((t) => t.id === Number(p.id))
      if (!task) throw mockError('任务不存在')
      // copy_script / share_script：复制或分享即已提醒（与后端一致），仅待提醒时推进、幂等
      if (p.action === 'copy_script' || p.action === 'share_script') {
        if (Number(task.status) === 0) {
          task.status = 1
          task.remind_time = fmtTime(new Date())
        }
      } else {
        const map = { mark_sent: 1, mark_done: 1, mark_visit: 2, ignore: 3, restore: 0 }
        if (map[p.action] !== undefined) {
          task.status = map[p.action]
          if (p.action === 'mark_sent' || p.action === 'mark_done') task.remind_time = fmtTime(new Date())
        }
      }
      db.taskLogs.unshift({
        id: nextId(),
        task_id: task.id,
        action: p.action,
        operator_id: OPERATOR.id,
        create_time: fmtTime(new Date())
      })
      return {}
    }
  ],

  [
    'GET',
    '/tenantApp/task/logs',
    (p) => db.taskLogs.filter((l) => Number(l.task_id) === Number(p.task_id))
  ],

  [
    'GET',
    '/tenantApp/customer/index',
    (p) => {
      let list = db.customers.filter((c) => (p.status === '' || p.status === undefined
        ? true
        : Number(c.status) === Number(p.status)))
      if (p.name) list = list.filter((c) => c.name.includes(p.name))
      if (p.phone) list = list.filter((c) => c.phone.includes(p.phone))
      if (p.project_name) list = list.filter((c) => c.project_name.includes(p.project_name))
      list = list.map((c) => {
        const last = lastVisitOf(c.id)
        return {
          ...c,
          visits_count: db.visits.filter((v) => Number(v.customer_id) === c.id).length,
          total_amount: db.visits
            .filter((v) => Number(v.customer_id) === c.id)
            .reduce((s, v) => s + Number(v.amount || 0), 0),
          last_amount: last ? Number(last.amount || 0) : 0
        }
      })
      return paginate(list, p)
    }
  ],

  ['GET', '/tenantApp/customer/read', (p) => customerDetail(p.id)],

  [
    'GET',
    '/tenantApp/customer/options',
    (p) =>
      db.customers
        .filter((c) => Number(c.status) === 1)
        .filter((c) => !p.name || c.name.includes(p.name))
        .map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          project_name: c.project_name,
          last_visit_time: c.last_visit_time
        }))
  ],

  [
    'POST',
    '/tenantApp/visit/save',
    (p) => {
      const customer = db.customers.find((c) => c.id === Number(p.customer_id))
      if (!customer) throw mockError('客户不存在')
      if (!p.visit_time) throw mockError('到店时间不能为空')
      const row = {
        id: nextId(),
        app_id: SHOP.app_id,
        customer_id: Number(p.customer_id),
        project_name: p.project_name || customer.project_name,
        amount: Number(p.amount || 0),
        visit_time: String(p.visit_time).replace('T', ' ').slice(0, 19),
        remark: p.remark || '',
        create_time: fmtTime(new Date())
      }
      if (row.visit_time.length === 16) row.visit_time += ':00'
      db.visits.push(row)
      // 回写客户上次到店时间（后端 后端到店逻辑 同款行为）
      if (!customer.last_visit_time || row.visit_time > customer.last_visit_time) {
        customer.last_visit_time = row.visit_time
      }
      if (p.project_name) customer.project_name = p.project_name

      // 到店自动闭环（与后端 后端到店闭环逻辑 同款）：
      // 该客户 status ∈ {0,1} 且 due_date <= 到店日 的任务 → 已到店(2) + 落 mark_visit 日志
      const visitDate = row.visit_time.slice(0, 10)
      const opened = db.tasks.filter(
        (t) =>
          Number(t.customer_id) === Number(p.customer_id) &&
          [0, 1].includes(Number(t.status)) &&
          String(t.due_date) <= visitDate
      )
      opened.forEach((t) => {
        t.status = 2
        db.taskLogs.unshift({
          id: nextId(),
          task_id: t.id,
          action: 'mark_visit',
          operator_id: OPERATOR.id,
          create_time: fmtTime(new Date())
        })
      })
      return { id: row.id, auto_closed: opened.length }
    }
  ],

  [
    'GET',
    '/tenantApp/visit/index',
    (p) => {
      let list = db.visits
      if (p.customer_id) list = list.filter((v) => Number(v.customer_id) === Number(p.customer_id))
      list = [...list].sort((a, b) => (a.visit_time < b.visit_time ? 1 : -1))
      return paginate(list, p)
    }
  ],

  [
    'GET',
    '/tenantApp/rule/index',
    (p) => {
      let list = [...db.rules]
      if (p.enabled !== undefined && p.enabled !== '') {
        list = list.filter((r) => Number(r.enabled) === Number(p.enabled))
      }
      return paginate(list, p)
    }
  ],

  [
    'POST',
    '/tenantApp/rule/save',
    (p) => {
      if (!p.rule_name) throw mockError('规则名称不能为空')
      const days = Number(p.interval_days || 0)
      if (days <= 0 || days > 365) throw mockError('触发周期须在 1-365 天之间')
      const id = nextId()
      db.rules.push({
        id,
        rule_name: p.rule_name,
        project_name: p.project_name || '',
        interval_days: days,
        template_id: Number(p.template_id || 9001),
        benefit_text: p.benefit_text || '',
        enabled: p.enabled === undefined ? 1 : Number(p.enabled),
        create_time: fmtTime(new Date())
      })
      return { id }
    }
  ],

  [
    'POST',
    '/tenantApp/rule/toggle',
    (p) => {
      const rule = db.rules.find((r) => r.id === Number(p.id))
      if (!rule) throw mockError('规则不存在')
      rule.enabled = Number(rule.enabled) === 1 ? 0 : 1
      return {}
    }
  ],

  ['GET', '/tenantApp/board/index', () => boardData()],

  /** mock 专属：模拟「扫描心跳执行完成」，用于「立即刷新」演示 */
  [
    'POST',
    '/tenantApp/board/refresh',
    () => {
      db.scanStale = false
      return { last_scan_time: fmtTime(new Date()), scan_stale: false }
    }
  ]
]

/** 1x1 透明 PNG（占位验证码图，避免 mock 下 img 报错） */
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

function shopInfo() {
  const expire = SHOP.expire_time
  const remain = expire
    ? Math.round(
        (new Date(String(expire).replace(/-/g, '/')).setHours(0, 0, 0, 0) -
          new Date().setHours(0, 0, 0, 0)) /
          86400000
      )
    : null
  return {
    app_id: SHOP.app_id,
    name: SHOP.name,
    industry: SHOP.industry,
    contact_name: SHOP.contact_name,
    contact_phone: SHOP.contact_phone,
    expire_time: expire,
    remain_days: remain,
    status: SHOP.status
  }
}

function mockError(message) {
  const err = new Error(message)
  err.isMockBusinessError = true
  return err
}

/* ---------------- 派发 ---------------- */

export function mockRequest({ url, method = 'GET', params = {} }) {
  const path = String(url).split('?')[0]
  const query = { ...params, ...parseQuery(String(url)) }
  const upper = String(method).toUpperCase()

  const hit = routes.find(([m, p]) => m === upper && p === path)
  if (!hit) {
    return Promise.reject(mockError(`mock 未实现接口：${upper} ${path}`))
  }

  return new Promise((resolve, reject) => {
    // 加一点延迟，让 loading / 下拉加载等状态肉眼可见
    setTimeout(() => {
      try {
        resolve(clone(hit[2](query)))
      } catch (e) {
        reject(e)
      }
    }, 180)
  })
}

function parseQuery(url) {
  const out = {}
  const qs = String(url).split('?')[1]
  if (!qs) return out
  qs.split('&').forEach((kv) => {
    const [k, v = ''] = kv.split('=')
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v)
  })
  return out
}

/** 供调试/演示查看当前 mock 状态 */
export function mockSnapshot() {
  return {
    tasks: db.tasks.length,
    pending: taskList({ limit: 100 }).total,
    customers: db.customers.length,
    rules: db.rules.length,
    scanStale: db.scanStale
  }
}
