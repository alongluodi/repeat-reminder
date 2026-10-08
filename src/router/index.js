import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken } from '@/utils/storage'

/**
 * 路由表
 *
 * 使用 hash 模式（createWebHashHistory）：
 *   - 微信/QQ 内置浏览器对 history 模式的子目录部署不友好，刷新容易 404
 *   - 部署到子目录时无需再配 nginx try_files 兜底
 *
 * meta.tab 标记该页是否显示底部 Tab（CheckIn / CustomerDetail / Rules 为流程页，不显示）
 */
const routes = [
  { path: '/', redirect: '/today' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '店铺登录', public: true }
  },
  {
    path: '/today',
    name: 'Today',
    component: () => import('@/views/Today.vue'),
    meta: { title: '今天该提醒谁', tab: 'today' }
  },
  {
    path: '/recall',
    name: 'RecallList',
    component: () => import('@/views/RecallList.vue'),
    meta: { title: '待跟进', tab: 'today' }
  },
  {
    path: '/checkin',
    name: 'CheckIn',
    component: () => import('@/views/CheckIn.vue'),
    meta: { title: '录到店' }
  },
  {
    path: '/customers',
    name: 'Customers',
    component: () => import('@/views/Customers.vue'),
    meta: { title: '客户', tab: 'customers' }
  },
  {
    path: '/customer/:id',
    name: 'CustomerDetail',
    component: () => import('@/views/CustomerDetail.vue'),
    meta: { title: '复购档案' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '看板', tab: 'dashboard' }
  },
  {
    path: '/rules',
    name: 'Rules',
    component: () => import('@/views/Rules.vue'),
    meta: { title: '提醒规则' }
  },
  {
    path: '/mine',
    name: 'Mine',
    component: () => import('@/views/Mine.vue'),
    meta: { title: '我的', tab: 'mine' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/today' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

/** 登录守卫：未登录一律回登录页（登录页自身放行） */
router.beforeEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · 复购提醒` : '复购提醒'
  if (to.meta?.public) return true
  if (!getToken()) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }
  return true
})

export default router
