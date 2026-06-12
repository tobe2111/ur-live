/**
 * 🛡️ 2026-05-20: 에이전시 입점 가게 commission credit.
 *
 * 호출 시점: 주문이 PAID/DONE 으로 confirm 된 직후 (payment.routes.ts).
 * 입력: 각 order 의 seller_id + total_amount.
 * 동작:
 *   1. 해당 seller 의 introduced_by_agency_id 조회 — null 이면 noop.
 *   2. 에이전시의 store_intro_commission_pct (default 2%) 가져옴.
 *   3. (가게 첫 PAID 주문이면) signup_bonus ₩30,000 1회 적립.
 *   4. sales_commission 적립 — 매 주문마다 (영구).
 *   5. UNIQUE(order_id, type) 으로 중복 방지 — 재confirm 시 안전.
 *
 * Fail-soft: 어떤 단계 실패해도 결제 흐름 막지 않음 (catch and swallow).
 */

const SIGNUP_BONUS_AMOUNT = 30000  // ₩30,000 첫 결제 시 1회
const DEFAULT_AGENCY_COMMISSION_PCT = 2.0  // agencies.store_intro_commission_pct fallback

export async function creditAgencyStoreIntroCommission(
  DB: D1Database,
  order: { id: number; seller_id?: number | null; total_amount?: number | null },
): Promise<void> {
  try {
    if (!order.seller_id || !order.total_amount) return

    // 1. 가게 셀러의 introduced_by_agency_id 조회
    const sellerRow = await DB.prepare(
      `SELECT introduced_by_agency_id FROM sellers WHERE id = ?`
    ).bind(order.seller_id).first<{ introduced_by_agency_id: number | null }>().catch(() => null)
    const agencyId = sellerRow?.introduced_by_agency_id
    if (!agencyId) return

    // 2. 에이전시 commission rate
    const agencyRow = await DB.prepare(
      `SELECT COALESCE(store_intro_commission_pct, ${DEFAULT_AGENCY_COMMISSION_PCT}) as pct FROM agencies WHERE id = ?`
    ).bind(agencyId).first<{ pct: number }>().catch(() => null)
    const pct = Number(agencyRow?.pct ?? DEFAULT_AGENCY_COMMISSION_PCT)
    if (!Number.isFinite(pct) || pct <= 0) return

    // 3. 가게 첫 PAID 주문 여부 확인 — signup_bonus 적립.
    //    이미 signup_bonus 가 있으면 skip (UNIQUE constraint 가 이중 보호).
    const existingBonus = await DB.prepare(
      `SELECT id FROM agency_store_intro_commissions
        WHERE store_seller_id = ? AND type = 'signup_bonus' LIMIT 1`
    ).bind(order.seller_id).first<{ id: number }>().catch(() => null)

    if (!existingBonus) {
      // 첫 결제 — signup bonus 1회 적립.
      await DB.prepare(
        `INSERT INTO agency_store_intro_commissions
           (agency_id, store_seller_id, order_id, type, order_amount, commission_amount, status, note)
         VALUES (?, ?, ?, 'signup_bonus', ?, ?, 'pending',
                 '입점 가게 첫 결제 보너스')`
      ).bind(
        agencyId, order.seller_id, order.id,
        order.total_amount, SIGNUP_BONUS_AMOUNT,
      ).run().catch(() => { /* duplicate or rare race — fine */ })
    }

    // 4. 매출 commission (매 주문마다 영구).
    //    order_amount × pct% — 100원 미만이면 round.
    const commission = Math.floor((order.total_amount * pct) / 100)
    if (commission > 0) {
      await DB.prepare(
        `INSERT INTO agency_store_intro_commissions
           (agency_id, store_seller_id, order_id, type, order_amount, commission_amount, status, note)
         VALUES (?, ?, ?, 'sales_commission', ?, ?, 'pending', ?)`
      ).bind(
        agencyId, order.seller_id, order.id,
        order.total_amount, commission,
        `매출 ${pct.toFixed(1)}% commission`
      ).run().catch(() => { /* UNIQUE(order_id, type) 보호 */ })
    }
  } catch {
    // fail-soft — 결제 흐름 막지 않음.
  }
}

/**
 * 🔐 2026-06-11 (머니 감사 High#2): 주문 환불 시 에이전시 매장영입 커미션 역전.
 *   creditAgencyStoreIntroCommission 가 적립(status='pending')하는데 환불 역전이 어떤 경로에도
 *   없어 환불해도 cron 이 성숙→지급하던 누수. order-refund + returns 양쪽에서 호출(단일 진실).
 *   pending/available 만 회수(이미 paid 면 차기 정산 상계 — 별도, 여기선 미성숙분만 안전 차단).
 *   멱등: status 를 'refunded' 로 바꿔 재호출 시 0건.
 */
export async function reverseAgencyStoreIntroOnRefund(
  DB: import('@cloudflare/workers-types').D1Database,
  orderId: number,
  _reason: string,
): Promise<number> {
  if (!orderId) return 0
  try {
    // 🛡️ 2026-06-11 (전 플로우 감사 🔴): 'refunded' 는 이 테이블 CHECK('pending','available','paid',
    //   'cancelled') 밖 → SQLite 가 UPDATE 를 거부하고 .catch 가 삼켜 **역전이 항상 0건(silent no-op)**
    //   이었음. clawback(helpers.ts) 과 동일하게 'cancelled' 로 통일 — payout 집계도 cancelled 제외 정합.
    const r = await DB.prepare(
      "UPDATE agency_store_intro_commissions SET status = 'cancelled' WHERE order_id = ? AND COALESCE(status,'pending') IN ('pending','available')"
    ).bind(orderId).run().catch(() => ({ meta: { changes: 0 } }))
    return (r as { meta?: { changes?: number } }).meta?.changes ?? 0
  } catch { return 0 }
}
