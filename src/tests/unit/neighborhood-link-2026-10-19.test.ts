/**
 * 🏘️ 이용권 상세 → 동네 이용권 모음 링크 (2026-10-19).
 * 이 시험이 못 보는 것: 라이브 집계 값 · 링크가 눈에 잘 띄는지 · JS 를 안 돌리는 크롤러(이 링크는 화면 렌더 뒤에 생긴다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pickNeighborhood } from '@/pages/group-buy/neighborhood-link'
import { regionPath, type SidoStat } from '@/shared/constants/region-slugs'

const REGIONS: SidoStat[] = [
  { sido: '서울', count: 44, indexable: true, sigungu: [
    { sigungu: '서초구', count: 6, indexable: true },
    { sigungu: '종로구', count: 1, indexable: false },
  ] },
  { sido: '세종', count: 1, indexable: false, sigungu: [] },
]

describe('① 판정', () => {
  it('색인 대상 시군구면 시군구로', () => {
    const t = pickNeighborhood('서울 서초구 방배로 12', REGIONS)
    expect(t?.href).toBe(regionPath({ sido: '서울', sigungu: '서초구' }))
    expect(t?.count).toBe(6)
  })
  it('시군구가 thin 이면 시/도로', () => {
    const t = pickNeighborhood('서울특별시 종로구 종로 1', REGIONS)
    expect(t?.href).toBe(regionPath({ sido: '서울' }))
    expect(t?.count).toBe(44)
  })
  it('시/도도 thin 이면 링크 없음', () => {
    expect(pickNeighborhood('세종특별자치시 한누리대로 1', REGIONS)).toBeNull()
  })
  it('주소 없음 · 집계 없음이면 링크 없음', () => {
    expect(pickNeighborhood(null, REGIONS)).toBeNull()
    expect(pickNeighborhood('서울 서초구 방배로 12', [])).toBeNull()
  })
})

describe('② 배선', () => {
  it('매장 카드가 동네 링크를 그린다', () => {
    const s = readFileSync('src/pages/group-buy/StoreLocation.tsx', 'utf8')
    expect(s).toMatch(/<NeighborhoodLink address=\{address\} \/>/)
  })
  it('화면에 들어온 뒤에만 묻고, 지역 페이지와 같은 캐시 키를 쓴다', () => {
    const s = readFileSync('src/pages/group-buy/NeighborhoodLink.tsx', 'utf8')
    expect(s).toMatch(/enabled: seen && REGION_PAGES_ENABLED && !!address/)
    expect(s).toMatch(/\['regions', 'stats'\]/)
    expect(readFileSync('src/pages/region/RegionPage.tsx', 'utf8')).toMatch(/\['regions', 'stats'\]/)
  })
})
