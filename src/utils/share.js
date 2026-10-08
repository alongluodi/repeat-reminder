/**
 * 系统分享（Web Share API）——「复制话术」之外的更短路径
 *
 * 背景（2026-10-12）：老板的痛点是「复制 → 切微信 → 找人 → 粘贴 → 发送 → 回 H5 标记」六步。
 * 微信不开放代发/代搜索，六步里的人工部分无法消灭，但**可以借系统分享面板砍掉大半**：
 *
 *   支持分享的环境：调 navigator.share({ text })，弹出系统分享面板 →
 *     选微信 → 选联系人 → 话术已经躺在输入框里，点发送即可。
 *   一步省掉：切 App、搜联系人、粘贴；顺带消灭「先复制微信号再复制话术」的剪贴板冲突。
 *
 *   不支持的环境（微信内置浏览器 / 非 HTTPS / 桌面浏览器）：返回 unsupported，
 *   由调用方降级为「复制到剪贴板」（现有路径，体验不倒退）。
 *
 * 能力边界（别在 UI 上承诺更多）：
 *   - 微信内置浏览器不实现 Web Share API（且我们自己也会拦掉 MicroMessenger，避免半残行为）；
 *   - **非安全上下文（http）下 navigator.share / canShare 不存在** —— 也就是说这个功能
 *     要等线上配好 HTTPS 才会自动启用，http 下自动走复制，属预期行为不是 bug；
 *   - 系统分享面板由用户选择目标，我们拿不到「发给了谁」，只拿得到「面板走完了没」。
 */

/** 是否在微信内置浏览器里（那里 Web Share API 不可用/不可靠） */
export function isWeChatBrowser() {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent || '')
}

/**
 * 当前环境是否能用系统分享发送文本
 * 需同时满足：非微信内置浏览器 + 非安全上下文条件满足 + 平台声明支持 text 分享
 */
export function canShareText() {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
    if (isWeChatBrowser()) return false
    if (!navigator.share || !navigator.canShare) return false
    if (!window.isSecureContext) return false
    return !!navigator.canShare({ text: 'x' })
  } catch (e) {
    return false
  }
}

/**
 * 调起系统分享
 * @param {string} text
 * @returns {Promise<'shared'|'cancelled'|'unsupported'|'failed'>}
 *   shared      分享面板走完（用户已选择目标并送出）→ 可视为「已发送」
 *   cancelled   用户主动取消 → 什么都不做（不要标记已提醒）
 *   unsupported 环境不支持 → 调用方降级为复制
 *   failed      调起异常 → 调用方降级为复制
 */
export async function shareText(text) {
  const value = String(text ?? '')
  if (!value) return 'failed'
  if (!canShareText()) return 'unsupported'
  try {
    await navigator.share({ text: value })
    return 'shared'
  } catch (e) {
    // 用户取消不是错误：AbortError / NotAllowedError 都不该提示失败
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'cancelled'
    return 'failed'
  }
}
