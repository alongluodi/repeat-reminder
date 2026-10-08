/**
 * 拉起微信的降级封装
 *
 * 老板端最痛的场景：复制完话术还要「退出 H5 → 切微信 → 找客户 → 粘贴」。
 * 这里在复制成功后的浮层里给一个「打开微信」按钮，直接拉起 App。
 *
 * 能力边界（微信不开放，能做到的就这些 —— 别在 UI 上承诺更多）：
 *   - weixin:// 是微信的通用 scheme，只能把微信**拉到前台**：
 *     不能带搜索词、不能搜索联系人、不能跳到某个人的聊天（2026-10-10 真机验证，
 *     老板反馈「微信打开了但没搜索」就是这里）。找人只能靠老板在微信里手搜。
 *   - 部分环境（PC 浏览器、部分安全浏览器）会静默失败 —— 这时不报错、只提示「已复制，手动打开微信粘贴」；
 *   - 微信自身内置浏览器里跳 weixin:// 无意义（已经在微信里），直接返回 'in-wechat'。
 *
 * @returns {Promise<'opened'|'in-wechat'|'failed'>}
 *   opened    成功离开当前页（切到了微信）
 *   in-wechat 当前就在微信内置浏览器里，无需拉起
 *   failed    没离开（PC 浏览器 / scheme 被拦）
 */
export function openWechat() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve('failed')
      return
    }

    // 已在微信内置浏览器：无需再拉
    const ua = navigator.userAgent || ''
    if (/MicroMessenger/i.test(ua)) {
      resolve('in-wechat')
      return
    }

    let resolved = false
    const finish = (r) => {
      if (resolved) return
      resolved = true
      resolve(r)
    }

    // 切到微信后页面会进入后台（visibilitychange）或触发 pagehide，
    // 用这个信号判定「拉起来了」，避免直接判定成功造成误导。
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        cleanup()
        finish('opened')
      }
    }
    const onPageHide = () => {
      cleanup()
      finish('opened')
    }
    function cleanup() {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      cleanup()
      finish('failed')
    }, 1500)

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)

    try {
      window.location.href = 'weixin://'
    } catch (e) {
      cleanup()
      finish('failed')
    }
  })
}
