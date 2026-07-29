import { describe, it, expect } from 'vitest'
import {
  computeCommissionBudget,
  allocateCommissions,
  assertCommissionBudgetInvariants,
  DEFAULT_PG_RESERVE_PCT,
} from '../../worker/utils/commission-budget'

/**
 * [INV-CB] 커미션 예산 아비터 불변식 테스트 (docs/design/commission-funding-restructure.md).
 * 순수 함수라 D1 불필요 — 이 테스트가 불변식을 영구히 지킨다.
 */

describe('computeCommissionBudget', () => {
  it('예산 = 플랫폼 수수료 − PG 준비금', () => {
    // 10,000원 · fee 5% = 500 · PG 2.5% = 250 → 예산 250
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 500, pgReservePct: 2.5 })).toBe(250)
  })
  it('PG 준비금이 수수료를 초과하면 0 (음수 금지)', () => {
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 200, pgReservePct: 2.5 })).toBe(0)
  })
  it('1P(수수료 0) → 예산 0', () => {
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 0, pgReservePct: 2.5 })).toBe(0)
  })
  it('비정상 pgReservePct 는 기본값 폴백', () => {
    const withDefault = computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 500, pgReservePct: DEFAULT_PG_RESERVE_PCT })
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 500, pgReservePct: NaN })).toBe(withDefault)
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 500, pgReservePct: -1 })).toBe(withDefault)
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 500, pgReservePct: 999 })).toBe(withDefault)
  })
  it('기본 PG 준비금 = 2.75% (VAT 포함 실측, 2026-07-12 flip 준비)', () => {
    expect(DEFAULT_PG_RESERVE_PCT).toBe(2.75)
    // 10,000원 · fee 5% = 500 · PG 2.75% = 275 → 예산 225
    expect(computeCommissionBudget({ amountKrw: 10000, platformFeeKrw: 500, pgReservePct: DEFAULT_PG_RESERVE_PCT })).toBe(225)
  })
  it('음수/NaN 입력은 0 처리', () => {
    expect(computeCommissionBudget({ amountKrw: -5, platformFeeKrw: NaN, pgReservePct: 2.5 })).toBe(0)
  })
})

describe('allocateCommissions', () => {
  it('Σ요청 ≤ 예산 → 전액 지급', () => {
    const grants = allocateCommissions(
      [{ key: 'a', amountKrw: 100 }, { key: 'b', amountKrw: 150 }],
      250,
    )
    expect(grants.map(g => g.grantedKrw)).toEqual([100, 150])
    assertCommissionBudgetInvariants(grants, 250)
  })

  it('초과 시 비례 축소 + Σgranted ≤ budget 정확 보장', () => {
    // 요청 2000+1500+1000=4500, 예산 2500 → scale 5/9
    const grants = allocateCommissions(
      [
        { key: 'affiliate', amountKrw: 2000 },
        { key: 'influencer_intro', amountKrw: 1500 },
        { key: 'agency_intro', amountKrw: 1000 },
      ],
      2500,
    )
    const sum = grants.reduce((s, g) => s + g.grantedKrw, 0)
    expect(sum).toBeLessThanOrEqual(2500)
    expect(sum).toBeGreaterThanOrEqual(2498) // largest-remainder 로 예산을 거의 소진
    for (const g of grants) {
      expect(g.grantedKrw).toBeLessThanOrEqual(g.requestedKrw)
      expect(g.grantedKrw).toBeGreaterThanOrEqual(0)
    }
    // 비례성: 큰 요청이 더 많이 받음
    expect(grants[0].grantedKrw).toBeGreaterThan(grants[1].grantedKrw)
    expect(grants[1].grantedKrw).toBeGreaterThan(grants[2].grantedKrw)
    assertCommissionBudgetInvariants(grants, 2500)
  })

  it('예산 0 → 전부 0', () => {
    const grants = allocateCommissions([{ key: 'a', amountKrw: 100 }], 0)
    expect(grants[0].grantedKrw).toBe(0)
    assertCommissionBudgetInvariants(grants, 0)
  })

  it('빈 요청 → 빈 결과', () => {
    expect(allocateCommissions([], 100)).toEqual([])
  })

  it('1원 반올림 잔여 분배 — granted 가 requested 를 절대 초과하지 않음', () => {
    // 예산 100, 요청 [1,1,1,300] → scale 100/303
    const grants = allocateCommissions(
      [
        { key: 'a', amountKrw: 1 },
        { key: 'b', amountKrw: 1 },
        { key: 'c', amountKrw: 1 },
        { key: 'd', amountKrw: 300 },
      ],
      100,
    )
    const sum = grants.reduce((s, g) => s + g.grantedKrw, 0)
    expect(sum).toBeLessThanOrEqual(100)
    for (const g of grants) expect(g.grantedKrw).toBeLessThanOrEqual(g.requestedKrw)
    assertCommissionBudgetInvariants(grants, 100)
  })

  it('음수/NaN 요청은 0 으로 정규화', () => {
    const grants = allocateCommissions(
      [{ key: 'a', amountKrw: -50 }, { key: 'b', amountKrw: NaN }, { key: 'c', amountKrw: 100 }],
      60,
    )
    expect(grants[0].grantedKrw).toBe(0)
    expect(grants[1].grantedKrw).toBe(0)
    expect(grants[2].grantedKrw).toBe(60)
    assertCommissionBudgetInvariants(grants, 60)
  })

  it('결정적 — 같은 입력은 같은 출력', () => {
    const input: Parameters<typeof allocateCommissions> = [
      [{ key: 'x', amountKrw: 777 }, { key: 'y', amountKrw: 333 }],
      500,
    ]
    expect(allocateCommissions(...input)).toEqual(allocateCommissions(...input))
  })

  it('무작위 폭넓은 입력에서도 불변식 유지 (property-ish)', () => {
    // 결정적 의사난수(시드 고정) — Math.random 금지 환경 무관 로컬 LCG
    let seed = 42
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(rnd() * 5)
      const reqs = Array.from({ length: n }, (_, i) => ({ key: `k${i}`, amountKrw: Math.floor(rnd() * 5000) }))
      const budget = Math.floor(rnd() * 3000)
      const grants = allocateCommissions(reqs, budget)
      expect(() => assertCommissionBudgetInvariants(grants, budget)).not.toThrow()
      const total = reqs.reduce((s, r) => s + r.amountKrw, 0)
      const sum = grants.reduce((s, g) => s + g.grantedKrw, 0)
      if (total <= budget) expect(sum).toBe(total) // 여유 시 전액
    }
  })
})

describe('allocateCommissions — priorityKeys (Q10 에이전시 1% 보호 최우선)', () => {
  it('우선 축은 예산에서 먼저 전액 — 나머지가 잔여를 비례 배분', () => {
    // 예산 250: agency 100 선배정 → 잔여 150 을 aff 2000 : inf 1000 = 2:1 비례
    const grants = allocateCommissions(
      [
        { key: 'affiliate', amountKrw: 2000 },
        { key: 'influencer_intro', amountKrw: 1000 },
        { key: 'agency_intro', amountKrw: 100 },
      ],
      250,
      { priorityKeys: ['agency_intro'] },
    )
    const g = (k: string) => grants.find(x => x.key === k)!.grantedKrw
    expect(g('agency_intro')).toBe(100)
    expect(g('affiliate') + g('influencer_intro')).toBeLessThanOrEqual(150)
    expect(g('affiliate')).toBeGreaterThan(g('influencer_intro'))
    assertCommissionBudgetInvariants(grants, 250)
  })

  it('우선 축 요청이 예산 초과면 예산까지만 (Σ ≤ budget 유지)', () => {
    const grants = allocateCommissions(
      [{ key: 'affiliate', amountKrw: 500 }, { key: 'agency_intro', amountKrw: 400 }],
      300,
      { priorityKeys: ['agency_intro'] },
    )
    const g = (k: string) => grants.find(x => x.key === k)!.grantedKrw
    expect(g('agency_intro')).toBe(300)
    expect(g('affiliate')).toBe(0)
    assertCommissionBudgetInvariants(grants, 300)
  })

  it('여유 예산이면 priorityKeys 무관 전액 (기존 동작 보존)', () => {
    const withPrio = allocateCommissions(
      [{ key: 'a', amountKrw: 100 }, { key: 'agency_intro', amountKrw: 50 }],
      500,
      { priorityKeys: ['agency_intro'] },
    )
    expect(withPrio.map(g => g.grantedKrw)).toEqual([100, 50])
  })

  it('priorityKeys 미전달 = 기존 비례 배분과 byte-동일', () => {
    const reqs = [{ key: 'x', amountKrw: 777 }, { key: 'y', amountKrw: 333 }]
    expect(allocateCommissions(reqs, 500, {})).toEqual(allocateCommissions(reqs, 500))
    expect(allocateCommissions(reqs, 500, { priorityKeys: [] })).toEqual(allocateCommissions(reqs, 500))
  })

  it('property-ish: priority 모드에서도 불변식 유지', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(rnd() * 5)
      const keys = ['affiliate', 'multi_tier', 'influencer_intro', 'agency_intro', 'etc']
      const reqs = Array.from({ length: n }, (_, i) => ({ key: keys[i], amountKrw: Math.floor(rnd() * 5000) }))
      const budget = Math.floor(rnd() * 3000)
      const grants = allocateCommissions(reqs, budget, { priorityKeys: ['agency_intro'] })
      expect(() => assertCommissionBudgetInvariants(grants, budget)).not.toThrow()
      // 우선 축은 min(요청, 예산) 보장
      const ag = grants.find(g => g.key === 'agency_intro')
      if (ag) expect(ag.grantedKrw).toBe(Math.min(ag.requestedKrw, budget))
    }
  })
})

describe('assertCommissionBudgetInvariants', () => {
  it('초과 지급 조작 시 throw (fail-closed 신호)', () => {
    expect(() =>
      assertCommissionBudgetInvariants([{ key: 'a', requestedKrw: 100, grantedKrw: 101 }], 200),
    ).toThrow(/granted > requested/)
    expect(() =>
      assertCommissionBudgetInvariants(
        [
          { key: 'a', requestedKrw: 100, grantedKrw: 100 },
          { key: 'b', requestedKrw: 100, grantedKrw: 100 },
        ],
        150,
      ),
    ).toThrow(/sum\(granted\) > budget/)
  })
})
