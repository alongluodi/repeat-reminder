/**
 * 店铺信息 API（「我的」页面用）
 *
 * 说明：现有业务接口里没有「店铺名 / 行业 / 共建剩余天数」的出口，
 * 故在插件内补了一个只读接口 GET /tenantApp/shop/info
 * （读 后端会话缓存，不新增数据表，见 后端店铺信息接口）。
 * 接口不可用时前端自动降级：只显示店铺ID，不阻塞页面。
 */
import { get } from './request'

export function fetchShopInfo() {
  return get('/tenantApp/shop/info', {}, { silent: true })
}
