import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import { toast } from './utils/toast'

const app = createApp(App)

/** 兜底：未捕获异常也给用户一个可见提示，避免静默白屏 */
app.config.errorHandler = (err) => {
  console.error('[boss-h5]', err)
  toast(err?.message || '页面出错了，请重试')
}

app.use(router)
app.mount('#app')
