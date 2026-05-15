/**
 * 🛡️ 2026-05-15: Web Vitals + 공구 funnel 수집 (KV 카운터, 0원 운영)
 *
 * - POST /api/analytics/vitals  — { name: 'LCP'|'FID'|'CLS'|'INP'|'TTFB', value, id, page }
 * - POST /api/analytics/funnel  — { event: 'view'|'click'|'join'|'success', product_id, page }
 * - GET  /api/analytics/summary (admin) — KV 누적 값 dump
 *
 * 모두 KV 에 일별 카운터 (key = `vitals:YYYY-MM-DD:LCP:p75` 같은 식).
 * Cloudflare KV free: 100K read/day, 1K write/day. Sampling 으로 비용 0 유지.
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAdmin } from '../middleware/auth'

const analyticsRoutes = new Hono<{ Bindings: Env }>()

// 1% sampling — 100명 중 1명만 기록 (KV write 한도 보호)
const VITALS_SAMPLE_RATE = 0.01

interface VitalsBody {
  name?: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value?: number
  page?: string
}

interface FunnelBody {
  event?: 'view' | 'click' | 'join' | 'success'
  product_id?: number
  page?: string
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

async function incrementCounter(kv: KVNamespace, key: string, increment: number = 1, ttlSec: number = 90 * 86400): Promise<void> {
  try {
    const cur = await kv.get(key)
    const n = (cur ? parseInt(cur, 10) : 0) + increment
    await kv.put(key, String(n), { expirationTtl: ttlSec })
  } catch { /* KV 미설정 / 한도 초과 시 silent */ }
}

async function appendSample(kv: KVNamespace, key: string, value: number, maxSamples: number = 100): Promise<void> {
  // 간단한 reservoir-ish: 기존 array (≤100) 에 push, 초과 시 무작위 교체
  try {
    const cur = await kv.get(key)
    const arr: number[] = cur ? JSON.parse(cur) : []
    if (arr.length < maxSamples) arr.push(value)
    else {
      const idx = Math.floor(Math.random() * (arr.length + 1))
      if (idx < maxSamples) arr[idx] = value
    }
    await kv.put(key, JSON.stringify(arr), { expirationTtl: 90 * 86400 })
  } catch { /* silent */ }
}

analyticsRoutes.post('/vitals', async (c) => {
  if (Math.random() > VITALS_SAMPLE_RATE) return c.json({ ok: true, sampled: false })
  const body = await c.req.json<VitalsBody>().catch(() => ({} as VitalsBody))
  if (!body.name || typeof body.value !== 'number' || !Number.isFinite(body.value)) {
    return c.json({ ok: false }, 400)
  }
  const validNames = ['LCP', 'FID', 'CLS', 'INP', 'TTFB']
  if (!validNames.includes(body.name)) return c.json({ ok: false }, 400)
  if (body.value < 0 || body.value > 1_000_000) return c.json({ ok: false }, 400)
  const kv = (c.env as Env & { ANALYTICS_KV?: KVNamespace; SESSION_KV?: KVNamespace }).ANALYTICS_KV
    || (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ ok: true, skipped: true })

  const day = todayKey()
  // 페이지 키워드 정규화 (group-buy/123 → group-buy)
  const page = (body.page || '').replace(/\/\d+/g, '').slice(0, 60) || 'unknown'
  const sampleKey = `vitals:${day}:${body.name}:${page}`
  await appendSample(kv, sampleKey, Math.round(body.value))
  await incrementCounter(kv, `vitals_count:${day}:${body.name}`, 1)
  return c.json({ ok: true })
})

analyticsRoutes.post('/funnel', async (c) => {
  const body = await c.req.json<FunnelBody>().catch(() => ({} as FunnelBody))
  if (!body.event) return c.json({ ok: false }, 400)
  const validEvents = ['view', 'click', 'join', 'success']
  if (!validEvents.includes(body.event)) return c.json({ ok: false }, 400)
  const kv = (c.env as Env & { ANALYTICS_KV?: KVNamespace; SESSION_KV?: KVNamespace }).ANALYTICS_KV
    || (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ ok: true, skipped: true })

  const day = todayKey()
  const page = (body.page || '').replace(/\/\d+/g, '').slice(0, 60) || 'unknown'
  await incrementCounter(kv, `funnel:${day}:${body.event}:${page}`, 1)
  if (body.product_id && Number.isFinite(body.product_id)) {
    await incrementCounter(kv, `funnel_product:${day}:${body.product_id}:${body.event}`, 1)
  }
  return c.json({ ok: true })
})

analyticsRoutes.get('/summary', requireAdmin(), async (c) => {
  const kv = (c.env as Env & { ANALYTICS_KV?: KVNamespace; SESSION_KV?: KVNamespace }).ANALYTICS_KV
    || (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ success: true, data: { vitals: {}, funnel: {} } })

  const day = c.req.query('day') || todayKey()
  const vitals: Record<string, { p50: number; p75: number; p95: number; samples: number }> = {}
  const funnel: Record<string, number> = {}

  for (const name of ['LCP', 'FID', 'CLS', 'INP', 'TTFB']) {
    try {
      const list = await kv.list({ prefix: `vitals:${day}:${name}:` })
      for (const k of list.keys) {
        const raw = await kv.get(k.name)
        if (!raw) continue
        const arr = JSON.parse(raw) as number[]
        if (arr.length === 0) continue
        const sorted = [...arr].sort((a, b) => a - b)
        const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
        vitals[k.name] = {
          p50: pct(0.5), p75: pct(0.75), p95: pct(0.95), samples: arr.length,
        }
      }
    } catch { /* skip */ }
  }

  try {
    const list = await kv.list({ prefix: `funnel:${day}:` })
    for (const k of list.keys) {
      const v = await kv.get(k.name)
      if (v) funnel[k.name.replace(`funnel:${day}:`, '')] = parseInt(v, 10) || 0
    }
  } catch { /* skip */ }

  return c.json({ success: true, data: { day, vitals, funnel } })
})

export { analyticsRoutes }
