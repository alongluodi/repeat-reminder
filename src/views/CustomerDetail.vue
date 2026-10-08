<script setup>
/**
 * 复购档案（客户详情）
 *
 * 数据来源 GET /tenantApp/customer/read → { customer, visits, tasks }
 * 注意：后端 visits / tasks 各 limit 50，超过 50 次到店的老客累计值会偏小，
 * 因此条数达到 50 时明确标注「近 50 次」，不假装是全量。
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchCustomerDetail } from '@/api/customer'
import { daysSince, daysText, fmtDateTime, gapText } from '@/utils/date'
import { money, maskPhone } from '@/utils/format'
import { toast } from '@/utils/toast'

const VISIT_LIMIT = 50

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const customer = ref({})
const visits = ref([])
const tasks = ref([])

const gapDays = computed(() => {
  const d = daysSince(customer.value.last_visit_time)
  return d === null ? '—' : d
})

const visitCount = computed(() => visits.value.length)
const isCapped = computed(() => visitCount.value >= VISIT_LIMIT)

/** 老客判定：到店 3 次及以上（规则简单可解释，老板一看就懂） */
const isOldCustomer = computed(() => visitCount.value >= 3)

const totalAmount = computed(() =>
  visits.value.reduce((s, v) => s + Number(v.amount || 0), 0)
)

const avgAmount = computed(() =>
  visitCount.value ? totalAmount.value / visitCount.value : 0
)

const latestTask = computed(() => tasks.value[0] || null)

/** 提醒状态：把任务状态拆成老板能直接读的四个字段 */
const remindInfo = computed(() => {
  const t = latestTask.value
  if (!t) {
    return { pending: '否', reminded: '否', dueDate: '—', remindTime: '—' }
  }
  const status = Number(t.status)
  return {
    pending: status === 0 || status === 1 ? '是' : '否',
    reminded: t.remind_time ? '是' : status === 1 ? '是' : '否',
    dueDate: t.due_date || '—',
    remindTime: t.remind_time ? fmtDateTime(t.remind_time) : '未提醒'
  }
})

/** 提醒状态：把 0/1/2/3 翻成人话，并补上「差点就该提醒了」的判断 */
const remindState = computed(() => {
  const c = customer.value
  if (!latestTask.value) {
    return {
      text: c.cycle_days ? `还没到提醒时间（每 ${c.cycle_days} 天）` : '未设置复购周期',
      cls: 'is-idle'
    }
  }
  const status = Number(latestTask.value.status)
  if (status === 0 || status === 1) {
    return { text: `待跟进 · 应提醒日 ${latestTask.value.due_date}`, cls: 'is-pending' }
  }
  if (status === 2) return { text: `已回店（${latestTask.value.due_date}）`, cls: 'is-done' }
  return { text: `已忽略（${latestTask.value.due_date}）`, cls: 'is-ignore' }
})

async function load() {
  loading.value = true
  try {
    const data = await fetchCustomerDetail(route.params.id)
    customer.value = data.customer || {}
    visits.value = data.visits || []
    tasks.value = data.tasks || []
  } catch (e) {
    toast(e.message || '档案加载失败')
  } finally {
    loading.value = false
  }
}

function goCheckIn() {
  router.push({ path: '/checkin', query: { customer_id: customer.value.id } })
}

onMounted(load)
</script>

<template>
  <div class="page page--no-tab">
    <NavBar title="复购档案" show-back />

    <EmptyState v-if="loading" loading text="" />

    <template v-else>
      <section class="profile">
        <div class="profile__top">
          <div class="profile__avatar">{{ (customer.name || '客')[0] }}</div>
          <div class="profile__info">
            <p class="profile__name">{{ customer.name }}</p>
            <p class="profile__meta">
              <span v-if="customer.phone">{{ maskPhone(customer.phone) }}</span>
              <span v-if="customer.wechat">· 微信 {{ customer.wechat }}</span>
            </p>
          </div>
        </div>
        <div class="profile__tags">
          <span v-if="customer.project_name" class="chip-sm">{{ customer.project_name }}</span>
          <span v-if="customer.cycle_days" class="chip-sm">
            每 {{ customer.cycle_days }} 天复购
          </span>
          <span v-if="isOldCustomer" class="chip-sm chip-sm--old">老客</span>
          <span v-for="t in String(customer.tags || '').split(',').filter(Boolean)" :key="t" class="chip-sm">
            {{ t }}
          </span>
        </div>
        <p v-if="customer.remark" class="profile__remark">备注：{{ customer.remark }}</p>
      </section>

      <section class="stats">
        <div class="stat">
          <strong class="stat__num">{{ gapDays }}</strong>
          <span class="stat__label">距上次(天)</span>
        </div>
        <div class="stat">
          <strong class="stat__num">{{ money(totalAmount) }}</strong>
          <span class="stat__label">{{ isCapped ? `近${VISIT_LIMIT}次消费` : '累计消费' }}</span>
        </div>
        <div class="stat">
          <strong class="stat__num">{{ money(avgAmount) }}</strong>
          <span class="stat__label">均客单</span>
        </div>
        <div class="stat">
          <strong class="stat__num">{{ visitCount }}</strong>
          <span class="stat__label">到店次数</span>
        </div>
      </section>

      <div class="page-body">
        <div class="card">
          <div class="row--between">
            <span class="t-title">提醒状态</span>
            <span :class="['pill', remindState.cls]">{{ remindState.text }}</span>
          </div>

          <div class="rgrid">
            <div class="rgrid__item">
              <span class="rgrid__label">待跟进</span>
              <span class="rgrid__value">{{ remindInfo.pending }}</span>
            </div>
            <div class="rgrid__item">
              <span class="rgrid__label">已提醒</span>
              <span class="rgrid__value">{{ remindInfo.reminded }}</span>
            </div>
            <div class="rgrid__item">
              <span class="rgrid__label">应提醒日</span>
              <span class="rgrid__value">{{ remindInfo.dueDate }}</span>
            </div>
            <div class="rgrid__item">
              <span class="rgrid__label">上次提醒</span>
              <span class="rgrid__value">{{ remindInfo.remindTime }}</span>
            </div>
          </div>

          <p v-if="!latestTask" class="mt-1 t-weak">
            上次到店 {{ daysText(customer.last_visit_time) }}（隔了 {{ gapText(customer.last_visit_time) }}）
          </p>
        </div>

        <button type="button" class="btn btn--primary btn--block mt-2" @click="goCheckIn">
          又有客人到店了，去录一笔
        </button>

        <div class="card mt-2">
          <div class="row--between">
            <span class="t-title">到店记录</span>
            <span class="t-weak">{{ visitCount }} 条{{ isCapped ? '（近 50 次）' : '' }}</span>
          </div>
          <ul v-if="visits.length" class="vlist">
            <li v-for="v in visits.slice(0, 20)" :key="v.id" class="vitem">
              <div class="vitem__left">
                <span class="vitem__project">{{ v.project_name || '未填项目' }}</span>
                <span class="vitem__time">{{ fmtDateTime(v.visit_time) }}</span>
              </div>
              <span class="vitem__amount">{{ money(v.amount) }}</span>
            </li>
          </ul>
          <p v-else class="empty">还没有到店记录</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.profile {
  padding: var(--sp-3) var(--sp-2);
  background: linear-gradient(180deg, var(--c-pink) -60%, var(--c-bg) 100%);
}

.profile__top {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.profile__avatar {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-white);
  color: #7d4a4a;
  font-size: 22px;
  font-weight: 600;
}

.profile__name {
  font-size: var(--fs-title-lg);
  font-weight: 600;
  color: #6f4343;
}

.profile__meta {
  margin-top: 2px;
  font-size: var(--fs-sm);
  color: #a97a7a;
}

.profile__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--sp-2);
}

.chip-sm {
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.75);
  color: #a4636a;
  font-size: var(--fs-xs);
}

.chip-sm--old {
  background: #f7d9a8;
  color: #8a6420;
  font-weight: 600;
}

/* 提醒状态四宫格 */
.rgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-1);
  margin-top: var(--sp-2);
}

.rgrid__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--c-bg);
}

.rgrid__label {
  flex: none;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.rgrid__value {
  min-width: 0;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile__remark {
  margin-top: var(--sp-1);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  font-size: var(--fs-sm);
  color: #8a5f5f;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-1);
  padding: 0 var(--sp-2);
}

.stat {
  padding: var(--sp-2) 4px;
  border-radius: var(--r-card);
  background: var(--c-white);
  text-align: center;
  box-shadow: var(--shadow-card);
}

.stat__num {
  display: block;
  font-size: var(--fs-title);
  font-weight: 700;
  color: var(--c-pink-deep);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat__label {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-xs);
  color: var(--c-text-weak);
}

.pill {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: var(--fs-sm);
}

.pill.is-pending {
  background: #fdeff0;
  color: #c2707a;
}

.pill.is-done {
  background: #f0f9f2;
  color: var(--c-success);
}

.pill.is-ignore,
.pill.is-idle {
  background: var(--c-bg);
  color: var(--c-text-weak);
}

.vlist {
  margin-top: var(--sp-1);
}

.vitem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-1) 0;
  border-top: 1px solid var(--c-line);
}

.vitem:first-child {
  border-top: none;
}

.vitem__project {
  font-size: var(--fs-base);
}

.vitem__time {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.vitem__amount {
  flex: none;
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--c-text);
}
</style>
