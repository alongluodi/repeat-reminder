/**
 * 统一请求层
 *
 * 约定（与 管理后台 对齐，方便同域联调）：
 *   - baseURL = VITE_API_URL（开发 /api 走 Vite 代理剥前缀 → 8787；生产 /prod 由 nginx 反代）
 *   - 请求头 Authorization: Bearer <token>（Tinywan JWT）
 *   - 请求头 appid: <店铺ID>（鉴权中间件按 appid 识别租户，缺了会 401/店铺信息缺失）
 *   - 响应体 { code, message, data }，code=200 才算成功
 *   - code=401 → 清登录态并回到登录页
 *
 * mock 开关打开时不发真实请求，直接走 src/mock（页面交互可独立跑通）。
 */
import axios from 'axios'
import { getToken, getAppId, clearAuth, useMock } from '@/utils/storage'
import { mockRequest } from '@/mock'
import { toast } from '@/utils/toast'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
})

/** 未授权处理加防抖，避免并发请求同时弹窗 + 反复跳转 */
let unauthorizedLock = false

function handleUnauthorized(message) {
  if (unauthorizedLock) return
  unauthorizedLock = true
  clearAuth()
  toast(message || '登录已过期，请重新登录')
  setTimeout(() => {
    unauthorizedLock = false
    if (!location.hash.startsWith('#/login')) {
      location.hash = '#/login'
    }
  }, 600)
}

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const appid = getAppId()
  if (appid) config.headers.appid = appid
  return config
})

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (!body || typeof body !== 'object') return body
    if (Number(body.code) === 200) return body.data
    if (Number(body.code) === 401) {
      handleUnauthorized(body.message)
      return Promise.reject(bizError(body.message || '登录已过期', 401))
    }
    return Promise.reject(bizError(body.message || '请求失败', body.code))
  },
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      handleUnauthorized(err.response?.data?.message)
      return Promise.reject(bizError('登录已过期', 401))
    }
    if (err.code === 'ECONNABORTED') return Promise.reject(bizError('请求超时，请重试'))
    const msg = err.response?.data?.message || '网络异常，请检查后端服务'
    return Promise.reject(bizError(msg, status))
  }
)

function bizError(message, code) {
  const e = new Error(message)
  e.code = code
  e.isBizError = true
  return e
}

/**
 * 发起请求
 * @param {object} options
 * @param {string} options.url     接口路径（不含 baseURL，如 /tenantApp/task/index）
 * @param {string} [options.method] GET / POST / PUT / DELETE
 * @param {object} [options.params] query 参数
 * @param {object} [options.data]   请求体（POST/PUT 用）
 * @param {boolean} [options.silent] 出错时不自动 toast（由页面自己处理）
 */
async function request(options) {
  const { url, method = 'GET', params = {}, data, silent = false } = options
  try {
    if (useMock()) {
      // POST 归并进 params，与后端 $request->post() / ->input() 双兼容
      const merged = method.toUpperCase() === 'GET' ? params : { ...params, ...(data || {}) }
      return await mockRequest({ url, method, params: merged })
    }
    const res = await http.request({
      url,
      method,
      params: method.toUpperCase() === 'GET' ? params : undefined,
      data: method.toUpperCase() === 'GET' ? undefined : data ?? params
    })
    return res
  } catch (e) {
    if (!silent && e.code !== 401) toast(e.message || '操作失败')
    throw e
  }
}

export const get = (url, params, options = {}) => request({ url, method: 'GET', params, ...options })
export const post = (url, data, options = {}) => request({ url, method: 'POST', data, ...options })
export const put = (url, data, options = {}) => request({ url, method: 'PUT', data, ...options })
export const del = (url, data, options = {}) => request({ url, method: 'DELETE', data, ...options })

export default { get, post, put, del, request }
