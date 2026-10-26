import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatReset, formatStatus } from '../src/format.js'

const now = new Date('2026-10-23T20:30:00+08:00')

const reading = {
  window5h: { usedPct: 98, resetAt: new Date('2026-10-23T21:46:59+08:00') },
  window7d: { usedPct: 60, resetAt: new Date('2026-10-29T13:46:59+08:00') },
}

test('formatReset: 同日 HH:mm，跨天 MM-dd（本地时区）', () => {
  assert.equal(formatReset(reading.window5h.resetAt, now), '21:46')
  assert.equal(formatReset(reading.window7d.resetAt, now), '10-29')
})

test('formatStatus full: 完整格式，达阈值窗口加 !', () => {
  assert.equal(formatStatus(reading, { now }), 'kimi 5h 98%!↻21:46 · 7d 60%↻10-29')
})

test('formatStatus full: 都低于阈值时不加 !', () => {
  const calm = { window5h: { usedPct: 10 }, window7d: { usedPct: 20 } }
  assert.equal(formatStatus(calm, { now }), 'kimi 5h 10% · 7d 20%')
})

test('formatStatus: 陈旧读数尾部加 ?', () => {
  assert.equal(formatStatus(reading, { now, stale: true }), 'kimi 5h 98%!↻21:46 · 7d 60%↻10-29 ?')
})

test('formatStatus compact: 98/60，任一达阈值加 !', () => {
  assert.equal(formatStatus(reading, { format: 'compact', now }), 'kimi 98/60!')
  const calm = { window5h: { usedPct: 10 }, window7d: { usedPct: 20 } }
  assert.equal(formatStatus(calm, { format: 'compact', now }), 'kimi 10/20')
})

test('formatStatus: 只有一个窗口时只渲染一个', () => {
  const only7d = { window7d: { usedPct: 60, resetAt: new Date('2026-10-29T13:46:59+08:00') } }
  assert.equal(formatStatus(only7d, { now }), 'kimi 7d 60%↻10-29')
  assert.equal(formatStatus(only7d, { format: 'compact', now }), 'kimi -/60')
})

test('formatStatus: 无窗口返回 undefined（调用方隐藏）', () => {
  assert.equal(formatStatus({}, { now }), undefined)
})

test('formatStatus: warnThreshold 可配', () => {
  const r = { window5h: { usedPct: 80 } }
  assert.equal(formatStatus(r, { now, warnThreshold: 80 }), 'kimi 5h 80%!')
  assert.equal(formatStatus(r, { now, warnThreshold: 95 }), 'kimi 5h 80%')
})
