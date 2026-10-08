/**
 * 老板看板 API
 * GET /tenantApp/board/index
 * 返回：today_visit_count / today_visit_amount / pending_count / repurchase_rate /
 *      estimated_recovery / customer_count / trend[] / last_scan_time / scan_stale
 */
import { get } from './request'

export function fetchBoard() {
  return get('/tenantApp/board/index', {}, { silent: true })
}

/** mock 环境专用的「模拟扫描完成」；真实后端无此接口，调用失败会被忽略 */
export function refreshScanMock() {
  return get('/tenantApp/board/refresh', {}, { silent: true })
}
