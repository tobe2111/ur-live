/**
 * 🗺️ 지도(`/map`) 첫 화면 시드 — 워커가 미리 받아 둘 요청과 화면이 실제로 보내는 요청을 **한 곳**에서 정한다.
 *   (2026-10-11 [UNLOCK_LOADING] — 대표 "로딩 개선 둘 다 진행")
 *
 * 왜 필요한가: 홈은 워커가 `__SSR_INITIAL_MAIN__` 을 실어 줘서 첫 화면에 바로 카드가 뜨는데, 지도는 시드가
 *   **없었다.** 지도는 처음부터 `sort=discount`(할인 큰 순)로 요청해서 홈 시드(무정렬)와 페이로드가 달라
 *   그 시드를 못 쓴다. 그래서 하드로드마다 [로더 → 마운트 → 목록 요청 → 카드] 로 한 왕복을 더 기다렸다.
 *
 * ⚠️ 캐시 키가 곧 경로다. 워커 self-fetch · cron 예열(HOT_PATHS) · 전역 KV(SSR_KV_PATHS) · 화면 요청이
 *   **글자 하나까지** 같아야 미리 데운 것을 쓴다. 그래서 화면 요청 파라미터도 여기서 만든다(`mapFeedParams`).
 *   cron 목록은 문자열 리터럴이어야 해서(파서가 읽는다) 거기엔 같은 문자열을 손으로 적고, 시험이 대조한다.
 */

/** 위치를 모르는 사람이 지도를 열 때의 기본 정렬. `RestaurantMapPage` 의 초기값과 같아야 한다. */
export const MAP_SEED_SORT = 'discount' as const

/** 첫 화면 요청 — `mapFeedParams('all', 1, null, MAP_SEED_SORT)` 를 직렬화한 값과 byte-일치. */
export const MAP_SEED_PATH = '/api/group-buy/products?category=all&sort=discount'

export type FeedNear = { lat: number; lng: number } | null | undefined

/**
 * `/api/group-buy/products` 요청 파라미터. **삽입 순서가 곧 쿼리 문자열 순서**다(axios 가 그대로 직렬화).
 *   page1 은 파라미터를 최소로 — 정렬/near 가 없으면 무파라미터 기본 요청(= materialized·SSR 과 같은 캐시 경로).
 */
export function mapFeedParams(category: string, page: number, near: FeedNear, sort: string, pageSize: number): Record<string, string | number> {
  const params: Record<string, string | number> = { category }
  if (page > 1) { params.page = page; params.limit = pageSize }
  if (sort) params.sort = sort
  if (near) { params.near = `${near.lat},${near.lng}`; if (page === 1) params.limit = pageSize }
  return params
}

/** 이 화면 상태가 워커 시드와 같은 요청인가 — 같을 때만 시드를 쓴다(다른 요청의 답을 쓰면 거짓 목록이다). */
export function isMapSeedRequest(category: string, near: FeedNear, sort: string): boolean {
  return category === 'all' && !near && sort === MAP_SEED_SORT
}
