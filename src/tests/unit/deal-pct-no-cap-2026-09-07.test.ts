/**
 * 🛑 인플루언서 딜 % **플랫폼 상한 없음** (2026-09-07 대표 결재 Q2-1)
 *
 * 결재: `docs/decisions/2026-09-07-actor-benefit-conflicts.md` — *"기본안대로 모두 승인"* ⇒ Q2-1
 *   "매장이 제안한 % 그대로, 상한 없음(매장 부담이므로 유어딜 리스크 0)". 유일한 선은 입력 검증 90.
 *
 * 2026-08-30 "자동분은 빼줘" 가 이미 제안 문(`marketing.routes`)과 정산 계산(`calcInfluencerCommissionPct`)에서
 * 캡을 걷어냈고(`deal-only-commission.test.ts` 가 고정), 이 결재는 그 상태를 **확정**하고 남은 자투리를 치웠다:
 *   ① 매칭 정산 순수함수 `computeMatchingSettlement` 의 선택 인자 `maxCommissionPct`(2% clamp) 제거
 *   ② 셀러 가이드 시드가 "플랫폼 상한 이내에서만" 이라고 사장님에게 말하지 않는다(+ 시드 버전 bump)
 *   ③ `max_influencer_commission_pct` 를 **정산·제안 코드가 읽지 않는다**(설정은 과거 호환으로만 남는다)
 *
 * ⚠️ 못 막는 것: 실제 주문에서 소개자 몫이 딜 % 그대로 적립되는지 — staging 실결제 S8 의 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'
import { computeMatchingSettlement } from '../../worker/utils/matching-settlement'
import { calcInfluencerCommissionPct, DEAL_PCT_MAX, type CommissionRates } from '../../features/group-buy/api/commission-rates'

const RATES: CommissionRates = {
  platform_pct: 5, influencer_pct: 0, user_referral_bonus_pct: 0, agency_pct: 0,
  refund_window_days: 7, influencer_payout_min: 100000,
  seller_referral_bonus_pct: 1, seller_referral_bonus_months: 6,
  max_influencer_commission_pct: 2,
}

describe('① 매칭 정산 순수함수 — 상한 인자가 없고, 큰 %도 그대로 계산한다', () => {
  it('9% · 50% · 89% 가 그대로 적립액이 된다(2% 로 잘리지 않는다)', () => {
    for (const pct of [9, 50, 89]) {
      expect(computeMatchingSettlement({ grossKrw: 100_000, commissionPct: pct }).influencerKrw).toBe(pct * 1000)
    }
  })
  it('시그니처에 maxCommissionPct 가 없다 — 인자가 남아 있으면 언젠가 누가 넘긴다', () => {
    const src = codeOnly(readFileSync('src/worker/utils/matching-settlement.ts', 'utf-8'))
    expect(src).not.toMatch(/maxCommissionPct/)
    expect(src).not.toMatch(/max_influencer_commission_pct/)
  })
  it('순수취 5% 항등식은 커미션과 무관하게 그대로다', () => {
    const s = computeMatchingSettlement({ grossKrw: 100_000, commissionPct: 89 })
    expect(s.platformNetKrw).toBe(5000)
  })
})

describe('② 정산 % 계산 — max 설정이 2 여도 딜 % 그대로, 90 만 검증선', () => {
  it('딜 50 → 50 (설정 max 2 무시)', () => {
    expect(calcInfluencerCommissionPct(RATES, { is_referred_by_this_influencer: false, referral_bonus_active: false, deal_commission_pct: 50 })).toBe(50)
  })
  it('검증선은 90 하나', () => {
    expect(DEAL_PCT_MAX).toBe(90)
    expect(calcInfluencerCommissionPct(RATES, { is_referred_by_this_influencer: false, referral_bonus_active: false, deal_commission_pct: 95 })).toBe(90)
  })
})

describe('③ 문서·설정이 "상한" 을 다시 말하지 않는다', () => {
  it('셀러 가이드 시드가 플랫폼 상한을 약속하지 않는다', () => {
    const seed = readFileSync('src/features/guides/api/guide-seed-seller.ts', 'utf-8')
    expect(seed).not.toMatch(/플랫폼 상한\(어드민 설정/)
    expect(seed).toMatch(/플랫폼 상한 없음/)
  })
  it('제안 문과 정산 계산이 max_influencer_commission_pct 를 읽지 않는다', () => {
    for (const p of ['src/features/group-buy/api/marketing.routes.ts', 'src/worker/utils/matching-settlement.ts']) {
      expect(codeOnly(readFileSync(p, 'utf-8')), p).not.toContain('max_influencer_commission_pct')
    }
    // commission-rates 는 타입·기본값(과거 호환)에는 남되, 계산 함수 본문에서는 안 읽는다.
    const cr = codeOnly(readFileSync('src/features/group-buy/api/commission-rates.ts', 'utf-8'))
    const fn = cr.slice(cr.indexOf('export function calcInfluencerCommissionPct'))
    const body = fn.slice(0, fn.indexOf('\n}\n') + 3)
    expect(body).not.toContain('max_influencer_commission_pct')
  })
})
