/**
 * 📍 마지막 측위 캐시 — **홈·상세·지도가 같이 읽는 SSOT**.
 *
 * 원래 이 둘은 `pages/group-buy/detail-derived.ts` 에 있었는데, 2026-09-05 에 홈이
 * 기본 정렬을 '가까운 순'으로 바꾸며 그걸 import 하자 **상세 페이지 모듈이 홈 첫 페인트
 * 청크로 딸려 왔다**(`home-chunk-diet` 가드가 잡았다 — app-components·app-features 를
 * 통째로 끌고 온다). 위치 캐시는 어느 화면의 것도 아니므로 공용 자리로 옮긴다.
 * `detail-derived` 는 재수출만 남겨 기존 호출부를 안 건드린다.
 *
 * 🔑 **위치를 새로 묻지 않는다.** 지도 홈·위치바가 저장해 둔 값만 읽는다 — 화면을 열었다고
 *   권한 팝업을 띄우는 건 과하고, 없으면 그 기능(거리 표시·거리순)을 조용히 접는다.
 */

/** 지도 홈(`RestaurantMapPage`)·위치바가 쓰는 것과 **같은 키**여야 한다. */
export const LAST_LOC_KEY = 'ur_last_loc_v1'

export function readCachedLoc(): { lat: number; lng: number } | null {
  try {
    const c = JSON.parse(localStorage.getItem(LAST_LOC_KEY) || 'null')
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat as number, lng: c.lng as number } : null
  } catch {
    return null
  }
}
