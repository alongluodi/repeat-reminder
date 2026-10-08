/**
 * 轻量 toast（不引 UI 库，避免为一个提示多背 100KB）
 * 单例 DOM，重复调用只更新文案并重置计时。
 */
let el = null
let timer = null

function ensureEl() {
  if (el) return el
  el = document.createElement('div')
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:44%',
    'transform:translate(-50%,-50%)',
    'max-width:72%',
    'padding:10px 16px',
    'border-radius:8px',
    'background:rgba(0,0,0,0.78)',
    'color:#fff',
    'font-size:13px',
    'line-height:1.4',
    'text-align:center',
    'z-index:9999',
    'opacity:0',
    'transition:opacity .18s',
    'pointer-events:none',
    'word-break:break-all'
  ].join(';')
  document.body.appendChild(el)
  return el
}

export function toast(message, duration = 1800) {
  const node = ensureEl()
  node.textContent = message
  node.style.opacity = '1'
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    node.style.opacity = '0'
  }, duration)
}

/* ------------------------------------------------------------------ *
 * 带「撤销」按钮的底部轻提示
 * 场景：忽略一位客户的提醒后，不应该弹一个大确认框再让人点一次；
 *       而是即时生效 + 底部给一次「撤销」的机会（误点可退回）。
 * ------------------------------------------------------------------ */
let barEl = null
let barTimer = null

function ensureBar() {
  if (barEl) return barEl
  barEl = document.createElement('div')
  barEl.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:calc(72px + env(safe-area-inset-bottom, 0px))',
    'transform:translateX(-50%)',
    'display:flex',
    'align-items:center',
    'gap:14px',
    'max-width:88%',
    'padding:10px 14px',
    'border-radius:10px',
    'background:rgba(0,0,0,0.82)',
    'color:#fff',
    'font-size:13px',
    'line-height:1.4',
    'z-index:9999',
    'opacity:0',
    'transition:opacity .18s',
    'pointer-events:none',
    'box-shadow:0 4px 16px rgba(0,0,0,0.18)'
  ].join(';')
  document.body.appendChild(barEl)
  return barEl
}

/**
 * 底部动作轻提示
 * @param {string} message  文案
 * @param {string} actionText 按钮文案（如「撤销」）
 * @param {Function} onAction 点击按钮回调
 * @param {number} duration 停留时长
 */
export function toastAction(message, actionText, onAction, duration = 4500) {
  const node = ensureBar()
  node.textContent = ''
  const span = document.createElement('span')
  span.textContent = message
  span.style.cssText = 'flex:1;min-width:0;'
  node.appendChild(span)

  if (actionText) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = actionText
    btn.style.cssText = [
      'flex:none',
      'padding:2px 8px',
      'color:#f7c6c7',
      'font-size:13px',
      'font-weight:600',
      'cursor:pointer',
      'background:none',
      'border:none'
    ].join(';')
    btn.addEventListener('click', () => {
      hideBar()
      onAction?.()
    })
    node.appendChild(btn)
  }

  node.style.opacity = '1'
  node.style.pointerEvents = 'auto'
  if (barTimer) clearTimeout(barTimer)
  barTimer = setTimeout(hideBar, duration)
  return hideBar
}

export function hideBar() {
  if (barTimer) clearTimeout(barTimer)
  if (barEl) {
    barEl.style.opacity = '0'
    barEl.style.pointerEvents = 'none'
  }
}

/** 确认弹窗（原生 confirm，够用；移动端浏览器会渲染成系统样式） */
export function confirmBox(message) {
  return window.confirm(message)
}
