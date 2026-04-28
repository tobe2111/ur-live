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
import { requireAuth, getCurrentUser } from '../middleware/auth'

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
 * 🛡️ 2026-04-26 V3: 마이그레이션 적용 상태 검증
 *
 * 이번 세션 (2026-04-26) 신규 마이그레이션 0207~0217 + 핵심 테이블이
 * 실제 D1 에 적용됐는지 확인. 기대 컬럼/테이블 존재 여부만 체크 (read-only).
 *
 * 응답:
 *   {
 *     all_applied: boolean,
 *     missing: ['agency_members', 'agencies.tier', ...],
 *     applied: [...],
 *     expected: 11
 *   }
 *
 * 어드민 전용 (인프라 정보 노출 방지).
 */
healthRoutes.get('/migrations', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'admin') {
    return c.json({ success: false, error: 'forbidden' }, 403)
  }
  const DB = c.env.DB

  // 검증 항목 — (table 또는 table.column)
  // 이번 세션 신규 0207~0217 의 핵심만 (모든 컬럼 X)
  const checks: Array<{ key: string; sql: string; migration: string; expect_count_min?: number }> = [
    // 0207
    { key: 'agency_creator_approvals', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_creator_approvals'", migration: '0207' },
    { key: 'sellers.affiliated_agency_id', sql: "SELECT 1 FROM pragma_table_info('sellers') WHERE name='affiliated_agency_id'", migration: '0207' },
    // 0208
    { key: 'agencies.auto_settle', sql: "SELECT 1 FROM pragma_table_info('agencies') WHERE name='auto_settle'", migration: '0208' },
    { key: 'agency_settlements.tax_amount', sql: "SELECT 1 FROM pragma_table_info('agency_settlements') WHERE name='tax_amount'", migration: '0208' },
    // 0209
    { key: 'agency_campaigns', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_campaigns'", migration: '0209' },
    { key: 'agency_campaign_participants', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_campaign_participants'", migration: '0209' },
    // 0210
    { key: 'agency_incentive_rules', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_incentive_rules'", migration: '0210' },
    { key: 'agency_incentive_payouts', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_incentive_payouts'", migration: '0210' },
    // 0211
    { key: 'auction_winner_history', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='auction_winner_history'", migration: '0211' },
    { key: 'auction_holds.forfeit_reason', sql: "SELECT 1 FROM pragma_table_info('auction_holds') WHERE name='forfeit_reason'", migration: '0211' },
    // 0212
    { key: 'agencies.tier', sql: "SELECT 1 FROM pragma_table_info('agencies') WHERE name='tier'", migration: '0212' },
    // 0213
    { key: 'agency_creator_approvals.evaluation_score', sql: "SELECT 1 FROM pragma_table_info('agency_creator_approvals') WHERE name='evaluation_score'", migration: '0213' },
    // 0214
    { key: 'agency_message_templates', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_message_templates'", migration: '0214' },
    { key: 'agency_message_sends', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_message_sends'", migration: '0214' },
    // 0215
    { key: 'agency_monthly_tasks', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_monthly_tasks'", migration: '0215' },
    // 0216
    { key: 'coupons.distributed_by_agency_id', sql: "SELECT 1 FROM pragma_table_info('coupons') WHERE name='distributed_by_agency_id'", migration: '0216' },
    { key: 'agency_coupon_distributions', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_coupon_distributions'", migration: '0216' },
    // 0217
    { key: 'agency_members', sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='agency_members'", migration: '0217' },
  ]

  const applied: string[] = []
  const missing: string[] = []
  const errors: Array<{ key: string; error: string }> = []

  for (const check of checks) {
    try {
      const row = await DB.prepare(check.sql).first()
      if (row) applied.push(check.key)
      else missing.push(check.key)
    } catch (e) {
      errors.push({ key: check.key, error: (e as Error).message })
      missing.push(check.key)
    }
  }

  // 마이그레이션 별 그룹화
  const byMigration: Record<string, { applied: string[]; missing: string[] }> = {}
  for (const check of checks) {
    if (!byMigration[check.migration]) byMigration[check.migration] = { applied: [], missing: [] }
    if (applied.includes(check.key)) byMigration[check.migration].applied.push(check.key)
    else byMigration[check.migration].missing.push(check.key)
  }

  const allApplied = missing.length === 0

  return c.json({
    all_applied: allApplied,
    summary: {
      total: checks.length,
      applied: applied.length,
      missing: missing.length,
      errors: errors.length,
    },
    by_migration: byMigration,
    missing,
    errors,
    timestamp: new Date().toISOString(),
  }, allApplied ? 200 : 200)  // 200 always (인포 용도)
})

/**
 * Circuit-breaker state dump — ADMIN ONLY.
 *
 * Although it doesn't contain secrets, it exposes internal dependency
 * names and failure counts that help attackers map our infrastructure.
 * Locked behind `requireAuth() + admin` check.
 */
healthRoutes.get('/circuits', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'admin') {
    return c.json({ success: false, error: 'forbidden' }, 403)
  }
  return c.json({
    circuits: listCircuits(),
    timestamp: new Date().toISOString(),
  })
})
