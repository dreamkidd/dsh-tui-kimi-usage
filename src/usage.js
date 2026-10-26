/**
 * 用量读数：拉取与解析订阅端点的 `/usages` 响应。
 *
 * 纯函数 + 一次网络调用，不依赖 cordis / TUI，node --test 直接覆盖。
 * 领域术语见仓库根目录 GLOSSARY.md。
 *
 * @module dsh-tui-kimi-usage/usage
 */

/**
 * 一个配额窗口的读数。
 * @typedef {object} WindowReading
 * @property {number} usedPct - 已用比例，0–100 的整数。
 * @property {Date | undefined} resetAt - 窗口重置时刻；服务端未给时为 undefined。
 */

/**
 * 一次用量读数：5h 窗口与 7d 窗口各一份（可能只有其一）。
 * @typedef {object} UsageReading
 * @property {WindowReading | undefined} window5h
 * @property {WindowReading | undefined} window7d
 */

/**
 * 把 `/usages` 的响应体解析成用量读数。
 *
 * 响应里 `usage` / `limits[]` 是两个窗口的计数版，`usages.limit_5h` /
 * `usages.limit_7d` 是比例版；同源重复，只取比例版。两个窗口都缺失或
 * 都不可用（used_ratio 不是数字）时返回 undefined——读数缺失不等于
 * 额度为零。
 *
 * @param {unknown} body - 响应 JSON。
 * @returns {UsageReading | undefined}
 */
export function parseUsage(body) {
  const win = (w) => {
    if (!w || typeof w.used_ratio !== 'number' || !Number.isFinite(w.used_ratio)) return undefined
    const resetAt = typeof w.reset_time === 'string' ? new Date(w.reset_time) : undefined
    return {
      usedPct: Math.round(w.used_ratio * 100),
      resetAt: resetAt && !Number.isNaN(resetAt.getTime()) ? resetAt : undefined,
    }
  }
  const window5h = win(body?.usages?.limit_5h)
  const window7d = win(body?.usages?.limit_7d)
  if (!window5h && !window7d) return undefined
  return { window5h, window7d }
}

/**
 * 拉取一次用量读数。
 *
 * @param {string} baseUrl - 订阅端点根地址（不带尾随斜杠）。
 * @param {string} apiKey - Bearer 凭据。
 * @param {object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @param {typeof fetch} [options.fetchImpl=fetch] - 测试注入点。
 * @returns {Promise<UsageReading | undefined>} 解析失败时同样 reject，
 *   调用方按"拉取失败"统一处理。
 */
export async function fetchUsage(baseUrl, apiKey, { timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${baseUrl}/usages`, {
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`usages: HTTP ${res.status}`)
    const reading = parseUsage(await res.json())
    if (!reading) throw new Error('usages: no quota window in response')
    return reading
  } finally {
    clearTimeout(timer)
  }
}
