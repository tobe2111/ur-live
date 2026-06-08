/**
 * Platform Business Metrics — 경영 의사결정용 비즈니스 지표 (read-only aggregates)
 *
 * 🆕 2026-06-08: 리더십이 사업 viability 를 판단할 핵심 지표(GMV / 순수익률 추정 / 반복구매율 /
 *   활성 셀러·구매자 / 여신 미수금 / 공급사 미지급)를 한 endpoint 로 집계.
 *
 * 마운트: adminApp.route('/business-metrics', platformMetricsRoutes)  → /api/admin/business-metrics/*
 *   ⚠️ 기존 adminMetricsRoutes 가 이미 /api/admin/metrics 를 점유하므로 충돌 회피 위해 별도 path.
 *   adminApp 은 worker/index.ts 에서 requireAdmin() 미들웨어를 '*' 로 적용 → 이 라우터도 자동 인증.
 *
 * 🛡️ graceful: 모든 sub-query 는 .catch(() => fallback) → 미존재 테이블/컬럼이어도 절대 500 안 남.
 *   클라이언트 값으로 금액 계산 안 함 (period 만 화이트리스트 검증).
 *
 * ── 데이터 출처 & 가정 (코멘트로 명시 — 추측 금지, 실제 스키마 기준) ──
 *  · 소비자 GMV : orders.total_amount, status IN ('PAID','DONE','DELIVERED'), created_at (KST = +9h)
 *  · 도매 GMV   : wholesale_orders.subtotal, status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE','ON_CREDIT')
 *                 ('ON_CREDIT' = 외상 — GMV 에는 포함하되 PG 비용 산정에서는 제외)
 *  · 도매 마진  : wholesale_orders.margin_total (플랫폼 실수익 — 도매는 마진 모델)
 *  · 후원       : donations.amount, payment_status='completed' (셀러별 social.routes 와 동일 컬럼)
 *  · 소비자 수수료 : platform_settings.commission_rate_default (%) — 미설정 시 5% (CLAUDE.md SSOT)
 *  · 후원 수수료 : 15% (CLAUDE.md 후원 수수료)
 *  · 여신 미수금 : SUM(sellers.outstanding_balance)
 *  · 공급사 미지급 : SUM(supplier_settlements.supply_amount) WHERE status IN ('pending','available')
 *
 *  ⚠️ 순수익률은 ESTIMATE — PG 수수료 2.5% (paid GMV, ON_CREDIT 제외) 가정. 실제 PG 정산서 아님.
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'

export const platformMetricsRoutes = new Hono<{ Bindings: Env }>()

// 가정 상수 (클라이언트에도 disclaimer 로 노출)
const DEFAULT_CONSUMER_COMMISSION_PCT = 5 // platform_settings.commission_rate_default fallback
const DONATION_FEE_PCT = 15 // 후원 수수료 (CLAUDE.md)
const PG_FEE_PCT = 2.5 // 결제대행 수수료 추정 (paid GMV 기준)

// period → days. 12m 은 월별 집계.
function parsePeriod(raw: string | undefined): { period: '30d' | '90d' | '12m'; days: number; monthly: boolean } {
  if (raw === '90d') return { period: '90d', days: 90, monthly: false }
  if (raw === '12m') return { period: '12m', days: 365, monthly: true }
  return { period: '30d', days: 30, monthly: false } // default
}

interface SumRow { v: number }
interface CountRow { n: number }

// 안전 단일 집계 — 실패 시 fallback. (테이블/컬럼 미존재 graceful)
async function sum(DB: D1Database, sql: string, binds: (string | number)[] = []): Promise<number> {
  try {
    const r = await DB.prepare(sql).bind(...binds).first<SumRow>()
    const v = Number(r?.v)
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}
async function count(DB: D1Database, sql: string, binds: (string | number)[] = []): Promise<number> {
  try {
    const r = await DB.prepare(sql).bind(...binds).first<CountRow>()
    const n = Number(r?.n)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

platformMetricsRoutes.get('/overview', async (c) => {
  try {
    const DB = c.env.DB
    const { period, days, monthly } = parsePeriod(c.req.query('period'))

    // KST 기준 기간 시작 (orders 는 +9h 보정 컨벤션과 일치하도록 cutoff 비교)
    const sinceClause = `created_at >= datetime('now', '-${days} days')`

    // ── 수수료율 (platform_settings) ──
    let consumerCommissionPct = DEFAULT_CONSUMER_COMMISSION_PCT
    try {
      const cr = await DB.prepare(
        "SELECT value AS v FROM platform_settings WHERE key='commission_rate_default'"
      ).first<{ v: string }>()
      const parsed = parseFloat(String(cr?.v ?? ''))
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) consumerCommissionPct = parsed
    } catch { /* 미존재 — default 유지 */ }

    // ── GMV ──
    const consumerGmv = await sum(
      DB,
      `SELECT COALESCE(SUM(total_amount),0) AS v FROM orders WHERE status IN ('PAID','DONE','DELIVERED') AND ${sinceClause}`
    )
    const wholesaleGmv = await sum(
      DB,
      `SELECT COALESCE(SUM(subtotal),0) AS v FROM wholesale_orders WHERE status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE','ON_CREDIT') AND ${sinceClause}`
    )
    // PG 비용 산정용 — 실제 결제(외상 제외) GMV
    const wholesalePaidGmv = await sum(
      DB,
      `SELECT COALESCE(SUM(subtotal),0) AS v FROM wholesale_orders WHERE status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE') AND ${sinceClause}`
    )
    const combinedGmv = consumerGmv + wholesaleGmv

    // ── 시계열 (daily 30/90d, monthly 12m) — orders + wholesale_orders 합산 ──
    const bucketExpr = monthly
      ? `strftime('%Y-%m', created_at, '+9 hours')`
      : `DATE(created_at, '+9 hours')`
    const timeSeries: Array<{ bucket: string; consumer: number; wholesale: number; total: number }> = []
    try {
      const consRows = await DB.prepare(
        `SELECT ${bucketExpr} AS bucket, COALESCE(SUM(total_amount),0) AS v
         FROM orders WHERE status IN ('PAID','DONE','DELIVERED') AND ${sinceClause}
         GROUP BY bucket ORDER BY bucket ASC`
      ).all<{ bucket: string; v: number }>().catch(() => ({ results: [] as any[] }))
      const wholeRows = await DB.prepare(
        `SELECT ${bucketExpr} AS bucket, COALESCE(SUM(subtotal),0) AS v
         FROM wholesale_orders WHERE status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE','ON_CREDIT') AND ${sinceClause}
         GROUP BY bucket ORDER BY bucket ASC`
      ).all<{ bucket: string; v: number }>().catch(() => ({ results: [] as any[] }))

      const map = new Map<string, { consumer: number; wholesale: number }>()
      for (const r of (consRows.results ?? [])) {
        const b = String(r.bucket)
        map.set(b, { consumer: Number(r.v) || 0, wholesale: 0 })
      }
      for (const r of (wholeRows.results ?? [])) {
        const b = String(r.bucket)
        const cur = map.get(b) || { consumer: 0, wholesale: 0 }
        cur.wholesale = Number(r.v) || 0
        map.set(b, cur)
      }
      for (const b of Array.from(map.keys()).sort()) {
        const v = map.get(b)!
        timeSeries.push({ bucket: b, consumer: v.consumer, wholesale: v.wholesale, total: v.consumer + v.wholesale })
      }
    } catch { /* graceful — 빈 시계열 */ }

    // ── 후원 ──
    const donationTotal = await sum(
      DB,
      `SELECT COALESCE(SUM(amount),0) AS v FROM donations WHERE payment_status='completed' AND ${sinceClause}`
    )

    // ── 순수익률 추정 (ESTIMATE) ──
    const consumerCommissionRev = Math.round(consumerGmv * (consumerCommissionPct / 100))
    const wholesaleMarginRev = await sum(
      DB,
      `SELECT COALESCE(SUM(margin_total),0) AS v FROM wholesale_orders WHERE status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE','ON_CREDIT') AND ${sinceClause}`
    )
    const donationFeeRev = Math.round(donationTotal * (DONATION_FEE_PCT / 100))
    const grossRevenue = consumerCommissionRev + wholesaleMarginRev + donationFeeRev
    // PG 비용: 소비자 GMV + 도매 실결제(외상 제외) GMV 의 2.5%
    const pgBaseGmv = consumerGmv + wholesalePaidGmv
    const estPgCost = Math.round(pgBaseGmv * (PG_FEE_PCT / 100))
    const netRevenue = grossRevenue - estPgCost
    const netTakeRatePct = combinedGmv > 0 ? (netRevenue / combinedGmv) * 100 : 0

    // ── 주문 수 / AOV ──
    const consumerOrderCount = await count(
      DB,
      `SELECT COUNT(*) AS n FROM orders WHERE status IN ('PAID','DONE','DELIVERED') AND ${sinceClause}`
    )
    const wholesaleOrderCount = await count(
      DB,
      `SELECT COUNT(*) AS n FROM wholesale_orders WHERE status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE','ON_CREDIT') AND ${sinceClause}`
    )
    const totalOrderCount = consumerOrderCount + wholesaleOrderCount
    const aov = totalOrderCount > 0 ? Math.round(combinedGmv / totalOrderCount) : 0

    // ── 반복구매율 (소비자 orders.user_id 기준) ──
    // distinct user with >=2 orders / distinct user with >=1 order (기간 내)
    let buyersWithOrders = 0
    let buyersRepeat = 0
    try {
      const r = await DB.prepare(
        `SELECT
           COUNT(*) AS total_buyers,
           SUM(CASE WHEN oc >= 2 THEN 1 ELSE 0 END) AS repeat_buyers
         FROM (
           SELECT user_id, COUNT(*) AS oc
           FROM orders
           WHERE status IN ('PAID','DONE','DELIVERED') AND user_id IS NOT NULL AND ${sinceClause}
           GROUP BY user_id
         )`
      ).first<{ total_buyers: number; repeat_buyers: number }>()
      buyersWithOrders = Number(r?.total_buyers) || 0
      buyersRepeat = Number(r?.repeat_buyers) || 0
    } catch { /* graceful */ }
    const repeatPurchaseRatePct = buyersWithOrders > 0 ? (buyersRepeat / buyersWithOrders) * 100 : 0

    // ── 활성 구매자 (distinct order user_ids) ──
    const activeBuyers = buyersWithOrders // 위 distinct user 집계 재사용

    // ── 활성 셀러 (>=1 sale in period) ──
    const activeSellers = await count(
      DB,
      `SELECT COUNT(DISTINCT seller_id) AS n FROM orders WHERE status IN ('PAID','DONE','DELIVERED') AND seller_id IS NOT NULL AND ${sinceClause}`
    )

    // ── 신규 vs 재방문 구매자 (저렴하게 — 기간 내 첫 주문이 기간 시작 이후면 신규로 근사) ──
    // distinct user 중, 기간 이전 주문 이력이 없는 사용자를 신규로 카운트.
    let newBuyers = 0
    try {
      const r = await DB.prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT user_id FROM orders
           WHERE status IN ('PAID','DONE','DELIVERED') AND user_id IS NOT NULL AND ${sinceClause}
           GROUP BY user_id
           HAVING MIN(created_at) >= datetime('now', '-${days} days')
             AND user_id NOT IN (
               SELECT DISTINCT user_id FROM orders
               WHERE status IN ('PAID','DONE','DELIVERED') AND user_id IS NOT NULL
                 AND created_at < datetime('now', '-${days} days')
             )
         )`
      ).first<{ n: number }>()
      newBuyers = Number(r?.n) || 0
    } catch { /* graceful */ }
    const returningBuyers = Math.max(0, activeBuyers - newBuyers)

    // ── 여신 미수금 / 공급사 미지급 (스냅샷 — 기간 무관) ──
    const creditOutstanding = await sum(
      DB,
      `SELECT COALESCE(SUM(outstanding_balance),0) AS v FROM sellers`
    )
    const supplierPayable = await sum(
      DB,
      `SELECT COALESCE(SUM(supply_amount),0) AS v FROM supplier_settlements WHERE status IN ('pending','available')`
    )

    return c.json({
      success: true,
      period,
      generated_at: new Date().toISOString(),
      assumptions: {
        consumer_commission_pct: consumerCommissionPct,
        donation_fee_pct: DONATION_FEE_PCT,
        pg_fee_pct: PG_FEE_PCT,
        note: '순수익률은 추정치입니다. PG 수수료 2.5%(외상 제외 결제 GMV), 소비자 수수료 ' +
          `${consumerCommissionPct}%, 후원 수수료 ${DONATION_FEE_PCT}% 가정. 실제 PG 정산서가 아닙니다.`,
      },
      gmv: {
        consumer: consumerGmv,
        wholesale: wholesaleGmv,
        combined: combinedGmv,
        time_series: timeSeries,
        time_series_granularity: monthly ? 'monthly' : 'daily',
      },
      revenue: {
        estimate: true,
        gross: grossRevenue,
        breakdown: {
          consumer_commission: consumerCommissionRev,
          wholesale_margin: wholesaleMarginRev,
          donation_fee: donationFeeRev,
        },
        est_pg_cost: estPgCost,
        net: netRevenue,
        net_take_rate_pct: Math.round(netTakeRatePct * 100) / 100,
      },
      orders: {
        consumer: consumerOrderCount,
        wholesale: wholesaleOrderCount,
        total: totalOrderCount,
        aov,
      },
      repeat_purchase: {
        buyers_total: buyersWithOrders,
        buyers_repeat: buyersRepeat,
        rate_pct: Math.round(repeatPurchaseRatePct * 100) / 100,
      },
      active: {
        sellers: activeSellers,
        buyers: activeBuyers,
        new_buyers: newBuyers,
        returning_buyers: returningBuyers,
      },
      liabilities: {
        credit_outstanding: creditOutstanding, // 여신 미수금
        supplier_payable: supplierPayable, // 공급사 미지급
      },
      donations_total: donationTotal,
    })
  } catch (err) {
    return safeError(c, err, '비즈니스 지표를 불러오지 못했습니다', '[platform-metrics]')
  }
})

export default platformMetricsRoutes
