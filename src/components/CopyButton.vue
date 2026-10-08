<script setup>
/**
 * 「把话术送到客户那儿」按钮 —— 分享优先，复制兜底
 *
 * 2026-10-12 减步改造（老板端最痛的一步）：
 *   在支持系统分享的环境（非微信浏览器 + HTTPS）里，按钮变成「发送给客户」：
 *     点一下 → 系统分享面板 → 选微信 → 选联系人 → 话术已在输入框，点发送
 *   一步砍掉「切 App / 搜联系人 / 粘贴」，也消灭了「先复制微信号再复制话术」的剪贴板冲突。
 *   其余环境（微信内置浏览器 / http / 桌面）自动降级成原来的「复制话术」，
 *   文案随能力切换，不做任何「你以为能发其实不能」的承诺。
 *
 * 两种结果都算「已执行提醒」（复制即已提醒，2026-10-10 产品决策）：
 *   - share 面板走完 → 已发送
 *   - 复制成功       → 已复制，去微信粘贴
 * 用户取消分享 → 什么都不做（不标记、不提示失败）。
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import { copyText } from '@/utils/clipboard'
import { shareText, canShareText } from '@/utils/share'
import { logCopy, logShare } from '@/api/task'
import { toast } from '@/utils/toast'

const props = defineProps({
  text: { type: String, default: '' },
  taskId: { type: [Number, String], default: 0 },
  /** 是否已提醒过（复制路径下按钮文案用「再复制一次」） */
  reminded: { type: Boolean, default: false }
})

/** 第二参数 mode: 'share' | 'copy' —— 父页面据此给不同提示文案 */
const emit = defineEmits(['copied'])

/** 环境能力一次性判定：一次会话内不会中途改变 */
const shareable = canShareText()

/** '' | 'copied' | 'shared' */
const state = ref('')
const busy = ref(false)
let timer = null

const label = computed(() => {
  if (state.value === 'shared') return '已发送'
  if (state.value === 'copied') return '已复制'
  if (shareable) return '发送给客户'
  return props.reminded ? '再复制一次' : '复制话术'
})

/** 完成后统一收尾：按钮态 + 通知父页面 + 落沟通日志（日志失败不打扰用户） */
async function afterDone(mode) {
  state.value = mode === 'share' ? 'shared' : 'copied'
  emit('copied', props.taskId, mode)
  if (props.taskId) {
    try {
      // 分享与复制落不同的日志动作：前者是「送出证据」，看板据此区分
      await (mode === 'share' ? logShare(props.taskId) : logCopy(props.taskId))
    } catch (e) {
      /* 静默：日志缺一条不影响生意 */
    }
  }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    state.value = ''
  }, 3000)
}

async function handleTap() {
  if (busy.value) return
  if (!props.text) {
    toast('这条没有话术内容')
    return
  }
  busy.value = true
  try {
    if (shareable) {
      const r = await shareText(props.text)
      if (r === 'shared') {
        await afterDone('share')
        return
      }
      if (r === 'cancelled') return
      /* unsupported / failed → 继续走复制，不让体验倒退 */
    }
    const ok = await copyText(props.text)
    if (!ok) {
      toast('复制失败，请长按话术手动复制')
      return
    }
    await afterDone('copy')
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <button
    type="button"
    :class="['btn btn--ghost copy-btn', state ? 'is-done' : '']"
    @click.stop="handleTap"
  >
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        v-if="state"
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- 分享图标：三点连线（支持分享时用它，让老板一眼看懂是「发出去」） -->
      <g v-else-if="shareable" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="18" cy="5" r="2.4" />
        <circle cx="6" cy="12" r="2.4" />
        <circle cx="18" cy="19" r="2.4" />
        <path d="M8.1 10.8l7.8-4.6M8.1 13.2l7.8 4.6" stroke-linecap="round" />
      </g>
      <path
        v-else
        d="M9 9V5h10v10h-4M5 9h10v10H5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.copy-btn {
  gap: 4px;
  padding: 0 var(--sp-2);
  font-size: var(--fs-md);
  /* 防止卡片底部按钮过多时被压成竖排字 */
  white-space: nowrap;
  flex-shrink: 0;
}

.copy-btn.is-done {
  background: #f0f9f2;
  color: var(--c-success);
}
</style>
