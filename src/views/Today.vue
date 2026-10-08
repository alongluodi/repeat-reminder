<script setup>
/**
 * 今日待跟进（首页）
 *
 * 设计目标：老板通勤路上打开，30 秒处理一个人。
 *   - 一次只展示 5 条，避免无限滚动让人焦虑（点「看看后面还有谁」再追加 5 条）
 *   - 每条卡片就 3 个动作：复制话术 / 已到店 / 忽略
 *   - 「已到店」直接跳录单页并锁定客户，回来时任务已闭环
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import BottomTab from '@/components/BottomTab.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchTaskList, actionTask, TASK_ACTION } from '@/api/task'
import { fetchBoard } from '@/api/board'
import { openWechat } from '@/utils/wechat'
import { useMock } from '@/utils/storage'
import { toast, toastAction, hideBar } from '@/utils/toast'

const PAGE_SIZE = 5
const router = useRouter()
// 演示提示只在开发环境出现：isDev 是编译期常量，生产构建里该分支会被摇掉
const isDev = import.meta.env.DEV
const mockMode = ref(isDev && useMock())

const tasks = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const ignoringId = ref(0)
const summary = ref({ pending: 0, visits: 0, amount: 0, reminded: 0, pendingSend: 0 })

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return '上午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** 今日进度：已提醒 X / N 位 · M 位待微信发（待微信发仅提示，不阻塞） */
const progressText = computed(() => {
  const done = Number(summary.value.reminded || 0)
  const all = Number(summary.value.pending || 0)
  const toSend = Number(summary.value.pendingSend || 0)
  const base = `今日进度：已提醒 ${done} / ${all} 位`
  return toSend > 0 ? `${base} · ${toSend} 位待微信发` : base
})

/** 还剩多少人没提醒（= 总数 - 已提醒），>0 才给「去处理」入口 */
const remaining = computed(() =>
  Math.max(Number(summary.value.pending || 0) - Number(summary.value.reminded || 0), 0)
)

const hasMore = computed(() => tasks.value.length < total.value)
const today = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
})

async function load(reset = true) {
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }
  try {
    const res = await fetchTaskList({ scope: 'today', page: page.value, limit: PAGE_SIZE })
    const rows = res?.data || []
    tasks.value = reset ? rows : [...tasks.value, ...rows]
    total.value = Number(res?.total || rows.length)
  } catch (e) {
    if (reset) tasks.value = []
    toast(e.message || '待跟进清单加载失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadSummary() {
  try {
    const b = await fetchBoard()
    summary.value = {
      pending: Number(b.pending_count || 0),
      visits: Number(b.today_visit_count || 0),
      amount: Number(b.today_visit_amount || 0),
      reminded: Number(b.today_reminded || 0),
      pendingSend: Number(b.pending_send || 0)
    }
  } catch (e) {
    /* 摘要失败不影响主流程 */
  }
}

function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  page.value += 1
  load(false)
}

/** 已到店：跳到录单页（带 task_id，提交后自动闭环任务） */
function onVisit(task) {
  router.push({
    path: '/checkin',
    query: { task_id: task.id, customer_id: task.customer_id }
  })
}

/**
 * 忽略：本地即时移出 + 后端记状态，底部给一次「撤销」机会。
 * 刻意不用 confirm 大弹窗 —— 老板在通勤路上点一下就处理掉，误点可撤销。
 */
async function onIgnore(task) {
  if (ignoringId.value) return
  ignoringId.value = task.id
  const index = tasks.value.findIndex((t) => t.id === task.id)
  const snapshot = { ...task }
  // 即时移出当前列表（不等网络），总数与顶部问候同步减一
  tasks.value = tasks.value.filter((t) => t.id !== task.id)
  total.value = Math.max(total.value - 1, 0)
  summary.value = {
    ...summary.value,
    pending: Math.max(summary.value.pending - 1, 0),
    pendingSend: Number(task.send_status) === 1
      ? Math.max(Number(summary.value.pendingSend || 0) - 1, 0)
      : summary.value.pendingSend
  }
  try {
    await actionTask(task.id, TASK_ACTION.IGNORE)
    toastAction(`已忽略「${snapshot.customer_name}」`, '撤销', () => undoIgnore(snapshot, index))
  } catch (e) {
    // 失败：放回原位并提示，避免「看起来忽略了其实没记上」
    tasks.value.splice(Math.min(Math.max(index, 0), tasks.value.length), 0, snapshot)
    total.value += 1
    summary.value = {
      ...summary.value,
      pending: summary.value.pending + 1,
      pendingSend: Number(snapshot.send_status) === 1
        ? Number(summary.value.pendingSend || 0) + 1
        : summary.value.pendingSend
    }
    toast(e.message || '忽略失败，请重试')
  } finally {
    ignoringId.value = 0
  }
}

/** 撤销忽略：把任务恢复成「待提醒」并放回列表原位置 */
async function undoIgnore(task, index) {
  try {
    await actionTask(task.id, TASK_ACTION.RESTORE)
    tasks.value.splice(Math.min(Math.max(index, 0), tasks.value.length), 0, task)
    total.value += 1
    summary.value = {
      ...summary.value,
      pending: summary.value.pending + 1,
      pendingSend: Number(task.send_status) === 1
        ? Number(summary.value.pendingSend || 0) + 1
        : summary.value.pendingSend
    }
    toast('已恢复')
  } catch (e) {
    hideBar()
    toast(e.message || '恢复失败，可在「全部待跟进」里找回')
  }
}

function onOpen(task) {
  router.push(`/customer/${task.customer_id}`)
}

/* ---------------- 复制话术 = 已提醒（2026-10-10 产品决策） ---------------- */

/**
 * 话术送出去：本地立即转「已提醒 + 已复制·待微信发」，卡片收起置灰；
 * 不再弹「下一步」教程浮层，也不要求回 H5 标记已发送。
 *
 * mode 由 CopyButton 回传（2026-10-12）：
 *   share → 走的是系统分享面板，话已经发出去了，只报「已发送」，不再劝他去微信
 *   copy  → 老路径，给一条底部轻提示 + 弱的「打开微信」入口
 *           （weixin:// 只拉起微信，不承诺搜索/进聊天，微信不开放这些能力）
 */
function onCopied(task, mode) {
  const t = tasks.value.find((x) => x.id === task.id)
  if (t) {
    if (Number(t.status) === 0) {
      t.status = 1
      t.status_text = '已提醒'
      summary.value.reminded = Number(summary.value.reminded || 0) + 1
    }
    if (Number(t.send_status) === 0) {
      t.send_status = 1
      t.send_status_text = '已复制·待微信发'
      summary.value.pendingSend = Number(summary.value.pendingSend || 0) + 1
    }
    // 分享成功 = 真的发出去了，不该再挂「待微信发」
    if (mode === 'share') {
      t.send_status = 2
      t.send_status_text = '已发送'
      summary.value.pendingSend = Math.max(Number(summary.value.pendingSend || 0) - 1, 0)
    }
  }
  if (mode === 'share') {
    toast(`已发送给「${task.customer_name || '客户'}」并记为已提醒`)
    return
  }
  toastAction('已复制并记为已提醒，去微信粘贴即可', '打开微信', () => {
    openWechat()
  }, 3200)
}

/** 次要修正入口：复制错了人/想重新提醒 → 退回待提醒 */
async function onUndo(task) {
  try {
    await actionTask(task.id, TASK_ACTION.RESTORE)
    const t = tasks.value.find((x) => x.id === task.id)
    if (t) {
      const wasReminded = Number(t.status) === 1
      const wasToSend = Number(t.send_status) === 1
      t.status = 0
      t.status_text = '待提醒'
      t.send_status = 0
      t.send_status_text = ''
      if (wasReminded) {
        summary.value.reminded = Math.max(Number(summary.value.reminded || 0) - 1, 0)
      }
      if (wasToSend) {
        summary.value.pendingSend = Math.max(Number(summary.value.pendingSend || 0) - 1, 0)
      }
    }
    toast('已退回待提醒')
  } catch (e) {
    toast(e.message || '操作失败，请重试')
  }
}

/** 「去处理」→ 剩余待提醒（待跟进页默认就是今日口径），不跳「待微信发」筛选 */
function gotoRecall() {
  router.push('/recall')
}

onMounted(() => {
  load(true)
  loadSummary()
})
</script>

<template>
  <div class="page">
    <NavBar title="今天该提醒谁">
      <template #right>
        <button type="button" class="top-link" @click="router.push('/recall')">全部</button>
      </template>
    </NavBar>

    <section class="hero">
      <p class="hero__greet">{{ greeting }}，今天有 <strong>{{ summary.pending }}</strong> 位该招呼一下</p>
      <p class="hero__date">{{ today }} · 今日已到店 {{ summary.visits }} 人</p>
      <button type="button" class="hero__progress" @click="gotoRecall">
        {{ progressText }}
        <span v-if="remaining > 0" class="hero__progress-more">去处理 ›</span>
      </button>
    </section>

    <div class="page-body">
      <div v-if="isDev && mockMode" class="mock-tip">
        演示模式：数据在手机本地，可随便点着体验
      </div>

      <EmptyState
        v-if="loading"
        loading
        text=""
      />
      <EmptyState
        v-else-if="!tasks.length"
        text="今天没有要提醒的人，歇会儿吧"
        hint="新的提醒会在每天自动扫描后出现在这里"
        action-text="去看看客户档案"
        @action="router.push('/customers')"
      />

      <template v-else>
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @visit="onVisit"
          @ignore="onIgnore"
          @open="onOpen"
          @copied="onCopied"
          @undo="onUndo"
        />

        <div v-if="hasMore" class="more">
          <button type="button" class="btn btn--plain btn--block" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : `看看后面还有谁（${total - tasks.length}）` }}
          </button>
        </div>
        <p v-else class="more__end">今天这 {{ total }} 位都在这儿了</p>

        <button type="button" class="all-link" @click="router.push('/recall')">
          查看全部待跟进 ›
        </button>
      </template>
    </div>

    <BottomTab />
  </div>
</template>

<style scoped>
.hero {
  padding: var(--sp-3) var(--sp-2) var(--sp-2);
  background: linear-gradient(180deg, var(--c-pink) -40%, var(--c-bg) 100%);
}

.hero__greet {
  font-size: var(--fs-title-lg);
  font-weight: 600;
  color: #6f4343;
  line-height: 1.4;
}

.hero__greet strong {
  color: var(--c-pink-deep);
  font-size: 22px;
}

.hero__date {
  margin-top: 4px;
  font-size: var(--fs-sm);
  color: #a97a7a;
}

.hero__progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  color: #8a555b;
  font-size: var(--fs-sm);
  cursor: pointer;
}

.hero__progress-more {
  color: var(--c-pink-deep);
  font-weight: 600;
}

.top-link {
  padding: 6px 10px;
  color: var(--c-pink-deep);
  font-size: var(--fs-md);
  cursor: pointer;
}

.mock-tip {
  margin-bottom: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-card);
  background: var(--c-pink-soft);
  color: #b96f6f;
  font-size: var(--fs-sm);
}

.more {
  margin-top: var(--sp-2);
}

.more__end {
  margin-top: var(--sp-2);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.all-link {
  display: block;
  width: 100%;
  margin-top: var(--sp-2);
  padding: var(--sp-2);
  text-align: center;
  color: var(--c-pink-deep);
  font-size: var(--fs-md);
  cursor: pointer;
}
</style>
