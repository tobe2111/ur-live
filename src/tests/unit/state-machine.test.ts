import { describe, it, expect } from 'vitest'
import { canTransition, statusesThatCanReach, ORDER_TRANSITIONS } from '@/worker/utils/state-machine'

/**
 * 🛡️ 2026-06-01 주문 상태 전이 state-machine 테스트 (테스트 0개였음).
 * 막는 회귀: 환불 webhook 이 PAID→PENDING 역전, DELIVERED→SHIPPING 후퇴, 종결상태 재오픈 등
 *   동시요청/잘못된 전이로 인한 주문 무결성 + 돈 사고.
 */

describe('canTransition — 합법/불법 전이', () => {
  it('정상 진행 전이는 허용', () => {
    expect(canTransition('PENDING', 'PAID')).toBe(true)
    expect(canTransition('PAID', 'SHIPPING')).toBe(true)
    expect(canTransition('SHIPPING', 'DELIVERED')).toBe(true)
    expect(canTransition('DELIVERED', 'REFUNDED')).toBe(true)
  })

  // 🛡️ 2026-07-05 (대표 신고): 결제완료 주문을 관리자/셀러가 '배송 완료'로 직접(전진 건너뛰기).
  //   교환권·매장픽업·외부송장 등 SHIPPING 단계가 없는 이행에 필수. 머니 무관(delivered_at·알림만).
  it('🔒 결제 이후 전진 건너뛰기 허용 (배송완료 직접 표시)', () => {
    expect(canTransition('PAID', 'DELIVERED')).toBe(true)
    expect(canTransition('DONE', 'DELIVERED')).toBe(true)
    expect(canTransition('PREPARING', 'DELIVERED')).toBe(true)
    expect(canTransition('PAID', 'PREPARING')).toBe(true)
  })

  it('🔒 미결제 상태는 이행상태로 점프 불가 (선결제 불변 — 미결제 배송완료 금지)', () => {
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false)
    expect(canTransition('PENDING', 'SHIPPING')).toBe(false)
    expect(canTransition('AWAITING_PAYMENT', 'DELIVERED')).toBe(false)
  })

  it('역방향/불법 전이는 차단', () => {
    expect(canTransition('PAID', 'PENDING')).toBe(false)      // 결제완료 → 대기 역전 차단
    expect(canTransition('DELIVERED', 'SHIPPING')).toBe(false) // 배송완료 → 배송중 후퇴 차단
    expect(canTransition('SHIPPING', 'PAID')).toBe(false)
  })

  it('종결 상태(CANCELLED/REFUNDED/FAILED)는 나가는 전이 없음', () => {
    expect(canTransition('REFUNDED', 'PAID')).toBe(false)
    expect(canTransition('CANCELLED', 'SHIPPING')).toBe(false)
    expect(canTransition('FAILED', 'PAID')).toBe(false)
    for (const term of ['CANCELLED', 'REFUNDED', 'FAILED']) {
      expect(ORDER_TRANSITIONS[term]).toEqual([])
    }
  })

  it('동일 상태(idempotent) 전이는 허용', () => {
    expect(canTransition('PAID', 'PAID')).toBe(true)
    expect(canTransition('SHIPPING', 'SHIPPING')).toBe(true)
  })

  it('PAID/DONE 동의어 처리', () => {
    expect(canTransition('DONE', 'SHIPPING')).toBe(true)
    expect(canTransition('PAID', 'DONE')).toBe(true)
    expect(canTransition('DONE', 'PAID')).toBe(true)
  })

  it('PAY_COMPLETE 별칭 → PAID 정규화', () => {
    expect(canTransition('PAY_COMPLETE', 'SHIPPING')).toBe(true)
    expect(canTransition('PENDING', 'PAY_COMPLETE')).toBe(true)
  })

  it('대소문자 무관 정규화', () => {
    expect(canTransition('pending', 'paid')).toBe(true)
    expect(canTransition('Paid', 'Shipping')).toBe(true)
  })

  it('null/빈 값은 false', () => {
    expect(canTransition(null, 'PAID')).toBe(false)
    expect(canTransition('PAID', '')).toBe(false)
    expect(canTransition(undefined, 'PAID')).toBe(false)
  })
})

describe('statusesThatCanReach — CAS UPDATE 용 역방향 집합', () => {
  it('REFUNDED 로 갈 수 있는 상태 = PAID/DONE/PREPARING/SHIPPING/DELIVERED', () => {
    const reach = statusesThatCanReach('REFUNDED')
    for (const s of ['PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED']) {
      expect(reach, `${s} → REFUNDED`).toContain(s)
    }
    // 종결/대기 상태는 REFUNDED 로 직접 못 감
    expect(reach).not.toContain('CANCELLED')
  })

  it('DELIVERED 로 갈 수 있는 상태 = PAID/DONE/PREPARING/SHIPPING (전진 건너뛰기 허용)', () => {
    const reach = statusesThatCanReach('DELIVERED')
    for (const s of ['PAID', 'DONE', 'PREPARING', 'SHIPPING']) {
      expect(reach, `${s} → DELIVERED`).toContain(s)
    }
    // 미결제/종결 상태는 DELIVERED 로 직접 못 감
    expect(reach).not.toContain('PENDING')
    expect(reach).not.toContain('CANCELLED')
  })
})
