// ============================================================
// Health Check Routes — /api/health/*
//
// Extended health probes that complement the existing lightweight
// `/api/health` (defined inline in worker/index.ts). Returns per-
// dependency status so ops dashboards can distinguish a DB outage
// from a KV outage or a failing external service.
//
// Exposed:
//   GET /api/health/         — DB + KV + circuit summary
//   GET /api/health/circuits — current circuit-breaker states
//
// ⚠️  Keep this endpoint fast and dependency-light. It's hit by
//     uptime monitors and should NOT depend on external services.
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { listCircuits } from '../utils/circuit-breaker'

export const healthRoutes = new Hono<{ Bindings: Env }>()

interface CheckResult {
  ok: boolean
  latency?: number
  error?: string
}

healthRoutes.get('/', async (c) => {
  const startTime = Date.now()
  const checks: Record<string, CheckResult> = {}

  // DB check
  try {
    const t0 = Date.now()
    await c.env.DB.prepare('SELECT 1').first()
    checks.db = { ok: true, latency: Date.now() - t0 }
  } catch (e) {
    checks.db = { ok: false, error: (e as Error).message }
  }

  // KV check (SESSION_KV and/or RATE_LIMIT_KV if bound)
  try {
    if (c.env.SESSION_KV) {
      const t0 = Date.now()
      await c.env.SESSION_KV.get('__health__')
      checks.session_kv = { ok: true, latency: Date.now() - t0 }
    }
  } catch (e) {
    checks.session_kv = { ok: false, error: (e as Error).message }
  }

  try {
    if (c.env.RATE_LIMIT_KV) {
      const t0 = Date.now()
      await c.env.RATE_LIMIT_KV.get('__health__')
      checks.rate_limit_kv = { ok: true, latency: Date.now() - t0 }
    }
  } catch (e) {
    checks.rate_limit_kv = { ok: false, error: (e as Error).message }
  }

  // Circuit breakers — if any is OPEN we are "degraded"
  const circuits = listCircuits()
  const openCircuits = Object.entries(circuits)
    .filter(([, s]) => s.state === 'open')
    .map(([name]) => name)

  const allOk = Object.values(checks).every((r) => r.ok) && openCircuits.length === 0

  return c.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      circuits: {
        total: Object.keys(circuits).length,
        open: openCircuits,
      },
      uptime: null, // Workers are stateless
      region: c.env.REGION ?? 'unknown',
      environment: c.env.ENVIRONMENT ?? 'development',
      totalLatency: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
    allOk ? 200 : 503,
  )
})

/**
 * Admin-friendly dump of circuit-breaker state.
 * Safe to expose (no secrets) but useful for debugging.
 */
healthRoutes.get('/circuits', (c) => {
  return c.json({
    circuits: listCircuits(),
    timestamp: new Date().toISOString(),
  })
})
