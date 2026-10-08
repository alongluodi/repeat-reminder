<script setup>
/**
 * 扫描超时内联提示
 *
 * 背景：每日扫描任务（DailyScan）若超过 26 小时没跑，看板数据就是旧的。
 * 老板不应该看到一个「可能过期」的数字却不知道 —— 所以这里内联提示 + 立即刷新按钮，
 * 用主动点击代替不可靠的自动轮询（自动轮询在网络差时只会转圈，反而更像卡死）。
 */
defineProps({
  /** 数据是否可能过期（后端 scan_stale） */
  stale: { type: Boolean, default: false },
  /** 最近一次扫描时间 */
  lastTime: { type: String, default: '' },
  /** 刷新中 */
  loading: { type: Boolean, default: false },
  /** 请求失败（比 stale 更严重：数据都取不到） */
  failed: { type: Boolean, default: false }
})

const emit = defineEmits(['refresh'])
</script>

<template>
  <div v-if="failed || stale" :class="['scan-alert', failed ? 'is-error' : '']">
    <div class="scan-alert__text">
      <span class="scan-alert__dot"></span>
      <span v-if="failed">数据没取到，检查网络后点右侧刷新</span>
      <span v-else>
        今日还没自动扫描{{ lastTime ? `（上次 ${lastTime}）` : '' }}，数字可能有出入
      </span>
    </div>
    <button type="button" class="scan-alert__btn" :disabled="loading" @click="emit('refresh')">
      {{ loading ? '刷新中' : '立即刷新' }}
    </button>
  </div>
</template>

<style scoped>
.scan-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-1);
  margin-bottom: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-card);
  background: #fff8ec;
  border: 1px solid #f3e0c2;
}

.scan-alert.is-error {
  background: #fef2f2;
  border-color: #f4cccc;
}

.scan-alert__text {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: var(--fs-sm);
  color: #9a7328;
  line-height: 1.4;
}

.scan-alert.is-error .scan-alert__text {
  color: var(--c-danger);
}

.scan-alert__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.scan-alert__btn {
  flex: none;
  padding: 5px 12px;
  border-radius: 12px;
  background: var(--c-white);
  border: 1px solid currentColor;
  color: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
}

.scan-alert.is-error .scan-alert__btn {
  color: var(--c-danger);
}

.scan-alert__btn[disabled] {
  opacity: 0.6;
}
</style>
