import { describe, it, expect } from 'vitest'
import {
  computeMatchingSettlement,
  assertPlatformNetIsFee,
  DEFAULT_PLATFORM_FEE_PCT,
} from '../../worker/utils/matching-settlement'
import {
  computeCommissionBudget,
  allocateCommissions,
  assertCommissionBudgetInvariants,
  DEFAULT_PG_RESERVE_PCT,
  type CommissionRequest,
} from '../../worker/utils/commission-budget'

/**
 * 💸 매칭 성사 정산 — "유어딜 순수취 == 정확히 5%" 불변 항등식(순수 함수).
 *   설계: influencer-matching-service-2026-07.md · commission-funding-restructure.md #44.
 *   ⚠️ DB 레일(attribution 적립 · owner promo debit · 환불 역전)의 실검증은 staging 실결제(#496 규율).
 */

describe('computeMatchingSettlement — 순수취 5% 불변', () => {
  const GROSS = 100_000

  it('커미션이 아무리 커도 순수취는 정확히 5% (커미션과 독립)', () => {
    for (const pct of [0, 1.5, 3, 10, 50, 200]) {
      const s = computeMatchingSettlement({ grossKrw: GROSS, commissionPct: pct })
      expect(s.platformNetKrw).toBe(Math.round((GROSS * DEFAULT_PLATFORM_FEE_PCT) / 100)) // 항상 5,000
    }
  })

  it('인플루언서 적립 = 총액 × 커미션율 (floor)', () => {
    expect(computeMatchingSettlement({ grossKrw: 100_000, commissionPct: 1.5 }).influencerKrw).toBe(1500)
    expect(computeMatchingSettlement({ grossKrw: 33_333, commissionPct: 10 }).influencerKrw).toBe(Math.floor(3333.3))
  })

  it('owner 되갚기 = 적립액 (부호 대칭 → 환불 역전)', () => {
    const s = computeMatchingSettlement({ grossKrw: 80_000, commissionPct: 7 })
    expect(s.ownerDebitKrw).toBe(s.influencerKrw)
  })

  it('상한(maxCommissionPct) clamp', () => {
    const s = computeMatchingSettlement({ grossKrw: 100_000, commissionPct: 9, maxCommissionPct: 2 })
    expect(s.influencerKrw).toBe(2000) // 9% 요청이 2% 로 clamp
  })

  it('음수/NaN/0 graceful', () => {
    expect(computeMatchingSettlement({ grossKrw: -5, commissionPct: 5 }).influencerKrw).toBe(0)
    expect(computeMatchingSettlement({ grossKrw: NaN, commissionPct: 5 }).platformNetKrw).toBe(0)
    expect(computeMatchingSettlement({ grossKrw: 100_000, commissionPct: -3 }).influencerKrw).toBe(0)
  })

  it('assertPlatformNetIsFee — 불변식 통과/위반', () => {
    const s = computeMatchingSettlement({ grossKrw: 100_000, commissionPct: 50 })
    expect(() => assertPlatformNetIsFee(s, 100_000)).not.toThrow()
    expect(() => assertPlatformNetIsFee({ ...s, platformNetKrw: 4000 }, 100_000)).toThrow()
    expect(() => assertPlatformNetIsFee({ ...s, ownerDebitKrw: s.influencerKrw + 1 }, 100_000)).toThrow()
  })
})

describe('예산 아비터 모델 — 매칭은 owner-funded 축(플랫폼 예산 무접촉)', () => {
  const AMOUNT = 100_000
  const platformFee = Math.round((AMOUNT * DEFAULT_PLATFORM_FEE_PCT) / 100) // 5,000
  const budget = computeCommissionBudget({ amountKrw: AMOUNT, platformFeeKrw: platformFee, pgReservePct: DEFAULT_PG_RESERVE_PCT })

  /** owner-funded 축은 플랫폼 예산 requests 에서 제외(order-commissions.ts 규칙). */
  const platformFunded = (axes: { key: string; amountKrw: number; ownerFunded: boolean }[]): CommissionRequest[] =>
    axes.filter((a) => !a.ownerFunded).map((a) => ({ key: a.key, amountKrw: a.amountKrw }))

  it('매칭 축 owner-funded → 플랫폼 커미션 부담 0 → 순수취 == 5%', () => {
    const matching = computeMatchingSettlement({ grossKrw: AMOUNT, commissionPct: 12 })
    const axes = [{ key: 'matching', amountKrw: matching.influencerKrw, ownerFunded: true }]
    const grants = allocateCommissions(platformFunded(axes), budget)
    assertCommissionBudgetInvariants(grants, budget)
    const spend = grants.reduce((s, g) => s + g.grantedKrw, 0)
    expect(spend).toBe(0)                       // 플랫폼 예산에서 나간 돈 0
    expect(platformFee - spend).toBe(platformFee) // 순수취 == 5,000 (정확히 5%)
  })

  it('매칭 + 기존 성장축 전부 owner-funded → 순수취 여전히 5%', () => {
    const axes = [
      { key: 'affiliate', amountKrw: 2000, ownerFunded: true },
      { key: 'matching', amountKrw: 12000, ownerFunded: true },
    ]
    const grants = allocateCommissions(platformFunded(axes), budget)
    const spend = grants.reduce((s, g) => s + g.grantedKrw, 0)
    expect(spend).toBe(0)
    expect(platformFee - spend).toBe(platformFee)
  })
})
