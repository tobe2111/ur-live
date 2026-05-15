/**
 * 🛡️ 2026-05-15: A/B Feature Flag (KV 기반, 0원 운영)
 *
 * - GET /api/flags                  — 모든 활성 flag (캐시 가능)
 * - GET /api/flags/:key             — 특정 flag value (anonymous 가능)
 * - POST /api/flags/:key (admin)    — flag 설정 변경
 * - DELETE /api/flags/:key (admin)  — flag 삭제
 *
 * Flag schema (KV value JSON):
 *   { enabled: boolean, variant?: string, percentage?: number, allowlist?: string[] }
 *
 * 사용 예:
 *   - "gb_new_join_button": variant="A"|"B", percentage=50 (50% 사용자 B variant)
 *   - "gb_tier_visualization_v2": enabled=true (전체 활성)
 *   - "gb_email_template_v2": allowlist=["seller-123"] (특정 셀러만)
 *
 * 클라이언트 평가 (src/lib/feature-flag.ts):
 *   - userId 의 hash % 100 < percentage → 'B' variant
 *   - allowlist 우선
 *   - 결과 sessionStorage 캐싱 (24h)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAdmin } from '../middleware/auth'

const flagRoutes = new Hono<{ Bindings: Env }>()

interface FlagConfig {
  enabled: boolean
  variant?: string
  percentage?: number
  allowlist?: string[]
  description?: string
  updated_at?: string
}

const VALID_KEY = /^[a-z0-9_]{2,80}$/

flagRoutes.get('/', async (c) => {
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ success: true, data: {} })
  try {
    const list = await kv.list({ prefix: 'flag:' })
    const flags: Record<string, FlagConfig> = {}
    for (const k of list.keys) {
      const v = await kv.get(k.name)
      if (v) try { flags[k.name.replace('flag:', '')] = JSON.parse(v) } catch { /* skip */ }
    }
    return c.json({ success: true, data: flags }, 200, {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    })
  } catch {
    return c.json({ success: true, data: {} })
  }
})

flagRoutes.get('/:key', async (c) => {
  const key = c.req.param('key')
  if (!VALID_KEY.test(key)) return c.json({ success: false, error: '잘못된 key' }, 400)
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ success: true, data: { enabled: false } })
  const v = await kv.get(`flag:${key}`)
  if (!v) return c.json({ success: true, data: { enabled: false } })
  try {
    return c.json({ success: true, data: JSON.parse(v) }, 200, {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    })
  } catch {
    return c.json({ success: true, data: { enabled: false } })
  }
})

flagRoutes.post('/:key', requireAdmin(), async (c) => {
  const key = c.req.param('key')
  if (!VALID_KEY.test(key)) return c.json({ success: false, error: '잘못된 key' }, 400)
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ success: false, error: 'KV 미설정' }, 503)
  const body = await c.req.json<FlagConfig>().catch(() => null)
  if (!body || typeof body.enabled !== 'boolean') return c.json({ success: false, error: 'enabled 필수' }, 400)
  if (body.percentage !== undefined && (!Number.isFinite(body.percentage) || body.percentage < 0 || body.percentage > 100)) {
    return c.json({ success: false, error: 'percentage 0-100 사이' }, 400)
  }
  const config: FlagConfig = {
    enabled: body.enabled,
    variant: body.variant ? String(body.variant).slice(0, 60) : undefined,
    percentage: body.percentage,
    allowlist: Array.isArray(body.allowlist) ? body.allowlist.slice(0, 1000).map(String) : undefined,
    description: body.description ? String(body.description).slice(0, 500) : undefined,
    updated_at: new Date().toISOString(),
  }
  await kv.put(`flag:${key}`, JSON.stringify(config))
  return c.json({ success: true, data: config })
})

flagRoutes.delete('/:key', requireAdmin(), async (c) => {
  const key = c.req.param('key')
  if (!VALID_KEY.test(key)) return c.json({ success: false, error: '잘못된 key' }, 400)
  const kv = (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ success: false, error: 'KV 미설정' }, 503)
  await kv.delete(`flag:${key}`)
  return c.json({ success: true })
})

export { flagRoutes }
