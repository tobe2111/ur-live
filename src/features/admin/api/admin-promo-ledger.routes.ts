/**
 * 🧾 어드민 — promo/커미션 재원 원장 감사 콕핏 (read-only)
 *
 * 🔒 불변식 #44 (docs/AUDIT_INVARIANTS.md · CLAUDE.md ⭐ 커미션 재원 확정 원칙 2026-07-08):
 *   "원장 platform:revenue = 5% 전액, 성장 커미션 debit 0 — 유어딜 5% 는 어떤 커미션에도 안 쓴다."
 *   이 라우트는 그 **검증 표면** — 8월 promo flip(재원 owner 전환) *전에* 만들어 staging flip 검증이
 *   이 콕핏으로 Σ적립·원장 대칭을 눈으로 확인할 수 있게 한다. 돈 이동 0 · 정산 로직 무변경.
 *
 * 마운트: /api/admin/promo-ledger
 *   GET /summary?month=YYYY-MM — 스위치 상태 + 월 집계 + 불변식 #44 패널 데이터
 *   GET /orders?month=&page=   — order_fee_breakdown(그림자) 주문별 감사 테이블
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdminRole } from '../../../worker/middleware/auth'
import { intParam } from '../../../shared/pagination'
import type { Env } from '../../../worker/types/env'

export const adminPromoLedgerRoutes = new Hono<{ Bindings: Env }>()

/** YYYY-MM 검증 — 불일치 시 현재 월(UTC) 폴백 */
function resolveMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 7)
}

// ─── GET /summary — 스위치 + 월 집계 + 불변식 #44 패널 ─────────────────────
adminPromoLedgerRoutes.get('/summary', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  try {
    const month = resolveMonth(c.req.query('month'))

    // ① 재원/게이트 스위치 (platform_settings — 어드민 조정 대상 값)
    const settingRows = await DB.prepare(
      `SELECT key, value FROM platform_settings
        WHERE key IN ('promo_funding_source', 'commission_budget_enabled', 'pg_reserve_pct', 'seller_promo_field_enabled')`
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
    const settings: Record<string, string> = {}
    for (const r of settingRows.results || []) settings[r.key] = r.value
    const switches = {
      promo_funding_source: settings.promo_funding_source || 'platform',
      commission_budget_enabled: settings.commission_budget_enabled || 'false',
      pg_reserve_pct: settings.pg_reserve_pct ?? null,
      seller_promo_field_enabled: settings.seller_promo_field_enabled || 'false',
    }

    // ② 월 주문 집계 — status 값은 admin-tax.routes.ts 월간과 동일(DONE/PAID/DELIVERED)
    const orders = await DB.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amount
         FROM orders
        WHERE status IN ('DONE', 'PAID', 'DELIVERED')
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ cnt: number; amount: number }>().catch(() => null)

    // ③ 월 affiliate promo(소개비) 합 — 라이브 적립 경로 유효분(holding/granted)
    const promo = await DB.prepare(
      `SELECT COALESCE(SUM(commission), 0) AS total, COUNT(*) AS cnt
         FROM affiliate_earnings
        WHERE COALESCE(status, '') IN ('holding', 'granted')
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ total: number; cnt: number }>().catch(() => null)

    // ④ 그림자(order_fee_breakdown) 월 집계 — fee-resolver 기록 전용(실정산 아님)
    const shadow = await DB.prepare(
      `SELECT COUNT(*) AS cnt,
              COALESCE(SUM(platform), 0) AS platform_sum,
              COALESCE(SUM(promo), 0) AS promo_sum,
              COALESCE(SUM(agency), 0) AS agency_sum,
              COALESCE(SUM(owner_net), 0) AS owner_net_sum
         FROM order_fee_breakdown
        WHERE strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{
      cnt: number; platform_sum: number; promo_sum: number; agency_sum: number; owner_net_sum: number
    }>().catch(() => null)

    // ⑤ 불변식 #44 패널 — platform:revenue 원장 대칭.
    //   기대: credit = 5% 수수료 전액(+ owner-promo 회수 promo_fee credit),
    //         debit  = 정산/환불 역전 계열만. "위반" = 성장 커미션(agency/influencer/referral/passthrough 등
    //   commission-ish event_type)이 platform:revenue 를 debit 하는 것 — flip 후엔 0 이어야 함.
    //   (현행 모델(flip 전)은 agency_commission 등이 플랫폼 부담이라 suspect 에 잡히는 게 정상 — flip 검증용 지표.)
    const revCredit = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
         FROM ledger_entries
        WHERE credit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ total: number; cnt: number }>().catch(() => null)
    const revDebit = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
         FROM ledger_entries
        WHERE debit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ total: number; cnt: number }>().catch(() => null)

    // 성장 커미션 의심 debit — event_type 이 커미션 계열(환불 역전 promo_fee_reversal 은 대칭 정상이라 제외)
    const suspects = await DB.prepare(
      `SELECT id, event_type, amount, reference_id, created_at
         FROM ledger_entries
        WHERE debit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?
          AND event_type != 'promo_fee_reversal'
          AND (event_type LIKE '%commission%' OR event_type LIKE '%intro%'
               OR event_type LIKE '%referral%' OR event_type LIKE '%passthrough%'
               OR event_type LIKE '%affiliate%')
        ORDER BY created_at DESC
        LIMIT 20`
    ).bind(month).all<{
      id: number; event_type: string; amount: number; reference_id: string | null; created_at: string
    }>().catch(() => ({ results: [] as never[] }))
    const suspectCount = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM ledger_entries
        WHERE debit_account = 'platform:revenue'
          AND strftime('%Y-%m', created_at) = ?
          AND event_type != 'promo_fee_reversal'
          AND (event_type LIKE '%commission%' OR event_type LIKE '%intro%'
               OR event_type LIKE '%referral%' OR event_type LIKE '%passthrough%'
               OR event_type LIKE '%affiliate%')`
    ).bind(month).first<{ cnt: number }>().catch(() => null)

    // ⑥ 🎬 WP-A 비정산 마킹 — 0원 체험권 발급(매장 자기부담 제공). payment_method='experience'
    //   0원 order 는 정산/커미션/원장(amount>0 게이트)을 구조적으로 우회 → 여기 '비정산'으로만 가시화.
    //   sum_amount 는 항상 0 이어야 함(0 아니면 발급 경로 회귀 — 감사 신호).
    const experience = await DB.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS sum_amount
         FROM orders
        WHERE payment_method = 'experience'
          AND strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ cnt: number; sum_amount: number }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        month,
        switches,
        orders: { count: Number(orders?.cnt) || 0, amount: Number(orders?.amount) || 0 },
        affiliate_promo: { sum: Number(promo?.total) || 0, count: Number(promo?.cnt) || 0 },
        experience_noncash: {
          count: Number(experience?.cnt) || 0,
          sum_amount: Number(experience?.sum_amount) || 0,
          note: '비정산 (매장 자기부담 0원 체험권) — 정산·커미션·유어딜 5% 무관. sum_amount 는 0 이어야 정상.',
        },
        fee_breakdown: {
          count: Number(shadow?.cnt) || 0,
          platform_sum: Number(shadow?.platform_sum) || 0,
          promo_sum: Number(shadow?.promo_sum) || 0,
          agency_sum: Number(shadow?.agency_sum) || 0,
          owner_net_sum: Number(shadow?.owner_net_sum) || 0,
        },
        invariant_44: {
          platform_revenue_credit_sum: Number(revCredit?.total) || 0,
          platform_revenue_credit_count: Number(revCredit?.cnt) || 0,
          platform_revenue_debit_sum: Number(revDebit?.total) || 0,
          platform_revenue_debit_count: Number(revDebit?.cnt) || 0,
          suspect_commission_debit_count: Number(suspectCount?.cnt) || 0,
          suspect_commission_debits: suspects.results || [],
          note: 'flip 후 목표: suspect_commission_debit_count = 0 (성장 커미션은 매장 promo 재원 — 유어딜 5% 불변)',
        },
      },
    })
  } catch (err) {
    return safeError(c, err, 'promo 원장 요약 조회 중 오류가 발생했습니다', '[admin-promo-ledger]')
  }
})

// ─── GET /orders — 그림자 주문별 감사 테이블 (read-only) ─────────────────────
adminPromoLedgerRoutes.get('/orders', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  try {
    const month = resolveMonth(c.req.query('month'))
    const page = Math.max(1, intParam(c.req.query('page'), 1))
    const limit = 50
    const offset = (page - 1) * limit

    const rows = await DB.prepare(
      `SELECT ofb.order_id, o.order_number, o.seller_id, o.status,
              ofb.amount, ofb.ownership, ofb.platform, ofb.agency,
              ofb.platform_net, ofb.promo, ofb.supply, ofb.owner_net, ofb.created_at
         FROM order_fee_breakdown ofb
         JOIN orders o ON o.id = ofb.order_id
        WHERE strftime('%Y-%m', ofb.created_at) = ?
        ORDER BY ofb.created_at DESC
        LIMIT ? OFFSET ?`
    ).bind(month, limit, offset).all<Record<string, unknown>>()
      .catch(() => ({ results: [] as Record<string, unknown>[] }))

    const total = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM order_fee_breakdown WHERE strftime('%Y-%m', created_at) = ?`
    ).bind(month).first<{ cnt: number }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        month,
        page,
        limit,
        total: Number(total?.cnt) || 0,
        rows: rows.results || [],
      },
    })
  } catch (err) {
    return safeError(c, err, 'promo 원장 주문 목록 조회 중 오류가 발생했습니다', '[admin-promo-ledger]')
  }
})

// ─── GET /order/:orderNumber — 주문 1건 판정 패널 (S1 점등 절차용, read-only) ──
/**
 * 🔍 **주문 하나를 두고 "예산 아비터를 켜도 되는가"를 판정한다.**
 *
 * 왜 필요한가: S1(`commission_budget_enabled`)의 통과 기준은 *"Σ적립 ≤ 주문당 예산"* 인데,
 * 그걸 확인하려면 원장·적립 테이블 대여섯 개를 손으로 조회해 더해야 했다.
 * **손으로 더해야 하는 검증은 아무도 안 한다** — 그래서 이 게이트가 2026-07-04 부터 미검증으로 남았다.
 * 여기서 한 화면에 답이 나오면 대표가 실결제 1건으로 판정할 수 있다.
 *
 * 돈 이동 0 · 정산 로직 무접촉 — 조회만 한다.
 */
adminPromoLedgerRoutes.get('/order/:orderNumber', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  try {
    const orderNumber = String(c.req.param('orderNumber') || '').trim()
    if (!orderNumber || orderNumber.length > 64) {
      return c.json({ success: false, error: '주문번호가 올바르지 않습니다' }, 400)
    }

    const orders = await DB.prepare(
      `SELECT id, order_number, seller_id, status, total_amount, COALESCE(deal_used, 0) AS deal_used, created_at
         FROM orders WHERE order_number = ?`
    ).bind(orderNumber).all<{
      id: number; order_number: string; seller_id: number | null; status: string
      total_amount: number; deal_used: number; created_at: string
    }>().catch(() => ({ results: [] as never[] }))
    const orderRows = orders.results || []
    if (orderRows.length === 0) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    }
    const orderIds = orderRows.map((o) => Number(o.id))
    const idPlaceholders = orderIds.map(() => '?').join(', ')
    const amountKrw = orderRows.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)

    // ① 예산 = max(0, 플랫폼 수수료 − PG 준비금). 수수료는 이 주문의 원장 fee 를 진실로 삼는다
    //    (요율 계산을 여기서 다시 하면 실제와 갈릴 수 있다 — 갈리는 것이 바로 이 레포의 단골 사고다).
    const feeRow = await DB.prepare(
      `SELECT COALESCE(SUM(fee_amount), 0) AS fee FROM ledger_entries
        WHERE credit_account = 'platform:revenue' AND reference_id IN (${idPlaceholders})`
    ).bind(...orderIds.map((id) => `order:${id}`)).first<{ fee: number }>().catch(() => null)
    const settingRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'pg_reserve_pct'")
      .first<{ value: string | null }>().catch(() => null)
    const pgReservePct = Number(settingRow?.value ?? NaN)
    const { computeCommissionBudget, DEFAULT_PG_RESERVE_PCT } = await import('../../../worker/utils/commission-budget')
    const platformFeeKrw = Math.max(0, Math.round(Number(feeRow?.fee ?? 0)))
    const budgetKrw = computeCommissionBudget({
      amountKrw, platformFeeKrw,
      pgReservePct: Number.isFinite(pgReservePct) ? pgReservePct : DEFAULT_PG_RESERVE_PCT,
    })

    // ② 이 주문에 붙은 성장 커미션 적립 — 축마다 사는 테이블이 다르다(설계 문서 §flip 구현 스펙).
    const grants: Array<{ axis: string; amount: number; rows: number }> = []
    const collect = async (axis: string, sql: string, binds: unknown[]) => {
      const r = await DB.prepare(sql).bind(...binds)
        .first<{ total: number; cnt: number }>().catch(() => null)
      grants.push({ axis, amount: Math.round(Number(r?.total ?? 0)), rows: Number(r?.cnt ?? 0) })
    }
    await collect('affiliate',
      `SELECT COALESCE(SUM(commission), 0) AS total, COUNT(*) AS cnt FROM affiliate_earnings
        WHERE order_id IN (${idPlaceholders}) AND COALESCE(status, '') IN ('holding', 'granted')`, orderIds)
    await collect('multi_tier',
      `SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS cnt FROM referral_commissions
        WHERE order_id IN (${idPlaceholders}) AND COALESCE(status, '') != 'withdrawn'`, orderIds)
    await collect('influencer_store_intro',
      `SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS cnt FROM influencer_attributions
        WHERE order_id IN (${idPlaceholders}) AND COALESCE(source, '') = 'store_intro'`, orderIds)
    await collect('agency_store_intro',
      `SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS cnt FROM agency_store_intro_commissions
        WHERE order_id IN (${idPlaceholders})`, orderIds)
    const grantedTotal = grants.reduce((s, g) => s + g.amount, 0)

    // ③ platform:revenue 원장 — 이 주문에 대한 credit/debit. [INV-#44] 는 debit 0 을 요구한다.
    const refs = orderIds.map((id) => `order:${id}`)
    const refPh = refs.map(() => '?').join(', ')
    const credit = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
        WHERE credit_account = 'platform:revenue' AND reference_id IN (${refPh})`
    ).bind(...refs).first<{ total: number }>().catch(() => null)
    const debits = await DB.prepare(
      `SELECT event_type, amount, reference_id FROM ledger_entries
        WHERE debit_account = 'platform:revenue' AND reference_id IN (${refPh})
        ORDER BY id DESC LIMIT 20`
    ).bind(...refs).all<{ event_type: string; amount: number; reference_id: string | null }>()
      .catch(() => ({ results: [] as never[] }))
    const debitRows = debits.results || []
    const debitTotal = debitRows.reduce((s, d) => s + (Number(d.amount) || 0), 0)

    return c.json({
      success: true,
      data: {
        order: { order_number: orderNumber, rows: orderRows, amount_krw: amountKrw },
        budget: { platform_fee_krw: platformFeeKrw, pg_reserve_pct: Number.isFinite(pgReservePct) ? pgReservePct : DEFAULT_PG_RESERVE_PCT, budget_krw: budgetKrw },
        grants,
        granted_total_krw: grantedTotal,
        platform_revenue: { credit_krw: Math.round(Number(credit?.total ?? 0)), debit_krw: debitTotal, debit_rows: debitRows },
        // 👇 이 두 줄이 S1 판정이다. 손으로 더할 필요가 없게.
        verdict: {
          within_budget: grantedTotal <= budgetKrw,
          over_by_krw: Math.max(0, grantedTotal - budgetKrw),
          platform_revenue_untouched: debitTotal === 0,
        },
      },
    })
  } catch (err) {
    return safeError(c, err, '주문 커미션 판정 조회 중 오류가 발생했습니다', '[admin-promo-ledger]')
  }
})
