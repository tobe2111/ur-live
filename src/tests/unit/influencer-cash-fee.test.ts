/**
 * 💰 인플루언서 현금 정산 수수료 (2026-08-31 대표 확정 방향).
 *
 * 확정된 것: 마진을 **상품에서 걷지 않고 현금 출구에서 걷는다.**
 *   교환권 마크업 0 · 딜 보너스 0 ⇒ **1딜 = 1원 고정** · 현금 수령에만 정산 수수료.
 *
 * 이 테스트가 막는 것:
 *   R1 `0` 을 falsy 로 삼켜 기본값으로 튕기는 것 (교환권 마진에서 실제로 난 사고).
 *   R2 기본값 0 — 머지만으로 라이브 정산이 바뀌지 않음.
 *   R3 계산 순서(수수료 → 원천징수) 고정.
 *   R4 원천징수 계산이 다시 여러 곳으로 흩어지는 것.
 *   R5 딜 수령에 수수료가 새는 것.
 *
 * ⚠️ 못 막는 것: 실제 은행 송금은 사람이 한다 — 이 값이 "얼마를 보내라"의 출처일 뿐,
 *   그 금액이 실제로 이체됐는지는 코드가 모른다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  computeCashPayout,
  resolveCashFeePct,
  resolveWithholdingPct,
  CASH_PAYOUT_FEE_DEFAULT_PCT,
} from '@/shared/influencer-payout-math'

describe('R1 — 수수료 0 은 유효값 (기본값으로 튕기지 않는다)', () => {
  it("'0' → 0", () => expect(resolveCashFeePct('0')).toBe(0))
  it('0 → 0', () => expect(resolveCashFeePct(0)).toBe(0))
  it('미설정 → 기본값', () => expect(resolveCashFeePct(undefined)).toBe(CASH_PAYOUT_FEE_DEFAULT_PCT))
  it('오염 → 기본값', () => expect(resolveCashFeePct('abc')).toBe(CASH_PAYOUT_FEE_DEFAULT_PCT))
  it('범위 clamp', () => {
    expect(resolveCashFeePct('-3')).toBe(0)
    expect(resolveCashFeePct('999')).toBe(50)
  })
  it('소스에 `|| 기본값` 폴백이 없다', () => {
    // ⚠️ 이 검사가 왜 동작 테스트로 안 되는가: 기본값이 **0** 이라
    //   `Number('0') || 0` 도 0, `Number('abc') || 0` 도 0 이다. 즉 `||` 로 잘못 써도
    //   결과가 전부 같아서 **동작으로는 구분이 안 된다**(주입 검증에서 실제로 통과했다).
    //   나중에 기본값이 0 이 아니게 되는 순간 조용히 깨지므로 소스로 고정한다.
    const src = readFileSync('src/shared/influencer-payout-math.ts', 'utf8')
    const body = src.slice(src.indexOf('export function resolveCashFeePct'))
    const fn = body.slice(0, body.indexOf('\n}'))
    expect(fn).toContain('Number.isFinite')
    expect(fn).not.toMatch(/\|\|\s*CASH_PAYOUT_FEE_DEFAULT_PCT/)
  })
})

describe('R2 — 기본값 0: 머지만으로 라이브 정산이 안 바뀐다', () => {
  it('기본 수수료는 0', () => expect(CASH_PAYOUT_FEE_DEFAULT_PCT).toBe(0))
  it('수수료 미설정 시 종전과 동일 — 사업자 100만원은 원천징수 3.3% 만', () => {
    const r = computeCashPayout({ gross: 1_000_000, businessNumber: '1234567890' })
    expect(r.fee).toBe(0)
    expect(r.withholdingPct).toBeCloseTo(3.3, 5)
    expect(r.withholding).toBe(33_000)
    expect(r.net).toBe(967_000)
  })
  it('비사업자 기타소득은 8.8%', () => {
    const r = computeCashPayout({ gross: 1_000_000, taxType: 'other_income' })
    expect(r.withholdingPct).toBeCloseTo(8.8, 5)
    expect(r.net).toBe(912_000)
  })
})

describe('R3 — 과세표준에서 수수료를 뺀다', () => {
  it('수수료 10% + 사업소득 3.3%', () => {
    const r = computeCashPayout({ gross: 1_000_000, businessNumber: '1234567890', feePct: 10 })
    expect(r.fee).toBe(100_000)          // 총액의 10%
    expect(r.taxableBase).toBe(900_000)  // 원천징수 대상 = 총액 - 수수료
    expect(r.withholding).toBe(29_700)   // 900,000 × 3.3%
    expect(r.net).toBe(870_300)
  })
  it('총액을 과세표준으로 보는 대안과 값이 다르다 (해석을 고정한다)', () => {
    // ⚠️ "수수료 먼저냐 원천징수 먼저냐"는 갈림이 아니다 — 둘 다 곱셈이라 순서가 결과를
    //   안 바꾼다. 갈리는 것은 **과세표준에서 수수료를 빼느냐** 다.
    const ours = computeCashPayout({ gross: 1_000_000, businessNumber: '1', feePct: 10 }).net
    const grossTaxed = 1_000_000 - Math.floor(1_000_000 * 0.033) - 100_000 // 867,000
    expect(ours).toBe(870_300)
    expect(ours).not.toBe(grossTaxed)
  })
  it('원천징수는 분수로 곱한다 — `rate*100/100` 의 1원 오차 방지', () => {
    // 0.088 * 100 = 8.799999999999999 → 옛 방식은 87,999 를 냈다.
    expect(computeCashPayout({ gross: 1_000_000, taxType: 'other_income' }).withholding).toBe(88_000)
  })
  it('총액 0 이면 전부 0', () => {
    const r = computeCashPayout({ gross: 0, feePct: 10 })
    expect([r.fee, r.withholding, r.net]).toEqual([0, 0, 0])
  })
  it('음수 총액은 0 으로 (환급을 지급으로 뒤집지 않는다)', () => {
    expect(computeCashPayout({ gross: -5000, feePct: 10 }).net).toBe(0)
  })
})

describe('R4 — 원천징수율 판정은 SSOT 하나', () => {
  it('사업자번호 있으면 3.3%', () => expect(resolveWithholdingPct(null, '123')).toBeCloseTo(3.3, 5))
  it('기타소득 8.8%', () => expect(resolveWithholdingPct('other_income', null)).toBeCloseTo(8.8, 5))
  it('무신고 0', () => expect(resolveWithholdingPct(null, null)).toBe(0))

  const SITES = [
    'src/worker/cron/influencer-payout.ts',
    'src/features/group-buy/api/marketing.routes.ts',
    'src/pages/AdminInfluencerPayoutsPage.tsx',
  ]
  /** 주석 제거 — 주석에만 남은 이름을 배선으로 오독하지 않는다(2026-08-01 교훈). */
  const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  // 화면은 **두 자리**에서 금액을 보여준다(확인창 + 목록 행). 존재만 보면 한쪽이
  //   자체 계산으로 회귀해도 나머지 한 호출 때문에 통과한다(주입 검증에서 실제로 그랬다).
  //   ⚠️ 두 자리를 하나로 합치는 리팩토링을 하면 이 숫자도 함께 줄일 것.
  const MIN_CALLS: Record<string, number> = { 'src/pages/AdminInfluencerPayoutsPage.tsx': 2 }

  for (const f of SITES) {
    it(`${f} 가 computeCashPayout 을 쓴다 (자리 수까지)`, () => {
      const code = codeOnly(readFileSync(f, 'utf8'))
      const calls = code.split('computeCashPayout(').length - 1
      expect(calls).toBeGreaterThanOrEqual(MIN_CALLS[f] ?? 1)
    })
    it(`${f} 에 자체 원천징수 계산이 없다`, () => {
      const code = codeOnly(readFileSync(f, 'utf8'))
      expect(code).not.toContain('WITHHOLDING_RATES.business_income')
      expect(code).not.toContain('WITHHOLDING_RATES.other_income')
    })
  }
})

describe('R5 — 딜 수령에는 수수료가 붙지 않는다', () => {
  it('지급 엔드포인트가 현금 경로에서만 내역을 계산한다', () => {
    const code = readFileSync('src/features/group-buy/api/marketing.routes.ts', 'utf8')
    // 딜 분기(`body.method === 'deal'`) 안에서 computeCashPayout 을 부르면 안 된다.
    const dealBlock = code.slice(code.indexOf("if (body.method === 'deal')"))
    const dealBody = dealBlock.slice(0, dealBlock.indexOf('\n  }\n'))
    expect(dealBody).not.toContain('computeCashPayout')
    expect(code).toContain("if (body.method !== 'deal')")
  })
  it('cron 은 딜 수령자를 현금 계산 전에 continue 한다', () => {
    const code = readFileSync('src/worker/cron/influencer-payout.ts', 'utf8')
    expect(code.indexOf('if (wantsDeal) {')).toBeLessThan(code.indexOf('computeCashPayout('))
  })
})
