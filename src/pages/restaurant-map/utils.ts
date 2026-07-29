/**
 * 🛡️ 2026-05-02: TD-018 분할 — RestaurantMapPage 공유 유틸.
 */

// 카카오맵 길찾기 외부 링크 — 사용자 위치에서 매장까지
export function kakaoDirectionsUrl(r: { restaurant_name?: string; restaurant_lat?: number; restaurant_lng?: number }): string {
  const name = encodeURIComponent(r.restaurant_name || '맛집')
  return `https://map.kakao.com/link/to/${name},${r.restaurant_lat},${r.restaurant_lng}`
}

/** 📍 2026-07-19 (대표 UI v2 P1 — 거리 표시 로직): 10km 이상 딜은 km 라벨 대신 지역명(주소)을
 *  우선 표기 — 모든 카드가 주소를 이미 노출하므로 km 라벨을 10km 미만에서만 반환. */
export function nearKmLabel(km: number): string | null {
  return km < 10 ? `${km.toFixed(1)}km` : null
}

// Haversine 거리 계산 (km)
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// 🗺️ 2026-07-19 (대표 — 거리 표시 로직): 주소 → "서울 중구" 식 짧은 지역명.
//   10km 이상 원거리 딜은 "42km" 대신 지역명을 우선 노출(거리는 보조)하기 위한 표기용.
//   "서울특별시 중구 을지로…" → "서울 중구" (시/도 접미어 축약 + 앞 2토큰).
export function regionShort(address?: string | null): string {
  if (!address) return ''
  const tokens = address.trim().split(/\s+/)
  if (tokens.length === 0) return ''
  const sido = tokens[0].replace(/(특별시|광역시|특별자치시|특별자치도)$/, '')
  return tokens[1] ? `${sido} ${tokens[1]}` : sido
}

// 🏷️ 2026-07-19 (대표 — 카드 제목 중복 제거): 제목이 "한성식당 · 곱창전골 2인" 처럼 매장명으로
//   시작하면 매장명 프리픽스를 떼고 메뉴/오퍼명만 반환(매장명은 카드 보조 줄이 전담).
//   시드/heal 이 DB 를 신형으로 정정하지만, 셀러 수기 등록·구캐시 응답도 커버하는 표시측 방어.
//   구현 SSOT: @/utils/deal-title (구분자 일반화 버전 — "매장명 · " 외 공백/하이픈 등도 커버). 재수출만.
export { stripStorePrefix } from '@/utils/deal-title'
