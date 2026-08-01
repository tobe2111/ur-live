import { describe, it, expect } from 'vitest'
import { SEED, REGION_SEED, BANGBAE_SEED, SEOUL_GU, METRO_CITY, GYEONGGI_CITY, TRAVEL_REGION } from '@/features/marketing/api/influencer-seed-keywords'
import { classifyCategory } from '@/features/marketing/api/influencer-classify'

/**
 * 🌏 2026-07-29 — 지역 그리드 전국 확대(발송을 멈추고 DB 수집에 집중하는 기간의 최대 레버).
 *
 *   근거(라이브): 활성 키워드 252개 중 **지역 축이 서울 25구뿐**인데, 수확 상위는 전부 지역 키워드였다
 *   (`동네 맛집` 1,085 · `강남 맛집` 741 · `서울 맛집` 727). 잘 되는 축을 서울에서만 돌리고 있었고,
 *   신규 저장률은 4%까지 떨어져 있었다(= 이미 훑은 사람을 재방문 중).
 */
const allSeeds = [...SEED, ...REGION_SEED, ...BANGBAE_SEED]
const allKeywords = allSeeds.flatMap(g => g.keywords)

describe('시드 키워드 — 지역 그리드 무결성', () => {
  it('🔒 키워드 중복이 없다 — 같은 키워드가 두 카테고리에 있으면 UNIQUE 충돌로 하나만 살아남아 분류가 뒤섞인다', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const g of allSeeds) {
      for (const k of g.keywords) {
        const prev = seen.get(k)
        if (prev && prev !== g.category) dupes.push(`${k} (${prev} ↔ ${g.category})`)
        else if (prev) dupes.push(`${k} (${g.category} 중복)`)
        seen.set(k, g.category)
      }
    }
    expect(dupes).toEqual([])
  })

  it('지역 목록끼리 겹치지 않는다(같은 도시를 두 그룹에 넣으면 중복 키워드가 생긴다)', () => {
    const groups = [SEOUL_GU, METRO_CITY, GYEONGGI_CITY, TRAVEL_REGION]
    const flat = groups.flat()
    expect(new Set(flat).size).toBe(flat.length)
  })

  it('확장된 지역이 실제로 키워드를 만든다(빈 배열로 조용히 죽지 않게)', () => {
    for (const city of [...METRO_CITY, ...GYEONGGI_CITY]) {
      expect(allKeywords).toContain(`${city} 맛집`)
    }
    for (const r of TRAVEL_REGION) {
      expect(allKeywords).toContain(`${r} 숙소`)
    }
  })

  /**
   * ⚠️ 시드로 *찾기만* 하고 분류 규칙이 없으면 그 사람들의 카테고리는 영영 '키워드 상속'(미검증)으로 남는다
   *   — `influencer-seed-keywords.ts` 헤더가 경고하는 바로 그것. 지역 축이 쓰는 업종어는 규칙이 있어야 한다.
   */
  it('지역 그리드가 쓰는 업종어는 콘텐츠 분류 규칙에 존재한다', () => {
    expect(classifyCategory('부산 맛집 블로거', null)).toBe('맛집')
    expect(classifyCategory('수원 네일아트', null)).toBe('네일')
    expect(classifyCategory('제주 숙소 추천', null)).toBe('숙소')
    expect(classifyCategory('대구 뷰티 유튜버', null)).toBe('뷰티')
  })

  it('모든 시드 카테고리는 비어 있지 않다', () => {
    for (const g of allSeeds) {
      expect(g.category.length).toBeGreaterThan(0)
      expect(g.keywords.length).toBeGreaterThan(0)
      for (const k of g.keywords) expect(k.trim()).toBe(k) // 앞뒤 공백은 검색어를 망친다
    }
  })
})
