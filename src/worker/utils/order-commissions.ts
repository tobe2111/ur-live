/**
 * 🔐 2026-06-11 (머니 감사 Med-C): 결제 확정 시 커미션 적립 — /confirm 과 webhook 양쪽 공용.
 *   결제 확정 경로가 둘(payment.routes /confirm + webhook PAYMENT_CONFIRMED)인데 적립이
 *   /confirm 에만 있어, 브라우저가 confirm 을 못 보내고 webhook 만 도착하면 커미션 누락이었음.
 *   3종(에이전시 매장영입 / 영입자(인플) 매장영입 / 공급자 B2B)은 각각 order_id 멱등이라
 *   두 경로가 모두 와도 안전. fail-soft — 결제 흐름 막지 않음.
 */
import type { D1Database } from '@cloudflare/workers-types'

type OrderLike = { id: number; seller_id?: number | null; total_amount?: number | null }

export async function creditOrderCommissions(DB: D1Database, orders: OrderLike[]): Promise<void> {
  if (!orders?.length) return
  try {
    const { creditAgencyStoreIntroCommission } = await import('./agency-store-intro-commission')
    for (const o of orders) {
      await creditAgencyStoreIntroCommission(DB, { id: Number(o.id), seller_id: o.seller_id ?? null, total_amount: o.total_amount ?? null })
    }
  } catch { /* fail-soft */ }
  try {
    const { creditInfluencerStoreIntroCommission } = await import('./influencer-store-intro-commission')
    for (const o of orders) {
      await creditInfluencerStoreIntroCommission(DB, { id: Number(o.id), seller_id: o.seller_id ?? null, total_amount: o.total_amount ?? null })
    }
  } catch { /* fail-soft */ }
  try {
    const { creditSupplierOnOrder } = await import('../../features/supply/api/supply-settlement')
    for (const o of orders) {
      await creditSupplierOnOrder(DB, Number(o.id))
    }
  } catch { /* fail-soft */ }
}
