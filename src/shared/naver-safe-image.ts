/**
 * 🛡️ 2026-07-02 (대표 "영구적으로 해결") — 네이버 이미지 인증서/핫링크 깨짐 영구 차단 SSOT.
 *
 * 배경: 네이버 이미지검색의 원본 link 는 https 여도 깨진다 —
 *   `shop1.phinf.naver.net` 등 원본 호스트가 **호스트명과 불일치하는 인증서**를 서빙
 *   (ERR_CERT_COMMON_NAME_INVALID) + 핫링크 차단 호스트도 존재. "https-only 필터"로는 부족.
 *
 * 영구 해법: 원본 호스트를 **절대 직접 쓰지 않고**, 네이버 검색 자체가 쓰는 이미지 프록시
 *   `https://search.pstatic.net/common/?src=<원본>&type=<크기>` 로 항상 감싼다.
 *   search.pstatic.net 은 인증서 정상 + 원본을 서버측에서 fetch 해 재서빙 → 항상 로드.
 *   API 의 thumbnail 필드가 이미 이 프록시(type=b150 소형) — type 만 키워 재사용.
 *
 * 클라(ManualDealForm)와 워커(naver-image-search, seed heal) 공용 — 순수 함수만.
 */

const PROXY_HOST = 'https://search.pstatic.net/common/'

/** 이미 안전한(프록시) URL 인지 */
export function isNaverSafeImageUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(PROXY_HOST)
}

/**
 * 원본 link / API thumbnail 을 안전한 프록시 URL(큰 사이즈)로 변환.
 * - thumbnail(이미 프록시)이 있으면 type 파라미터만 상향.
 * - 아니면 원본 link 를 프록시로 감쌈.
 * - 둘 다 없으면 null.
 */
export function toNaverSafeImageUrl(
  link: string | null | undefined,
  thumbnail?: string | null,
  size = 'sc960',
): string | null {
  if (thumbnail && thumbnail.startsWith(PROXY_HOST)) {
    // 기존 type=bXXX → 상향. type 파라미터 없으면 append.
    return /[?&]type=/.test(thumbnail)
      ? thumbnail.replace(/([?&]type=)[^&]*/, `$1${size}`)
      : `${thumbnail}${thumbnail.includes('?') ? '&' : '?'}type=${size}`
  }
  const raw = (link || thumbnail || '').trim()
  if (!raw) return null
  if (raw.startsWith(PROXY_HOST)) return toNaverSafeImageUrl(null, raw, size)
  if (!/^https?:\/\//.test(raw)) return null
  return `${PROXY_HOST}?src=${encodeURIComponent(raw)}&type=${size}`
}

/**
 * 저장된 image_url 이 "깨질 수 있는" 네이버 원본/HTTP 인지 → 치유(프록시 랩) 필요 여부.
 * 대상: phinf.* (인증서 불일치 상습) · *.naver.net 원본 · http:// 전부(mixed content).
 */
export function needsNaverImageHeal(url: string | null | undefined): boolean {
  if (!url) return false
  if (isNaverSafeImageUrl(url)) return false
  if (url.startsWith('http://')) return true
  return /https:\/\/[^/]*(?:phinf|naver\.net)/i.test(url)
}
