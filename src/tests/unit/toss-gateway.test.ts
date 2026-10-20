import { describe, it, expect } from 'vitest'
import {
  detectTossKeyType,
  decideTossFlow,
  generateTossOrderId,
  confirmTossPayment,
  cancelTossPayment,
} from '@/worker/utils/toss-gateway'
import { getTossErrorMessage, getTossErrorInfo } from '@/worker/utils/toss-error-messages'

// 🛡️ 2026-06-01: 결제 SSOT(toss-gateway) 테스트 — 이전엔 커버리지 0건.
//   네트워크 없는 순수 함수 + early-return 가드만 검증 (실제 Toss API 호출 X).

describe('toss-gateway — 키 타입/플로우 판별 (순수)', () => {
  it('detectTossKeyType: missing / widget / unknown', () => {
    expect(detectTossKeyType(undefined)).toBe('missing')
    expect(detectTossKeyType('')).toBe('missing')
    expect(detectTossKeyType('test_ck_abc')).toBe('widget')
    expect(detectTossKeyType('live_wck_xyz')).toBe('widget')
    expect(detectTossKeyType('test_gck_xyz')).toBe('widget')
    expect(detectTossKeyType('randomstring')).toBe('unknown')
  })

  it('decideTossFlow: missing→invalid, 그 외→widget', () => {
    expect(decideTossFlow(undefined).flow).toBe('invalid')
    expect(decideTossFlow('test_ck_abc').flow).toBe('widget')
    expect(decideTossFlow('weirdkey').flow).toBe('widget')
  })

  it('generateTossOrderId: prefix-user-timestamp + 사용자 sanitize/24자 제한', () => {
    const id = generateTossOrderId('GB', 'user@한글!#123')
    expect(id.startsWith('GB-')).toBe(true)
    // 특수문자/한글 제거 후 영숫자만
    expect(id.split('-')[1]).toMatch(/^[a-zA-Z0-9]*$/)
    const long = generateTossOrderId('ORD', 'a'.repeat(50))
    expect(long.split('-')[1].length).toBeLessThanOrEqual(24)
  })
})

describe('toss-gateway — confirm early-return 가드 (네트워크 X)', () => {
  it('TOSS_SECRET_KEY 없음 → NO_TOSS_SECRET', async () => {
    const r = await confirmTossPayment({ env: {}, paymentKey: 'pk', orderId: 'ORD-1', amount: 1000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NO_TOSS_SECRET')
  })

  it('paymentKey/orderId 누락 → INVALID_PARAMS', async () => {
    const r = await confirmTossPayment({ env: { TOSS_SECRET_KEY: 'test_sk_x' }, paymentKey: '', orderId: '', amount: 1000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_PARAMS')
  })

  it('amount 비정상(0/음수) → INVALID_AMOUNT', async () => {
    const r0 = await confirmTossPayment({ env: { TOSS_SECRET_KEY: 'test_sk_x' }, paymentKey: 'pk', orderId: 'ORD-1', amount: 0 })
    expect(r0.ok).toBe(false)
    if (!r0.ok) expect(r0.code).toBe('INVALID_AMOUNT')
    const rNeg = await confirmTossPayment({ env: { TOSS_SECRET_KEY: 'test_sk_x' }, paymentKey: 'pk', orderId: 'ORD-1', amount: -5 })
    if (!rNeg.ok) expect(rNeg.code).toBe('INVALID_AMOUNT')
  })
})

describe('toss-gateway — cancel early-return 가드 (네트워크 X)', () => {
  it('TOSS_SECRET_KEY 없음 → NO_TOSS_SECRET', async () => {
    const r = await cancelTossPayment({ env: {}, paymentKey: 'pk', cancelReason: 'x', idempotencyKey: 'k' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NO_TOSS_SECRET')
  })

  it('paymentKey 누락 → INVALID_PAYMENT_KEY', async () => {
    const r = await cancelTossPayment({ env: { TOSS_SECRET_KEY: 'test_sk_x' }, paymentKey: '', cancelReason: 'x', idempotencyKey: 'k' })
    if (!r.ok) expect(r.code).toBe('INVALID_PAYMENT_KEY')
  })

  it('취소 사유 누락 → MISSING_CANCEL_REASON', async () => {
    const r = await cancelTossPayment({ env: { TOSS_SECRET_KEY: 'test_sk_x' }, paymentKey: 'pk', cancelReason: '', idempotencyKey: 'k' })
    if (!r.ok) expect(r.code).toBe('MISSING_CANCEL_REASON')
  })

  it('cancelAmount 비정상 → INVALID_CANCEL_AMOUNT', async () => {
    const r = await cancelTossPayment({ env: { TOSS_SECRET_KEY: 'test_sk_x' }, paymentKey: 'pk', cancelReason: 'x', cancelAmount: -1, idempotencyKey: 'k' })
    if (!r.ok) expect(r.code).toBe('INVALID_CANCEL_AMOUNT')
  })
})

describe('toss-error-messages — 코드→메시지 매핑', () => {
  it('알려진 코드는 메시지 반환', () => {
    expect(getTossErrorMessage('ALREADY_PROCESSED_PAYMENT')).toBeTruthy()
    expect(getTossErrorInfo('PROVIDER_ERROR')).toBeDefined()
  })
  it('알 수 없는 코드/빈 값 → undefined', () => {
    expect(getTossErrorMessage('___NOPE___')).toBeUndefined()
    expect(getTossErrorMessage(undefined)).toBeUndefined()
    expect(getTossErrorInfo(null)).toBeUndefined()
  })
})
