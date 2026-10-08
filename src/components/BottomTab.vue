<script setup>
/**
 * 底部 Tab（4 项：待办 / 客户 / 看板 / 我的）
 * 高度固定 56px，并留出 iOS 安全区，避免被系统手势条压住。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const TAB_ITEMS = [
  { key: 'today', label: '待办', path: '/today', icon: 'task' },
  { key: 'customers', label: '客户', path: '/customers', icon: 'user' },
  { key: 'dashboard', label: '看板', path: '/dashboard', icon: 'chart' },
  { key: 'mine', label: '我的', path: '/mine', icon: 'mine' }
]

const ICONS = {
  task: 'M9 5h6M9 9h6M9 13h4M5 4h14v16H5z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5',
  chart: 'M5 19V10M12 19V5M19 19v-6',
  mine: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5'
}

const route = useRoute()
const router = useRouter()

/** 用 meta.tab 判定高亮：/recall 也属于「待办」，避免进二级页后 Tab 全灰 */
const activeKey = computed(() => route.meta?.tab || '')

function go(item) {
  if (route.path === item.path) return
  router.replace(item.path)
}
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="item in TAB_ITEMS"
      :key="item.key"
      type="button"
      :class="['tabbar__item', activeKey === item.key ? 'is-active' : '']"
      @click="go(item)"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          :d="ICONS[item.icon]"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="tabbar__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  max-width: 640px;
  margin: 0 auto;
  height: calc(var(--h-tab) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--c-white);
  box-shadow: var(--shadow-tab);
}

.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--c-text-weak);
  cursor: pointer;
  transition: color 0.15s;
}

.tabbar__item.is-active {
  color: var(--c-pink-deep);
}

.tabbar__label {
  font-size: var(--fs-xs);
  line-height: 1;
}
</style>
