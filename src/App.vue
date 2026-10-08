<script setup>
/**
 * 根组件
 * 只做两件事：路由出口 + 全局路由过渡。底部 Tab 由各页面自己挂（便于流程页不显示）。
 */
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const isTabPage = computed(() => !!route.meta?.tab)
</script>

<template>
  <div :class="['app-root', isTabPage ? 'has-tab' : '']">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
.app-root {
  min-height: 100vh;
}
</style>
