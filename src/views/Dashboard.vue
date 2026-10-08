<script setup>
/**
 * 老板看板
 *
 * 只回答老板最关心的 4 个问题：今天进账多少 / 今天该联系几个人 / 能挽回多少钱 / 这个月复购如何。
 * 数据来自 GET /tenantApp/board/index（一次请求拿全，不做多次轮询）。
 *
 * 「扫描超时」：后端 scan_stale = 最近一次每日扫描超过 26 小时没跑。
 * 这里不给自动轮询（网络差时只会一直转圈），而是内联提示 + 「立即刷新」按钮，
 * 让老板自己决定什么时候重拉。
 */
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import BottomTab from '@/components/BottomTab.vue'
import ScanAlert from '@/components/ScanAlert.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchBoard, refreshScanMock } from '@/api/board'
import { useMock } from '@/utils/storage'
import { money } from '@/utils/format'
import { fmtDateTime } from '@/utils/date'
import { toast } from '@/utils/toast'

const loading = ref(true)
const refreshing = ref(false)
const failed = ref(false)
const board = ref(null)

const trend = computed(() => board.value?.trend || [])
const maxVisits = computed(() => Math.max(...trend.value.map((t) => Number(t.visits) || 0), 1))

const scanStale = computed(() => !!board.value?.scan_stale)
const scanTime = computed(() =>
  board.value?.last_scan_time ? fmtDateTime(board.value.last_scan_time) : ''
)

const monthLabel = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1} 月`
})

async function load(isManual = false) {
  if (isManual) refreshing.value = true
  else loading.value = true
  try {
    // 演示模式下顺手把「扫描心跳」刷新掉，好让「立即刷新」的闭环看得见
    if (isManual && useMock()) {
      try {
        await refreshScanMock()
      } catch (e) {
        /* 忽略 */
      }
    }
    board.value = await fetchBoard()
    failed.value = false
    if (isManual) toast('已刷新')
  } catch (e) {
    failed.value = true
    if (!board.value) board.value = null
    if (isManual) toast(e.message || '刷新失败，稍后再试')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => load(false))
</script>

<template>
  <div class="page">
    <NavBar title="看板" />

    <div class="page-body">
      <ScanAlert
        :stale="scanStale"
        :last-time="scanTime"
        :loading="refreshing"
        :failed="failed"
        @refresh="load(true)"
      />

      <EmptyState v-if="loading" loading text="" />

      <EmptyState
        v-else-if="!board"
        text="看板数据没取到"
        hint="确认后端服务正常后重试"
        action-text="立即刷新"
        @action="load(true)"
      />

      <template v-else>
        <section class="hero">
          <p class="hero__label">今日到店 / 营业额</p>
          <div class="hero__main">
            <strong class="hero__num">{{ board.today_visit_count }}</strong>
            <span class="hero__unit">人</span>
            <strong class="hero__amount">{{ money(board.today_visit_amount) }}</strong>
          </div>
          <p class="hero__foot">{{ monthLabel }}复购率 {{ board.repurchase_rate }}%（回店 2 次以上占比）</p>
        </section>

        <section class="grid">
          <div class="metric">
            <span class="metric__label">今日待提醒</span>
            <strong class="metric__num">{{ board.pending_count }}</strong>
            <span class="metric__unit">人</span>
          </div>
          <div class="metric metric--warm">
            <span class="metric__label">预计可挽回</span>
            <strong class="metric__num">{{ money(board.estimated_recovery) }}</strong>
          </div>
          <!-- 提醒→回店：判断「人工私聊值不值得」的核心数据（到店即自动闭环，不靠手点） -->
          <div class="metric">
            <span class="metric__label">提醒→回店</span>
            <strong class="metric__num">{{ board.recall_recovery_rate }}%</strong>
            <span class="metric__unit">
              已提醒 {{ board.recall_reminded || 0 }} 人 · 回店 {{ board.recall_closed || 0 }} 人
            </span>
          </div>
          <div class="metric">
            <span class="metric__label">在册客户</span>
            <strong class="metric__num">{{ board.customer_count }}</strong>
            <span class="metric__unit">人</span>
          </div>
        </section>

        <section class="card mt-2">
          <div class="row--between">
            <span class="t-title">近 7 日到店</span>
            <span class="t-weak">共 {{ trend.reduce((s, t) => s + Number(t.visits || 0), 0) }} 人次</span>
          </div>

          <div class="bars">
            <div v-for="item in trend" :key="item.date" class="bar">
              <div class="bar__track">
                <div
                  class="bar__fill"
                  :style="{ height: `${Math.max((Number(item.visits) / maxVisits) * 100, item.visits ? 8 : 0)}%` }"
                ></div>
              </div>
              <span class="bar__value">{{ item.visits }}</span>
              <span class="bar__label">{{ item.date.slice(8) }}</span>
            </div>
          </div>

          <p class="t-weak mt-1">数字为「到店人次」，柱高按 7 日内最大值等比缩放</p>
        </section>

        <p class="foot-tip">
          数据每天由系统自动扫描更新{{ scanTime ? `（上次 ${scanTime}）` : '' }}，不用手动刷新
        </p>
      </template>
    </div>

    <BottomTab />
  </div>
</template>

<style scoped>
.hero {
  padding: var(--sp-3) var(--sp-2);
  border-radius: var(--r-card);
  background: linear-gradient(135deg, var(--c-pink) 0%, #fadada 100%);
  color: #6f4343;
}

.hero__label {
  font-size: var(--fs-md);
  opacity: 0.85;
}

.hero__main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 6px;
}

.hero__num {
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
}

.hero__unit {
  font-size: var(--fs-base);
}

.hero__amount {
  margin-left: auto;
  font-size: 20px;
  font-weight: 600;
}

.hero__foot {
  margin-top: 6px;
  font-size: var(--fs-sm);
  opacity: 0.8;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-1);
  margin-top: var(--sp-1);
}

.metric {
  padding: var(--sp-2);
  border-radius: var(--r-card);
  background: var(--c-white);
  box-shadow: var(--shadow-card);
}

.metric--warm {
  background: #fff8ec;
}

.metric__label {
  display: block;
  font-size: var(--fs-sm);
  color: var(--c-text-sub);
}

.metric__num {
  display: inline-block;
  margin-top: 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--c-pink-deep);
}

.metric__unit {
  margin-left: 4px;
  font-size: var(--fs-xs);
  color: var(--c-text-weak);
}

.bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
  height: 120px;
  margin-top: var(--sp-2);
}

.bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar__track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar__fill {
  width: 60%;
  min-height: 2px;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, var(--c-pink) 0%, var(--c-pink-deep) 100%);
}

.bar__value {
  margin-top: 4px;
  font-size: var(--fs-xs);
  color: var(--c-text-sub);
}

.bar__label {
  font-size: var(--fs-xs);
  color: var(--c-text-weak);
}

.foot-tip {
  margin-top: var(--sp-2);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
  line-height: 1.6;
}
</style>
