/**
 * 本地存储（仅存 登录态 + 店铺识别），不做持久化框架
 * 注意：Token 与 appid 必须同源同生命周期，退出登录一并清掉
 */
const TOKEN_KEY = 'boss_access_token'
const REFRESH_KEY = 'boss_refresh_token'
const APPID_KEY = 'app_appid' // 与 管理后台 同名，方便同域调试时复用
const USER_KEY = 'boss_user_info'
const MOCK_KEY = 'boss_use_mock'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(accessToken, refreshToken) {
  localStorage.setItem(TOKEN_KEY, accessToken || '')
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function getAppId() {
  return (
    localStorage.getItem(APPID_KEY) ||
    import.meta.env.VITE_DEFAULT_APPID ||
    ''
  )
}

export function setAppId(appid) {
  if (appid) localStorage.setItem(APPID_KEY, String(appid))
}

export function getUserInfo() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}')
  } catch (e) {
    return {}
  }
}

export function setUserInfo(info) {
  localStorage.setItem(USER_KEY, JSON.stringify(info || {}))
}

/** mock 开关：环境变量为默认值，可在页面上临时覆盖（便于同一份构建演示） */
export function useMock() {
  const override = localStorage.getItem(MOCK_KEY)
  if (override !== null) return override === 'true'
  return String(import.meta.env.VITE_USE_MOCK) === 'true'
}

export function setMock(flag) {
  localStorage.setItem(MOCK_KEY, flag ? 'true' : 'false')
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}
