/**
 * 🧮 이용권 상세의 파생값 — 순수 함수만
 *
 * 상세 페이지 본문에 계산이 섞이면 파일이 커지고(래칫), 무엇보다 **눈으로만 검증하게 된다**.
 * 여기 있는 셋은 전부 "데이터가 없으면 그 자리를 비운다"는 같은 규칙을 따르고, 그 규칙이
 * 이 화면의 정직함을 지탱한다 — 없는 급함이나 없는 인기를 지어내지 않는다.
 */

/** 마지막 측위 캐시 키 — 지도 홈(`RestaurantMapPage`)이 쓰는 것과 **같은 키**여야 한다. */
export const LAST_LOC_KEY = 'ur_last_loc_v1'

/**
 * 위치는 **새로 묻지 않는다.** 지도 홈이 저장해 둔 마지막 측위만 읽는다 —
 * 상세를 열었다고 권한 팝업을 띄우는 건 과하고, 없으면 거리 자리를 그냥 비운다.
 */
export function readCachedLoc(): { lat: number; lng: number } | null {
  try {
    const c = JSON.parse(localStorage.getItem(LAST_LOC_KEY) || 'null')
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat as number, lng: c.lng as number } : null
  } catch {
    return null
  }
}

/**
 * 현위치 거리(km 문자열). 홈 카드(`GroupBuyFeedCard`)와 **같은 계산·같은 컷오프**다.
 * 10km 이상은 `null` — 그 거리에선 숫자가 도움이 안 되고 지역명이 낫다(홈 카드가 내린 결론).
 */
export function distanceKm(
  loc: { lat: number; lng: number } | null,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (!loc || lat == null || lng == null) return null
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat - loc.lat)
  const dLng = toRad(lng - loc.lng)
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(loc.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  const km = 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q))
  if (!Number.isFinite(km) || km >= 10) return null
  return km < 1 ? String(Math.round(km * 10) / 10) : String(Math.round(km))
}

/**
 * 마감까지 남은 날. **실제 마감일이 있을 때만** 숫자가 나온다.
 * ⚠️ 없는 급함을 지어내지 않는다 — 그게 화면에서 가장 티 나는 짓이고, 한 번 하면 다른 문구까지
 *    전부 의심받는다. 마감일이 없으면 `null` 이고 호출부는 띠를 안 그린다.
 */
export function daysLeft(deadline: string | null | undefined, parse: (s: string) => Date | null): number | null {
  if (!deadline) return null
  const t = parse(deadline)?.getTime()
  if (!t || !Number.isFinite(t)) return null
  const d = Math.ceil((t - Date.now()) / 86400000)
  return d >= 0 ? d : null
}
