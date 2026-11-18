/**
 * 💸 2026-11-17 [UNLOCK] /confirm 선점이 **던졌을 때**의 복구 기록 — `payment.routes.ts` 에서 떼어 냄(그 파일 크기 래칫).
 * 상세: docs/locks/toss/2026-11-17-confirm-claim-atomic.md
 *
 * 결제는 이미 Toss 에서 끝났다. 할 일은 셋이고 **어느 것도 실패로 응답을 막지 않는다**:
 *  1. 키만이라도 PENDING 행에 남긴다 → reconciliation 1b(키 있는 PENDING → Toss 조회 → 확정)가 구한다.
 *  2. `payment_update_retry` 기록 → reconciliation 이 이 주문을 "결제 증거 없음"으로 자동 취소하지 않는다.
 *  3. critical 알림.
 */
import type { Env } from '../types/env'
import { swallow } from './swallow'
import { sendAlert } from './alerts'

export async function recordConfirmClaimFailure(
  env: Env,
  p: { orderNumber: string; paymentKey: string; totalAmount: number; error: unknown },
): Promise<void> {
  const DB = env.DB
  await DB.prepare(
    `UPDATE orders SET toss_payment_key = ?, updated_at = datetime('now')
     WHERE order_number = ? AND (toss_payment_key IS NULL OR toss_payment_key = '') AND status = 'PENDING'`,
  ).bind(p.paymentKey, p.orderNumber).run().catch(swallow('payment:claim-fail-key-save'))
  await DB.prepare(`
    INSERT INTO webhook_events (id, source, event_type, payload, status, order_number, created_at)
    VALUES (?, 'internal', 'payment_update_retry', ?, 'FAILED', ?, datetime('now'))
  `).bind(`retry_${p.orderNumber}_${Date.now()}`, JSON.stringify({ paymentKey: p.paymentKey, stage: 'claim', totalAmount: p.totalAmount }), p.orderNumber)
    .run().catch(swallow('payment:claim-fail-retry-log'))
  await sendAlert(env, {
    severity: 'critical',
    title: 'Order claim failed after Toss confirm',
    message: `Order ${p.orderNumber} paid at Toss but DONE claim failed (DB error).`,
    context: { orderNumber: p.orderNumber, error: String(p.error).slice(0, 200) },
  }).catch(swallow('payment:send-alert-claim'))
}
