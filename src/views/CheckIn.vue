<script setup>
/**
 * 快速录到店
 *
 * 从待跟进卡片「已到店」调起，因此：
 *   - 客户锁定，不让改（避免老板选错人，录单要 10 秒完成）
 *   - 项目 / 金额默认取这位客户上一次到店的消费（多数情况直接确认即可）
 *   - 时间默认现在，可改（补录昨天忘录的单）
 * 提交后由**后端**顺带闭环该客户的提醒（到店自动闭环，2026-10-12）——
 * 前端不再单独调 mark_visit：录单这一个动作就够，闭环是它的副作用。
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchCustomerDetail } from '@/api/customer'
import { addVisit } from '@/api/visit'
import { toLocalInput, daysText } from '@/utils/date'
import { money, maskPhone } from '@/utils/format'
import { toast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()

const customerId = computed(() => Number(route.query.customer_id || 0))
const taskId = computed(() => Number(route.query.task_id || 0))

const loading = ref(true)
const submitting = ref(false)
const customer = ref({})
const lastVisit = ref(null)

const form = reactive({
  project_name: '',
  amount: '',
  visit_time: toLocalInput(new Date()),
  remark: ''
})

const locked = computed(() => !!taskId.value)

/** 进入来源：从待办卡片进来会带 task_id（录完顺手闭环），从档案进来只带 customer_id */
const sourceText = computed(() => (locked.value ? '从待办进入' : '从档案进入'))

async function load() {
  if (!customerId.value) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const data = await fetchCustomerDetail(customerId.value)
    customer.value = data.customer || {}
    const visits = data.visits || []
    lastVisit.value = visits[0] || null
    // 默认值：项目优先取上次实际消费的项目，其次取客户档案里的常做项目
    form.project_name = lastVisit.value?.project_name || customer.value.project_name || ''
    form.amount = lastVisit.value ? String(lastVisit.value.amount ?? '') : ''
  } catch (e) {
    toast(e.message || '客户信息加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function fillLast() {
  if (!lastVisit.value) return
  form.project_name = lastVisit.value.project_name || form.project_name
  form.amount = String(lastVisit.value.amount ?? '')
  toast('已套用上次消费')
}

async function submit() {
  if (submitting.value) return
  if (!customerId.value) {
    toast('缺少客户信息，请从待跟进里进入')
    return
  }
  if (!form.visit_time) {
    toast('请选择到店时间')
    return
  }
  if (form.amount !== '' && Number(form.amount) < 0) {
    toast('金额不能为负')
    return
  }

  submitting.value = true
  try {
    const res = await addVisit({
      customer_id: customerId.value,
      project_name: form.project_name,
      amount: form.amount === '' ? 0 : form.amount,
      visit_time: form.visit_time,
      remark: form.remark
    })

    // 到店自动闭环（2026-10-12）：后端录单时已顺带关闭该客户所有未闭环提醒，
    // 前端不再单独调 mark_visit（否则会重复落日志、且只能闭环卡片上那一条）。
    const closed = Number(res?.auto_closed || 0)
    toast(closed > 0 ? `到店已记录，顺手闭环了 ${closed} 条提醒` : '到店已记录，辛苦啦')
    setTimeout(() => {
      if (locked.value) router.replace('/today')
      else router.replace(`/customer/${customerId.value}`)
    }, 500)
  } catch (e) {
    toast(e.message || '录入失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page page--no-tab">
    <NavBar title="录到店" show-back />

    <EmptyState v-if="loading" loading text="" />

    <EmptyState
      v-else-if="!customerId"
      text="没找到要录的客户"
      hint="请从「待跟进」里点某位客户的「已到店」进入"
      action-text="去待跟进"
      @action="router.replace('/today')"
    />

    <div v-else class="page-body">
      <div class="lock">
        <div class="lock__avatar">{{ (customer.name || '客')[0] }}</div>
        <div class="lock__info">
          <p class="lock__name">
            {{ customer.name }}
            <span class="lock__tag">{{ sourceText }}</span>
          </p>
          <p class="t-weak">
            <template v-if="customer.phone">{{ maskPhone(customer.phone) }} · </template>
            上次到店 {{ customer.last_visit_time ? daysText(customer.last_visit_time) : '暂无记录' }}
          </p>
          <p class="t-weak">今天 · 到店时间默认现在</p>
        </div>
      </div>

      <div v-if="lastVisit" class="last">
        <span class="t-weak">上次：{{ lastVisit.project_name }} {{ money(lastVisit.amount) }}</span>
        <button type="button" class="last__btn" @click="fillLast">套用上次</button>
      </div>

      <div class="field mt-2">
        <div class="field-item">
          <span class="field-label">项目</span>
          <input v-model.trim="form.project_name" class="field-input" placeholder="如 猫眼胶" />
        </div>
        <div class="field-item">
          <span class="field-label">金额</span>
          <input
            v-model="form.amount"
            class="field-input"
            type="number"
            inputmode="decimal"
            min="0"
            placeholder="0"
          />
          <span class="t-weak">元</span>
        </div>
        <div class="field-item">
          <span class="field-label">到店时间</span>
          <input v-model="form.visit_time" class="field-input" type="datetime-local" />
        </div>
        <div class="field-item">
          <span class="field-label">备注</span>
          <input v-model.trim="form.remark" class="field-input" placeholder="可不填" />
        </div>
      </div>

      <button
        type="button"
        class="btn btn--primary btn--block mt-3"
        :disabled="submitting"
        @click="submit"
      >
        {{ submitting ? '保存中…' : '确认到店' }}
      </button>

      <p class="hint">录完自动把这位客户的提醒标为「已到店」，下次到期会重新提醒</p>
    </div>
  </div>
</template>

<style scoped>
.lock {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border-radius: var(--r-card);
  background: var(--c-white);
  box-shadow: var(--shadow-card);
}

.lock__avatar {
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-pink);
  color: #7d4a4a;
  font-size: var(--fs-title);
  font-weight: 600;
}

.lock__info {
  flex: 1;
  min-width: 0;
}

.lock__name {
  font-size: var(--fs-title);
  font-weight: 600;
}

.lock__tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--c-pink-soft);
  color: #b96f6f;
  font-size: var(--fs-xs);
  font-weight: 400;
  vertical-align: middle;
}

.last {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--sp-1);
  padding: 0 4px;
}

.last__btn {
  padding: 4px 12px;
  border-radius: var(--r-chip);
  background: var(--c-white);
  color: var(--c-pink-deep);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.hint {
  margin-top: var(--sp-2);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
  line-height: 1.6;
}
</style>
