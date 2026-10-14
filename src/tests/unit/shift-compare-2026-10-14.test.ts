/**
 * 📐 밀림 대조가 같은 글자의 **다른 요소**를 짝짓지 않는다 (2026-10-14 · PR #1784 CI 거짓 빨간불)
 *
 * 교환권 화면: 로딩 중 "교환권" 은 하단 탭 하나 → 다 그리면 맨 위 제목도 "교환권". 첫 번째만 보던 대조가
 * 탭 라벨이 812px 올라간 것으로 읽었다. 이제 같은 글자는 위치를 전부 모으고 개수가 같을 때만 짝짓는다.
 *   ① 진짜 밀림은 여전히 잡는다(유일한 글자 · 같은 개수의 여러 글자)
 *   ② 같은 글자가 하나 더 생긴 것은 밀림이 아니다
 *   ③ 하네스가 이 함수를 쓴다(측정기 두 벌 금지)
 * ⚠️ 못 보는 것: 같은 글자가 생기면서 **동시에** 기존 것이 밀린 경우(개수가 달라 판정 보류).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { compareSnaps } from '../../../scripts/shift-compare.mjs'

describe('① 진짜 밀림', () => {
  it('유일한 글자가 보이는 곳에서 움직이면 잡는다', () => {
    const r = compareSnaps({ vh: 844, pos: { 카드: [300] } }, { pos: { 카드: [500] } })
    expect(r.movedVisible).toBe(1)
  })
  it('같은 글자가 여럿이어도 개수가 같으면 순서대로 대조한다', () => {
    const r = compareSnaps({ vh: 844, pos: { 가격: [100, 400] } }, { pos: { 가격: [100, 640] } })
    expect(r.movedVisible).toBe(1)
    expect(r.moved[0]).toContain('400→640')
  })
  it('화면 밖 이동은 보이는 곳으로 안 센다', () => {
    const r = compareSnaps({ vh: 844, pos: { 푸터: [1500] } }, { pos: { 푸터: [1700] } })
    expect(r.movedVisible).toBe(0)
    expect(r.moved).toHaveLength(1)
  })
})

describe('② 같은 글자가 하나 더 생긴 것', () => {
  it('하단 탭 "교환권" + 새 제목 "교환권" 은 밀림이 아니다', () => {
    const r = compareSnaps({ vh: 844, pos: { 교환권: [820] } }, { pos: { 교환권: [8, 820] } })
    expect(r.movedVisible).toBe(0)
    expect(r.moved).toEqual([])
  })
  it('사라진 글자·생긴 글자는 따로 센다', () => {
    const r = compareSnaps({ vh: 844, pos: { 로딩: [400] } }, { pos: { 완료: [400] } })
    expect(r.gone).toEqual(['로딩'])
    expect(r.born).toEqual(['완료'])
  })
})

describe('③ 하네스 배선', () => {
  const src = readFileSync('scripts/visual-preview.mjs', 'utf8')
  it('스냅이 같은 글자의 위치를 전부 담는다', () => {
    expect(src).toMatch(/m\.get\(s\)\.push\(Math\.round\(r\.top \+ window\.scrollY\)\)/)
  })
  it('판정은 compareSnaps 한 곳이다', () => {
    expect(src).toMatch(/import \{ compareSnaps \} from '\.\/shift-compare\.mjs'/)
    expect(src).toMatch(/= compareSnaps\(a, b\)/)
  })
})
