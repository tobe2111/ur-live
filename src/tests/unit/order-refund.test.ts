import { describe, it, expect } from 'vitest'
import { refundOrderFully } from '@/worker/utils/order-refund'

/**
 * 🛡️ 2026-06-01 refundOrderFully 가드 테스트 (전액환불 공유루틴, 테스트 0개였음).
 *   환불 진입 가드: 주문없음 404 / IDOR / 멱등(이미 REFUNDED) / 상태검증 / 결제키누락 422.
 *   (Toss 취소·cascade 역적립은 dynamic import 라 여기선 가드 분기만 — 가장 사고 위험 큰 경로.)
 */

function dbWithOrder(order: Record<string, unknown> | null) {
  return {
    prepare(_sql: string) {
      const api = {
        bind: (..._a: unknown[]) => api,
        first: async () => order,
        run: async () => ({ meta: {} }),
        all: async () => ({ results: [] }),
      }
      return api
    },
    batch: async () => [],
  } as never
}
const env = { TOSS_SECRET_KEY: 'test_sk' }

describe('refundOrderFully — 환불 진입 가드', () => {
  it('주문 없음 → 404', async () => {
    const r = await refundOrderFully(dbWithOrder(null), env, 999, { reason: 'x' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(404)
  })

  it('IDOR: expectSellerId 불일치 → 404 (정보노출 방지)', async () => {
    const order = { id: 1, order_number: 'O1', user_id: 'u', seller_id: 5, status: 'PAID', total_amount: 10000, payment_method: 'card', toss_payment_key: 'pk' }
    const r = await refundOrderFully(dbWithOrder(order), env, 1, { reason: 'x', expectSellerId: 99 })
    expect(r.status).toBe(404) // 다른 셀러 주문은 "없음" 으로 위장
  })

  it('멱등: 이미 REFUNDED → already:true, 200', async () => {
    const order = { id: 1, order_number: 'O1', user_id: 'u', seller_id: 5, status: 'REFUNDED', total_amount: 10000 }
    const r = await refundOrderFully(dbWithOrder(order), env, 1, { reason: 'x' })
    expect(r.ok).toBe(true)
    expect(r.already).toBe(true)
  })

  it('환불 불가 상태(PENDING) → 400', async () => {
    const order = { id: 1, order_number: 'O1', user_id: 'u', seller_id: 5, status: 'PENDING', total_amount: 10000 }
    const r = await refundOrderFully(dbWithOrder(order), env, 1, { reason: 'x' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('카드결제인데 payment key 없음 → 422 PAYMENT_KEY_MISSING', async () => {
    const order = { id: 1, order_number: 'O1', user_id: 'u', seller_id: 5, status: 'PAID', total_amount: 10000, payment_method: 'card', toss_payment_key: null, payment_key: null }
    const r = await refundOrderFully(dbWithOrder(order), env, 1, { reason: 'x' })
    expect(r.status).toBe(422)
    expect(r.code).toBe('PAYMENT_KEY_MISSING')
  })

  it('expectSellerId 일치 시 IDOR 통과(상태검증으로 진행)', async () => {
    // seller_id 일치 + 환불불가 상태 → 404 가 아니라 400 (소유권은 통과했다는 증거)
    const order = { id: 1, order_number: 'O1', user_id: 'u', seller_id: 5, status: 'CANCELLED', total_amount: 10000 }
    const r = await refundOrderFully(dbWithOrder(order), env, 1, { reason: 'x', expectSellerId: 5 })
    expect(r.status).toBe(400)
  })
})
