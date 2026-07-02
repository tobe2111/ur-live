/**
 * 💸 2026-07-01 (정산 정합 — 대표 승인 "가장 이상적으로"): 일반 쇼핑 주문 → 이중원장 배선.
 *
 * 배경: 소비자 셀러 매출 중 동네딜 공구·이용권은 원장(ledger_entries)에 seller:N credit 되어
 *   주간 payout 으로 자동 정산되지만, **일반 쇼핑 상품 주문(payment.routes /confirm)은 원장 미기록**
 *   → 자동 payout 누락. 이 헬퍼가 그 갭을 메움(셀러 매출을 원장에 net 크레딧).
 *
 * 🛡️ 안전 설계:
 *   - 기본 OFF: 호출부(payment.routes)가 `SHOPPING_LEDGER_ENABLED==='true'` 게이트로만 실행(그림자).
 *     실결제 검증 불가 환경이므로 staging 검증 후 활성. 기본 OFF = 라이브 영향 0.
 *   - 멱등: 같은 주문이 이미 원장에 있으면(order:N 또는 order_number) skip → 이중적립 0.
 *   - 이중적립 방지: 이용권/deal_only 아이템 주문은 **skip**(그건 voucher 사용 시점에 원장 기록됨).
 *     공구 주문도 group-buy.routes 가 order_number 로 이미 크레딧 → dedup 으로 skip.
 *   - net 규칙 준수(ledger.ts): credit.amount=gross + fee_amount=플랫폼 수수료 → 집계가 net 산출.
 *   - 역전: 환불 시 reverseSellerOrderLedger (order-refund.ts reverseOrderAncillaryOnRefund 에서 호출).
 */
import { recordLedger } from './ledger'
import { COMMISSION_DEFAULTS } from '../../shared/constants/policy'
import { VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'

interface OrderRow {
  id: number
  order_number: string | null
  user_id: string | null
  seller_id: number | null
  total_amount: number | null
  commission_rate: number | null
}

/**
 * 셀러의 일반 쇼핑 주문 매출을 원장에 net 크레딧한다(멱등, 이용권/공구 제외).
 * @returns 크레딧된 net 금액, 또는 null(대상 아님/이미 기록됨).
 */
export async function creditSellerOrderToLedger(
  DB: D1Database,
  orderId: number,
): Promise<{ credited: number } | null> {
  const order = await DB.prepare(
    `SELECT id, order_number, user_id, seller_id, total_amount,
            COALESCE(commission_rate, ?) AS commission_rate
       FROM orders WHERE id = ?`,
  ).bind(COMMISSION_DEFAULTS.PLATFORM_FEE_PCT, orderId).first<OrderRow>().catch(() => null)
  if (!order || !order.seller_id) return null
  const total = Number(order.total_amount || 0)
  if (!(total > 0)) return null

  const sellerAccount = `seller:${order.seller_id}`
  const ref = `order:${orderId}`

  // 멱등/이중적립 방지: 이 주문이 이미 seller 원장에 있으면(order:N 또는 공구의 order_number) skip.
  const dup = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE credit_account = ? AND reference_id IN (?, ?) LIMIT 1`,
  ).bind(sellerAccount, ref, String(order.order_number || '')).first<{ id: number }>().catch(() => null)
  if (dup) return null

  // 이용권/deal_only 아이템 주문은 skip — 그건 voucher 사용 시점에 원장 기록(recordVoucherUsedLedger).
  const voucherPlaceholders = VOUCHER_CATEGORIES.map(() => '?').join(',')
  const voucherish = await DB.prepare(
    `SELECT COUNT(*) AS n FROM order_items oi
       JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
        AND (COALESCE(p.deal_only, 0) = 1 OR p.category IN (${voucherPlaceholders}))`,
  ).bind(orderId, ...VOUCHER_CATEGORIES).first<{ n: number }>().catch(() => ({ n: 0 }))
  if (Number(voucherish?.n ?? 0) > 0) return null

  const rate = Number(order.commission_rate) // 플랫폼 take %
  const platformFee = Math.max(0, Math.round(total * rate / 100))
  const sellerNet = Math.max(0, total - platformFee)

  // 단일 균형 엔트리(공구와 동일 패턴): 유저 wallet 차감 = 셀러 receivable, fee_amount=수수료.
  await recordLedger(DB, {
    event_type: 'order_paid',
    reference_id: ref,
    amount: total,                 // gross; 집계 net = amount − fee_amount
    debit_account: `user:${order.user_id ?? 0}`,
    credit_account: sellerAccount,
    fee_amount: platformFee,
    fee_account: 'platform:commission',
    metadata: { kind: 'order_seller', order_id: orderId },
  })
  return { credited: sellerNet }
}

/**
 * 환불 시 셀러 원장 크레딧 역전(멱등). credit 이 없으면 no-op.
 * seller:N 을 net 만큼 debit → 집계 receivable 감소(payout base 축소).
 */
export async function reverseSellerOrderLedger(
  DB: D1Database,
  orderId: number,
  reason: string,
): Promise<void> {
  const ref = `order:${orderId}`
  const credit = await DB.prepare(
    `SELECT credit_account, amount, fee_amount FROM ledger_entries
      WHERE reference_id = ? AND event_type = 'order_paid' LIMIT 1`,
  ).bind(ref).first<{ credit_account: string; amount: number; fee_amount: number | null }>().catch(() => null)
  if (!credit) return
  // 멱등: 이미 역전됨?
  const done = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = 'order_paid_refund' LIMIT 1`,
  ).bind(ref).first<{ id: number }>().catch(() => null)
  if (done) return
  const net = Math.max(0, Number(credit.amount || 0) - Number(credit.fee_amount || 0))
  if (!(net > 0)) return
  await recordLedger(DB, {
    event_type: 'order_paid_refund',
    reference_id: ref,
    amount: net,
    debit_account: String(credit.credit_account), // seller:N debit → receivable 감소
    credit_account: 'platform:escrow',
    metadata: { kind: 'order_refund_reversal', reason, order_id: orderId },
  })
}
