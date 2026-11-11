/**
 * 📏 이용권 상세 매장 지도 자리 — 지도가 뜰 때 아래가 밀리지 않는다 (2026-11-11 "계속 최적화")
 *
 * 라이브 /group-buy/2919 에서 CLS 0.0079 가 매회 났다. 원인: 호출부(잠금 파일)의 지도 자리표시는 172px 인데
 * 카카오·네이버 지도는 기본 220px 로 그려져, ~2.3초에 지도가 뜨면 주소·제보·아래 카드 전부가 48px 밀렸다.
 * 처방: `StoreLocation` 의 지도 상자가 처음부터 220px 최소 높이를 갖는다(잠금 파일 무접촉).
 *
 * ⚠️ 못 보는 것: 지도 부품이 기본 높이 대신 다른 `height` 를 받게 바뀌는 경우 — 그때는 이 값도 같이 바꿔야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
const loc = read('src/pages/group-buy/StoreLocation.tsx')
const mapDefault = (p: string) => Number((read(p).match(/height = (\d+)/) || [])[1])

describe('매장 지도 자리 예약', () => {
  it('상자의 최소 높이 = 지도 기본 높이(카카오·네이버 둘 다)', () => {
    const h = Number((loc.match(/const STORE_MAP_H = (\d+)/) || [])[1])
    expect(h).toBe(mapDefault('src/components/RestaurantMiniMap.tsx'))
    expect(h).toBe(mapDefault('src/components/NaverMiniMap.tsx'))
  })
  it('지도 상자가 그 높이를 최소로 잡는다', () => {
    expect(loc).toMatch(/overflow: 'hidden', minHeight: STORE_MAP_H/)
  })
  it('네이버 자리표시도 같은 높이', () => {
    expect(loc).toMatch(/fallback=\{<div style=\{\{ height: STORE_MAP_H/)
  })
})
