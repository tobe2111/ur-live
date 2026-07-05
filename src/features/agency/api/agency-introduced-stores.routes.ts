/**
 * 🛡️ 2026-05-20: 에이전시 — 내가 입점시킨 가게 (Phase 2).
 *
 * Routes:
 *   GET /api/agency/introduced-stores            — 입점 가게 리스트 + 누적 commission
 *   GET /api/agency/introduced-stores/commissions — commission ledger (전체)
 *   GET /api/agency/introduced-stores/summary    — 대시보드 요약 (이번달/누적)
 *   GET /api/agency/intro-code                   — 내 추천 코드 (없으면 자동 생성)
 *
 * 사용자 모델: 에이전시 = 가게 영업. 입점 가게의 모든 이용권 매출에 영구 2% commission.
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAgency, type AgencyVars } from '@/lib/agency-shared'
import { intParam } from '@/shared/pagination'
import { COMMISSION_DEFAULTS } from '@/shared/constants/policy'

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
app.use('*', requireAgency)

interface IntroducedStoreRow {
  id: number
  business_name: string | null
  name: string | null
  status: string | null
  introduced_at: string | null
  created_at: string
  total_orders: number
  total_sales: number
  active_group_buys: number
  total_commission: number
  pending_commission: number
  // 🗓️ 2026-07-05 (운영 감사 Q6): 커미션 기간 기산일 = 가게 첫 결제(signup_bonus 생성) 시각.
  term_started_at: string | null
}

// ─── GET /introduced-stores ─────────────────────────────────────────────
app.get('/introduced-stores', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const stores = await c.env.DB.prepare(
    `SELECT s.id, s.business_name, s.name, s.status, s.introduced_at, s.created_at,
            COALESCE((SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE','SHIPPING','COMPLETED')), 0) as total_orders,
            COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE','SHIPPING','COMPLETED')), 0) as total_sales,
            COALESCE((SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND p.group_buy_status = 'active' AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')), 0) as active_group_buys,
            COALESCE((SELECT SUM(commission_amount) FROM agency_store_intro_commissions WHERE store_seller_id = s.id AND agency_id = ?), 0) as total_commission,
            COALESCE((SELECT SUM(commission_amount) FROM agency_store_intro_commissions WHERE store_seller_id = s.id AND agency_id = ? AND status = 'pending'), 0) as pending_commission,
            (SELECT MIN(created_at) FROM agency_store_intro_commissions WHERE store_seller_id = s.id AND agency_id = ? AND type = 'signup_bonus') as term_started_at
       FROM sellers s
      WHERE s.introduced_by_agency_id = ?
      ORDER BY s.introduced_at DESC, s.created_at DESC
      LIMIT 200`
  ).bind(agencyId, agencyId, agencyId, agencyId).all<IntroducedStoreRow>().catch(() => ({ results: [] as IntroducedStoreRow[] }))

  return c.json({ success: true, data: stores.results || [] })
})

// ─── GET /introduced-stores/commissions ─────────────────────────────────
app.get('/introduced-stores/commissions', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const limit = Math.min(Math.max(intParam(c.req.query('limit'), 50), 1), 200)

  const rows = await c.env.DB.prepare(
    `SELECT c.id, c.store_seller_id, c.order_id, c.type, c.order_amount,
            c.commission_amount, c.status, c.note, c.created_at, c.available_at, c.paid_at,
            s.business_name as store_name
       FROM agency_store_intro_commissions c
       LEFT JOIN sellers s ON s.id = c.store_seller_id
      WHERE c.agency_id = ?
      ORDER BY c.created_at DESC
      LIMIT ?`
  ).bind(agencyId, limit).all().catch(() => ({ results: [] as Record<string, unknown>[] }))

  return c.json({ success: true, data: rows.results || [] })
})

// ─── GET /introduced-stores/summary ─────────────────────────────────────
app.get('/introduced-stores/summary', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)

  // 이번달 시작 (UTC).
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  // 💰 2026-07-05 (운영 감사 Q7 — 'available' 죽은 수치 수리): 커미션 행은 pending→paid 직행이라
  //   status='available' 은 실제로 만들어지지 않음 → 에이전시 "출금 가능" 이 항상 ₩0 이던 버그.
  //   지급센터(admin-payout-center)와 **동일 규칙**(생성 +7일 = 성숙)으로 파생 계산:
  //   available = 성숙 pending(+레거시 available 행), pending = 7일 미경과분만. 상태 전이 추가 없음.
  const summary = await c.env.DB.prepare(
    `SELECT
        (SELECT COUNT(*) FROM sellers WHERE introduced_by_agency_id = ?) as total_stores,
        (SELECT COUNT(*) FROM sellers WHERE introduced_by_agency_id = ? AND status = 'active') as active_stores,
        (SELECT COUNT(*) FROM sellers s2 WHERE s2.introduced_by_agency_id = ? AND s2.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM products p WHERE p.seller_id = s2.id AND p.group_buy_status = 'active'
             AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher'))
        ) as inactive_stores,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM agency_store_intro_commissions WHERE agency_id = ?) as total_commission,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM agency_store_intro_commissions WHERE agency_id = ? AND created_at >= ?) as month_commission,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM agency_store_intro_commissions WHERE agency_id = ? AND COALESCE(status,'pending') = 'pending' AND datetime(created_at) > datetime('now','-7 days')) as pending_commission,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM agency_store_intro_commissions WHERE agency_id = ? AND (status = 'available' OR (COALESCE(status,'pending') = 'pending' AND datetime(created_at) <= datetime('now','-7 days')))) as available_commission,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM agency_store_intro_commissions WHERE agency_id = ? AND status = 'paid') as paid_commission`
  ).bind(agencyId, agencyId, agencyId, agencyId, agencyId, monthStart, agencyId, agencyId, agencyId)
    .first<{
      total_stores: number; active_stores: number; inactive_stores: number;
      total_commission: number; month_commission: number;
      pending_commission: number; available_commission: number; paid_commission: number;
    }>().catch(() => null)

  return c.json({ success: true, data: summary || {
    total_stores: 0, active_stores: 0, inactive_stores: 0,
    total_commission: 0, month_commission: 0,
    pending_commission: 0, available_commission: 0, paid_commission: 0,
  } })
})

// ─── GET /intro-code ────────────────────────────────────────────────────
// 에이전시 본인의 추천 코드 조회 + 없으면 자동 생성 (AG-XXXXXXXX 형식).
app.get('/intro-code', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)

  // 🗓️ 2026-07-05 (운영 감사 Q6): commission_term_months 동반 조회 — 컬럼 미존재 환경 폴백(현행 쿼리).
  type IntroCodeRow = { intro_code: string | null; store_intro_commission_pct: number | null; commission_term_months?: number | null }
  let row = await c.env.DB.prepare(
    `SELECT intro_code, store_intro_commission_pct, commission_term_months FROM agencies WHERE id = ?`
  ).bind(agencyId).first<IntroCodeRow>().catch(() => null)
  if (!row) {
    row = await c.env.DB.prepare(
      `SELECT intro_code, store_intro_commission_pct FROM agencies WHERE id = ?`
    ).bind(agencyId).first<IntroCodeRow>().catch(() => null)
  }

  if (!row?.intro_code) {
    // 자동 생성 — 충돌 시 재시도 3번.
    for (let i = 0; i < 3; i++) {
      const rand = crypto.getRandomValues(new Uint8Array(4))
      const code = `AG-${Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 8)}`
      try {
        await c.env.DB.prepare(`UPDATE agencies SET intro_code = ? WHERE id = ? AND (intro_code IS NULL OR intro_code = '')`)
          .bind(code, agencyId).run()
        row = await c.env.DB.prepare(`SELECT intro_code, store_intro_commission_pct FROM agencies WHERE id = ?`)
          .bind(agencyId).first<{ intro_code: string | null; store_intro_commission_pct: number | null }>()
        if (row?.intro_code) break
      } catch { /* unique conflict — 재시도 */ }
    }
  }

  return c.json({
    success: true,
    data: {
      intro_code: row?.intro_code || null,
      // 💰 2026-07-05: 하드코딩 2.0 → SSOT 상수(기본 1%) — 적립 헬퍼(getAgencyRate)와 동일 폴백.
      commission_pct: row?.store_intro_commission_pct ?? COMMISSION_DEFAULTS.AGENCY_STORE_INTRO_PCT,
      // 0 = 무제한(미설정). 잔여기간 계산은 매장별 term_started_at(첫 결제)과 조합 — UI 담당.
      term_months: Number(row?.commission_term_months) > 0 ? Number(row?.commission_term_months) : 0,
      share_url: row?.intro_code
        ? `https://live.ur-team.com/seller/register/supplier?agency=${row.intro_code}`
        : null,
    },
  })
})

export { app as agencyIntroducedStoresRoutes }
