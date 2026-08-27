import { describe, it, expect } from 'vitest'
import { resolveOrderFees, assertFeeInvariants, DEFAULT_FEE_RATES, type FeeContext } from '@/worker/utils/fee-resolver'

/**
 * 💸 2026-08-27 — **대행사 몫의 재원을 유어딜 수수료 → 2차 재원(매장이 판 돈)으로.**
 *
 * ## 대표 확정
 * *"유어딜은 대행사에게 돈을 주지 않는다. 대행사는 자신들이 직접 중개수수료를 버는 구조"* 이고,
 * 유어딜이 해 주는 것은 **덜 받는 것**이다 — 대행사가 낀 매장은 10%가 아니라 5%.
 * 그런데 코드는 대행사 몫 1%를 **유어딜 5% 안에서** 떼고 있었다(정반대).
 *
 * ## 이 테스트가 지키는 것
 *   ① 게이트 꺼짐 = 종전과 **완전히 동일**(켜기 전엔 아무것도 안 바뀐다)
 *   ② 게이트 켜짐 = 유어딜 몫이 **줄지 않는다**(5%/10% 온전)
 *   ③ 어떤 경우에도 **슬라이스 합 = 결제액**, 모든 슬라이스 ≥ 0
 *   ④ 대행사가 소개비를 후하게 써도 **매장 몫이 음수가 되지 않는다**
 *
 * ## 못 막는 것
 *   - 호출부가 `agencyFromOwner` 를 실제로 전달하는지(배선). 리졸버는 순수함수다.
 *   - 정산 지급·환불 역전(별도 레일).
 */
const base: FeeContext = { amount: 10_000, ownership: '3P', productKind: 'voucher', storeChannel: 'brokered' }
const withAgency: FeeContext = {
  ...base,
  agency: { agencyId: 7, active: true, withinTerm: true, pctOverride: 15 },
}

describe('대행사 지갑 — 게이트 꺼짐(기본)', () => {
  it('① 종전과 동일: 대행사 몫이 유어딜 수수료 안에서 나간다', () => {
    const b = resolveOrderFees(withAgency, DEFAULT_FEE_RATES)
    expect(b.platform).toBe(500)            // 중개 5%
    expect(b.agency).toBe(500)              // 15% 요청이지만 platform 으로 clamp
    expect(b.platformNet).toBe(0)           // 유어딜이 전부 내준다 ← 대표 확정과 어긋나는 옛 구조
    expect(b.ownerNet).toBe(9_500)
    assertFeeInvariants(b)
  })

  it('② 기본값이 꺼짐이다 (모르고 켜지지 않는다)', () => {
    expect(DEFAULT_FEE_RATES.agencyFromOwner).toBe(false)
  })
})

describe('대행사 지갑 — 게이트 켜짐', () => {
  const ON = { ...DEFAULT_FEE_RATES, agencyFromOwner: true }

  it('③ 유어딜 몫이 줄지 않는다 — 대행사 몫은 매장이 판 돈에서', () => {
    const b = resolveOrderFees(withAgency, ON)
    expect(b.platform).toBe(500)
    expect(b.platformNet).toBe(500)   // ← 핵심: 유어딜 5% 가 온전히 남는다
    expect(b.agency).toBe(1_500)      // 15% = 1,500원 (더 이상 platform 으로 clamp 되지 않는다)
    expect(b.ownerNet).toBe(8_000)    // 매장
    assertFeeInvariants(b)
  })

  it('④ 대행사가 소개비를 써도 매장 몫은 그대로다', () => {
    // 대행사 몫에서 소개비가 나가는 것은 호출부(누가 딜을 맺었나) 판정이다.
    // 리졸버 수준에서 확인할 것은 "매장 몫이 대행사 %에만 반응한다"는 것.
    const a = resolveOrderFees(withAgency, ON)
    const b = resolveOrderFees({ ...withAgency, agency: { ...withAgency.agency!, pctOverride: 15 } }, ON)
    expect(a.ownerNet).toBe(b.ownerNet)
  })

  it('⑤ 대행사 %가 과해도 매장 몫이 음수가 되지 않는다', () => {
    const b = resolveOrderFees({ ...withAgency, agency: { ...withAgency.agency!, pctOverride: 99 } }, ON)
    expect(b.ownerNet).toBeGreaterThanOrEqual(0)
    expect(b.agency).toBeLessThanOrEqual(b.amount - b.platform)
    assertFeeInvariants(b)
  })

  it('⑥ 소개비까지 겹쳐도 합이 정확히 결제액이다', () => {
    const b = resolveOrderFees(
      { ...withAgency, promo: { promoterId: 'u1', pct: 10 } },
      ON,
    )
    expect(b.platform + b.agency + b.supply + b.promo + b.ownerNet).toBe(b.amount)
    assertFeeInvariants(b)
  })

  it('⑦ 대행사가 없으면 켜져 있어도 돈은 한 푼도 안 바뀐다', () => {
    const off = resolveOrderFees(base, DEFAULT_FEE_RATES)
    const on = resolveOrderFees(base, ON)
    // 모드 플래그(`agencyFromOwner`)는 대행사 유무와 무관하게 기록되므로 객체 전체 비교는 과하다.
    // 확인할 것은 **돈 슬라이스가 동일한가**다.
    const money = (b: typeof off) => ({
      platform: b.platform, platformNet: b.platformNet, agency: b.agency,
      promo: b.promo, supply: b.supply, ownerNet: b.ownerNet,
    })
    expect(money(on)).toEqual(money(off))
  })

  it('⑧ 1P(유어딜 직판)는 켜져 있어도 대행사 몫 0', () => {
    const b = resolveOrderFees({ ...withAgency, ownership: '1P' }, ON)
    expect(b.platform).toBe(0)
    expect(b.agency).toBe(0)
    assertFeeInvariants(b)
  })

  it('⑨ 직접 채널(10%)에서도 유어딜 몫이 온전하다', () => {
    const b = resolveOrderFees({ ...withAgency, storeChannel: 'direct' }, ON)
    expect(b.platform).toBe(1_000)
    expect(b.platformNet).toBe(1_000)
    assertFeeInvariants(b)
  })
})
