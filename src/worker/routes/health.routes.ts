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
 * 🔧 2026-06-29 환경 준비상태 진단 — ADMIN ONLY.
 *
 *   대표 질문 "다른 운영자/브라우저/장소에서 써도 문제없게 환경 세팅 다 됐어?" 에 대한
 *   *검증 가능한* 답. 대시보드 로그인/보안을 게이트하는 Cloudflare 바인딩·시크릿이 실제
 *   설정됐는지 런타임에서 확인. **값은 절대 노출 안 함 — 존재 여부(present)만.**
 *
 *   기존 /api/health 의 갭 보완: 그건 *있을 때만* KV 핑(없으면 skip=안 보임), JWT_SECRET 등
 *   시크릿은 미점검이었음. 여기선 누락을 명시적으로 RED 로 보고.
 *
 *   severity:
 *     - blocking : 없으면 그 기능 자체가 깨짐(대시보드 로그인 등) → ready=false
 *     - security : fail-open(동작하나 보안 약화 — brute-force/봇/평문토큰)
 *     - perf     : degraded(느려지나 동작)
 *     - payments : 소비자 결제(도매몰 예치금은 무관)
 *     - optional : 선택 기능(fail-soft)
 */
healthRoutes.get('/env-readiness', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'admin') {
    return c.json({ success: false, error: 'forbidden' }, 403)
  }
  const env = c.env as unknown as Record<string, unknown>
  const has = (k: string) => {
    const v = env[k]
    return typeof v === 'string' ? v.trim().length > 0 : v != null
  }

  const SPEC: Array<{ key: string; group: 'blocking' | 'security' | 'perf' | 'payments' | 'optional' | 'infra'; note: string }> = [
    // 대시보드/서비스 자체를 게이트 — 없으면 전 운영자 영향.
    { key: 'JWT_SECRET', group: 'blocking', note: '모든 대시보드 로그인(어드민/셀러/제조사/판매사/에이전시). 없으면 로그인 500.' },
    { key: 'FRONTEND_URL', group: 'blocking', note: 'OAuth 콜백/리다이렉트 베이스 URL.' },
    // 보안 — fail-open(동작하나 약화).
    { key: 'RATE_LIMIT_KV', group: 'security', note: '로그인/결제 brute-force 방어. 없으면 fail-open(무제한 시도).' },
    { key: 'TURNSTILE_SECRET', group: 'security', note: '봇 차단(CAPTCHA). 없으면 fail-open.' },
    { key: 'DATA_ENCRYPTION_KEY', group: 'security', note: '카카오/외부 토큰 at-rest 암호화. 없으면 평문 저장 위험.' },
    { key: 'INTERNAL_API_TOKEN', group: 'security', note: '내부 전용 엔드포인트(cron/정산) 보호.' },
    // 성능 — degraded.
    { key: 'SESSION_KV', group: 'perf', note: '세션/카운트 캐시. 없으면 동작하나 D1 부하.' },
    { key: 'CACHE_KV', group: 'perf', note: '전역 public API 캐시. 없으면 edge 캐시만(region cold 시 D1 hit).' },
    // 🆕 2026-07-01 (Cloudflare 전수조사): 인프라 바인딩 — R2 버킷/Durable Objects/분석 KV.
    //   wrangler.toml 에 주석 처리돼 Dashboard 수동 바인딩에 의존 → 리포지토리로 검증 불가하던 것을 가시화.
    { key: 'MEDIA_BUCKET', group: 'infra', note: '이미지 업로드 R2 버킷. 없으면 업로드 503(dataURI 폴백 없음).' },
    { key: 'BACKUP_BUCKET', group: 'infra', note: '주간 D1 백업 R2 버킷. 없으면 자동 백업 미동작(재해복구 0).' },
    { key: 'ANALYTICS_KV', group: 'infra', note: '분석(웹바이탈/퍼널) 전용 KV. 없으면 분석 write skip(무해, SESSION_KV 잠식 안 함).' },
    { key: 'PUBLIC_R2_URL', group: 'infra', note: 'R2 커스텀 도메인(media.ur-team.com). 없으면 /api/media 워커 서빙(요청당 워커 과금).' },
    { key: 'LIVE_STREAM', group: 'infra', note: '라이브 채팅 Durable Object 바인딩.' },
    { key: 'RATE_LIMITER', group: 'infra', note: '글로벌 rate-limit Durable Object 바인딩(미바인딩 시 in-memory 폴백).' },
    // 소비자 결제 — 도매몰 무관.
    { key: 'TOSS_SECRET_KEY', group: 'payments', note: '소비자 결제 승인/취소.' },
    { key: 'TOSS_CLIENT_KEY', group: 'payments', note: '소비자 결제 위젯.' },
    { key: 'TOSS_WEBHOOK_SECRET', group: 'payments', note: '결제 webhook 시그니처 검증.' },
    // 선택 기능 — fail-soft.
    { key: 'KAKAO_REST_API_KEY', group: 'optional', note: '소비자 카카오 로그인(대시보드 무관).' },
    { key: 'ALIGO_API_KEY', group: 'optional', note: '알림톡 발송.' },
    { key: 'NAVER_SEARCH_CLIENT_ID', group: 'optional', note: '제조사 시중최저가 대조.' },
    { key: 'UCANSIGN_API_KEY', group: 'optional', note: '전자계약 자동발송.' },
    { key: 'ANTHROPIC_API_KEY', group: 'optional', note: '유어애즈 AI마케터/리뷰생성.' },
    { key: 'SENTRY_DSN', group: 'optional', note: '에러 모니터링.' },
  ]

  const results = SPEC.map((s) => ({ key: s.key, group: s.group, present: has(s.key), note: s.note }))

  // DB 연결성 (binding 존재 ≠ 연결 — 실제 쿼리).
  let dbOk = false
  try { await c.env.DB.prepare('SELECT 1').first(); dbOk = true } catch { dbOk = false }

  const blockingMissing = results.filter((r) => r.group === 'blocking' && !r.present).map((r) => r.key)
  const securityMissing = results.filter((r) => r.group === 'security' && !r.present).map((r) => r.key)
  const infraMissing = results.filter((r) => r.group === 'infra' && !r.present).map((r) => r.key)
  const ready = dbOk && blockingMissing.length === 0

  const groups: Record<string, Array<{ key: string; present: boolean; note: string }>> = {}
  for (const r of results) (groups[r.group] ??= []).push({ key: r.key, present: r.present, note: r.note })

  return c.json({
    ready,                        // true = 다른 운영자/브라우저에서 대시보드 로그인·기본동작 정상
    db_ok: dbOk,
    summary: {
      blocking_missing: blockingMissing,   // 비어야 함 — 있으면 로그인 자체가 깨짐
      security_missing: securityMissing,   // 비어야 안전 — 있으면 fail-open(동작은 함)
      infra_missing: infraMissing,         // Cloudflare 인프라 바인딩(R2/DO/분석KV) — 있으면 백업/업로드/비용 영향
    },
    groups,
    environment: c.env.ENVIRONMENT ?? 'unknown',
    region: c.env.REGION ?? 'unknown',
    timestamp: new Date().toISOString(),
  }, 200) // 항상 200 (인포 용도 — ready 불리언이 상태 신호. /migrations 와 동일).
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
