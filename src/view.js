/**
 * 富文本状态视图：`tuiStatus.registerView` 的组件工厂。
 *
 * 插件不打包 React：组件经 props 拿到宿主 React 实例（single-React 规则，
 * 与插件场景一致），元素与 hook 都必须用它。配色用语义色名（green/yellow/
 * red/dimColor），不写死 hex，跟随宿主主题。
 *
 * @module dsh-tui-kimi-usage/view
 */
import { formatReset } from './format.js'

/** 已用比例的语义色：≥99 红，≥warnThreshold 黄，其余绿。 */
const toneOf = (pct, warnThreshold) =>
  pct >= 99 ? 'red' : pct >= warnThreshold ? 'yellow' : 'green'

/** 五格文本进度条：█ 已用，░ 剩余。 */
const bar = (pct) => {
  const cells = 5
  const filled = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)))
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

/**
 * @param {{ subscribe: (l: () => void) => () => void, getSnapshot: () => object }} store
 * @returns {import('react').ComponentType<object>} 宿主 React 渲染的状态视图
 */
export function buildUsageView(store) {
  return function UsageView(props) {
    const { React, ui } = props
    const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
    if (!snap || snap.hidden) return null
    const e = React.createElement
    const { reading, stale, format, warnThreshold } = snap
    const compact = format === 'compact'
    const now = new Date()

    const win = (label, w) => {
      if (!w) return null
      const tone = toneOf(w.usedPct, warnThreshold)
      if (compact) {
        return e(ui.Text, { color: tone }, `${label} ${w.usedPct}%`)
      }
      return e(
        ui.Text,
        null,
        e(ui.Text, { dimColor: true }, `${label} `),
        e(ui.Text, { color: tone }, `${bar(w.usedPct)} ${w.usedPct}%`),
        w.resetAt
          ? e(ui.Text, { dimColor: true }, ` ↻${formatReset(w.resetAt, now)}`)
          : null,
      )
    }

    return e(
      ui.Box,
      null,
      e(ui.Text, { dimColor: true }, 'kimi '),
      win('5h', reading?.window5h),
      reading?.window5h && reading?.window7d
        ? e(ui.Text, { dimColor: true }, ' · ')
        : null,
      win('7d', reading?.window7d),
      stale ? e(ui.Text, { color: 'yellow' }, ' ?') : null,
    )
  }
}
