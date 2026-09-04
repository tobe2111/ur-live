/**
 * 🗺️ **지도는 검색 결과를 따라간다** (2026-09-03 — 대표 신고 "검색을 했을 때 무관한 지도 위치가 떠. 심각한 문제야")
 *
 * ## 사고
 * `커트` 를 치면 목록은 **동탄 2건**인데 지도는 **인천 부평**으로 갔다. 화면 왼쪽과 오른쪽이 서로 다른
 * 도시를 가리켰고 에러는 없었다. 원인: 검색 제출 시 검색어를 **무조건 지명으로 지오코딩**했다 —
 * 카카오 장소검색이 "커트"에 걸리는 아무 상호를 물어다 주면 지도는 거기로 날아간다.
 *
 * `pan-to-region` 안에는 이미 올바른 규칙이 있었다(`panToRegionAccurate` = 딜 핀 먼저, 지오코딩은
 * 폴백). **검색 경로만 그 1단계를 건너뛰고 있었다.**
 *
 * ## 규칙
 *   ① 제출 시점이 아니라 **결과가 정해진 시점**에 움직인다
 *   ② 결과 핀에 맞춘다. 결과가 0일 때만 지명으로 해석한다(`panToSearchResults` 안의 폴백)
 *   ③ 클라가 든 딜로 0건이어도 **서버 q검색이 끝날 때까지 기다린다** — 성급히 날아가면 결과가
 *      도착해도 지도는 이미 딴 도시다
 *   ④ **질의당 한 번만** 움직인다 — 지도를 손으로 옮긴 뒤 정렬을 바꿨다고 다시 끌려가면 안 된다
 *
 * ⚠️ 이 훅이 파일로 분리된 이유는 규칙이 아니라 **파일 크기 래칫**이다(`RestaurantMapPage` 가
 *    god 파일이라 990줄에서 CI 가 막았다). 규칙 자체는 여기 한 곳에만 있어야 한다.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import api from '@/lib/api'
import { panToSearchResults } from './pan-to-region'

interface Pinned { restaurant_lat?: number | null; restaurant_lng?: number | null }

/** 결과 핀은 bounds 계산용이라 많이 넣어도 답이 안 바뀐다 — 큰 목록에서 헛돌지 않게만 자른다. */
const MAX_PINS = 300

export function useSearchPan({
  search, setSearch, category, results, resultsReadyFor, mapRef, active,
}: {
  search: string
  setSearch: (v: string) => void
  /** 카테고리가 바뀌면 결과가 달라지므로 같은 검색어여도 다시 맞춘다. */
  category: string
  /** 지금 화면에 뜬 결과(필터·정렬 적용분). */
  results: Pinned[]
  /** 서버 q검색이 **어느 질의**의 결과인지(`질의|카테고리`). 이 값이 맞을 때만 "결과 0"을 믿는다. */
  resultsReadyFor: string
  mapRef: MutableRefObject<unknown>
  /** 지도 모드 + SDK 준비됨. */
  active: boolean
}) {
  const pannedForRef = useRef('')

  const submitSearch = useCallback((q: string) => {
    // Enter·최근검색 선택은 "다시 그 결과로 데려가 달라"는 뜻 — 같은 질의여도 한 번 더 맞춘다.
    pannedForRef.current = ''
    setSearch((q || '').trim())
  }, [setSearch])

  useEffect(() => {
    if (!active) return
    const q = search.trim()
    const key = `${q}|${category}`
    if (!q) { pannedForRef.current = ''; return }
    if (pannedForRef.current === key) return
    const map = mapRef.current
    if (!map || !(window as { kakao?: { maps?: unknown } }).kakao?.maps) return
    const pins = results
      .filter((r) => Number.isFinite(r.restaurant_lat) && Number.isFinite(r.restaurant_lng))
      .slice(0, MAX_PINS)
      .map((r) => ({ lat: r.restaurant_lat as number, lng: r.restaurant_lng as number }))
    // 결과가 0인데 서버 검색이 아직 안 끝났으면 기다린다 — 여기서 지명으로 단정하면 또 엉뚱한 곳으로 간다.
    if (pins.length === 0 && resultsReadyFor !== key) return
    pannedForRef.current = key
    void panToSearchResults(map, q, pins)
  }, [search, category, results, resultsReadyFor, active, mapRef])

  return submitSearch
}


/**
 * 🔎 서버 q검색 (2026-07-12 스케일 검색) — 근접 바운드·뷰포트 로딩에 안 실린 **먼 매장**까지 잡는다.
 *   300ms 디바운스, 실패는 무해(로드분 클라 필터만으로도 동작).
 *
 * ⚠️ `readyFor` 가 이 훅의 진짜 산출물이다 — "이 질의의 결과가 정해졌다"는 신호로, `useSearchPan`
 *    이 그걸 기다린다. 없으면 결과가 0인 순간에 지도가 지명으로 날아가고, 뒤늦게 결과가 와도
 *    지도는 이미 딴 도시다(2026-09-03 사고의 절반).
 */
export function useSearchDeals<T>(search: string, category: string) {
  const [deals, setDeals] = useState<T[]>([])
  /** 지금 담긴 `deals` 가 어느 질의의 것인지(`질의|카테고리`). 미확정이면 빈 문자열. */
  const [readyFor, setReadyFor] = useState('')

  useEffect(() => {
    const q = search.trim()
    if (!q) { setDeals([]); return }
    const handle = setTimeout(() => {
      api.get('/api/group-buy/products', { params: { category, q, limit: 100 } })
        .then((r) => { if (r.data?.success && Array.isArray(r.data.data)) setDeals(r.data.data as T[]) })
        .catch(() => { /* silent — 로드분 클라 필터만으로 동작 */ })
        // 성공이든 실패든 "정해졌다"고 표시한다. 실패를 미확정으로 두면 지도가 영영 안 움직인다.
        .finally(() => setReadyFor(`${q}|${category}`))
    }, 300)
    return () => clearTimeout(handle)
  }, [search, category])

  return { deals, readyFor }
}
