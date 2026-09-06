import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { deferSeeded, seededSectionProductIds, readHomeSectionsSeed } from '@/shared/home-section-ids'

/**
 * 🖼️ 2026-09-06 (대표 — "메인에서 이용권의 똑같은 사진이 두 번 나오는 경우가 있는데")
 *
 * 앞선 수정(#1366)은 **섹션끼리**의 겹침만 없앴다. 라이브 실측으로 나머지 절반이 남아 있었다:
 * 섹션 8개 상품이 **전부** 아래 피드에도 있었고, 그중 4개는 피드 앞 14번 안이라
 * 스크롤을 조금만 내리면 같은 카드가 다시 나왔다.
 *
 * 처방은 **제거가 아니라 미루기**다. 피드는 *전체* 목록이라 여기서 빼면 목록이 거짓말이 된다.
 */

const seed = (data: unknown) => {
  ;(globalThis as { document?: unknown }).document = {
    getElementById: (id: string) =>
      id === '__SSR_INITIAL_SECTIONS__' ? { textContent: typeof data === 'string' ? data : JSON.stringify(data) } : null,
  }
}
const noSeed = () => {
  ;(globalThis as { document?: unknown }).document = { getElementById: () => null }
}

const P = (id: number) => ({ id, name: `p${id}` })

describe('홈 피드 — 섹션에 뜬 것은 뒤로, 빼지는 않는다', () => {
  it('섹션 상품이 밴드 뒤로 간다', () => {
    const band = [P(1), P(2), P(3), P(4), P(5)]
    const out = deferSeeded(band, new Set([2, 4]))
    expect(out.map(p => p.id)).toEqual([1, 3, 5, 2, 4])
  })

  it('개수와 구성원이 그대로다 — 목록에서 사라지면 안 된다', () => {
    const band = [P(1), P(2), P(3), P(4), P(5)]
    const out = deferSeeded(band, new Set([1, 2, 3]))
    expect(out).toHaveLength(band.length)
    expect(new Set(out.map(p => p.id))).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('두 묶음 안의 상대 순서는 보존된다(정렬 칩의 의미가 유지된다)', () => {
    const band = [P(9), P(1), P(8), P(2), P(7)]
    const out = deferSeeded(band, new Set([1, 2]))
    expect(out.map(p => p.id)).toEqual([9, 8, 7, 1, 2]) // 9,8,7 순서 유지 · 1,2 순서 유지
  })

  it('섹션 집합이 비면 입력과 같은 순서 — 홈이 아닌 표면·콜드 진입은 종전 동작', () => {
    const band = [P(3), P(1), P(2)]
    expect(deferSeeded(band, new Set()).map(p => p.id)).toEqual([3, 1, 2])
  })

  it('전부 섹션 상품이어도 순서만 유지된 채 그대로 남는다', () => {
    const band = [P(1), P(2)]
    expect(deferSeeded(band, new Set([1, 2])).map(p => p.id)).toEqual([1, 2])
  })

  it('id 가 없거나 숫자가 아닌 행은 앞쪽에 그대로 둔다(미루기 대상이 아니다)', () => {
    const band = [{ id: null }, { id: 'x' as unknown as number }, P(1)]
    const out = deferSeeded(band as { id?: number | string | null }[], new Set([1]))
    expect(out.map(p => p.id)).toEqual([null, 'x', 1])
  })

  /**
   * 🔴 이 검사가 이 파일의 핵심이다. 밴드 경계를 넘겨 미루면 **나중 페이지가 로드될 때
   * 이미 그려진 카드가 움직인다** — 2026-07-16 대표 신고("스크롤하면 배치가 제멋대로")의 재발.
   */
  it('밴드 경계를 넘지 않는다 — page2 가 와도 page1 의 순서가 그대로다', () => {
    const ids = new Set([2])
    const page1 = [P(1), P(2), P(3)]
    const page2 = [P(4), P(5)]
    const before = deferSeeded(page1, ids).map(p => p.id)
    const after = [...deferSeeded(page1, ids), ...deferSeeded(page2, ids)].map(p => p.id)
    expect(before).toEqual([1, 3, 2])
    expect(after.slice(0, page1.length)).toEqual(before) // page1 구간 불변
  })
})

describe('SSR 시드 읽기', () => {
  it('시드에서 섹션 상품 id 를 모은다', () => {
    seed({ success: true, data: [{ products: [{ id: 11 }, { id: 12 }] }, { products: [{ id: 13 }] }] })
    expect(seededSectionProductIds()).toEqual(new Set([11, 12, 13]))
  })

  it('시드가 없으면 빈 집합 — 홈이 아닌 표면에서 no-op', () => {
    noSeed()
    expect(seededSectionProductIds().size).toBe(0)
    expect(readHomeSectionsSeed()).toBeUndefined()
  })

  it('깨진 JSON·success=false·products 부재 전부 빈 집합(홈이 안 열리면 안 된다)', () => {
    seed('{{{ not json')
    expect(seededSectionProductIds().size).toBe(0)
    seed({ success: false, data: [{ products: [{ id: 1 }] }] })
    expect(seededSectionProductIds().size).toBe(0)
    seed({ success: true, data: [{ title: '섹션' }, { products: 'nope' }] })
    expect(seededSectionProductIds().size).toBe(0)
  })
})

/** 주석을 지운 소스 — 이 판정이 *설명하는 주석*에 걸려 늘 통과하는 것을 막는다(같은 함정을 두 번 밟았다). */
const code = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('배선', () => {
  const FEED = code('src/pages/main-home/GroupBuyFeed.tsx')

  it('피드가 밴드 단위로 미루기를 적용한다', () => {
    expect(FEED).toMatch(/deferSeeded\(sortBand\(src\), sectionIds\)/)
  })

  it('섹션 id 는 시드에서 온다 — 쿼리를 구독하면 카드가 재배치된다', () => {
    expect(FEED).toMatch(/useMemo\(\(\) => seededSectionProductIds\(\), \[\]\)/)
  })

  it('피드는 섹션 상품을 걸러내지 않는다 — 전체 목록이어야 한다', () => {
    expect(FEED).not.toMatch(/\.filter\([^)]*sectionIds/)
    expect(FEED).not.toMatch(/sectionIds\.has\([^)]*\)\s*\)?\s*continue/)
  })

  it('섹션과 피드가 같은 시드 파서를 쓴다', () => {
    const SEC = code('src/components/home/HomeSections.tsx')
    expect(SEC).toMatch(/readHomeSectionsSeed</)
    expect(SEC).not.toMatch(/getElementById\('__SSR_INITIAL_SECTIONS__'\)/) // 자체 파서 부활 금지
  })
})
