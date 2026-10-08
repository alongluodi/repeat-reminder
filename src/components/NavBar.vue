<script setup>
/**
 * 顶部导航
 * 移动端不做复杂导航栏：左返回 + 居中标题 + 右侧插槽
 */
import { useRouter } from 'vue-router'

defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  /** 透明底（登录页/看板头部用） */
  transparent: { type: Boolean, default: false },
  /** 品牌后缀，统一“XXX · 复购提醒”的标题口径 */
  brand: { type: String, default: '复购提醒' }
})

const router = useRouter()

function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/today')
}
</script>

<template>
  <header :class="['navbar', transparent ? 'navbar--transparent' : '']">
    <div class="navbar__side navbar__side--left">
      <button v-if="showBack" class="navbar__back" type="button" @click="goBack">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
    <h1 class="navbar__title">
      {{ title }}<span v-if="brand" class="navbar__brand"> · {{ brand }}</span>
    </h1>
    <div class="navbar__side navbar__side--right">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  height: var(--h-nav);
  padding: 0 var(--sp-1);
  background: var(--c-white);
  border-bottom: 1px solid var(--c-line);
}

.navbar--transparent {
  background: var(--c-pink);
  border-bottom: none;
}

.navbar__side {
  width: 56px;
  flex: none;
  display: flex;
  align-items: center;
}

.navbar__side--right {
  justify-content: flex-end;
}

.navbar__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: 4px;
  color: var(--c-text);
  cursor: pointer;
}

.navbar__title {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: var(--fs-title);
  font-weight: 600;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 品牌后缀弱化，页面名仍然是视觉主标题 */
.navbar__brand {
  font-size: var(--fs-sm);
  font-weight: 400;
  color: var(--c-text-weak);
}
</style>
