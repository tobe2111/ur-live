/**
 * 📍 2026-10-27 (대표 "지도 섹션이 상품 구성 아래에 나와야 … 모바일 기준 지도 부분에서 스크롤 하려고 하면 안먹혀"):
 *   ① 이용권 상세에서 매장 위치(지도)가 상품 구성 바로 다음 — 상단 탭 순서도 같다.
 *   ② 터치 기기는 지도가 손가락을 붙잡지 않는다(드래그·확대 끔 + 투명 덮개) — 페이지가 스크롤된다.
 * 못 보는 것: 실제 폰의 터치 처리(jsdom 에 카카오 SDK·터치 스크롤이 없다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/GroupBuyDetailPage.tsx')
const MAP = readCode('src/components/RestaurantMiniMap.tsx')

describe('지도 섹션 위치', () => {
  it('상품 구성(StoreIntro) 다음이 매장 위치이고, 이용 안내(UsageGuide)보다 앞', () => {
    const intro = PAGE.indexOf('<StoreIntro ')
    const loc = PAGE.indexOf('<StoreLocation ')
    const usage = PAGE.indexOf('<UsageGuide ')
    expect(intro).toBeGreaterThan(0)
    expect(loc).toBeGreaterThan(intro)
    expect(usage).toBeGreaterThan(loc)
  })
  it('상단 탭도 같은 순서(매장 위치 → 이용권 정보)', () => {
    expect(PAGE.indexOf("label: '매장 위치'")).toBeLessThan(PAGE.indexOf("label: '이용권 정보'"))
  })
})

describe('모바일 지도 스크롤', () => {
  it('터치 기기는 확대도 끈다', () => {
    expect(MAP).toMatch(/setZoomable\(!coarsePointer\)/)
    expect(MAP).toMatch(/draggable: !coarsePointer/)
  })
  it('터치 기기 전용 투명 덮개가 지도 위에 있다', () => {
    expect(MAP).toMatch(/\[@media\(pointer:coarse\)\]:block[^>]*touchAction: 'pan-y'[^>]*data-map-scroll-guard/)
  })
})
