/**
 * 剪贴板复制
 * 优先 navigator.clipboard（需 https 或 localhost），失败降级 execCommand，
 * 再失败抛错由调用方提示「长按复制」。返回是否成功。
 */
export async function copyText(text) {
  const value = String(text ?? '')
  if (!value) return false

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch (e) {
      /* 继续走降级 */
    }
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    return false
  }
}
