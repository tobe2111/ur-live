/**
 * 🧮 이용권 상세의 파생값 — 순수 함수만
 *
 * 상세 페이지 본문에 계산이 섞이면 파일이 커지고(래칫), 무엇보다 **눈으로만 검증하게 된다**.
 * 여기 있는 셋은 전부 "데이터가 없으면 그 자리를 비운다"는 같은 규칙을 따르고, 그 규칙이
 * 이 화면의 정직함을 지탱한다 — 없는 급함이나 없는 인기를 지어내지 않는다.
 */

/**
 * 📍 위치 캐시는 **공용 SSOT**(`@/shared/utils/cached-loc`)로 옮겼다 — 홈이 기본 정렬을
 *   '가까운 순'으로 바꾸며 이 파일을 import 하자 상세 모듈이 홈 첫 페인트 청크로 딸려 왔다
 *   (`home-chunk-diet` 가드가 잡았다). 여기서는 재수출만 해 기존 호출부를 안 건드린다.
 */
export { LAST_LOC_KEY, readCachedLoc } from '@/shared/utils/cached-loc'

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
