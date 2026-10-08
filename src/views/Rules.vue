<script setup>
/**
 * 提醒规则（轻量版）
 *
 * 老板只做两件事：开/关某条规则、加一条新规则。
 * 刻意不暴露 interval_days / rule_id 这类后台字段，
 * 一律翻译成「N 天没来就提醒」这种能直接听懂的话。
 */
import { ref, reactive, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchRuleList, toggleRule, saveRule } from '@/api/rule'
import { toast } from '@/utils/toast'

const loading = ref(true)
const rows = ref([])
const togglingId = ref(0)
const showForm = ref(false)
const saving = ref(false)

const form = reactive({
  rule_name: '',
  project_name: '',
  interval_days: 21,
  benefit_text: ''
})

const PRESET_DAYS = [14, 21, 28, 45]

async function load() {
  loading.value = true
  try {
    const res = await fetchRuleList({ limit: 50 })
    rows.value = res?.data || []
  } catch (e) {
    toast(e.message || '规则加载失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function onToggle(rule) {
  if (togglingId.value) return
  togglingId.value = rule.id
  const next = Number(rule.enabled) === 1 ? 0 : 1
  try {
    await toggleRule(rule.id)
    rule.enabled = next
    toast(next === 1 ? '已开启' : '已关闭')
  } catch (e) {
    toast(e.message || '操作失败')
  } finally {
    togglingId.value = 0
  }
}

function openForm() {
  form.rule_name = ''
  form.project_name = ''
  form.interval_days = 21
  form.benefit_text = ''
  showForm.value = true
}

async function submit() {
  if (saving.value) return
  if (!form.rule_name.trim()) {
    toast('给这条规则起个名字吧')
    return
  }
  const days = Number(form.interval_days)
  if (!days || days < 1 || days > 365) {
    toast('天数请填 1 - 365 之间')
    return
  }
  saving.value = true
  try {
    await saveRule({ ...form })
    showForm.value = false
    toast('规则已添加，明天扫描开始生效')
    load()
  } catch (e) {
    toast(e.message || '添加失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page page--no-tab">
    <NavBar title="提醒规则" show-back>
      <template #right>
        <button type="button" class="top-link" @click="openForm">+ 新增</button>
      </template>
    </NavBar>

    <div class="page-body">
      <p class="intro">
        到点没来的客人，系统会在每天早上自动帮你挑出来，放进「今天该提醒谁」。
      </p>

      <EmptyState v-if="loading" loading text="" />

      <EmptyState
        v-else-if="!rows.length"
        text="还没有提醒规则"
        hint="加一条「21 天没来就提醒」，明天就有待跟进名单了"
        action-text="新增规则"
        @action="openForm"
      />

      <template v-else>
        <div v-for="rule in rows" :key="rule.id" :class="['rule', rule.enabled ? '' : 'is-off']">
          <div class="rule__main">
            <p class="rule__name">{{ rule.rule_name }}</p>
            <p class="rule__desc">
              <span class="rule__days">{{ rule.interval_days }} 天</span>没来就提醒
              <template v-if="rule.project_name">（只针对 {{ rule.project_name }}）</template>
            </p>
            <p v-if="rule.benefit_text" class="rule__benefit">话术里带上：{{ rule.benefit_text }}</p>
          </div>
          <button
            type="button"
            :class="['switch', Number(rule.enabled) === 1 ? 'is-on' : '']"
            :disabled="togglingId === rule.id"
            @click="onToggle(rule)"
          >
            <span class="switch__dot"></span>
          </button>
        </div>

        <button type="button" class="btn btn--plain btn--block mt-3" @click="openForm">
          + 新增一条规则
        </button>
      </template>
    </div>

    <!-- 新增表单：底部抽屉，避免跳页打断操作 -->
    <div v-if="showForm" class="drawer-mask" @click.self="showForm = false">
      <div class="drawer">
        <div class="drawer__head">
          <span class="t-title">新增提醒规则</span>
          <button type="button" class="drawer__close" @click="showForm = false">关闭</button>
        </div>

        <div class="field">
          <div class="field-item">
            <span class="field-label">规则名</span>
            <input
              v-model.trim="form.rule_name"
              class="field-input"
              placeholder="如：老客 21 天唤醒"
            />
          </div>
          <div class="field-item">
            <span class="field-label">适用项目</span>
            <input
              v-model.trim="form.project_name"
              class="field-input"
              placeholder="留空 = 所有项目"
            />
          </div>
          <div class="field-item">
            <span class="field-label">多少天</span>
            <input
              v-model="form.interval_days"
              class="field-input"
              type="number"
              inputmode="numeric"
              min="1"
              max="365"
            />
            <span class="t-weak">天没来就提醒</span>
          </div>
          <div class="field-item">
            <span class="field-label">权益话术</span>
            <input
              v-model.trim="form.benefit_text"
              class="field-input"
              placeholder="如：老客专享 8 折"
            />
          </div>
        </div>

        <div class="presets">
          <button
            v-for="d in PRESET_DAYS"
            :key="d"
            type="button"
            :class="['preset', Number(form.interval_days) === d ? 'is-active' : '']"
            @click="form.interval_days = d"
          >
            {{ d }} 天
          </button>
        </div>

        <button
          type="button"
          class="btn btn--primary btn--block mt-3"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? '保存中…' : '保存规则' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro {
  margin-bottom: var(--sp-2);
  padding: 0 4px;
  font-size: var(--fs-sm);
  color: var(--c-text-sub);
  line-height: 1.6;
}

.top-link {
  padding: 6px 10px;
  color: var(--c-pink-deep);
  font-size: var(--fs-md);
  cursor: pointer;
}

.rule {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border-radius: var(--r-card);
  background: var(--c-white);
  box-shadow: var(--shadow-card);
}

.rule + .rule {
  margin-top: var(--sp-2);
}

.rule.is-off {
  opacity: 0.55;
}

.rule__main {
  flex: 1;
  min-width: 0;
}

.rule__name {
  font-size: var(--fs-base);
  font-weight: 600;
}

.rule__desc {
  margin-top: 2px;
  font-size: var(--fs-sm);
  color: var(--c-text-sub);
}

.rule__days {
  color: var(--c-pink-deep);
  font-weight: 600;
}

.rule__benefit {
  margin-top: 2px;
  font-size: var(--fs-xs);
  color: var(--c-warn);
}

/* 开关 */
.switch {
  flex: none;
  position: relative;
  width: 46px;
  height: 26px;
  border-radius: 13px;
  background: #dcdcdc;
  transition: background 0.2s;
  cursor: pointer;
}

.switch.is-on {
  background: var(--c-pink-deep);
}

.switch__dot {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.switch.is-on .switch__dot {
  transform: translateX(20px);
}

/* 抽屉 */
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.drawer {
  width: 100%;
  max-width: 640px;
  padding: var(--sp-2) var(--sp-2) calc(var(--sp-3) + var(--safe-bottom));
  border-radius: 16px 16px 0 0;
  background: var(--c-bg);
}

.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px var(--sp-2);
}

.drawer__close {
  color: var(--c-text-weak);
  font-size: var(--fs-md);
  cursor: pointer;
}

.presets {
  display: flex;
  gap: var(--sp-1);
  margin-top: var(--sp-2);
}

.preset {
  flex: 1;
  padding: 8px 0;
  border-radius: var(--r-chip);
  background: var(--c-white);
  color: var(--c-text-sub);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.preset.is-active {
  background: var(--c-pink-soft);
  color: #b96f6f;
  font-weight: 600;
}
</style>
