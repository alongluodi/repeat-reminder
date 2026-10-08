<script setup>
/**
 * 我的
 *
 * 老板视角只需要 4 件事：这是哪家店 / 还能用多久 / 有事找谁 / 怎么退出。
 * 「共建剩余天数」取自 店铺表.expire_time（无该字段时降级为「长期有效」）。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import BottomTab from '@/components/BottomTab.vue'
import { fetchShopInfo } from '@/api/shop'
import { fetchUserInfo, logout } from '@/api/auth'
import { getAppId, getUserInfo, setUserInfo, useMock, setMock } from '@/utils/storage'
import { copyText } from '@/utils/clipboard'
import { maskPhone } from '@/utils/format'
import { toast, confirmBox } from '@/utils/toast'

/** 运营（共建服务）联系方式 —— 硬编码常量，避免为一行字加接口 */
const OPERATOR_WECHAT = 'softzero100'

// 构建期注入的版本号（vite.config.js 的 define）。
// 必须先在脚本里取成常量再给模板用：模板里的标识符不会被 define 文本替换，
// 直接写 {{ __APP_VERSION__ }} 会被当成实例属性 → 生产构建下渲染成空白。
const appVersion = __APP_VERSION__

const router = useRouter()
// 演示/联调开关只保留在开发环境：生产构建里 import.meta.env.DEV 为 false，
// 相关分支会被摇掉，老板端固定显示「实时数据」，避免误点后看到本地假数据。
const isDev = import.meta.env.DEV
const mockMode = ref(isDev && useMock())

const dataSourceText = computed(() => {
  if (!isDev) return '实时数据'
  return mockMode.value ? '演示数据（点击切换）' : '实时数据（点击切换）'
})

const shop = ref({})
const user = ref(getUserInfo() || {})
const shopLoading = ref(true)

const shopName = computed(() => shop.value.name || `店铺 ${getAppId()}`)
const industry = computed(() => shop.value.industry || '美业')
const appId = computed(() => shop.value.app_id || getAppId())
const operatorName = computed(
  () => user.value.realname || user.value.nickname || user.value.username || '店长'
)

/** 共建剩余天数：null=无到期时间（长期）；<=0=已到期 */
const remain = computed(() => {
  const v = shop.value.remain_days
  return v === null || v === undefined ? null : Number(v)
})

const remainText = computed(() => {
  if (remain.value === null) return '长期有效'
  if (remain.value > 0) return `剩余 ${remain.value} 天`
  return '已到期'
})

const remainClass = computed(() => {
  if (remain.value === null) return 'is-safe'
  if (remain.value > 30) return 'is-safe'
  if (remain.value > 0) return 'is-warn'
  return 'is-danger'
})

async function loadShop() {
  shopLoading.value = true
  try {
    shop.value = await fetchShopInfo()
  } catch (e) {
    // 接口不可用（老版本后端）时降级，不让页面报错
    shop.value = {}
  } finally {
    shopLoading.value = false
  }
}

async function loadUser() {
  try {
    const info = await fetchUserInfo()
    user.value = info || {}
    setUserInfo(user.value)
  } catch (e) {
    /* 静默：用本地缓存顶上 */
  }
}

async function copyWechat() {
  const ok = await copyText(OPERATOR_WECHAT)
  toast(ok ? `微信号已复制：${OPERATOR_WECHAT}` : `微信号：${OPERATOR_WECHAT}`)
}

function handleLogout() {
  if (!confirmBox('确定退出登录吗？')) return
  logout()
  router.replace('/login')
}

function toggleMock() {
  setMock(!mockMode.value)
  location.reload()
}

onMounted(() => {
  loadShop()
  loadUser()
})
</script>

<template>
  <div class="page">
    <NavBar title="我的" />

    <section class="shop">
      <div class="shop__avatar">{{ shopName.slice(0, 1) }}</div>
      <div class="shop__info">
        <p class="shop__name">{{ shopLoading ? '加载中…' : shopName }}</p>
        <p class="shop__meta">
          {{ industry }} · 店铺编号 {{ appId }}
          <template v-if="user.phone"> · {{ maskPhone(user.phone) }}</template>
        </p>
      </div>
    </section>

    <div class="page-body">
      <div class="card">
        <div class="row--between">
          <span class="t-sub">共建剩余天数</span>
          <span :class="['pill', remainClass]">{{ remainText }}</span>
        </div>
        <p v-if="shop.expire_time" class="t-weak mt-1">服务截止：{{ shop.expire_time }}</p>
        <p v-else class="t-weak mt-1">
          {{ shopLoading ? '正在获取服务期限…' : '后台未设置到期时间' }}
        </p>
      </div>

      <div class="card">
        <div class="row--between">
          <div>
            <p class="t-title">联系运营</p>
            <p class="t-weak mt-1">共建期有任何问题，直接找我</p>
          </div>
          <button type="button" class="btn btn--ghost contact" @click="copyWechat">
            复制微信号
          </button>
        </div>
        <p class="wechat">{{ OPERATOR_WECHAT }}</p>
      </div>

      <div class="field mt-2">
        <div class="field-item" @click="router.push('/rules')">
          <span class="field-label field-label--wide">提醒规则</span>
          <span class="t-weak">去设置 ›</span>
        </div>
        <div class="field-item" @click="isDev && toggleMock()">
          <span class="field-label field-label--wide">数据来源</span>
          <span class="t-weak">{{ dataSourceText }}</span>
        </div>
        <div class="field-item">
          <span class="field-label field-label--wide">版本</span>
          <span class="t-weak">v{{ appVersion }}</span>
        </div>
      </div>

      <button type="button" class="btn btn--plain btn--block mt-3 logout" @click="handleLogout">
        退出登录
      </button>

      <p class="foot">账号与管理后台一致，忘记密码找运营重置</p>
    </div>

    <BottomTab />
  </div>
</template>

<style scoped>
.shop {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-2);
  background: linear-gradient(180deg, var(--c-pink) -60%, var(--c-bg) 100%);
}

.shop__avatar {
  flex: none;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-white);
  color: #7d4a4a;
  font-size: 24px;
  font-weight: 700;
}

.shop__name {
  font-size: var(--fs-title-lg);
  font-weight: 600;
  color: #6f4343;
}

.shop__meta {
  margin-top: 4px;
  font-size: var(--fs-sm);
  color: #a97a7a;
}

.pill {
  padding: 2px 12px;
  border-radius: 10px;
  font-size: var(--fs-sm);
  font-weight: 600;
}

.pill.is-safe {
  background: #f0f9f2;
  color: var(--c-success);
}

.pill.is-warn {
  background: #fff8ec;
  color: var(--c-warn);
}

.pill.is-danger {
  background: #fef2f2;
  color: var(--c-danger);
}

.contact {
  height: 36px;
  font-size: var(--fs-md);
  padding: 0 14px;
}

.wechat {
  margin-top: var(--sp-2);
  padding: var(--sp-1);
  border-radius: 8px;
  background: var(--c-bg);
  text-align: center;
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--c-pink-deep);
  letter-spacing: 1px;
}

.field-label--wide {
  width: auto;
  flex: 1;
}

.field-item {
  cursor: pointer;
}

.logout {
  color: var(--c-danger);
}

.foot {
  margin-top: var(--sp-2);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}
</style>
