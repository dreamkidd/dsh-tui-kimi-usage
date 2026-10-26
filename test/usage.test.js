import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseUsage, fetchUsage } from '../src/usage.js'

// 2026-10-23 从 https://api.kimi.com/coding/v1/usages 实抓的响应（fixture）。
const REAL_BODY = {
  usage: { limit: '100', used: '60', remaining: '40', resetTime: '2026-10-29T05:47:00.179664Z' },
  limits: [
    {
      window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
      detail: { limit: '100', used: '98', remaining: '2', resetTime: '2026-10-23T13:47:00.179664Z' },
    },
  ],
  usages: {
    limit_5h: { used_ratio: 0.9788, reset_time: '2026-10-23T13:46:59Z' },
    limit_7d: { used_ratio: 0.6048, reset_time: '2026-10-29T05:46:59Z' },
  },
}

test('parseUsage: 解析真实响应的两个窗口', () => {
  const reading = parseUsage(REAL_BODY)
  assert.equal(reading.window5h.usedPct, 98)
  assert.equal(reading.window7d.usedPct, 60)
  assert.equal(reading.window5h.resetAt.toISOString(), '2026-10-23T13:46:59.000Z')
  assert.equal(reading.window7d.resetAt.toISOString(), '2026-10-29T05:46:59.000Z')
})

test('parseUsage: used_ratio 四舍五入到整数百分比', () => {
  const reading = parseUsage({ usages: { limit_5h: { used_ratio: 0.975 } } })
  assert.equal(reading.window5h.usedPct, 98)
  assert.equal(reading.window5h.resetAt, undefined)
  assert.equal(reading.window7d, undefined)
})

test('parseUsage: 两个窗口都缺失时返回 undefined（缺失不等于为零）', () => {
  assert.equal(parseUsage({}), undefined)
  assert.equal(parseUsage({ usages: {} }), undefined)
  assert.equal(parseUsage(null), undefined)
  assert.equal(parseUsage({ usages: { limit_5h: { used_ratio: 'high' } } }), undefined)
})

test('parseUsage: reset_time 非法时降级为 undefined 而不是 NaN Date', () => {
  const reading = parseUsage({ usages: { limit_7d: { used_ratio: 0.5, reset_time: 'not-a-date' } } })
  assert.equal(reading.window7d.usedPct, 50)
  assert.equal(reading.window7d.resetAt, undefined)
})

test('fetchUsage: 非 200 响应 reject', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401 })
  await assert.rejects(fetchUsage('https://example.test', 'k', { fetchImpl }), /HTTP 401/)
})

test('fetchUsage: 响应里没有配额窗口时 reject', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) })
  await assert.rejects(fetchUsage('https://example.test', 'k', { fetchImpl }), /no quota window/)
})

test('fetchUsage: 正常路径返回读数并携带 Authorization 头', async () => {
  let seen
  const fetchImpl = async (url, init) => {
    seen = { url, init }
    return { ok: true, json: async () => REAL_BODY }
  }
  const reading = await fetchUsage('https://example.test', 'secret-key', { fetchImpl })
  assert.equal(seen.url, 'https://example.test/usages')
  assert.equal(seen.init.headers.authorization, 'Bearer secret-key')
  assert.equal(reading.window5h.usedPct, 98)
})
