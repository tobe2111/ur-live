/**
 * 🧪 2026-10-31 대표 시안 8(지역 배경)·10(메인 줄 목록).
 * ⚠️ 못 보는 것: 사진이 실제로 예쁜지 · 폰에서 줄 목록 높이(jsdom 에 레이아웃이 없다 — 시각 확인은 visual-preview).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { existsSync } from 'node:fs'
import { regionHeroFor } from '@/shared/home-region-hero'
import { DEAL_ROW } from '@/shared/deal-card-grid'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import DealCardPlaceholder from '@/components/home/DealCardPlaceholder'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'
import { readCode } from '../helpers/source-text'

describe('시안 8 — 지역 배경', () => {
  it('고른 지역이 좌표보다 먼저, 사진 없는 도시는 null', () => {
    expect(regionHeroFor({ regionKey: '서울' })?.slug).toBe('seoul')
    expect(regionHeroFor({ regionKey: '부산', loc: { lat: 37.55, lng: 126.92 } })?.slug).toBe('busan')
    expect(regionHeroFor({ regionKey: '없는지역' })).toBeNull()
    expect(regionHeroFor({})).toBeNull()
  })
  it('좌표로 도시를 찾는다 — 마포(서울)·광안리(부산)·성산(제주)·동성로(대구)·강릉(강원), 바다 위는 없음', () => {
    expect(regionHeroFor({ loc: { lat: 37.556, lng: 126.92 } })?.slug).toBe('seoul')
    expect(regionHeroFor({ loc: { lat: 35.153, lng: 129.118 } })?.slug).toBe('busan')
    expect(regionHeroFor({ loc: { lat: 33.46, lng: 126.94 } })?.slug).toBe('jeju')
    expect(regionHeroFor({ loc: { lat: 35.869, lng: 128.596 } })?.slug).toBe('daegu')
    expect(regionHeroFor({ loc: { lat: 37.75, lng: 128.9 } })?.slug).toBe('gangwon')
    expect(regionHeroFor({ loc: { lat: 34.0, lng: 131.0 } })).toBeNull()
  })
  it('2026-11-01 추가 도시 — 송도(인천)·정부청사(세종)·한옥마을(전주)·수원(경기)·둔산(대전)', () => {
    expect(regionHeroFor({ loc: { lat: 37.39, lng: 126.64 } })?.slug).toBe('incheon')
    expect(regionHeroFor({ loc: { lat: 36.50, lng: 127.26 } })?.slug).toBe('sejong')
    expect(regionHeroFor({ loc: { lat: 35.815, lng: 127.153 } })?.slug).toBe('jeonju')
    expect(regionHeroFor({ regionKey: '인천' })?.slug).toBe('incheon')
    expect(regionHeroFor({ regionKey: '전북' })?.slug).toBe('jeonju')
    expect(regionHeroFor({ regionKey: '충남세종' })?.slug).toBe('sejong')
    expect(regionHeroFor({ loc: { lat: 37.28, lng: 127.01 } })?.slug).toBe('gyeonggi')
    expect(regionHeroFor({ loc: { lat: 36.35, lng: 127.38 } })?.slug).toBe('daejeon')
    expect(regionHeroFor({ loc: { lat: 35.95, lng: 126.95 } })?.slug).toBe('jeonju')
    // 서울 서쪽 끝(김포공항 근처)은 여전히 서울
    expect(regionHeroFor({ loc: { lat: 37.56, lng: 126.81 } })?.slug).toBe('seoul')
  })
  it('표의 사진 파일이 실재한다(없는 파일이면 남색 판만 뜬다)', () => {
    for (const k of ['서울', '부산', '제주', '대구', '인천', '전북', '충남세종', '대전', '경기', '강원']) {
      const src = regionHeroFor({ regionKey: k })!.src
      expect(existsSync(`public${src}`), src).toBe(true)
    }
  })
  it('홈 배선 — 사진은 늦게(lazy·낮은 우선순위), 밝게(dark 강제·남색 막 없음) + 바탕색으로 녹는 그라데이션', () => {
    const src = readCode('src/pages/mobile-home/MobileHomePage.tsx')
    expect(src).toContain('regionHeroFor({ regionKey: region.regionKey, loc: userLoc })')
    // 🌤️ 2026-11-01 대표 "밝은 사진 + 그라데이션, 지금은 어둡기만" — 사진 위에서 dark 를 강제하지 않는다.
    expect(src).toMatch(/hero\s*\?\s*'sticky top-0 z-30/)
    expect(src).not.toMatch(/hero\s*\?\s*'dark /)
    expect(src).not.toContain('bg-gray-900">')
    expect(src).toMatch(/loading="lazy"[^>]*fetchPriority="low"/)
    expect(src).toContain('REGION_HERO_FADE_LIGHT')
    expect(src).toContain('REGION_HERO_FADE_DARK')
  })
})

const P = { id: 7, name: '닭도리탕', image_url: 'https://media.ur-team.com/a.jpg', price: 31000, original_price: 35000, category: 'meal_voucher', restaurant_name: '달빛한스푼', deal_only: 0 }
function reactCard(row: boolean) {
  const qc = new QueryClient()
  const { container } = render(<QueryClientProvider client={qc}><MemoryRouter><GroupBuyFeedCard p={P as any} row={row} /></MemoryRouter></QueryClientProvider>)
  return container.querySelector('a') as HTMLAnchorElement
}

describe('시안 10 — 메인 줄 목록', () => {
  it('row 카드: 링크·사진 칸이 DEAL_ROW 클래스, 격자 카드는 종전 그대로', () => {
    const a = reactCard(true)
    expect(a.className).toContain(DEAL_ROW.link)
    expect((a.firstElementChild as HTMLElement).className).toBe(DEAL_ROW.mediaBox)
    const g = reactCard(false)
    expect(g.className).not.toContain('flex-row')
  })
  it('자리 카드(row)가 진짜 카드와 같은 링크·사진 칸 클래스', () => {
    const { container } = render(<DealCardPlaceholder row />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toBe(DEAL_ROW.link)
    expect((root.firstElementChild as HTMLElement).className).toBe(DEAL_ROW.mediaBox)
  })
  it('워커 첫 화면도 줄 목록 — 화면과 같은 격자·링크', () => {
    const html = buildHomeFirstScreen(JSON.stringify({ data: [{ id: 1, title: '이런 이용권은 어떠세요?', products: [P] }] }), '')
    expect(html).toContain(`class="${DEAL_ROW.grid}"`)
    expect(html).toContain(`${DEAL_ROW.link}"`)
    expect(html).toContain(`class="${DEAL_ROW.mediaBox}"`)
  })
  it('배선 — 홈 섹션(레일 제외)·폰 피드가 row 를 넘긴다', () => {
    expect(readCode('src/components/home/HomeSections.tsx')).toContain('row={!rail}')
    expect(readCode('src/pages/main-home/GroupBuyFeed.tsx')).toContain('row={!pc}')
  })
})
