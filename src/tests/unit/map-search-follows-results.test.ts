/**
 * 🗺️ 지도는 검색 결과를 따라간다 (2026-09-03 — 대표 신고 "검색을 했을 때 무관한 지도 위치가 떠. 심각한 문제야")
 *
 * ■ 무슨 일이 있었나
 *   `커트` 를 치면 **목록은 동탄(1.3km) 딜 2건**인데 **지도는 인천 부평**으로 날아갔다. 화면 왼쪽과
 *   오른쪽이 서로 다른 도시를 가리켰고, 에러는 없었다. 원인은 검색 제출 시 검색어를 **무조건 지명으로
 *   지오코딩**한 것 — 카카오 장소검색이 "커트"에 걸리는 아무 상호를 물어다 주면 거기로 간다.
 *
 * ■ 왜 소스 grep 만으로는 부족한가
 *   호출 이름은 언제든 바뀌고, "핀이 있으면 핀 먼저"는 **분기 순서**라 문자열로 못 잰다.
 *   ⇒ 가짜 kakao 지도를 만들어 **실제로 어느 API 가 불렸는지** 본다.
 *
 * ⚠️ 이 검사가 못 막는 것: 카카오 SDK 의 실제 지오코딩 품질, 그리고 `filtered` 가 올바른 딜을 담는지
 *    (그건 필터 로직의 몫이다). 여기서 고정하는 것은 **우선순위** 하나다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const PAGE = readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8')

// ── 가짜 카카오 지도 ────────────────────────────────────────────────
const calls = { setBounds: 0, setCenter: 0, setLevel: 0, keyword: 0, address: 0 }
class LatLng { constructor(public lat: number, public lng: number) {} }
class LatLngBounds { pts: LatLng[] = []; extend(p: LatLng) { this.pts.push(p) } }
const fakeMap = {
  setBounds: () => { calls.setBounds++ },
  setCenter: () => { calls.setCenter++ },
  setLevel: () => { calls.setLevel++ },
}

function installKakao({ geocodeHit }: { geocodeHit: boolean }) {
  const Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' }
  ;(globalThis as unknown as { window: unknown }).window = globalThis
  ;(globalThis as unknown as { kakao: unknown }).kakao = {
    maps: {
      LatLng, LatLngBounds,
      services: {
        Status,
        Places: class { keywordSearch(_q: string, cb: (r: unknown[], s: string) => void) {
          calls.keyword++
          cb(geocodeHit ? [{ y: '37.4900', x: '126.7200' }] : [], geocodeHit ? Status.OK : Status.ZERO_RESULT)
        } },
        Geocoder: class { addressSearch(_q: string, cb: (r: unknown[], s: string) => void) {
          calls.address++
          cb([], Status.ZERO_RESULT)
        } },
      },
    },
  }
}

beforeEach(() => { for (const k of Object.keys(calls)) (calls as Record<string, number>)[k] = 0 })
afterEach(() => { delete (globalThis as Record<string, unknown>).kakao })

describe('검색 → 지도 이동 우선순위', () => {
  it('① 결과 핀이 있으면 **핀에 맞춘다** — 지오코딩은 아예 안 부른다', async () => {
    installKakao({ geocodeHit: true }) // 지오코딩이 성공하더라도
    const { panToSearchResults } = await import('@/pages/restaurant-map/pan-to-region')
    const ok = await panToSearchResults(fakeMap, '커트', [
      { lat: 37.2000, lng: 127.0700 },
      { lat: 37.2010, lng: 127.0720 },
    ])
    expect(ok).toBe(true)
    expect(calls.setBounds, '결과 핀들이 다 보이게 맞춰야 한다').toBe(1)
    expect(calls.keyword + calls.address, '핀이 있는데 지명으로 날아가면 목록과 지도가 갈린다').toBe(0)
  })

  it('핀이 하나뿐이면 그 자리로 (bounds 가 한 점이면 줌이 튄다)', async () => {
    installKakao({ geocodeHit: false })
    const { panToSearchResults } = await import('@/pages/restaurant-map/pan-to-region')
    await panToSearchResults(fakeMap, '커트', [{ lat: 37.2, lng: 127.07 }])
    expect(calls.setCenter).toBe(1)
    expect(calls.setBounds).toBe(0)
  })

  it('② 결과가 하나도 없을 때만 지명으로 해석한다 ("부산" 같은 지역어)', async () => {
    installKakao({ geocodeHit: true })
    const { panToSearchResults } = await import('@/pages/restaurant-map/pan-to-region')
    const ok = await panToSearchResults(fakeMap, '부산', [])
    expect(ok).toBe(true)
    expect(calls.keyword).toBe(1)
    expect(calls.setCenter).toBe(1)
  })

  it('지명도 아니고 결과도 없으면 **지도를 건드리지 않는다** (엉뚱한 데로 가느니 그대로)', async () => {
    installKakao({ geocodeHit: false })
    const { panToSearchResults } = await import('@/pages/restaurant-map/pan-to-region')
    const ok = await panToSearchResults(fakeMap, 'ㅁㄴㅇㄹ', [])
    expect(ok).toBe(false)
    expect(calls.setCenter + calls.setBounds).toBe(0)
  })
})

describe('지도 페이지 배선', () => {
  it('③ 검색 경로는 결과-우선 헬퍼만 쓴다 (생 지오코딩 직접 호출 금지)', () => {
    expect(PAGE).toMatch(/panToSearchResults/)
    expect(PAGE, 'panToPlaceQuery 직접 호출이 되살아나면 이 버그가 그대로 돌아온다').not.toMatch(/panToPlaceQuery\s*\(/)
  })

  it('④ 결과가 0인데 서버 검색이 안 끝났으면 기다린다 (성급히 지명으로 단정하지 않는다)', () => {
    expect(PAGE).toMatch(/pins\.length === 0 && searchDealsFor !== key/)
    expect(PAGE, '성공·실패 무관하게 "결과 확정" 신호가 서야 한다').toMatch(/\.finally\(\(\) => setSearchDealsFor/)
  })

  it('⑤ 질의당 한 번만 움직인다 — 지도를 손으로 옮긴 뒤 다시 끌려가면 안 된다', () => {
    expect(PAGE).toMatch(/pannedForRef\.current === key/)
    expect(PAGE).toMatch(/pannedForRef\.current = key/)
  })
})
