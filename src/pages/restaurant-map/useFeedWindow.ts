/**
 * 🚦 2026-09-03 [UNLOCK_LOADING] (대표 "가장 이상적으로 하자") — 동네딜 목록의 **로딩 창(window)**.
 *
 * 이 훅이 답하는 질문은 하나다: **지금 화면에 필요한 만큼만 받았는가.**
 *   ① 정렬은 서버로 넘긴다 — 50개 안에서 정렬한 "할인 큰 순"은 거짓말이다.
 *      거리순은 `sort` 가 아니라 `near`(서버 거리 랭킹)가 담당하므로 sort 를 비운다.
 *   ② 서버가 못 걸러 주는 조건(지역 텍스트 매칭·반경·가격대·즐겨찾기)이 켜진 **그때만**
 *      `loadAll()` 로 나머지를 받는다 ⇒ 비용을 그 기능을 쓰는 사람에게만 부과한다.
 *   ③ 그래서 "N곳" 은 로드된 수가 아니라 서버의 `total` 로 말한다(필터가 없을 때).
 *
 * ⚠️ 이 훅이 **못 하는 것**: 검색(q)은 서버가 별도 경로로 매칭분을 합쳐 주므로 여기서 다루지 않는다.
 */
import { useEffect } from 'react'
import { useMapProducts } from '@/hooks/queries/useMapProducts'
import type { SortBy } from './types'

export function useFeedWindow(params: {
  category: string
  userLoc: { lat: number; lng: number } | null
  sortBy: SortBy
  /** 서버가 못 걸러 주는 필터가 켜졌나 — 켜지면 그때 전체를 받는다. */
  needsAll: boolean
}) {
  const { category, userLoc, sortBy, needsAll } = params
  // 거리순 = near 가 담당(서버 거리 랭킹). 나머지는 이름 그대로 서버 sort 화이트리스트와 1:1.
  const sort = sortBy === 'distance' ? '' : sortBy
  const feed = useMapProducts(category, userLoc, { sort })
  const { loadAll } = feed

  useEffect(() => {
    if (needsAll) void loadAll()
  }, [needsAll, loadAll])

  return { ...feed, needsAll }
}
