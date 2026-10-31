/**
 * 🧪 2026-10-31 숙소 '서비스 및 부대시설' 그리드 (대표 "없으면 없다고 표시되고, 업로드할 때도 선택이 되어야").
 * 진짜 판정 함수와 진짜 컴포넌트를 돌린다. ⚠️ 못 보는 것: 아이콘 그림 자체(lazy) · 칸 간격이 보기 좋은지.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { stayAmenityGrid, parseAmenities, STAY_AMENITY_GRID } from '@/pages/stay-detail/amenity-grid'
import AmenityGrid from '@/pages/stay-detail/AmenityGrid'
import { readCode } from '../helpers/source-text'

const has = (items: string[]) => Object.fromEntries(stayAmenityGrid(items).cells.map(c => [c.kind, c.has]))

describe('판정', () => {
  it('한글 낱말(시드)과 셀러 폼 코드가 같은 칸에 들어간다', () => {
    expect(has(['무료 주차', '와이파이', '온수풀']).parking).toBe(true)
    expect(has(['parking_free', 'wifi', 'aircon', 'heating', 'pet_friendly', 'bbq', 'kitchenette']))
      .toMatchObject({ parking: true, wifi: true, air: true, pet: true, fire: true, kitchen: true, pool: false })
  })
  it('흡연실은 금연 칸을 켜지 않는다 · 금연 코드는 켠다', () => {
    expect(has(['smoking']).nosmoke).toBe(false)
    expect(has(['non_smoking']).nosmoke).toBe(true)
  })
  it('그리드 밖 시설은 그 밖의 시설로 — 코드는 한글로 바꾼다', () => {
    expect(stayAmenityGrid(['tv', 'elevator', '공용 라운지', 'wifi']).extras).toEqual(['TV', '엘리베이터', '공용 라운지'])
  })
  it('시설 정보가 없으면 known=false (없음으로 칠하지 않는다)', () => {
    expect(stayAmenityGrid([]).known).toBe(false)
    expect(parseAmenities('not json')).toEqual([])
    expect(parseAmenities('["a","b"]')).toEqual(['a', 'b'])
  })
})

describe('화면', () => {
  it('대표 칸이 전부 뜨고, 고르지 않은 칸에 없음이 붙는다', () => {
    const { container } = render(<AmenityGrid items={['무료 주차', '조식']} />)
    expect(container.querySelectorAll('[data-amenity-grid] li').length).toBe(STAY_AMENITY_GRID.length)
    expect(screen.getAllByText('없음').length).toBe(STAY_AMENITY_GRID.length - 2)
  })
  it('정보가 아예 없으면 없음 대신 안내 한 줄', () => {
    render(<AmenityGrid items={[]} />)
    expect(screen.queryByText('없음')).toBeNull()
    expect(screen.getByText(/시설 정보를 등록하지 않았어요/)).toBeTruthy()
  })
  it('배선 — 상세가 공통·객실 시설을 합쳐 그리드에 넘기고, 등록 폼이 그 동작을 안내한다', () => {
    const page = readCode('src/pages/StayDetailPage.tsx')
    expect(page).toContain('<AmenityGrid items={amenitiesArr} />')
    expect(page).toMatch(/parseAmenities\(stay\?\.amenities\)[\s\S]{0,120}room_amenities/)
    expect(readCode('src/pages/SellerStayNewPage.tsx')).toContain('서비스 및 부대시설')
  })
})
