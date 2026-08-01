import { describe, it, expect } from 'vitest'
import { planKeywordSplit, FOCUS_CATEGORIES, PRIORITY_CATEGORIES } from '@/features/marketing/api/influencer-keyword-rotation'
import { CLASSIFIED_CATEGORIES } from '@/features/marketing/api/influencer-classify'

/**
 * 🎯 **집중 축 전용 슬롯** (2026-08-02 대표 "C안" 확정).
 *
 *   마케팅대행사는 리드 1건이 **매장 N건으로 곱해지는** 유일한 축인데, 우선 풀(3/4)에 얹으면
 *   7분의 1만 받아 몇 주가 걸린다. 그래서 배치의 1/4을 통째로 뗀다.
 *
 *   ⚠️ **자기 반납이 이 설계의 핵심이다.** 대행사 키워드가 고갈되면(무수확 누적 → 자동 비활성)
 *   전용 슬롯은 스스로 0이 되고 그 몫이 우선/일반으로 돌아간다. 이게 없으면 다 훑은 뒤에도
 *   1/4을 영원히 낭비한다 — 아래 검사가 그 성질을 고정한다.
 *   ⚠️ 이 테스트가 못 보는 것: 1/4이라는 **비중이 타당한지**(라이브 수율은 코드 밖 사실이다).
 *   비중을 바꿀 땐 `FOCUS_SHARE` 주석의 근거도 함께 갱신할 것.
 */
describe('planKeywordSplit — 집중/우선/일반 3분할', () => {
  it('🔒 집중 축이 몫(1/4)을 먼저 가져간다', () => {
    const r = planKeywordSplit(16, 10, 100, 100)
    expect(r.nFocus).toBe(4)
    expect(r.nFocus + r.nPri + r.nGen).toBe(16)
  })

  it('🔒 집중 축이 비면 슬롯을 **반납**한다 — 다 훑은 뒤 1/4을 낭비하지 않는다', () => {
    const r = planKeywordSplit(16, 0, 100, 100)
    expect(r.nFocus).toBe(0)
    expect(r.nFocus + r.nPri + r.nGen).toBe(16) // 총량 유지 = 반납분이 다른 풀로 갔다
  })

  it('🔒 가용분보다 많이 배정하지 않는다 — 같은 키워드를 한 배치에 두 번 넣지 않게', () => {
    const r = planKeywordSplit(16, 2, 3, 4)
    expect(r.nFocus).toBeLessThanOrEqual(2)
    expect(r.nPri).toBeLessThanOrEqual(3)
    expect(r.nGen).toBeLessThanOrEqual(4)
  })

  it('🔒 슬롯을 버리지 않는다 — total 과 가용합계 중 작은 쪽만큼 꽉 채운다', () => {
    for (const [t, f, p, g] of [[16, 2, 3, 4], [16, 10, 100, 100], [4, 0, 1, 0], [20, 5, 5, 5], [8, 8, 0, 0]] as const) {
      const r = planKeywordSplit(t, f, p, g)
      expect(r.nFocus + r.nPri + r.nGen, `total=${t} f=${f} p=${p} g=${g}`).toBe(Math.min(t, f + p + g))
    }
  })

  it('🐛 이상값(음수·NaN)에도 음수 몫이 안 나온다', () => {
    for (const [t, f, p, g] of [[-5, 1, 1, 1], [Number.NaN, 1, 1, 1], [10, -1, Number.NaN, 5]] as const) {
      const r = planKeywordSplit(t as number, f as number, p as number, g as number)
      for (const v of [r.nFocus, r.nPri, r.nGen]) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('📌 집중 축은 분류기가 실제로 만드는 카테고리다 — 오타면 영원히 빈 풀이고 아무도 모른다', () => {
    for (const c of FOCUS_CATEGORIES) expect(CLASSIFIED_CATEGORIES).toContain(c)
  })

  it('🔒 집중 축과 우선 풀은 겹치지 않는다 — 겹치면 같은 키워드가 한 배치에 두 번 들어간다', () => {
    expect(FOCUS_CATEGORIES.filter(c => PRIORITY_CATEGORIES.includes(c))).toEqual([])
  })
})

/** 🔌 배선 잠금 — 순수함수만 테스트하면 "함수는 있는데 부르는 곳이 없는" 사고를 못 잡는다. */
describe('배선 — 수집 루프가 3분할을 실제로 쓴다', () => {
  it('🔒 planKeywordSplit 로 배분하고 세 풀이 서로 배타다', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
    expect(src).toMatch(/const \{ nFocus, nPri, nGen \} = planKeywordSplit\(/)
    expect(src).toMatch(/const focusPool = kws\.filter\(inFocus\)/)
    // 우선/일반 풀이 집중 축을 제외해야 배타가 성립한다.
    expect(src).toMatch(/priPool = kws\.filter\(k => !inFocus\(k\)/)
    expect(src).toMatch(/genPool = kws\.filter\(k => !inFocus\(k\)/)
    expect(src).toMatch(/focus_n: nFocus/)   // 밖에서 "대행사를 돌고 있나"를 볼 수 있어야 한다
  })
})
