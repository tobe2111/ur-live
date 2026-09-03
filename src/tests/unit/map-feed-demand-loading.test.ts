/**
 * 🚦 동네딜 피드 **수요 기반 로딩** 계약 (2026-09-03 — 대표 "가장 이상적으로 하자")
 *
 * ■ 무엇을 못으로 박는가
 *   이 화면(모바일 홈 `/` · 지도 `/map`)은 진입할 때마다 활성 이용권을 **전부** 받았다.
 *   라이브 실측 338건 = 요청 7회 · 66KB(gzip), 화면에 뜨는 카드는 10~20장인데.
 *   전량 순회는 "일단 다 받아 두면 정렬·필터가 쉽다" 는 이유로 **언제든 다시 붙는다** — 그래서 못을 박는다.
 *
 * ■ 이 테스트가 **못 잡는 것**(과신 금지)
 *   - 실제 네트워크 요청 수. 소스에 루프가 없다는 것만 본다.
 *   - React 훅의 런타임 동작(재마운트·경합). 렌더러를 안 쓴다.
 *   - 서버 정렬 결과의 정확성(SQL 은 실행하지 않는다).
 *   순수 함수(pickViewportList)만 실제로 실행해 검증한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pickViewportList } from '@/pages/restaurant-map/viewport-list'
import type { Restaurant } from '@/pages/restaurant-map/types'

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')

const hook = R('hooks/queries/useMapProducts.ts')
const win = R('pages/restaurant-map/useFeedWindow.ts')
const page = R('pages/RestaurantMapPage.tsx')
const list = R('pages/restaurant-map/RestaurantList.tsx')
const route = R('features/group-buy/api/group-buy-public.routes.ts')
const total = R('features/group-buy/api/feed-total.ts')

describe('전량 순회 금지', () => {
  it('useMapProducts 는 스스로 끝까지 걷지 않는다 — page1 뒤엔 호출자가 요청할 때만', () => {
    // 예전 형태: 초기 effect 안에서 `for (let page = startPage; !cancelled; page++)` 로 자동 순회.
    const effect = hook.slice(hook.indexOf('useEffect(() => {'))
    expect(effect).not.toMatch(/for\s*\(\s*let\s+page/)
    // SOFT_CAP(500) 조용한 절벽도 함께 사라졌다 — 상한은 loadAll 의 안전장치(ALL_CAP)뿐이다.
    // ⚠️ 문자열 전체 검색이면 **왜 없앴는지 적은 주석**에도 걸린다(첫 판이 그래서 빨간불이었다).
    //    선언과 사용만 본다.
    expect(hook).not.toMatch(/^\s*const SOFT_CAP/m)
    expect(hook).not.toMatch(/>=\s*SOFT_CAP/)
  })

  it('요청형 API(loadMore/loadAll)를 노출한다', () => {
    expect(hook).toMatch(/loadMore,/)
    expect(hook).toMatch(/loadAll,/)
    // loadAll 은 무한루프 안전 상한을 갖는다.
    expect(hook).toMatch(/acc\.length < ALL_CAP/)
  })

  it('SSR 시드(0-RTT)와 near 거리랭킹 경로는 그대로다 — 잠긴 계약', () => {
    expect(hook).toMatch(/__SSR_INITIAL_MAIN__/)
    expect(hook).toMatch(/params\.near = `\$\{near\.lat\},\$\{near\.lng\}`/)
  })
})

describe('정렬은 서버가 한다', () => {
  it('거리순은 sort 가 아니라 near 가 담당한다', () => {
    expect(win).toMatch(/sortBy === 'distance' \? '' : sortBy/)
  })

  it('클라 SortBy 4종이 서버 화이트리스트와 맞물린다', () => {
    // SortBy = distance(near) | discount | price | rating → 뒤 셋은 서버 키와 이름이 같아야 한다.
    const wl = route.slice(route.indexOf('ALLOWED_GB_SORT'), route.indexOf('const sortParam'))
    for (const key of ['discount', 'price', 'rating']) {
      expect(wl, `서버 정렬 화이트리스트에 ${key} 가 없다`).toMatch(new RegExp(`\\n\\s+${key}:`))
    }
  })
})

describe('개수는 서버가 말한다', () => {
  it('응답에 total 이 additive 로 붙고, 필터가 붙은 요청에선 세지 않는다', () => {
    expect(route).toMatch(/data: withOnnuri, \.\.\.\(total != null \? \{ total \} : \{\}\)/)
    expect(route).toMatch(/\(!hasRegion && !hasQ && !hasBbox\) \? await getActiveFeedTotal/)
  })

  it('COUNT 의 WHERE 가 목록 쿼리와 같은 조건이다 — 어긋나면 "50곳 중 60곳" 이 된다', () => {
    for (const cond of ['p.is_active = 1', "p.group_buy_status = ? OR ? = 'all'", 'COALESCE(p.is_supply_product,0) = 1']) {
      expect(total, `COUNT 조건 누락: ${cond}`).toContain(cond)
    }
  })

  it('화면의 "N곳" 은 필터가 없을 때 서버 total 을 쓴다', () => {
    expect(page.match(/filteredCount=\{!needsAll && !search \? \(feedTotal \?\? /g)?.length).toBe(2)
  })
})

describe('스크롤이 다음 페이지를 부른다', () => {
  it('목록 두 곳(리스트 모드·지도 시트) 모두에 서버 페이징이 배선돼 있다', () => {
    expect(page.match(/onLoadMore=\{loadMore\}/g)?.length).toBe(2)
    expect(page.match(/hasMoreOnServer=\{!reachedEnd\}/g)?.length).toBe(2)
  })

  it('센티넬은 로드된 행을 다 보여 준 뒤에만 서버를 부른다', () => {
    expect(list).toMatch(/if \(localMore\) setVisibleCount\(v => v \+ PAGE\)\s*\n\s*else onLoadMore\?\.\(\)/)
  })

  it('필터 시트를 열면 전체를 받는다 — 미리보기 카운트가 로드된 것만 세면 거짓말이다', () => {
    expect(page).toMatch(/needsAll: !!\([^)]*filterSheetOpen\)/)
  })
})

describe('pickViewportList (순수 함수 — 실제로 돌린다)', () => {
  const mk = (id: number, lat: number, lng: number) => ({ id, restaurant_lat: lat, restaurant_lng: lng } as Restaurant)
  const list4 = [mk(1, 37.50, 127.00), mk(2, 35.00, 129.00), mk(3, 37.51, 127.01), mk(4, 0, 0)]

  it('bounds 가 없으면 원본 그대로(리스트 모드·검색 중)', () => {
    const r = pickViewportList(list4, null)
    expect(r.viewportList).toBe(list4)
    expect(r.viewportInCount).toBeNull()
  })

  it('보이는 딜을 앞으로 올리되 **하나도 숨기지 않는다**', () => {
    const r = pickViewportList(list4, { swLat: 37.4, swLng: 126.9, neLat: 37.6, neLng: 127.1 })
    expect(r.viewportList.map((x) => x.id)).toEqual([1, 3, 2, 4])
    expect(r.viewportList).toHaveLength(list4.length)   // 숨김 0 — 2026-07-15 "왜 18곳만?" 사고
    expect(r.viewportInCount).toBe(2)
  })

  it('뷰포트 안이 0건이면 원본 순서를 유지한다', () => {
    const r = pickViewportList(list4, { swLat: 10, swLng: 10, neLat: 11, neLng: 11 })
    expect(r.viewportList).toBe(list4)
    expect(r.viewportInCount).toBe(0)
  })
})
