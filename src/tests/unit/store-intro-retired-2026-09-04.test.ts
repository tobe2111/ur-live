/**
 * 🛑 2026-09-04 대표 *"2% 주는건 지금은 없는게 낫겠어"* — 크리에이터 매장영입 2%·1년 폐지.
 *
 * ## 왜 없앴나
 * **커미션 재원을 매장(promo)으로 통일**한다. 2026-07-08 대표 확정 원칙 —
 * *"유어딜 5%는 **어떤** 커미션에도 일절 안 쓴다"* — 의 **마지막 예외**가 이 축이었다.
 *
 * 데려온 사람의 몫은 이제 **매장이 스스로 거는 소개비**에서 나온다. 손님이 급한 매장은 많이 걸고,
 * 잘 되는 매장은 안 건다 — 유어딜이 2%로 못 박으면 모든 매장이 똑같아진다.
 *
 * ## 없애도 잃는 사람이 없다 (폐지 시점 라이브 실측)
 * 성장 커미션 **네 축 전부 지급 0건**: C1 핀/어필리에이트 0 · C2 멀티티어 0 · C3 영입 0 · C4 에이전시 0.
 * 영입자가 지정된 매장도 **0곳**. 즉 이 2%로 돈을 받은 사람이 **한 명도 없다**.
 *
 * ## 이 테스트가 못 막는 것
 * 정산·원장·cron 이 `influencer_attributions` 를 **읽는** 것은 그대로 둔다(과거 행 보호 —
 * 지금은 0행이지만 읽기 경로를 지우면 비대칭이 된다). 환불 역전
 * `reverseInfluencerStoreIntroOnRefund` 도 남긴다. 여기서 보는 것은 **새 적립이 0** 이라는 것뿐이다.
 *
 * 선례: `agency-intro-retired.test.ts`(2026-08-31 에이전시 1% 폐지) — 같은 형태로 맞춘다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const ORDERS = codeOnly(readFileSync('src/worker/utils/order-commissions.ts', 'utf-8'))
const SETTINGS = codeOnly(readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf-8'))

describe('크리에이터 매장영입 2% — 새 적립 경로가 없다', () => {
  it('오케스트레이터가 더 이상 적립을 호출하지 않는다', () => {
    expect(ORDERS).not.toContain('creditInfluencerStoreIntroCommission')
  })

  it('예산 요청에도 안 올린다', () => {
    // 요청만 올리고 적립을 안 하면 예산을 잡아만 두고 다른 축 몫이 사라진다(가장 조용한 손실).
    expect(ORDERS).not.toContain('computeInfluencerStoreIntroRequest')
    expect(ORDERS).not.toContain("key: 'influencer_intro'")
  })

  it("축 타입에서 'influencer_intro' 가 빠져 호출부가 컴파일로 막힌다", () => {
    const m = ORDERS.match(/export type CommissionAxis = ([^\n]+)/)
    expect(m, 'CommissionAxis 선언을 찾지 못했다').toBeTruthy()
    expect(m![1]).not.toContain('influencer_intro')
  })

  it('어드민 설정으로도 되살릴 수 없다', () => {
    const m = SETTINGS.match(/const COMMISSION_AXES = \[([^\]]*)\]/)
    expect(m, 'COMMISSION_AXES 선언을 찾지 못했다').toBeTruthy()
    expect(m![1]).not.toContain('influencer_intro')
  })
})

describe('환불 역전과 읽기 경로는 남아 있다 (비대칭 방지)', () => {
  const REFUND = codeOnly(readFileSync('src/worker/utils/order-refund.ts', 'utf-8'))
  it('환불 역전은 그대로 — 적립만 없앴다', () => {
    expect(REFUND, '역전을 함께 지우면 과거 행이 있을 때 복원이 안 된다')
      .toContain('reverseInfluencerStoreIntroOnRefund')
  })
})

describe('축 목록이 실제로 줄었다 — 검사가 헛돌지 않는지', () => {
  it('남은 축이 3개(affiliate·multi_tier·supplier)', () => {
    const m = ORDERS.match(/export type CommissionAxis = ([^\n]+)/)
    const axes = (m?.[1] ?? '').split('|').map(s => s.trim().replace(/'/g, '')).filter(Boolean)
    expect(axes.sort()).toEqual(['affiliate', 'multi_tier', 'supplier'])
  })
})
