<script setup>
/**
 * 全部待跟进
 *
 * 筛选直接映射后端参数（todoList 认 status / send_status / due_date / all）：
 *   今日   → {}                            默认：due_date <= 今天 且 状态 0/1
 *   全部   → { all: 1 }                    不加日期与状态过滤，看全量
 *   待微信发 → { all: 1, send_status: 1 }  复制过话术的（仅展示，不阻塞）
 *   已处理 → { all: 1, status: 2 | 3 }     二级切「已到店 / 已忽略」
 *
 * 发状态（send_status）由后端按「任务状态 + 日志」实时推导，不落库。
 * 2026-10-10 起复制话术即记已提醒，不再有「标记为已发送」必走路径。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import BottomTab from '@/components/BottomTab.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchTaskList, actionTask, TASK_ACTION } from '@/api/task'
import { openWechat } from '@/utils/wechat'
import { toast, toastAction, hideBar } from '@/utils/toast'

const PAGE_SIZE = 10

const SCOPES = [
  { key: 'today', label: '今日' },
  { key: 'all', label: '全部' },
  { key: 'send', label: '待微信发' },
  { key: 'handled', label: '已处理' }
]

const HANDLED = [
  { key: 2, label: '已到店' },
  { key: 3, label: '已忽略' }
]

const route = useRoute()
const router = useRouter()
const scope = ref('today')
const handledStatus = ref(2)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const ignoringId = ref(0)

const mode = computed(() => (scope.value === 'handled' ? 'history' : 'todo'))
const hasMore = computed(() => rows.value.length < total.value)

const emptyText = computed(() => {
  if (scope.value === 'today') return '今天没有要提醒的人'
  if (scope.value === 'all') return '还没有任何提醒记录'
  if (scope.value === 'send') return '没有待微信发的提醒'
  return handledStatus.value === 2 ? '还没有回店的记录' : '还没有被忽略的提醒'
})

function currentParams(p) {
  if (scope.value === 'handled') {
    return { scope: 'handled', status: handledStatus.value, page: p, limit: PAGE_SIZE }
  }
  if (scope.value === 'send') {
    return { scope: 'all', send_status: 1, page: p, limit: PAGE_SIZE }
  }
  return { scope: scope.value, page: p, limit: PAGE_SIZE }
}

async function load(reset = true) {
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }
  try {
    const res = await fetchTaskList(currentParams(page.value))
    const list = res?.data || []
    rows.value = reset ? list : [...rows.value, ...list]
    total.value = Number(res?.total || list.length)
  } catch (e) {
    if (reset) rows.value = []
    toast(e.message || '加载失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function switchScope(key) {
  if (scope.value === key) return
  scope.value = key
}

function switchHandled(key) {
  if (handledStatus.value === key) return
  handledStatus.value = key
}

function loadMore() {
  if (loadingMore.value || loading.value || !hasMore.value) return
  page.value += 1
  load(false)
}

/** 触底自动加载（手机上没有「下一页」的概念） */
function onScroll() {
  const doc = document.documentElement
  if (doc.scrollHeight - doc.scrollTop - window.innerHeight < 160) loadMore()
}

function onVisit(task) {
  router.push({ path: '/checkin', query: { task_id: task.id, customer_id: task.customer_id } })
}

/** 忽略：即时移出 + 撤销（与首页一致，不弹大确认框） */
async function onIgnore(task) {
  if (ignoringId.value) return
  ignoringId.value = task.id
  const index = rows.value.findIndex((t) => t.id === task.id)
  const snapshot = { ...task }
  rows.value = rows.value.filter((t) => t.id !== task.id)
  total.value = Math.max(total.value - 1, 0)
  try {
    await actionTask(task.id, TASK_ACTION.IGNORE)
    toastAction(`已忽略「${snapshot.customer_name}」`, '撤销', () => undoIgnore(snapshot, index))
  } catch (e) {
    rows.value.splice(Math.min(Math.max(index, 0), rows.value.length), 0, snapshot)
    total.value += 1
    toast(e.message || '忽略失败，请重试')
  } finally {
    ignoringId.value = 0
  }
}

async function undoIgnore(task, index) {
  try {
    await actionTask(task.id, TASK_ACTION.RESTORE)
    rows.value.splice(Math.min(Math.max(index, 0), rows.value.length), 0, task)
    total.value += 1
    toast('已恢复')
  } catch (e) {
    hideBar()
    toast(e.message || '恢复失败，可在「已处理」里找回')
  }
}

function onOpen(task) {
  router.push(`/customer/${task.customer_id}`)
}

/* ---------------- 复制话术 = 已提醒（与首页一致，不弹教程浮层） ---------------- */

function onCopied(task, mode) {
  const t = rows.value.find((x) => x.id === task.id)
  if (t) {
    if (Number(t.status) === 0) {
      t.status = 1
      t.status_text = '已提醒'
    }
    if (Number(t.send_status) === 0) {
      t.send_status = 1
      t.send_status_text = '已复制·待微信发'
    }
    // 分享成功 = 真的发出去了，不再挂「待微信发」
    if (mode === 'share') {
      t.send_status = 2
      t.send_status_text = '已发送'
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

/** 退回待提醒：在「待微信发」筛选下该条要移出（不再是待微信发） */
async function onUndo(task) {
  try {
    await actionTask(task.id, TASK_ACTION.RESTORE)
    if (scope.value === 'send') {
      rows.value = rows.value.filter((x) => x.id !== task.id)
      total.value = Math.max(total.value - 1, 0)
    } else {
      const t = rows.value.find((x) => x.id === task.id)
      if (t) {
        t.status = 0
        t.status_text = '待提醒'
        t.send_status = 0
        t.send_status_text = ''
      }
    }
    toast('已退回待提醒')
  } catch (e) {
    toast(e.message || '操作失败，请重试')
  }
}

watch([scope, handledStatus], () => load(true))

onMounted(() => {
  // 深链支持：?filter=send 直接落到「待微信发」
  const f = String(route.query.filter || '')
  if (f === 'send') scope.value = 'send'
  load(true)
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="page">
    <NavBar title="待跟进" show-back />

    <div class="chips">
      <button
        v-for="item in SCOPES"
        :key="item.key"
        type="button"
        :class="['chip', scope === item.key ? 'is-active' : '']"
        @click="switchScope(item.key)"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="scope === 'handled'" class="subchips">
      <button
        v-for="item in HANDLED"
        :key="item.key"
        type="button"
        :class="['subchip', handledStatus === item.key ? 'is-active' : '']"
        @click="switchHandled(item.key)"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="page-body">
      <EmptyState v-if="loading" loading text="" />

      <EmptyState
        v-else-if="!rows.length"
        :text="emptyText"
        hint="每天自动扫描后，命中提醒规则的人会出现在这里"
        action-text="回首页看看"
        @action="router.replace('/today')"
      />

      <template v-else>
        <TaskCard
          v-for="task in rows"
          :key="task.id"
          :task="task"
          :mode="mode"
          :pre-expand="scope === 'send'"
          @visit="onVisit"
          @ignore="onIgnore"
          @open="onOpen"
          @copied="onCopied"
          @undo="onUndo"
        />

        <div class="loading-more">
          <template v-if="loadingMore">加载中…</template>
          <template v-else-if="hasMore">
            <button type="button" class="load-btn" @click="loadMore">加载更多</button>
          </template>
          <template v-else>共 {{ total }} 条，到底了</template>
        </div>
      </template>
    </div>

    <BottomTab />
  </div>
</template>

<style scoped>
/* 5 档筛选在窄屏放不下时横向滑动，不要换行挤压 */
.chips {
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
}

.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  flex: none;
}

.subchips {
  display: flex;
  gap: var(--sp-1);
  padding: 0 var(--sp-2) var(--sp-2);
  background: var(--c-white);
  position: sticky;
  top: calc(var(--h-nav) + 46px);
  z-index: 4;
}

.subchip {
  padding: 3px 12px;
  border-radius: var(--r-chip);
  border: 1px solid var(--c-pink-line);
  color: var(--c-text-sub);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.subchip.is-active {
  background: var(--c-pink-soft);
  border-color: var(--c-pink);
  color: #b96f6f;
}

.load-btn {
  padding: 6px 22px;
  border-radius: var(--r-chip);
  background: var(--c-white);
  color: var(--c-text-sub);
  font-size: var(--fs-sm);
  cursor: pointer;
}
</style>
