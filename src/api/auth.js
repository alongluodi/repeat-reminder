/**
 * 鉴权 API（复用管理后台登录，不走 独立的会员体系）
 * 真实路由见 后端路由配置 `/tenantApp` 分组
 */
import { get, post } from './request'
import { setToken, setUserInfo, setAppId, clearAuth } from '@/utils/storage'

/** 图形验证码（登录前置接口；不受店铺校验限制——appid 残留已删除店铺ID时同样可用） */
export function fetchCaptcha() {
  return get('/tenantApp/captcha', {}, { silent: true })
}

/**
 * 店铺账号登录
 * @param {{username:string,password:string,code:string,uuid:string,type?:string}} form
 */
export async function login(form) {
  const data = await post(
    '/tenantApp/login',
    {
      username: form.username,
      password: form.password,
      code: form.code,
      uuid: form.uuid,
      type: form.type || 'pc'
    },
    { silent: true }
  )
  if (!data || !data.access_token) throw new Error('登录失败：未返回令牌')
  setToken(data.access_token, data.refresh_token)
  return data
}

/** 当前登录用户信息 */
export function fetchUserInfo() {
  return get('/tenantApp/system/user')
}

/** 拉取并落地当前用户信息 */
export async function loadUserInfo() {
  const info = await fetchUserInfo()
  setUserInfo(info)
  return info
}

export function logout() {
  clearAuth()
}

export { setAppId }
