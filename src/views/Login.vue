<script setup>
/**
 * 店铺账号登录
 *
 * 鉴权直接复用管理后台（/tenantApp/login + 登录鉴权），不走 独立的会员体系。
 * 关键点：
 *   - appid 必须与登录请求同时发出去（鉴权中间件按 appid 识别租户），
 *     否则会落到「店铺信息缺失」或租户不匹配
 *   - 图形验证码是后端强制项（Captcha::checkCaptcha），不能省
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCaptcha, login, loadUserInfo, setAppId } from '@/api/auth'
import { getAppId, useMock, setMock, clearAuth } from '@/utils/storage'
import { toast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()

// 演示模式只在开发环境可用（生产构建下 import.meta.env.DEV=false，分支被摇掉）
const isDev = import.meta.env.DEV
const mockMode = ref(isDev && useMock())
const loading = ref(false)
const captchaImg = ref('')
const captchaLoading = ref(false)

const form = reactive({
  appid: getAppId(),
  username: '',
  password: '',
  code: '',
  uuid: ''
})

const canSubmit = computed(() => {
  if (!form.appid) return false
  if (mockMode.value) return true
  return !!form.username && !!form.password && !!form.code && !!form.uuid
})

async function refreshCaptcha() {
  if (mockMode.value) {
    // 演示模式：不给假图占位造成困扰，直接留空并提示
    captchaImg.value = ''
    form.uuid = 'mock-uuid'
    return
  }
  captchaLoading.value = true
  try {
    const res = await fetchCaptcha()
    form.uuid = res.uuid
    captchaImg.value = res.image
  } catch (e) {
    captchaImg.value = ''
    toast(e.message || '验证码加载失败，点图重试')
  } finally {
    captchaLoading.value = false
  }
}

async function handleSubmit() {
  if (loading.value) return
  if (!form.appid) {
    toast('请填写店铺编号')
    return
  }
  if (!mockMode.value) {
    if (!form.username || !form.password) {
      toast('请填写账号和密码')
      return
    }
    if (!form.code) {
      toast('请填写验证码')
      return
    }
  }

  loading.value = true
  try {
    // 先落 appid：请求拦截器要立刻带上，且登录成功后仍要复用
    setAppId(form.appid)
    clearAuth()

    await login({
      username: form.username || 'demo',
      password: form.password || 'demo',
      code: form.code || '1234',
      uuid: form.uuid || 'mock-uuid'
    })
    await loadUserInfo()

    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && redirect ? redirect : '/today')
  } catch (e) {
    toast(e.message || '登录失败，请检查账号密码')
    refreshCaptcha()
  } finally {
    loading.value = false
  }
}

/** 演示/联调一键切换：写 localStorage 后整页重载，避免状态残留 */
function toggleMock() {
  setMock(!mockMode.value)
  location.reload()
}

onMounted(refreshCaptcha)
</script>

<template>
  <div class="login">
    <div class="login__hero">
      <div class="login__badge">老板端</div>
      <h1 class="login__title">复购提醒</h1>
      <p class="login__sub">每天 30 秒，把该回来的人叫回来</p>
    </div>

    <div class="login__panel">
      <div class="field">
        <div class="field-item">
          <span class="field-label">店铺编号</span>
          <input
            v-model.trim="form.appid"
            class="field-input"
            type="tel"
            inputmode="numeric"
            placeholder="例如 10001"
          />
        </div>
        <div class="field-item">
          <span class="field-label">账号</span>
          <input
            v-model.trim="form.username"
            class="field-input"
            type="text"
            autocomplete="username"
            placeholder="店长账号"
          />
        </div>
        <div class="field-item">
          <span class="field-label">密码</span>
          <input
            v-model="form.password"
            class="field-input"
            type="password"
            autocomplete="current-password"
            placeholder="登录密码"
          />
        </div>
        <div v-if="!mockMode" class="field-item">
          <span class="field-label">验证码</span>
          <input
            v-model.trim="form.code"
            class="field-input"
            type="text"
            maxlength="6"
            placeholder="4 位字母"
          />
          <button type="button" class="login__captcha" :disabled="captchaLoading" @click="refreshCaptcha">
            <img v-if="captchaImg" :src="captchaImg" alt="验证码" />
            <span v-else class="t-weak">{{ captchaLoading ? '加载中' : '点击加载' }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        :class="['btn btn--primary btn--block login__submit', canSubmit ? '' : 'is-disabled']"
        :disabled="loading"
        @click="handleSubmit"
      >
        {{ loading ? '登录中…' : '登录' }}
      </button>

      <div class="login__tip">
        <template v-if="isDev && mockMode">
          当前是<strong>演示模式</strong>，数据全在手机本地，随便点登录即可体验
        </template>
        <template v-else>
          账号密码与店铺管理后台一致；忘记密码请联系运营重置
        </template>
      </div>
    </div>

    <div class="login__foot">
      <template v-if="isDev">
        <span>遇到问题</span>
        <button type="button" class="login__link" @click="toggleMock">
          {{ mockMode ? '切换为对接后端' : '切换为演示模式' }}
        </button>
      </template>
      <span v-else>遇到问题请联系运营</span>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  padding-bottom: 48px;
  background: var(--c-bg);
}

.login__hero {
  padding: 56px var(--sp-3) 40px;
  background: linear-gradient(160deg, var(--c-pink) 0%, #f9d6d6 60%, var(--c-bg) 100%);
}

.login__badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  color: #b96f6f;
  font-size: var(--fs-xs);
}

.login__title {
  margin-top: var(--sp-2);
  font-size: 26px;
  font-weight: 700;
  color: #7d4a4a;
  letter-spacing: 2px;
}

.login__sub {
  margin-top: 6px;
  font-size: var(--fs-md);
  color: #a97a7a;
}

.login__panel {
  margin: -20px var(--sp-2) 0;
  padding: var(--sp-2);
  border-radius: var(--r-card);
  background: var(--c-white);
  box-shadow: 0 4px 16px rgba(232, 149, 149, 0.12);
}

.login__panel .field {
  padding: 0;
}

.login__captcha {
  flex: none;
  width: 92px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--c-bg);
  font-size: var(--fs-sm);
  overflow: hidden;
  cursor: pointer;
}

.login__captcha img {
  width: 92px;
  height: 36px;
  object-fit: cover;
}

.login__submit {
  margin-top: var(--sp-3);
}

.login__tip {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
  line-height: 1.6;
}

.login__tip strong {
  color: var(--c-pink-deep);
}

.login__foot {
  margin-top: var(--sp-3);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-text-weak);
}

.login__link {
  margin-left: 6px;
  color: var(--c-pink-deep);
  font-size: var(--fs-sm);
  text-decoration: underline;
  cursor: pointer;
}
</style>
