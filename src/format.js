/**
 * 状态行文本格式化：把用量读数渲染成一格纯文本。
 *
 * `ctx.tuiStatus.set()` 是纯文本缝（无颜色、上限 200 字符），警示只能
 * 用字符标记：窗口达到 warnThreshold 加 `!`，读数陈旧（上次成功后
 * 拉取失败）加尾部 ` ?`。
 *
 * @module dsh-tui-kimi-usage/format
 */

const pad = (n) => String(n).padStart(2, '0')

/**
 * 重置时刻的紧凑显示：与 now 同日本地时间 `HH:mm`，跨天 `MM-dd`。
 *
 * @param {Date} resetAt
 * @param {Date} now
 * @returns {string}
 */
export function formatReset(resetAt, now) {
  const sameDay =
    resetAt.getFullYear() === now.getFullYear() &&
    resetAt.getMonth() === now.getMonth() &&
    resetAt.getDate() === now.getDate()
  return sameDay
    ? `${pad(resetAt.getHours())}:${pad(resetAt.getMinutes())}`
    : `${pad(resetAt.getMonth() + 1)}-${pad(resetAt.getDate())}`
}

/**
 * 渲染一格状态行文本。
 *
 * full:    `kimi 5h 98%!↻21:46 · 7d 60%↻10-29`
 * compact: `kimi 98/60`（任一窗口达阈值时 `kimi 98/60!`）
 * 陈旧读数尾部加 ` ?`。两个窗口都无读数时返回 undefined（调用方隐藏）。
 *
 * @param {import('./usage.js').UsageReading} reading
 * @param {object} [options]
 * @param {'full' | 'compact'} [options.format='full']
 * @param {number} [options.warnThreshold=90]
 * @param {boolean} [options.stale=false]
 * @param {Date} [options.now=new Date()]
 * @returns {string | undefined}
 */
export function formatStatus(reading, { format = 'full', warnThreshold = 90, stale = false, now = new Date() } = {}) {
  const { window5h, window7d } = reading
  const suffix = stale ? ' ?' : ''
  if (format === 'compact') {
    if (!window5h && !window7d) return undefined
    const bang = (window5h?.usedPct ?? 0) >= warnThreshold || (window7d?.usedPct ?? 0) >= warnThreshold
    return `kimi ${window5h?.usedPct ?? '-'}/${window7d?.usedPct ?? '-'}${bang ? '!' : ''}${suffix}`
  }
  const part = (label, w) => {
    if (!w) return undefined
    const bang = w.usedPct >= warnThreshold ? '!' : ''
    return `${label} ${w.usedPct}%${bang}${w.resetAt ? `↻${formatReset(w.resetAt, now)}` : ''}`
  }
  const parts = [part('5h', window5h), part('7d', window7d)].filter(Boolean)
  if (parts.length === 0) return undefined
  return `kimi ${parts.join(' · ')}${suffix}`
}
