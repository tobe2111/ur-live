/**
 * 🛡️ 2026-05-15: 환율 endpoint — exchangerate.host (free, key 불필요).
 *
 * KRW base, return 1 KRW → other currencies.
 * KV 1시간 캐싱 (free tier 호환).
 *
 * GET /api/currency/rates  → { success, rates: { USD, JPY, CNY, EUR } }
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

const currencyRoutes = new Hono<{ Bindings: Env }>()

const TARGETS = ['USD', 'JPY', 'CNY', 'EUR']
const CACHE_KEY = 'currency_rates_v1'
const CACHE_TTL = 60 * 60 // 1시간

interface ExchangeApiResponse {
  result?: string
  conversion_rates?: Record<string, number>
  rates?: Record<string, number>
}

currencyRoutes.get('/rates', async (c) => {
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV

  if (kv) {
    try {
      const cached = await kv.get(CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        return c.json({ success: true, rates: data, cached: true }, 200, {
          'Cache-Control': 'public, max-age=3600',
        })
      }
    } catch { /* miss */ }
  }

  // exchangerate.host (free, no key) — KRW base
  let rates: Record<string, number> = {
    USD: 0.00072, JPY: 0.108, CNY: 0.0052, EUR: 0.00067,  // fallback
  }
  try {
    const res = await fetch(`https://api.exchangerate.host/latest?base=KRW&symbols=${TARGETS.join(',')}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json<ExchangeApiResponse>()
      if (data.rates) {
        rates = { ...rates, ...data.rates }
        if (kv) {
          await kv.put(CACHE_KEY, JSON.stringify(rates), { expirationTtl: CACHE_TTL }).catch(() => { /* silent */ })
        }
      }
    }
  } catch { /* fallback */ }

  return c.json({ success: true, rates }, 200, {
    'Cache-Control': 'public, max-age=3600',
  })
})

export { currencyRoutes }
