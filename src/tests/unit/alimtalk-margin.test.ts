/**
 * 💰 2026-08-10 알림톡 마진 — 불변식.
 *
 * 이 테스트가 지키는 것은 "숫자가 맞다"가 아니라 **거짓말을 안 한다**이다.
 * 고치기 전 어드민은 `발송건수 × 하드코딩 9원` 을 "수익"이라고 표시했다 — 원가를 빼지 않았으니
 * 그건 매출(그것도 추정)이었다. 마진을 보고 값을 정하는 순간 그 오표시는 잘못된 가격 결정이 된다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것: 어드민이 원가를 실제와 다르게 입력하는 것(사람의 입력값).
 *   그건 코드가 알 수 없다 — 알리고 요금제가 바뀌면 사람이 갱신해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  computeAlimtalkMargin, packageUnitPrice, packageMarginPct, parseUnitCost,
  DEFAULT_ALIMTALK_UNIT_COST_KRW,
} from '@/shared/alimtalk-pricing'

describe('computeAlimtalkMargin — 매출과 원가는 다른 곳에서 온다', () => {
  it('마진 = 매출 − 원가 (원가는 발송건수 × 단가)', () => {
    // 100만원 충전, 10만건 발송, 원가 6.5원 → 원가 65만, 마진 35만(35%)
    const m = computeAlimtalkMargin(1_000_000, 100_000, 6.5)
    expect(m.revenue).toBe(1_000_000)
    expect(m.cost).toBe(650_000)
    expect(m.margin).toBe(350_000)
    expect(m.marginPct).toBe(35)
  })

  it('🔴 원가보다 싸게 팔면 마진이 음수로 그대로 나온다 — 숨기지 않는다', () => {
    const m = computeAlimtalkMargin(50_000, 10_000, 6.5)
    expect(m.cost).toBe(65_000)
    expect(m.margin).toBe(-15_000)
    expect(m.marginPct).toBeLessThan(0)
  })

  it('매출 0 이면 마진율은 0 — 0 으로 나누지 않는다', () => {
    expect(computeAlimtalkMargin(0, 1000, 6.5).marginPct).toBe(0)
  })

  it('소수점 원가를 반올림해 버리지 않는다 (6.5원 × 1만건 = 65,000원)', () => {
    // 정수로 깎으면(6원) 6만원 — 1만건에 5천원이 틀어진다. 원가는 실수로 다뤄야 한다.
    expect(computeAlimtalkMargin(0, 10_000, 6.5).cost).toBe(65_000)
  })

  it('음수·NaN 입력은 0 으로 눕힌다(표시가 깨지지 않게)', () => {
    const m = computeAlimtalkMargin(Number.NaN, -5, Number.NaN)
    expect(m).toEqual({ revenue: 0, cost: 0, margin: 0, marginPct: 0 })
  })
})

describe('parseUnitCost — 잘못 저장된 값이 마진을 뒤집지 않게', () => {
  it('정상값은 그대로', () => {
    expect(parseUnitCost('6.5', 9)).toBe(6.5)
  })
  it('빈값·문자·음수·비상식값(자릿수 오타)은 폴백', () => {
    // '' 은 특히 중요 — Number('')===0 이라 범위검사를 통과해 원가 0(마진 100%)이 되던 버그를 CI 가 잡았다.
    for (const bad of ['', '  ', 'abc', '-1', '0', '6500', null, undefined]) {
      expect(parseUnitCost(bad, DEFAULT_ALIMTALK_UNIT_COST_KRW)).toBe(DEFAULT_ALIMTALK_UNIT_COST_KRW)
    }
  })
})

describe('패키지 단가·마진율', () => {
  it('1,000건 9,000원 = 건당 9원, 원가 6.5원이면 마진 27.8%', () => {
    expect(packageUnitPrice(9000, 1000)).toBe(9)
    expect(packageMarginPct(9000, 1000, 6.5)).toBe(27.8)
  })
  it('credits 0 이면 0 — 나누기 사고 방지', () => {
    expect(packageUnitPrice(9000, 0)).toBe(0)
    expect(packageMarginPct(9000, 0, 6.5)).toBe(0)
  })
})

describe('배선 — 어드민이 매출을 원가라고 부르지 않는다', () => {
  const api = readFileSync('src/features/admin/api/admin-streams.routes.ts', 'utf8').replace(/\/\/[^\n]*/g, '')
  it('통계가 하드코딩 9원을 더는 쓰지 않는다', () => {
    expect(api).not.toMatch(/total_cost:\s*\([^)]*\)\s*\*\s*9/)
    expect(api).toContain('computeAlimtalkMargin(')
  })
  it('원가는 platform_settings 에서 읽는다(코드 상수 고정이 아니다)', () => {
    expect(api).toContain('FROM platform_settings')
    expect(api).toContain('readAlimtalkUnitCosts')
  })
  it('🔴 무결제 충전 경로가 잔액을 올리지 않는다', () => {
    const legacy = readFileSync('src/features/seller/api/seller-alimtalk-mgmt.routes.ts', 'utf8')
    const i = legacy.indexOf("post('/alimtalk/charge'")
    expect(i).toBeGreaterThan(-1)
    // 핸들러 본문에 balance 증가가 남아 있으면 구멍이 되살아난 것.
    const body = legacy.slice(i, i + 1200)
    expect(body).not.toMatch(/balance\s*=\s*balance\s*\+/)
    expect(body).toContain('410')
  })
})
