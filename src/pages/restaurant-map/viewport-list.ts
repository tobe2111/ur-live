/**
 * 🗺️ 2026-07-15 (대표 — "지도 보는 위치에 따라 그 지역 이용권이 떠야 해" + 신고 "왜 18곳만?"):
 *   지도 모드에서 **현재 보이는 지도 영역의 딜을 리스트 위로** 올린다(당근/야놀자식 '이 지역 먼저').
 *   ⚠️ 숨기지 않는다 — 처음엔 뷰포트로 딱 잘라 82곳(전체 100)이 사라져 "왜 18곳만" 혼란이 났다.
 *   보이는 딜을 앞으로, 나머지는 뒤에 붙여 전체가 다 보이되 현 지역이 먼저 뜨게.
 *   (엄격한 '이 지역만' 은 지역 필터가 담당한다.)
 *
 * 📦 2026-09-03: RestaurantMapPage 에서 순수 함수로 추출(로직 불변). bounds 가 null 이면 원본 그대로 —
 *   호출부가 [리스트 모드 · 검색 중 · 줌아웃 집계 · bounds 미확정] 을 null 로 표현한다.
 */
import type { Restaurant } from './types'

export function pickViewportList(
  list: Restaurant[],
  bounds: { swLat: number; swLng: number; neLat: number; neLng: number } | null,
): { viewportList: Restaurant[]; viewportInCount: number | null } {
  if (!bounds) return { viewportList: list, viewportInCount: null }
  const { swLat, swLng, neLat, neLng } = bounds
  const mLat = (neLat - swLat) * 0.1, mLng = (neLng - swLng) * 0.1 // 경계 약간 여유
  const inView = (r: Restaurant) => !!(r.restaurant_lat && r.restaurant_lng &&
    r.restaurant_lat >= swLat - mLat && r.restaurant_lat <= neLat + mLat &&
    r.restaurant_lng >= swLng - mLng && r.restaurant_lng <= neLng + mLng)
  const inB: Restaurant[] = []; const rest: Restaurant[] = []
  for (const r of list) (inView(r) ? inB : rest).push(r)
  // 보이는 딜 먼저, 나머지 뒤에(숨김 없음) + 이 지역(뷰포트) 딜 수 = inB.length("이 지역 N · 전체 M" 카운트용)
  return { viewportList: inB.length ? [...inB, ...rest] : list, viewportInCount: inB.length }
}
