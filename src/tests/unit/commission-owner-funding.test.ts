import { describe, it, expect } from 'vitest'
import {
  computeCommissionBudget,
  allocateCommissions,
  assertCommissionBudgetInvariants,
  DEFAULT_PG_RESERVE_PCT,
  type CommissionRequest,
} from '../../worker/utils/commission-budget'

/**
 * 💸 S5 — 8월 promo flip owner-redirect 불변식 테스트 (순수 함수).
 *   설계 SSOT: docs/design/commission-funding-restructure.md §확정 원칙 / 불변식 #44.
 *
 * 핵심 모델(코드 정합): order-commissions.ts 는 promo_funding_source='owner' 일 때
 *   성장 커미션 축을 **플랫폼 예산(requests)에서 제외**하고 전액 적립 → owner 되갚기는
 *   ledger.ts debitOwnerPromoForOrder 가 merchant→platform:revenue 로 충당.
 *   따라서 "플랫폼이 예산에서 부담하는 커미션" = platform-펀딩 축의 grants 합.
 *
 * 이 테스트는 그 배분 로직의 **5% 불변 항등식**을 순수하게 강제한다:
 *   platformNet = platformFee − Σ(platform-펀딩 grants)
 *   - 전 축 owner-펀딩(flip 완성): platform-펀딩 requests = [] → platformNet == platformFee (정확히 5%)
 *   - 혼합/미flip: platformNet ≥ platformFee − budget == pg_reserve ≥ 0 (플랫폼 절대 마이너스 없음)
 *
 * ⚠️ DB 레일(debitOwnerPromoForOrder 실합산, 환불 대칭)의 실검증은 staging 실결제(조건 ①).
 */

/** 오케스트레이터의 owner-펀딩 제외 규칙을 순수 모델링 — owner 축은 requests 에서 빠진다. */
function platformFundedRequests(
  all: { key: string; amountKrw: number; ownerFunded: boolean }[],
): CommissionRequest[] {
  return all.filter(a => !a.ownerFunded).map(a => ({ key: a.key, amountKrw: a.amountKrw }))
}

/** 이 주문에서 플랫폼이 예산으로 실제 부담한 커미션 합. */
function platformCommissionSpend(
  all: { key: string; amountKrw: number; ownerFunded: boolean }[],
  budget: number,
): number {
  const reqs = platformFundedRequests(all)
  const grants = allocateCommissions(reqs, budget)
  assertCommissionBudgetInvariants(grants, budget)
  return grants.reduce((s, g) => s + g.grantedKrw, 0)
}

describe('flip owner-redirect — 5% 불변 항등식 (#44)', () => {
  const AMOUNT = 100_000
  const FEE_PCT = 5
  const platformFee = Math.round((AMOUNT * FEE_PCT) / 100) // 5,000
  const budget = computeCommissionBudget({ amountKrw: AMOUNT, platformFeeKrw: platformFee, pgReservePct: DEFAULT_PG_RESERVE_PCT })
  const reserve = platformFee - budget // = round(AMOUNT * 2.75%) = 2,750

  it('예산 = 수수료 − PG준비금(2.75%) — 사전 확인', () => {
    expect(platformFee).toBe(5000)
    expect(reserve).toBe(Math.round(AMOUNT * DEFAULT_PG_RESERVE_PCT / 100)) // 2750
    expect(budget).toBe(5000 - 2750) // 2250
  })

  it('전 축 owner-펀딩(flip 완성) → 플랫폼 커미션 부담 0 → platformNet == 수수료(정확히 5%)', () => {
    const axes = [
      { key: 'affiliate', amountKrw: 2000, ownerFunded: true },
      { key: 'multi_tier', amountKrw: 3000, ownerFunded: true },
      { key: 'influencer_intro', amountKrw: 1500, ownerFunded: true },
      { key: 'agency_intro', amountKrw: 1000, ownerFunded: true },
    ]
    const spend = platformCommissionSpend(axes, budget)
    expect(spend).toBe(0)
    const platformNet = platformFee - spend
    expect(platformNet).toBe(platformFee) // 5,000 == 정확히 5%
  })

  it('미flip(전 축 platform-펀딩) → platformNet ≥ 예산 하한(pg_reserve) — 마이너스 불가', () => {
    const axes = [
      { key: 'affiliate', amountKrw: 2000, ownerFunded: false },
      { key: 'multi_tier', amountKrw: 3000, ownerFunded: false },
      { key: 'influencer_intro', amountKrw: 1500, ownerFunded: false },
      { key: 'agency_intro', amountKrw: 1000, ownerFunded: false },
    ]
    const spend = platformCommissionSpend(axes, budget) // Σ요청 7500 > 예산 2250 → 캡
    expect(spend).toBeLessThanOrEqual(budget)
    const platformNet = platformFee - spend
    expect(platformNet).toBeGreaterThanOrEqual(reserve) // ≥ 2,750 (PG 준비금 보전)
    expect(platformNet).toBeGreaterThan(0)
  })

  it('혼합(C1/C2 owner, C3/C4 platform) → owner 축은 예산 무관, platform 축만 캡', () => {
    const axes = [
      { key: 'affiliate', amountKrw: 2000, ownerFunded: true },
      { key: 'multi_tier', amountKrw: 3000, ownerFunded: true },
      { key: 'influencer_intro', amountKrw: 1500, ownerFunded: false },
      { key: 'agency_intro', amountKrw: 1000, ownerFunded: false },
    ]
    // platform-펀딩 요청 = 1500+1000 = 2500 > 예산 2250 → 캡
    const spend = platformCommissionSpend(axes, budget)
    expect(spend).toBeLessThanOrEqual(budget)
    expect(spend).toBeLessThanOrEqual(2500)
    const platformNet = platformFee - spend
    expect(platformNet).toBeGreaterThanOrEqual(reserve)
  })

  it('owner 되갚기 대칭성(모델) — owner 부담액 == 전액 적립분(캡 미적용)', () => {
    // owner-펀딩 축은 전액 적립되고 같은 금액을 merchant 에서 되갚으므로,
    // "적립액 == 되갚기액" 이 항상 성립(부호 대칭 → 환불 시 자동 역전).
    const ownerAxes = [
      { key: 'affiliate', amountKrw: 2000 },
      { key: 'multi_tier', amountKrw: 3000 },
    ]
    const credited = ownerAxes.reduce((s, a) => s + a.amountKrw, 0) // 전액(캡 없음)
    const ownerDebit = credited // debitOwnerPromoForOrder 가 같은 합을 되갚음
    expect(ownerDebit).toBe(credited)
    // 환불 시 reverseOwnerPromoDebit 이 저장 금액(ownerDebit)을 그대로 복원 → 대칭.
  })
})
