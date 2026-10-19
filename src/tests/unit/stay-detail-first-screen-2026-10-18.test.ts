/**
 * 🛏️ 숙소 상세 첫 화면이 남의 화면 봉투를 받던 것 (2026-10-18)
 *
 * 편의시설 아이콘 열한 개(lucide)가 교환권·홈·공용 lucide 봉투에 흩어져 있어서, `amenity-meta.tsx` 가
 * 정적으로 부르면 숙소 상세가 그 봉투 셋을 통째로 받았다(정적 폐쇄 실측 230.2 → 205.8KB br).
 * 처방: 판정(키워드 → 종류)은 그대로 두고 그림만 `AmenityIcon` 을 lazy 로. 이미지 대체·추천 할인 아이콘 둘은
 * 유어딜 세트(StayLineIcon·CouponIcon)로.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 바이트(그건 check-surface-budgets 가 잰다) · 아이콘이 보기 좋은지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { amenityKind } from '@/pages/stay-detail/amenity-meta'

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))
const META = 'src/pages/stay-detail/amenity-meta.tsx'
const ICON = 'src/pages/stay-detail/AmenityIcon.tsx'
const PAGE = 'src/pages/StayDetailPage.tsx'

describe('① 편의시설 아이콘은 lazy 로만', () => {
  it('amenity-meta 는 lucide 를 정적으로 부르지 않는다', () => {
    expect(code(META)).not.toMatch(/from ['"]lucide-react['"]/)
  })
  it('AmenityIcon 을 lazy 로 부른다', () => {
    expect(code(META)).toMatch(/lazy\(\(\) => import\(['"]\.\/AmenityIcon['"]\)\)/)
    expect(code(META)).not.toMatch(/import AmenityIcon from/)
  })
  it('fallback 이 아이콘과 같은 크기 자리를 잡는다(늦게 와도 글자가 안 밀린다)', () => {
    expect(code(META)).toMatch(/fallback=\{<span className=\{`\$\{AMENITY_ICON_CLS\} inline-block/)
  })
  it('AmenityIcon 이 종류 열두 개를 전부 그림에 잇는다', () => {
    const src = code(ICON)
    for (const k of ['parking', 'wifi', 'breakfast', 'pool', 'spa', 'fire', 'kitchen', 'air', 'gym', 'pet', 'nosmoke', 'default']) {
      expect(src).toMatch(new RegExp(k === 'default' ? 'default:' : `case '${k}':`))
    }
  })
})

describe('② 판정 순서는 종전 그대로', () => {
  it.each([
    ['무료 주차', 'parking'], ['와이파이', 'wifi'], ['조식 포함', 'breakfast'], ['수영장', 'pool'],
    ['온수풀', 'pool'], ['사우나', 'spa'], ['개별 화로', 'fire'], ['바비큐', 'fire'], ['취사 가능', 'kitchen'],
    ['냉난방', 'air'], ['피트니스', 'gym'], ['반려견 동반', 'pet'], ['금연', 'nosmoke'], ['샤워실', 'default'],
  ])('%s → %s', (label, kind) => {
    expect(amenityKind(label)).toBe(kind)
  })
})

describe('③ 숙소 상세 본문이 공용 lucide 봉투를 끌지 않는다', () => {
  it('Hotel·TicketPercent 대신 유어딜 세트', () => {
    const src = code(PAGE)
    expect(src).not.toMatch(/\bHotel\b/)
    expect(src).not.toMatch(/\bTicketPercent\b/)
    expect(src).toMatch(/<StayLineIcon /)
    expect(src).toMatch(/<CouponIcon /)
  })
})
