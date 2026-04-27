/**
 * Agency Incentive Rules Routes (Agency P0 #5)
 *
 * 에이전시 = 본인 규칙 CRUD + 본인 셀러 payouts 조회
 * 어드민 = 모든 payouts 강제 트리거 + 지급 처리
 *
 * 마운트: /api/agency/incentives
 * 마이그레이션: 0210_agency_incentive_engine.sql
 *
 * Endpoints:
 *   GET    /rules                  — 본인 에이전시 규칙 목록
 *   POST   /rules                  — 규칙 생성
 *   PATCH  /rules/:id              — 규칙 수정
 *   DELETE /rules/:id              — 규칙 비활성화 (소프트)
 *   GET    /payouts?month=YYYY-MM  — 본인 에이전시 payouts (월별)
 *   GET    /preview?month=YYYY-MM  — dry-run 계산 (실제 INSERT 안 함)
 *
 * 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #5)
 */

import { Hono, type Next } from 'hono'
import { verify } from 'hono/jwt'
import { parseSessionCookie } from '@/worker/utils/session'
import type { Env } from '@/worker/types/env'

type AgencyCtx = {
  Bindings: Env
  Variables: { agency: { id: number; email?: string } }
}

const app = new Hono<AgencyCtx>()

// ── auth ────────────────────────────────────────────────
function getBearerToken(h?: string | null): string | null {
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch {
    return null
  }
}

const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '')
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' }
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

app.use('*', requireAgency)

const VALID_METRICS = ['sales', 'rating', 'streams', 'orders', 'viewers'] as const
type Metric = typeof VALID_METRICS[number]

interface RuleRow {
  id: number
  agency_id: number
  name: string
  metric: Metric
  threshold: number
  bonus_rate: number
  is_active: number
  priority: number
}

// ── GET /rules ────────────────────────────────────────
app.get('/rules', async (c) => {
  const agencyId = c.get('agency').id
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM agency_incentive_rules WHERE agency_id = ? ORDER BY priority DESC, id ASC'
    ).bind(agencyId).all<RuleRow>()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: false, error: 'agency_incentive_rules 미존재 — migration 0210 필요', data: [] })
  }
})

// ── POST /rules ───────────────────────────────────────
app.post('/rules', async (c) => {
  const agencyId = c.get('agency').id
  const body = await c.req.json<{
    name: string; metric: Metric; threshold: number; bonus_rate: number;
    is_active?: boolean; priority?: number;
  }>().catch(() => null)

  if (!body || !body.name) return c.json({ success: false, error: 'name 필수' }, 400)
  if (!VALID_METRICS.includes(body.metric)) {
    return c.json({ success: false, error: `metric 은 ${VALID_METRICS.join('/')} 중 하나` }, 400)
  }
  if (!Number.isFinite(body.threshold) || body.threshold < 0) {
    return c.json({ success: false, error: 'threshold 는 0 이상 숫자' }, 400)
  }
  if (!Number.isFinite(body.bonus_rate) || body.bonus_rate < 0 || body.bonus_rate > 100) {
    return c.json({ success: false, error: 'bonus_rate 는 0~100' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO agency_incentive_rules (agency_id, name, metric, threshold, bonus_rate, is_active, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    agencyId, body.name.slice(0, 100), body.metric,
    body.threshold, body.bonus_rate,
    body.is_active === false ? 0 : 1,
    body.priority ?? 0,
  ).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── PATCH /rules/:id ──────────────────────────────────
app.patch('/rules/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const body = await c.req.json<Partial<RuleRow & { is_active: boolean }>>().catch(() => ({}))
  const sets: string[] = []
  const binds: unknown[] = []

  if (body.name !== undefined) { sets.push('name = ?'); binds.push(String(body.name).slice(0, 100)) }
  if (body.metric !== undefined) {
    if (!VALID_METRICS.includes(body.metric as Metric)) return c.json({ success: false, error: 'invalid metric' }, 400)
    sets.push('metric = ?'); binds.push(body.metric)
  }
  if (body.threshold !== undefined) {
    if (!Number.isFinite(body.threshold) || body.threshold < 0) return c.json({ success: false, error: 'threshold 오류' }, 400)
    sets.push('threshold = ?'); binds.push(body.threshold)
  }
  if (body.bonus_rate !== undefined) {
    if (!Number.isFinite(body.bonus_rate) || body.bonus_rate < 0 || body.bonus_rate > 100) {
      return c.json({ success: false, error: 'bonus_rate 오류' }, 400)
    }
    sets.push('bonus_rate = ?'); binds.push(body.bonus_rate)
  }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); binds.push(body.is_active ? 1 : 0) }
  if (body.priority !== undefined) { sets.push('priority = ?'); binds.push(body.priority) }

  if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
  sets.push("updated_at = datetime('now')")
  binds.push(id, agencyId)

  const r = await c.env.DB.prepare(
    `UPDATE agency_incentive_rules SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`
  ).bind(...binds).run()
  if ((r.meta.changes ?? 0) === 0) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true })
})

// ── DELETE /rules/:id (soft — is_active=0) ─────────────
app.delete('/rules/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)
  await c.env.DB.prepare(
    "UPDATE agency_incentive_rules SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND agency_id = ?"
  ).bind(id, agencyId).run()
  return c.json({ success: true })
})

// ── GET /payouts?month=YYYY-MM ────────────────────────
app.get('/payouts', async (c) => {
  const agencyId = c.get('agency').id
  const month = c.req.query('month') // YYYY-MM
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'month 형식: YYYY-MM' }, 400)
  }

  let where = 'agency_id = ?'
  const binds: unknown[] = [agencyId]
  if (month) { where += ' AND month = ?'; binds.push(month) }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT p.*, s.name AS seller_name, s.email AS seller_email,
        r.name AS rule_name, r.metric AS rule_metric, r.bonus_rate AS rule_bonus_rate
      FROM agency_incentive_payouts p
      LEFT JOIN sellers s ON s.id = p.seller_id
      LEFT JOIN agency_incentive_rules r ON r.id = p.rule_id
      WHERE ${where}
      ORDER BY p.month DESC, p.total DESC
    `).bind(...binds).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: false, error: 'agency_incentive_payouts 미존재', data: [] })
  }
})

// ── GET /preview?month=YYYY-MM (dry-run) ──────────────
app.get('/preview', async (c) => {
  const agencyId = c.get('agency').id
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ success: false, error: 'month 형식: YYYY-MM' }, 400)

  try {
    const result = await calculatePayouts(c.env.DB, agencyId, month, /* dry */ true)
    return c.json({ success: true, data: result })
  } catch (e) {
    if (import.meta.env.DEV) console.error('[incentive:preview]', e)
    return c.json({ success: false, error: '계산 실패' }, 500)
  }
})

export const agencyIncentivesRoutes = app

// ============================================================
// 인센티브 계산 코어 (cron 과 preview 가 공유)
// ============================================================

interface SellerStats {
  seller_id: number
  sales: number      // 매출 (원)
  orders: number     // 주문 수
  rating: number     // 평균 별점 (없으면 0)
  streams: number    // 라이브 횟수
  viewers: number    // 누적 시청자
}

interface PayoutResult {
  agency_id: number
  month: string
  evaluated: number
  total_base: number
  total_bonus: number
  payouts: Array<{
    seller_id: number
    seller_name?: string
    metric_value: number
    matched_rule_id?: number
    matched_rule_name?: string
    base_commission: number
    bonus_commission: number
    total: number
  }>
}

/**
 * 특정 에이전시 / 월의 인센티브 계산. dry=true 면 INSERT 생략 (preview 용).
 */
export async function calculatePayouts(
  DB: D1Database,
  agencyId: number,
  month: string,
  dry: boolean,
): Promise<PayoutResult> {
  // YYYY-MM → 시작/끝 일자
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const endDate = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}-01`

  // 1) 활성 규칙 (priority DESC) + 에이전시 commission_rate
  const [rulesRes, agencyRow] = await Promise.all([
    DB.prepare(
      `SELECT * FROM agency_incentive_rules WHERE agency_id = ? AND is_active = 1 ORDER BY priority DESC, threshold DESC`
    ).bind(agencyId).all<RuleRow>(),
    DB.prepare('SELECT commission_rate FROM agencies WHERE id = ?').bind(agencyId).first<{ commission_rate: number }>(),
  ])
  const rules = rulesRes.results || []
  const baseRate = agencyRow?.commission_rate ?? 2.0

  // 2) 셀러별 KPI 집계 (해당 월)
  const { results: sellerStats } = await DB.prepare(`
    SELECT
      ag.seller_id,
      COALESCE(SUM(o.total_amount), 0) AS sales,
      COUNT(o.id) AS orders,
      COALESCE(AVG(s.avg_rating), 0) AS rating,
      (SELECT COUNT(*) FROM live_streams ls WHERE ls.seller_id = ag.seller_id AND ls.created_at >= ? AND ls.created_at < ?) AS streams,
      (SELECT COALESCE(SUM(ls.peak_viewers), 0) FROM live_streams ls WHERE ls.seller_id = ag.seller_id AND ls.created_at >= ? AND ls.created_at < ?) AS viewers
    FROM agency_sellers ag
    LEFT JOIN orders o ON o.seller_id = ag.seller_id
      AND o.status IN ('PAID','DONE')
      AND o.created_at >= ? AND o.created_at < ?
    LEFT JOIN sellers s ON s.id = ag.seller_id
    WHERE ag.agency_id = ?
    GROUP BY ag.seller_id
  `).bind(
    startDate, endDate,    // streams
    startDate, endDate,    // viewers
    startDate, endDate,    // orders
    agencyId,
  ).all<SellerStats>()

  const result: PayoutResult = {
    agency_id: agencyId,
    month,
    evaluated: 0,
    total_base: 0,
    total_bonus: 0,
    payouts: [],
  }

  for (const stats of (sellerStats || [])) {
    result.evaluated++

    // 매칭되는 규칙 찾기 (priority DESC 순 — 첫 매치가 최고 보너스)
    let matchedRule: RuleRow | undefined
    let metricValue = 0
    for (const rule of rules) {
      const v = (stats[rule.metric] as number) ?? 0
      if (v >= rule.threshold) {
        matchedRule = rule
        metricValue = v
        break
      }
    }
    // 매치 안 된 경우에도 base commission 은 지급
    if (!matchedRule && rules.length > 0) {
      // 가장 첫 metric 값을 snapshot 으로 저장
      metricValue = (stats[rules[0].metric] as number) ?? 0
    }

    const baseCommission = Math.round(stats.sales * baseRate / 100)
    const bonusCommission = matchedRule
      ? Math.round(stats.sales * matchedRule.bonus_rate / 100)
      : 0
    const total = baseCommission + bonusCommission

    if (total === 0 && !matchedRule) continue // 매출 0 + 매치 없음 → skip

    result.total_base += baseCommission
    result.total_bonus += bonusCommission
    result.payouts.push({
      seller_id: stats.seller_id,
      metric_value: metricValue,
      matched_rule_id: matchedRule?.id,
      matched_rule_name: matchedRule?.name,
      base_commission: baseCommission,
      bonus_commission: bonusCommission,
      total,
    })

    if (!dry) {
      // INSERT OR REPLACE on UNIQUE (agency_id, seller_id, month)
      await DB.prepare(`
        INSERT INTO agency_incentive_payouts
          (agency_id, seller_id, month, rule_id, metric_value, base_commission, bonus_commission, total, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'calculated')
        ON CONFLICT (agency_id, seller_id, month)
          DO UPDATE SET
            rule_id = excluded.rule_id,
            metric_value = excluded.metric_value,
            base_commission = excluded.base_commission,
            bonus_commission = excluded.bonus_commission,
            total = excluded.total,
            status = CASE WHEN agency_incentive_payouts.status = 'paid' THEN 'paid' ELSE 'calculated' END
      `).bind(
        agencyId, stats.seller_id, month,
        matchedRule?.id ?? null, metricValue,
        baseCommission, bonusCommission, total,
      ).run()
    }
  }

  return result
}

// ============================================================
// 🛡️ W2: 순수 함수 — 단위 테스트 가능
// ============================================================

/**
 * 셀러 stats + 규칙 목록으로 매칭되는 규칙 찾기.
 * priority DESC 순 (calculatePayouts 가 정렬 후 호출 가정).
 * 첫 번째 충족하는 규칙 반환 (max-bonus 패턴).
 */
export function matchIncentiveRule(
  stats: SellerStats,
  rules: Array<{ metric: keyof SellerStats; threshold: number; bonus_rate: number; id: number; name: string }>
): { matched: typeof rules[0] | null; metricValue: number } {
  for (const rule of rules) {
    const v = (stats[rule.metric] as number) ?? 0
    if (v >= rule.threshold) {
      return { matched: rule, metricValue: v }
    }
  }
  // 매치 없음 — 첫 규칙 의 metric 값을 snapshot 으로 (있다면)
  const fallbackValue = rules.length > 0 ? ((stats[rules[0].metric] as number) ?? 0) : 0
  return { matched: null, metricValue: fallbackValue }
}

/**
 * commission 계산: base + bonus.
 */
export function computeCommission(args: {
  sales: number
  baseRate: number          // % (예: 2.0)
  bonusRate?: number        // % (예: 0.5)
}): { base: number; bonus: number; total: number } {
  const base = Math.round(args.sales * args.baseRate / 100)
  const bonus = args.bonusRate ? Math.round(args.sales * args.bonusRate / 100) : 0
  return { base, bonus, total: base + bonus }
}

/**
 * 모든 에이전시 대상 인센티브 계산 (cron 매월 1일 사용)
 */
export async function calculateAllAgencyIncentives(DB: D1Database, month: string): Promise<{
  agencies_processed: number; total_payouts: number; total_amount: number;
}> {
  let agencies_processed = 0
  let total_payouts = 0
  let total_amount = 0

  try {
    const { results: agencies } = await DB.prepare(
      "SELECT id FROM agencies WHERE status IN ('active','approved')"
    ).all<{ id: number }>()

    for (const a of (agencies || [])) {
      try {
        const r = await calculatePayouts(DB, a.id, month, false)
        agencies_processed++
        total_payouts += r.payouts.length
        total_amount += r.total_base + r.total_bonus
      } catch (e) {
        console.error(`[cron:incentives] agency=${a.id} failed:`, e)
      }
    }
  } catch (e) {
    console.error('[cron:incentives] bootstrap failed (migration 0210 not applied?):', e)
  }

  return { agencies_processed, total_payouts, total_amount }
}
