/**
 * 🧩 PC 홈 시안 6 (2026-10-14 대표 확정 — 시안 4(*"2번과 3번 섞어서, 위 배너는 3번"*)에서
 *    *"지금 인기 이용권이 아니잖아 … 모바일에서 이름 바꿨잖아. 같이 바뀌는거 아니야?"* →
 *    *"주말에 떠나는 숙소 이건 빼줘 아예. 모바일도 마찬가지고. 그 상태로 시안대로 구현해줘"*).
 *
 * 고정하는 것:
 *   ① 순서 — [큰 배너 1 + 작은 배너 2] → [어드민 섹션 + 유어쇼츠] → [지역 4칸] → [왼쪽 필터 + 목록]
 *   ② 대체한 것이 되살아나지 않는다 — 히어로(색면 + 위치 칩) · 시안 4 의 별도 순위 줄
 *      (PC 만의 고정 제목은 어드민 섹션 이름과 갈렸고 위치 정렬을 잃었다)
 *   ③ 위치 칩은 사라지지 않고 왼쪽 필터로 옮겼다(같은 부품) — 지우면 PC 에서 지역을 고를 길이 없다
 *   ④ 순위 줄의 주소 = cron 예열 주소 · 피드 인기순 키(한 글자라도 다르면 콜드 D1)
 *   ⑤ 거리·가격 필터 판정(진짜 함수를 부른다)
 *   ⑥ 숫자를 지어내지 않는다 — 지역 타일은 색인 게이트를 통과한 곳만, 개수는 집계 API 값
 *
 * ⚠️ 못 보는 것: 실제 화면(배너 높이·카드 폭·다크 대비) — `visual-preview --pc` 로 봐야 한다.
 */
import { pickRegionTiles } from '@/pages/pc-home/region-tiles'
import { regionHeroForSido } from '@/shared/home-region-hero'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '@/tests/helpers/source-text'
import { passesFeedFilters, feedFiltersKey } from '@/shared/home-feed-filters'

const PAGE = stripComments(readFileSync('src/pages/pc-home/PcHomePage.tsx', 'utf8'))
const SIDEBAR = stripComments(readFileSync('src/pages/pc-home/PcFeedSidebar.tsx', 'utf8'))
const POP = stripComments(readFileSync('src/pages/pc-home/usePopularDeals.ts', 'utf8'))
const TILES = stripComments(readFileSync('src/pages/pc-home/PcRegionTiles.tsx', 'utf8'))
const HERO = stripComments(readFileSync('src/pages/pc-home/PcHeroBanners.tsx', 'utf8'))
const FEED = stripComments(readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8'))

describe('① 순서 — 시안 4', () => {
  it('배너 → 순위 → 지역 → 필터+목록', () => {
    const at = ['<PcHeroBanners', '<HomeSections', '<PcRegionTiles', '<PcFeedSidebar', '<GroupBuyFeed'].map((t) => PAGE.indexOf(t))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    for (let k = 1; k < at.length; k++) expect(at[k]).toBeGreaterThan(at[k - 1])
  })
  it('필터와 목록은 한 패널 안 나란히 — 필터가 목록 왼쪽', () => {
    const panel = PAGE.indexOf('ur-home-panel !mb-0 flex')
    expect(panel).toBeGreaterThan(-1)
    expect(PAGE.indexOf('<PcFeedSidebar')).toBeGreaterThan(panel)
  })
})

describe('② 대체한 것이 되살아나지 않는다', () => {
  it.each(['<HomeHeroBanner', '<PcTopRank', 'variant="strip"'])('%s 없음', (tag) => {
    expect(PAGE).not.toContain(tag)
  })
  it('PC 섹션 = 모바일과 같은 부품 · 위치 정렬 · 유어쇼츠는 첫 섹션 다음(모바일과 같은 자리)', () => {
    expect(PAGE).toMatch(/<HomeSections rail near=\{near\} shortsRail=\{<UrShortsRail \/>\}/)
    const SEC = stripComments(readFileSync('src/components/home/HomeSections.tsx', 'utf8'))
    expect(SEC).toMatch(/return rail\s*\n?\s*\? <SectionRail count=\{sec\.products\.length\}>\{cards\}<\/SectionRail>/)
    expect(SEC).toContain('{sIdx === 0 && shortsRail}')
  })
})

describe('③ 위치 칩은 왼쪽 필터로 옮겼다', () => {
  it('필터가 같은 위치 부품을 쓰고, 페이지가 지역·현위치 핸들러를 넘긴다', () => {
    expect(SIDEBAR).toMatch(/<PcHomeLocationBar value=\{region\} onChange=\{onRegionChange\} onLocate=\{onLocate\}/)
    expect(PAGE).toMatch(/onRegionChange=\{handleRegion\} onLocate=\{handleLocate\}/)
  })
  it('필터 값이 피드까지 간다', () => {
    expect(PAGE).toMatch(/filters=\{filters\}\s*\n\s*\/>/)
    expect(FEED).toMatch(/\.filter\(p => passesFeedFilters\(p, filters, userLoc\)(?: && life\.keep\(p\))?\)/) // 2026-10-25 생활 업종 거르기가 함께 붙는다
    expect(FEED).toMatch(/feedFiltersKey\(filters\)(?:, life\.key)?\]\)/)
  })
  it('거리는 위치가 잡혔을 때만 보인다', () => {
    expect(SIDEBAR).toMatch(/\{located && \(\s*<Group label="거리">/)
  })
})

describe('④ 지역 사진용 인기 목록 = 예열 주소 · 피드 인기순 키', () => {
  const URL = '/api/group-buy/products?status=active&category=all&sort=popular'
  it('예열 목록에 그 주소가 있다', () => {
    const prewarm = stripComments(readFileSync('src/worker/cron/cache-prewarm.ts', 'utf8'))
    const hot = prewarm.slice(prewarm.indexOf('const HOT_PATHS'), prewarm.indexOf('\n]', prewarm.indexOf('const HOT_PATHS')))
    expect(hot).toContain(`'${URL}'`)
  })
  it('훅이 그 주소를 그대로 부르고 피드와 같은 키를 쓴다', () => {
    expect(POP).toContain(`api.get('${URL}')`)
    expect(POP).toContain("queryKeys.groupBuyList('active', 'all', 'popular')")
  })
  it('지역 타일이 그 훅을 쓴다', () => {
    expect(TILES).toContain('usePopularDeals()')
  })
})

describe('⑤ 거리·가격 필터', () => {
  const here = { lat: 37.5, lng: 127 }
  const near = { price: 15000, restaurant_lat: 37.505, restaurant_lng: 127 }   // ~0.56km
  const far = { price: 15000, restaurant_lat: 37.6, restaurant_lng: 127 }      // ~11km
  it('거리 — 반경 안만, 좌표 없는 이용권은 뺀다', () => {
    expect(passesFeedFilters(near, { maxKm: 1 }, here)).toBe(true)
    expect(passesFeedFilters(far, { maxKm: 10 }, here)).toBe(false)
    expect(passesFeedFilters({ price: 1 }, { maxKm: 10 }, here)).toBe(false)
  })
  it('거리 — 위치를 모르면 판정하지 않는다(통과)', () => {
    expect(passesFeedFilters(far, { maxKm: 1 }, null)).toBe(true)
  })
  it('가격 — 카드가 보여 주는 값(공구 확정가 우선)으로 가른다', () => {
    expect(passesFeedFilters({ price: 60000, current_price: 15000 }, { price: 'lt20k' }, null)).toBe(true)
    expect(passesFeedFilters({ price: 20000 }, { price: 'lt20k' }, null)).toBe(false)
    expect(passesFeedFilters({ price: 20000 }, { price: '20to50k' }, null)).toBe(true)
    expect(passesFeedFilters({ price: 50000 }, { price: 'gte50k' }, null)).toBe(true)
    expect(passesFeedFilters({}, { price: 'gte50k' }, null)).toBe(false)
  })
  it('필터가 없으면 출력 불변', () => {
    expect(passesFeedFilters(far, undefined, here)).toBe(true)
    expect(passesFeedFilters(far, {}, here)).toBe(true)
    expect(feedFiltersKey(undefined)).toBe('')
  })
})

describe('⑥ 숫자를 지어내지 않는다', () => {
  it('지역 타일 — 색인 게이트 통과 지역만, 네 곳이 안 모이면 줄을 안 그린다', () => {
    expect(TILES).toMatch(/if \(tiles\.length < TILE_COUNT\) return null/)
    const sg = (n: string) => ({ sigungu: n, count: 3, indexable: true })
    const R = (sido: string, count: number, indexable = true) => ({ sido, count, indexable, sigungu: [sg('중구')] }) as never
    // 🔁 2026-11-02 재조준 — 1순위가 홈 머리와 같은 지역 사진이 됐다. 아래 폴백 규칙은 **그 사진이 없는**
    //   지역(울산·경남·경북·광주·전남)으로 본다(서울·부산 등은 이제 늘 머리 사진이 있다).
    const regions = [R('울산', 50), R('경남', 40), R('경북', 30), R('광주', 20), R('전남', 10), R('세종', 99, false)]
    const deal = (addr: string) => ({ image_url: `https://x/${addr}.jpg`, deal_only: 0, restaurant_address: `${addr} 중구 1` })
    // 🖼️ 2026-10-14 대표 "사진 없는건 빼주면 돼" — 사진 없는 경남은 건너뛰고 전남으로 채운다
    const got = pickRegionTiles(regions, [deal('울산'), deal('경북'), deal('광주'), deal('전남')], [])
    expect(got.map((t) => t.sido)).toEqual(['울산', '경북', '광주', '전남'])
    expect(got.every((t) => !!t.photo)).toBe(true)
    // 색인 게이트 밖(세종)은 사진이 있어도 안 들어온다
    expect(pickRegionTiles(regions, [deal('세종'), deal('울산'), deal('경북'), deal('광주'), deal('전남')], []).map((t) => t.sido)).not.toContain('세종')
    // 사진 있는 곳이 넷이 안 되면 빈 배열(줄을 안 그린다)
    expect(pickRegionTiles(regions, [deal('울산'), deal('경북')], [])).toEqual([])
    // 배너 사진이 이용권 사진보다 먼저
    const b = [{ image_url: 'https://x/banner.jpg', link_url: 'https://urdeal.kr/region/%EC%9A%B8%EC%82%B0' }]
    expect(pickRegionTiles(regions, [deal('울산'), deal('경북'), deal('광주'), deal('전남')], b)[0].photo).toBe('https://x/banner.jpg')
  })
  it('🗺️ 홈 머리와 같은 지역 사진이 배너·이용권 사진보다 먼저다 (2026-11-02 대표 "같이 적용")', () => {
    const sg = (n: string) => ({ sigungu: n, count: 3, indexable: true })
    const R = (sido: string, count: number) => ({ sido, count, indexable: true, sigungu: [sg('중구')] }) as never
    const regions = [R('서울', 50), R('경기', 40), R('세종', 30), R('강원', 20)]
    const adDeal = (addr: string) => ({ image_url: `https://x/gym-ad-${addr}.jpg`, deal_only: 0, restaurant_address: `${addr} 중구 1` })
    const banner = [{ image_url: 'https://x/banner.jpg', link_url: 'https://urdeal.kr/region/%EC%84%9C%EC%9A%B8' }]
    const got = pickRegionTiles(regions, ['서울', '경기', '세종', '강원'].map(adDeal), banner)
    expect(got.map((t) => t.photo)).toEqual([
      regionHeroForSido('서울')!.src, regionHeroForSido('경기')!.src, regionHeroForSido('세종')!.src, regionHeroForSido('강원')!.src,
    ])
    expect(got.every((t) => t.hero)).toBe(true)
    expect(regionHeroForSido('세종')?.slug, '세종·충남은 고르기 칸이 하나라 같은 사진').toBe('sejong')
    expect(regionHeroForSido('충남')?.slug).toBe('sejong')
    expect(TILES, '정적 지역 사진을 리사이저로 줄이면 4:3 칸에서 흐려진다').toMatch(/const src = t\.hero \? t\.photo : cfImage\(/)
  })
  it('왼쪽 필터 열이 목록 카드보다 위 층이다 — 지역 드롭다운이 카드에 가려지지 않는다', () => {
    // sticky 는 쌓임 맥락을 연다: 열에 z 가 없으면 안쪽 드롭다운이 오른쪽 카드 밑으로 들어간다(대표 신고 2026-10-14)
    expect(SIDEBAR).toMatch(/<aside[^>]*className="sticky[^"]*\bz-(\d+|\[\d+\])/)
  })
  it('사진 없는 타일을 그리는 대체 면이 없다', () => {
    expect(TILES).not.toMatch(/brand-grad/)
  })
  it('필터에 종류별 개수를 붙이지 않는다(서버가 총수를 안 준다)', () => {
    expect(SIDEBAR).not.toMatch(/count/)
  })
  it('배너가 없으면 큰 배너 자리도 안 그린다', () => {
    expect(HERO).toMatch(/if \(n === 0\) return null/)
  })
})
