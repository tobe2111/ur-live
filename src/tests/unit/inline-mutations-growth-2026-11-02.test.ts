/**
 * 🧊 옛 인라인 주입 배열을 늘리지 못하게 — **이 PR 의 차이**로 판정한다 (2026-11-02)
 *
 * 대표 *"단발적으로 문제 해결하지 말고 교훈삼아서 근본적으로 해결할 수 있는게 있으면 해결해줘."*
 *
 * 이 시험의 첫 판(`inline-mutations-frozen`)은 main 의 인라인 수를 고정 상수(977 → 979)와 견줬다.
 * 그 구조가 같은 날 main 을 세 번 막았다 — 근거 전문: scripts/check-inline-mutations-growth.mjs 머리말.
 * 그래서 판정은 Verify 단계(`check-inline-mutations-growth.mjs`, merge-base 와 비교)로 옮겼고,
 * 이 시험은 ① 판정 규칙 ② 셈이 실제로 센다 ③ 그 판정이 Verify 에 배선돼 있다 — 셋만 본다.
 * **main 의 절대값은 보지 않는다**(그게 경주로 main 을 막던 원인이다).
 *
 * ⚠️ 못 보는 것: 실제 PR 의 차이 — 그건 Verify 단계가 본다(단위 시험은 base 를 모른다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { countInline, judgeInlineGrowth } from '../../../scripts/check-inline-mutations-growth.mjs'

describe('옛 인라인 주입 배열 — 이 PR 이 늘렸는가', () => {
  it('① 늘리면 막는다', () => {
    expect(judgeInlineGrowth({ base: 979, head: 981 }).join('\n')).toMatch(/2건 더했다/)
    expect(judgeInlineGrowth({ base: 979, head: 980 })).toHaveLength(1)
  })

  it('① 그대로 두거나 줄이면 통과한다 — 상수를 따라 내릴 일이 없다', () => {
    expect(judgeInlineGrowth({ base: 979, head: 979 })).toEqual([])
    expect(judgeInlineGrowth({ base: 979, head: 950 })).toEqual([])
  })

  it('① 못 셌으면 통과가 아니다', () => {
    expect(judgeInlineGrowth({ base: -1, head: 979 })).toHaveLength(1)
    expect(judgeInlineGrowth({ base: 979, head: 0 })).toHaveLength(1)
  })

  it('② 셈이 실제 러너에서 무언가를 센다', () => {
    const n = countInline(readFileSync('scripts/check-guard-mutations.mjs', 'utf8'))
    expect(n, '`const MUTATIONS = [` 를 못 찾았다 — 러너 구조가 바뀌었으면 countInline 을 재조준할 것').toBeGreaterThan(100)
  })

  it('③ Verify 가 이 판정을 strict 로 돌린다', () => {
    const yml = readFileSync('.github/workflows/verify.yml', 'utf8')
    expect(yml).toMatch(/run: node scripts\/check-inline-mutations-growth\.mjs\n\s+continue-on-error: false/)
  })

  it('③ 고정 상수로 되돌아가지 않았다 — main 절대값 비교가 경주로 main 을 막았다', () => {
    const src = readFileSync('src/tests/unit/inline-mutations-growth-2026-11-02.test.ts', 'utf8')
    const forbidden = ['FROZEN', '_INLINE ='].join('')
    expect(src.includes(forbidden)).toBe(false)
  })
})
