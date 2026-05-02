/**
 * 🛡️ 2026-05-02: TD-018 분할 — RestaurantMapPage 공유 유틸.
 */

// 카카오맵 길찾기 외부 링크 — 사용자 위치에서 매장까지
export function kakaoDirectionsUrl(r: { restaurant_name?: string; restaurant_lat?: number; restaurant_lng?: number }): string {
  const name = encodeURIComponent(r.restaurant_name || '맛집')
  return `https://map.kakao.com/link/to/${name},${r.restaurant_lat},${r.restaurant_lng}`
}

// Haversine 거리 계산 (km)
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
