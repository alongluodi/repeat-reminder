<script setup>
/**
 * 待跟进任务卡（老板每天就看这一张张卡，30 秒处理一个人）
 *
 * 信息优先级：客户名 > 隔了多少天没来 > 做什么项目 > 话术预览 > 动作按钮
 *
 * 「已复制·待微信发」的卡片默认**收起置灰**：复制话术即记已提醒（2026-10-10 产品决策，
 * 不再要求老板回 H5 标记已发送），话还没粘到微信的人一行看完，点开仍可看话术/操作。
 */
import { computed, ref } from 'vue'
import CopyButton from './CopyButton.vue'
import { gapText } from '@/utils/date'
import { maskPhone } from '@/utils/format'

const props = defineProps({
  task: { type: Object, required: true },
  /** todo=待跟进（带动作按钮） history=已处理（只读） */
  mode: { type: String, default: 'todo' },
  /** 默认展开（「待微信发」筛选里整页都是已复制卡，不展开全是收起行） */
  preExpand: { type: Boolean, default: false }
})

const emit = defineEmits(['visit', 'ignore', 'open', 'copied', 'undo'])

const expanded = ref(!!props.preExpand)

const gap = computed(() => gapText(props.task.last_visit_time))
const status = computed(() => Number(props.task.status))
const isPending = computed(() => status.value === 0 || status.value === 1)
const isHandled = computed(() => status.value === 2 || status.value === 3)

/** 逾期天数：due_date 已过则提示「已超期 N 天」，语气更急一些 */
const overdue = computed(() => {
  if (!props.task.due_date) return 0
  const due = new Date(String(props.task.due_date).replace(/-/g, '/')).setHours(0, 0, 0, 0)
  const today = new Date().setHours(0, 0, 0, 0)
  return Math.max(Math.round((today - due) / 86400000), 0)
})

const statusText = computed(() => {
  return { 0: '待提醒', 1: '已提醒', 2: '已到店', 3: '忽略' }[status.value] || '未知'
})

/** 右侧副标签：待提醒说「没来」，已到店说「回来过」，避免文案自相矛盾 */
const gapLabel = computed(() => (status.value === 2 ? '回来过' : '没来'))

const statusClass = computed(() => {
  return { 0: 'is-pending', 1: 'is-remind', 2: 'is-visit', 3: 'is-ignore' }[status.value] || ''
})

/**
 * 发送状态（仅展示，不阻塞）：
 *   1 已复制·待微信发（复制即记已提醒，老板可能还没粘到微信 —— 橙色提示）
 *   2 已发送（旧链路数据：点过「标记为已发送」）
 */
const sendStatus = computed(() => Number(props.task.send_status || 0))
const isToSend = computed(() => sendStatus.value === 1)
/** 收起态：已复制待微信发 && 未展开 */
const collapsed = computed(() => isToSend.value && !expanded.value)

function onCardClick() {
  if (collapsed.value) {
    expanded.value = true
  } else {
    emit('open', props.task)
  }
}
</script>

<template>
  <article
    :class="['tcard', isToSend ? 'is-tosend' : '', collapsed ? 'is-collapsed' : '']"
    @click="onCardClick"
  >
    <!-- 收起态：一行看完「谁、还没粘到微信、隔多久」，点开再看话术/操作 -->
    <template v-if="collapsed">
      <div class="tcard__mini">
        <span class="tcard__name">{{ task.customer_name || '未命名客户' }}</span>
        <span class="tcard__send tcard__send--wait">已复制 · 待微信发</span>
        <span v-if="gap" class="tcard__mini-gap">{{ gap }}没来</span>
        <span class="tcard__expand">展开 ▾</span>
      </div>
      <div class="tcard__meta tcard__mini-sub">
        <span v-if="task.project_name" class="tcard__chip">{{ task.project_name }}</span>
        <span v-if="task.customer_phone" class="tcard__weak">{{ maskPhone(task.customer_phone) }}</span>
        <span v-if="task.benefit_text" class="tcard__ref">权益：{{ task.benefit_text }}</span>
      </div>
    </template>

    <!-- 展开态：完整卡片 -->
    <template v-else>
      <div class="tcard__head">
        <div class="tcard__name-wrap">
          <span class="tcard__name">{{ task.customer_name || '未命名客户' }}</span>
          <span :class="['tag', statusClass]">{{ statusText }}</span>
          <span v-if="isToSend" class="tcard__send tcard__send--wait">已复制 · 待微信发</span>
          <span v-else-if="sendStatus === 2" class="tcard__send tcard__send--done">已发送</span>
        </div>
        <div class="tcard__gap">
          <strong>{{ gap }}</strong>
          <i>{{ gapLabel }}</i>
        </div>
      </div>

      <div class="tcard__meta">
        <span v-if="task.project_name" class="tcard__chip">{{ task.project_name }}</span>
        <span v-if="task.customer_phone" class="tcard__weak">{{ maskPhone(task.customer_phone) }}</span>
        <span v-if="overdue > 0 && isPending" class="tcard__overdue">已超期 {{ overdue }} 天</span>
      </div>

      <p v-if="task.script_text" class="tcard__script ellipsis-2">{{ task.script_text }}</p>
      <p v-else class="tcard__script tcard__script--empty">暂无话术，可先复制历史内容联系</p>

      <div v-if="isPending && task.benefit_text" class="tcard__ref">
        权益：{{ task.benefit_text }}
      </div>

      <div class="tcard__foot" @click.stop>
        <CopyButton
          :text="task.script_text"
          :task-id="task.id"
          :reminded="status === 1"
          @copied="(id, mode) => emit('copied', task, mode)"
        />
        <button
          v-if="mode === 'todo' && isPending"
          type="button"
          class="btn btn--primary tcard__btn"
          @click="emit('visit', task)"
        >
          已到店
        </button>
        <button
          v-if="mode === 'todo' && isPending"
          type="button"
          class="btn btn--plain tcard__btn tcard__btn--sm"
          @click="emit('ignore', task)"
        >
          忽略
        </button>
        <!-- 次要修正入口：复制错了人/想重新提醒，退回待提醒 -->
        <button
          v-if="mode === 'todo' && isToSend"
          type="button"
          class="btn btn--plain tcard__btn tcard__btn--sm tcard__btn--undo"
          @click="emit('undo', task)"
        >
          退回待提醒
        </button>
        <button
          v-if="mode === 'todo' && isToSend"
          type="button"
          class="btn btn--plain tcard__btn tcard__btn--sm tcard__btn--undo"
          @click="expanded = false"
        >
          收起
        </button>
        <span v-else-if="isHandled" class="tcard__done">
          {{ status === 2 ? '已完成回店' : '已忽略' }}
        </span>
      </div>
    </template>
  </article>
</template>

<style scoped>
.tcard {
  background: var(--c-white);
  border-radius: var(--r-card);
  padding: var(--sp-2);
  box-shadow: var(--shadow-card);
  cursor: pointer;
}

/* 已复制待微信发：左侧橙色提示「这条还没粘到微信」 */
.tcard.is-tosend {
  box-shadow: var(--shadow-card), inset 3px 0 0 var(--c-warn);
}

/* 收起态：整卡弱化，视觉上退出「该处理」的第一梯队 */
.tcard.is-collapsed {
  opacity: 0.72;
}

.tcard + .tcard {
  margin-top: var(--sp-2);
}

/* ---- 收起态一行 ---- */
.tcard__mini {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tcard__mini-gap {
  flex: none;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.tcard__expand {
  flex: none;
  margin-left: auto;
  color: var(--c-pink-deep);
  font-size: var(--fs-sm);
}

.tcard__mini-sub {
  margin-top: 6px;
}

.tcard__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-1);
}

.tcard__name-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.tcard__name {
  font-size: var(--fs-title);
  font-weight: 600;
  color: var(--c-text);
}

.tcard__gap {
  flex: none;
  text-align: right;
  color: var(--c-pink-deep);
  line-height: 1.2;
}

.tcard__gap strong {
  font-size: var(--fs-title);
  font-weight: 700;
}

.tcard__gap i {
  display: block;
  font-size: var(--fs-xs);
  font-style: normal;
  color: var(--c-text-weak);
}

.tcard__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.tcard__chip {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--c-pink-soft);
  color: #b96f6f;
  font-size: var(--fs-sm);
}

.tcard__weak {
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.tcard__overdue {
  font-size: var(--fs-xs);
  color: var(--c-danger);
}

/* 发送状态标签：橙=待微信发（仅提示），绿=已发送（旧数据） */
.tcard__send {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: var(--fs-xs);
  font-weight: 500;
}

.tcard__send--wait {
  background: #fff4e5;
  color: var(--c-warn);
}

.tcard__send--done {
  background: #f0f9f2;
  color: var(--c-success);
}

.tcard__script {
  margin-top: var(--sp-1);
  padding: var(--sp-1);
  border-radius: 8px;
  background: var(--c-bg);
  color: var(--c-text-sub);
  font-size: var(--fs-sm);
  line-height: 1.6;
}

.tcard__script--empty {
  color: var(--c-text-weak);
}

.tcard__ref {
  margin-top: 6px;
  font-size: var(--fs-xs);
  color: var(--c-warn);
}

.tcard__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1);
  margin-top: var(--sp-2);
}

.tcard__btn {
  height: 36px;
  padding: 0 18px;
  font-size: var(--fs-md);
  flex: none;
}

.tcard__btn--sm {
  padding: 0 14px;
}

.tcard__btn--undo {
  color: var(--c-text-weak);
}

.tcard__done {
  margin-left: auto;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

/* 状态标签 */
.tag {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: var(--fs-xs);
  font-weight: 500;
}

.tag.is-pending {
  background: #fdeff0;
  color: #c2707a;
}

.tag.is-remind {
  background: #f4f0fb;
  color: #8a76c4;
}

.tag.is-visit {
  background: #f0f9f2;
  color: var(--c-success);
}

.tag.is-ignore {
  background: #f2f2f2;
  color: var(--c-text-weak);
}
</style>
