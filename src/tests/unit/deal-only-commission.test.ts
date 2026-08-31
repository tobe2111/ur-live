/**
 * 🛑 2026-08-30 대표 확정 두 가지를 고정한다.
 *   ① *"자동분은 빼줘"* — 소개자 몫 = 매장이 합의한 딜 % 뿐. 플랫폼이 얹어 주던 자동분 없음.
 *   ② *"스위치를 켜긴 해도 필요하다면 계좌송금도 해줘야지"* — 딜/현금은 소개자 본인이 고르고
 *      (`influencer_balances.payout_method`) 두 경로 모두 살아 있어야 한다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 어드민 [처리] 버튼이 실제로 돈을 옮기는지(런타임),
 *   원천징수 금액의 정확성, D1 스키마에 `payout_method` 컬럼이 실재하는지.
 *   그건 staging 실결제(S8)에서만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'
import { calcInfluencerCommissionPct, DEAL_PCT_MAX, type CommissionRates } from '../../features/group-buy/api/commission-rates'

const RATES: CommissionRates = {
  platform_pct: 5, influencer_pct: 3, user_referral_bonus_pct: 0, agency_pct: 2,
  refund_window_days: 7, influencer_payout_min: 100000,
  seller_referral_bonus_pct: 1, seller_referral_bonus_months: 6,
  max_influencer_commission_pct: 2,
}

describe('① 자동분 제거 — 소개자 몫은 딜 % 뿐', () => {
  it('딜이 없으면 0 — 영입한 매장이어도 자동으로 안 붙는다', () => {
    expect(calcInfluencerCommissionPct(RATES, {
      is_referred_by_this_influencer: true, referral_bonus_active: true, deal_commission_pct: null,
    })).toBe(0)
  })

  it('딜이 있으면 딜 % 그대로 — 자동분이 더해지지도 max 로 겨루지도 않는다', () => {
    // 자동분이 살아 있으면 max(min(3+1,2)=2, 10) = 10 으로 같은 값이 나와 구분이 안 된다.
    // 그래서 자동분이 딜보다 **큰** 경우로 판정한다: 살아 있으면 2, 죽었으면 1.
    expect(calcInfluencerCommissionPct(RATES, {
      is_referred_by_this_influencer: true, referral_bonus_active: true, deal_commission_pct: 1,
    })).toBe(1)
  })

  it('max_influencer_commission_pct 는 딜을 자르지 못한다 (라이브 2 · 딜 10)', () => {
    expect(calcInfluencerCommissionPct(RATES, {
      is_referred_by_this_influencer: false, referral_bonus_active: false, deal_commission_pct: 10,
    })).toBe(10)
  })

  it('검증선 90 을 넘으면 90 으로 clamp · 음수는 0', () => {
    const ctx = { is_referred_by_this_influencer: false, referral_bonus_active: false }
    expect(calcInfluencerCommissionPct(RATES, { ...ctx, deal_commission_pct: 200 })).toBe(DEAL_PCT_MAX)
    expect(calcInfluencerCommissionPct(RATES, { ...ctx, deal_commission_pct: -5 })).toBe(0)
  })
})

describe('① 제안 문이 정산과 같은 값을 쓴다', () => {
  const src = codeOnly(readFileSync('src/features/group-buy/api/marketing.routes.ts', 'utf-8'))

  it('propose 양방향이 DEAL_PCT_MAX 로 검증한다', () => {
    // 제안이 2 로 막히면 계약 자체가 성립 못 해 정산 쪽 90 이 죽은 코드가 된다.
    expect(src.match(/pct > DEAL_PCT_MAX/g) || []).toHaveLength(2)
  })

  it('propose 가 max_influencer_commission_pct 를 다시 읽지 않는다', () => {
    expect(src).not.toContain('max_influencer_commission_pct')
  })

  it('90 을 리터럴로 재선언하지 않는다 — SSOT 한 곳', () => {
    expect(codeOnly(readFileSync('src/features/group-buy/api/commission-rates.ts', 'utf-8')))
      .toContain('export const DEAL_PCT_MAX = 90')
  })
})

describe('② 딜/현금 선택 — 두 경로 모두 살아 있다', () => {
  const cron = codeOnly(readFileSync('src/worker/cron/influencer-payout.ts', 'utf-8'))

  it('cron 이 payout_method 를 읽는다', () => {
    expect(cron).toContain('payout_method')
    expect(cron).toContain("=== 'deal'")
  })

  it('딜 수령자는 계좌 누락으로 보류되지 않는다', () => {
    // 회귀 모습: `if (!bank_name || ...)` 가 wantsDeal 가드 없이 되돌아오는 것.
    const guard = cron.match(/if \(!wantsDeal && \(!inf\.bank_name/)
    expect(guard, 'missingBank 가드에 wantsDeal 예외가 있어야 한다').toBeTruthy()
  })

  it('현금 경로의 원천징수는 그대로 남아 있다', () => {
    // ⚠️ 2026-08-31: 원천징수 계산이 cron · 라우트 · 어드민 화면 **세 곳**에 중복돼 있어서
    //   `shared/influencer-payout-math.ts` SSOT 로 모았다. 그래서 cron 안에서 상수를 직접
    //   찾던 옛 검사는 더 이상 맞지 않는다 — **의도(현금 경로에 원천징수가 살아 있다)는 그대로**
    //   두고, 그 의도를 SSOT 경유로 검사한다(오히려 세 곳이 갈리는 것까지 막는다).
    const math = codeOnly(readFileSync('src/shared/influencer-payout-math.ts', 'utf-8'))
    expect(cron, 'cron 이 현금 내역을 SSOT 로 계산해야 한다').toContain('computeCashPayout(')
    expect(math).toContain('WITHHOLDING_RATES.business_income')
    expect(math).toContain('WITHHOLDING_RATES.other_income')
    // 그리고 그 결과가 실제로 알림에 실려야 한다(계산만 하고 안 쓰면 의미가 없다).
    expect(cron).toContain('withholding')
    expect(cron).toContain('netAmount')
  })

  it('cron 이 직접 딜을 적립하지 않는다 — 지급은 어드민 [처리]', () => {
    // 2026-08-30 오전에 여기에 adjustUserPoints 적립 블록을 넣었다가 되돌렸다.
    // 유상 버킷 적립은 [현금→딜→재출금] 세탁 루프를 연다(2026-07-05 에 닫은 것).
    expect(cron).not.toContain('adjustUserPoints')
    expect(cron).not.toContain('creditFreePoints')
  })

  it('어드민 지급 경로가 딜은 무상 버킷 + 보너스로 준다', () => {
    // ⚠️ 2026-08-31: 지급 처리는 파일크기 래칫 때문에 `marketing/payouts.ts` 로 이동했다(로직 불변).
    const mk = codeOnly(readFileSync('src/features/group-buy/api/marketing/payouts.ts', 'utf-8'))
    expect(mk).toContain('creditFreePoints')
    expect(mk).toContain('influencer_deal_bonus_pct')
  })
})
