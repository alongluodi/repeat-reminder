<script setup>
/**
 * 空态 / 加载态占位
 * 老板端最怕「白屏不知道怎么回事」，所以空态一定给一句人话 + 可选动作。
 */
defineProps({
  loading: { type: Boolean, default: false },
  text: { type: String, default: '这里还没有内容' },
  hint: { type: String, default: '' },
  actionText: { type: String, default: '' }
})

const emit = defineEmits(['action'])
</script>

<template>
  <div class="empty-state">
    <template v-if="loading">
      <div class="empty-state__spinner"></div>
      <p class="empty-state__text">加载中…</p>
    </template>
    <template v-else>
      <svg class="empty-state__icon" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
        <rect x="12" y="16" width="40" height="34" rx="6" fill="#fdeff0" />
        <path
          d="M22 27h20M22 34h14"
          stroke="#e89595"
          stroke-width="2.4"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
      <p class="empty-state__text">{{ text }}</p>
      <p v-if="hint" class="empty-state__hint">{{ hint }}</p>
      <button v-if="actionText" type="button" class="btn btn--ghost mt-2" @click="emit('action')">
        {{ actionText }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 56px var(--sp-3);
  text-align: center;
}

.empty-state__icon {
  display: block;
  margin: 0 auto var(--sp-2);
}

.empty-state__text {
  font-size: var(--fs-base);
  color: var(--c-text-sub);
}

.empty-state__hint {
  margin-top: 6px;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.empty-state__spinner {
  width: 26px;
  height: 26px;
  margin: 0 auto var(--sp-2);
  border: 2px solid var(--c-pink);
  border-top-color: var(--c-pink-deep);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
