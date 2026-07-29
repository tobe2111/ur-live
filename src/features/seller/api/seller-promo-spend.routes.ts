/**
 * 🔍 매장(셀러) — promo 지출(소개비) 투명성 조회 (read-only)
 *   설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3 🔒 불변 원칙 #1 (투명성):
 *   매장은 자기 promo 지출 내역(누구에게 얼마·어느 딜)을 **항상** 조회 가능 — 완전위임형이어도.
 *
 * 마운트: /api/seller/promo-spend
 *   GET /?months=3 — 최근 N개월(1..12) affiliate promo 지출 내역 + 집계 + 재원 라벨
 *
 * ⚠️ 읽기 전용 — 돈 이동 0, 커미션 적립 로직 무변경.
 *   현재 재원이 'platform'(기본)이면 이 내역은 "플랫폼 부담(재원 전환 전)" 참고용이고,
 *   'owner' 전환(8월 flip) 후에는 매장 원장 debit(ledger promo_fee)과 대사되는 실지출.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { intParam } from '../../../shared/pagination'

type Vars = { sellerId: number }
const app = new Hono<{ Bindings: Env; Variables: Vars }>()

// ── requireSeller (seller JWT — seller-shared SSOT) ──
app.use('*', async (c, next) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
  c.set('sellerId', sellerId)
  await next()
})

interface PromoSpendRow {
  id: number
  order_id: number | null
  product_id: number | null
  product_name: string | null
  commission: number
  status: string | null
  created_at: string
  referrer_id: string
  referrer_name: string | null
  referrer_handle: string | null
}

// ─── GET / — promo 지출 내역 (?months=3, clamp 1..12) ──────────────────────
app.get('/', async (c) => {
  const sellerId = c.get('sellerId')
  try {
    const DB = c.env.DB
    const months = Math.max(1, Math.min(12, intParam(c.req.query('months'), 3)))
    const since = `-${months} months`

    // (a) 행 단위 내역 — 추천인(수령자) 표시 포함. referrer_id 는 TEXT, users.id 는 INTEGER → CAST 조인.
    const rows = await DB.prepare(
      `SELECT ae.id, ae.order_id, ae.product_id,
              COALESCE(ae.product_name, p.name) AS product_name,
              ae.commission, ae.status, ae.created_at,
              ae.referrer_id, u.name AS referrer_name, u.handle AS referrer_handle
         FROM affiliate_earnings ae
         JOIN products p ON p.id = ae.product_id AND p.seller_id = ?
         LEFT JOIN users u ON u.id = CAST(ae.referrer_id AS INTEGER)
        WHERE ae.created_at >= datetime('now', ?)
        ORDER BY ae.created_at DESC
        LIMIT 500`
    ).bind(sellerId, since).all<PromoSpendRow>().catch(() => ({ results: [] as PromoSpendRow[] }))

    // (b-1) status 별 합계
    const byStatus = await DB.prepare(
      `SELECT COALESCE(ae.status, 'pending') AS status,
              COALESCE(SUM(ae.commission), 0) AS total, COUNT(*) AS cnt
         FROM affiliate_earnings ae
         JOIN products p ON p.id = ae.product_id AND p.seller_id = ?
        WHERE ae.created_at >= datetime('now', ?)
        GROUP BY COALESCE(ae.status, 'pending')`
    ).bind(sellerId, since).all<{ status: string; total: number; cnt: number }>()
      .catch(() => ({ results: [] as { status: string; total: number; cnt: number }[] }))

    // (b-2) 수령자(추천인) 별 집계 — "누구에게 얼마" (§4.3 투명성의 핵심)
    const byRecipient = await DB.prepare(
      `SELECT ae.referrer_id, u.name AS referrer_name, u.handle AS referrer_handle,
              COALESCE(SUM(ae.commission), 0) AS total, COUNT(*) AS cnt
         FROM affiliate_earnings ae
         JOIN products p ON p.id = ae.product_id AND p.seller_id = ?
         LEFT JOIN users u ON u.id = CAST(ae.referrer_id AS INTEGER)
        WHERE ae.created_at >= datetime('now', ?)
        GROUP BY ae.referrer_id
        ORDER BY total DESC
        LIMIT 100`
    ).bind(sellerId, since).all<{
      referrer_id: string; referrer_name: string | null; referrer_handle: string | null
      total: number; cnt: number
    }>().catch(() => ({ results: [] as never[] }))

    // (c) 재원 스위치 — UI 라벨의 진실성: 'platform'(기본) = 현재 플랫폼 부담(재원 전환 전),
    //     'owner' = 매장 promo 부담(원장 debit 발생 — ledger.ts debitOwnerPromoForOrder).
    const fund = await DB.prepare(
      `SELECT value FROM platform_settings WHERE key = 'promo_funding_source'`
    ).first<{ value: string }>().catch(() => null)
    const fundingSource = fund?.value || 'platform'
    const ownerFunded = fundingSource === 'owner'

    // owner 재원일 때만: 매장 원장의 promo debit 합 (event_type='promo_fee' — ledger.ts SSOT.
    //   ownerAccount 는 이용권=merchant:{id} / 쇼핑=seller:{id} 두 형태 — 둘 다 합산.)
    let ledgerDebitSum = 0
    if (ownerFunded) {
      const led = await DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM ledger_entries
          WHERE event_type = 'promo_fee'
            AND debit_account IN (?, ?)
            AND created_at >= datetime('now', ?)`
      ).bind(`seller:${sellerId}`, `merchant:${sellerId}`, since)
        .first<{ total: number }>().catch(() => null)
      ledgerDebitSum = Number(led?.total) || 0
    }

    return c.json({
      success: true,
      data: {
        months,
        rows: rows.results || [],
        totals_by_status: byStatus.results || [],
        recipients: byRecipient.results || [],
        funding: {
          funding_source: fundingSource,
          owner_funded: ownerFunded,
          // 0 = 플랫폼 부담(재원 전환 전) — owner 전환 후에만 원장 debit 발생
          ledger_debit_sum: ledgerDebitSum,
          label: ownerFunded
            ? '매장 promo 부담 (원장 차감 중)'
            : '현재 플랫폼 부담 (재원 전환 전)',
        },
      },
    })
  } catch (err) {
    return safeError(c, err, 'promo 지출 내역 조회 중 오류가 발생했습니다', '[seller-promo-spend]')
  }
})

export const sellerPromoSpendRoutes = app
