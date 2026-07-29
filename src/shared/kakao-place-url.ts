/**
 * 🎯 2026-07-01 (대표 예시 — 김밥천국 kko.to 링크): 카카오 장소/지도/공유 링크 검증 (URL 주입 방지).
 *
 * 허용 형식:
 *   - https://place.map.kakao.com/{id}   (장소 상세 페이지 — 검색기가 자동 캡처)
 *   - https://map.kakao.com/...          (지도 링크)
 *   - https://kko.to/{code}              (카카오맵 '공유' 단축링크 — 붙여넣기)
 * 그 외 도메인은 거부 → RestaurantMiniMap 이 임의 URL 로 열리지 않게.
 */
const KAKAO_PLACE_URL_RE = /^https?:\/\/(place\.map\.kakao\.com\/\d+|map\.kakao\.com\/|kko\.to\/[A-Za-z0-9_-]+)/

export function isValidKakaoPlaceUrl(url: unknown): url is string {
  return typeof url === 'string' && KAKAO_PLACE_URL_RE.test(url.trim())
}

/** 검증 후 https 정규화. 유효하지 않으면 null. */
export function normalizeKakaoPlaceUrl(url: unknown): string | null {
  if (!isValidKakaoPlaceUrl(url)) return null
  return url.trim().replace(/^http:/, 'https:')
}
