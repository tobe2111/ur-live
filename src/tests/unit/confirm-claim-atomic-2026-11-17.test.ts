/**
 * 💸 2026-11-17 [UNLOCK] /confirm 의 DONE 선점이 결제 키와 **한 문장**이고, 선점 실패를 '이미 처리됨'으로 읽지 않는다.
 * 대표 승인 "잠금 풀고 고침" · 기록 docs/locks/toss/2026-11-17-confirm-claim-atomic.md
 *
 * 지키는 것:
 *  1. 선점 UPDATE 가 status='DONE' 과 toss_payment_key 를 같은 문장에 쓴다 — 'DONE 인데 키 없음' 이 생기지 않는다.
 *  2. 선점이 던지면 success 만 돌려주지 않는다 — 키 보존 시도 + retry 기록 + critical 알림 + DEFERRED 경고.
 *  3. 보조 updateStatus 가 실패해도 return 하지 않는다(재고·교환권·커미션이 이어 돈다).
 *  4. reconciliation 은 retry 기록이 있는 PENDING 주문을 자동 취소하지 않는다.
 *
 * 못 막는 것: 실제 D1 장애 시 기록 쓰기 자체가 실패하는 경우(알림과 Toss 웹훅 재시도·1b 복구에 기댄다) ·
 *   staging 실결제(머니 경로 — STAGING_CHECKLIST).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const PAY = fs.readFileSync('src/worker/routes/payment.routes.ts', 'utf8')
const REC = fs.readFileSync('src/worker/cron/reconciliation.ts', 'utf8')

describe('/confirm 선점 — 원자적·실패는 실패로', () => {
  it('DONE 선점 문장이 결제 키를 함께 쓴다', () => {
    expect(PAY).toMatch(/UPDATE orders SET status = 'DONE', toss_payment_key = \?, toss_order_id = \?/)
  })

  it('선점 오류를 null 로 삼켜 "이미 처리됨" 으로 보내지 않는다', () => {
    const at = PAY.indexOf("UPDATE orders SET status = 'DONE', toss_payment_key = ?")
    const tail = PAY.slice(at, at + 2200)
    expect(tail).toMatch(/\.catch\(\(e: unknown\) => \{ claimErr = e; return null \}\)/)
    expect(tail).toMatch(/if \(claimErr\) \{[\s\S]{0,200}recordConfirmClaimFailure\(c\.env,[\s\S]{0,200}PAYMENT_CONFIRMED_DB_DEFERRED/)
    // 복구 기록 본체: 키 보존 · retry 기록 · critical 알림
    const REC_FN = fs.readFileSync('src/worker/utils/confirm-claim-recovery.ts', 'utf8')
    expect(REC_FN).toMatch(/UPDATE orders SET toss_payment_key = \?/)
    expect(REC_FN).toMatch(/'payment_update_retry'/)
    expect(REC_FN).toMatch(/severity: 'critical'/)
  })

  it('보조 updateStatus 실패가 부수효과를 끊지 않는다', () => {
    const at = PAY.indexOf("logError('toss.confirm.db_update_failed'")
    expect(at).toBeGreaterThan(-1)
    const block = PAY.slice(at, PAY.indexOf('// Reduce stock', at))
    expect(block).not.toMatch(/return c\.json/)
  })

  it('reconciliation 은 결제 증거(retry 기록)가 있는 주문을 자동 취소하지 않는다', () => {
    const sel = REC.slice(REC.indexOf('const toCancel'), REC.indexOf('const cancelIds'))
    expect(sel).toMatch(/NOT EXISTS \(SELECT 1 FROM webhook_events we WHERE we\.order_number = orders\.order_number AND we\.event_type = 'payment_update_retry'\)/)
  })
})
