import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 构建配置
 *
 * 几个取舍：
 *   - 无 TS、无 UI 框架：纯 Vue3 + 原生 CSS 变量主题，首屏体积优先
 *   - base 可通过 VITE_BASE_URL 配置，支持部署到子目录
 *   - 开发环境 /api 前缀由 Vite 代理剥掉后转发，避免后端改 CORS
 */
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const { VITE_VERSION, VITE_PORT, VITE_BASE_URL, VITE_API_URL, VITE_API_PROXY_URL } = env

  // 代理前缀：开发环境 VITE_API_URL=/api，生产 /prod（与 admin/tenant 两端同约定）
  const apiPrefix = VITE_API_URL || '/api'

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(VITE_VERSION || '1.0.0')
    },
    base: VITE_BASE_URL || '/',
    server: {
      port: Number(VITE_PORT) || 3008,
      host: true,
      proxy: {
        // 把 /api 前缀剥掉再转发：/api/tenantApp/task/index → 8787/tenantApp/task/index
        [apiPrefix]: {
          target: VITE_API_PROXY_URL || 'http://127.0.0.1:8787',
          changeOrigin: true,
          rewrite: (p) => p.replace(new RegExp('^' + apiPrefix), '')
        }
      }
    },
    preview: {
      port: 4208,
      proxy: {
        [apiPrefix]: {
          target: VITE_API_PROXY_URL || 'http://127.0.0.1:8787',
          changeOrigin: true,
          rewrite: (p) => p.replace(new RegExp('^' + apiPrefix), '')
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(fileURLToPath(new URL('./src', import.meta.url)))
      }
    },
    build: {
      target: 'es2015',
      outDir: 'dist',
      assetsDir: 'assets',
      chunkSizeWarningLimit: 800,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', 'axios']
          }
        }
      }
    },
    plugins: [vue()]
  })
}
