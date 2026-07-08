/**
 * 🛡️ 네이버 이미지 저장 정규화 SSOT — 2026-07-02 v2 (라이브 콘솔 증거 기반 방향 전환).
 *
 * v1(같은 날 오전)은 `https://search.pstatic.net/common/?src=<원본>&type=sc960` 프록시로 감쌌으나,
 * **라이브 콘솔 실측으로 그 프록시가 404 를 반환**함이 확인됨(비네이버 원본 yt3 는 물론
 * `imgnews.naver.net` 조차 404 — 네이버 내부 전용 프록시라 외부발 임의 src 를 거부).
 *
 * v2 영구 해법: **DB 에는 항상 원본 URL 을 저장**하고, 깨짐 방지는 렌더 시점의
 * `cfImage()`(cf-image.ts) 가 담당 — phinf.naver.net/pstatic.net/imgnews 등이 CDN_CGI_VERIFIED
 * 에 등재되어 zone 리사이저가 서버측에서 원본(http 포함)을 fetch 해 same-origin https 로 서빙
 * (라이브 실측 `cf-resized: internal=ok`, 인증서/CSP/mixed-content 문제 원천 소멸).
 *
 * 함수 시그니처는 v1 과 동일(호출부 무수정) — 의미만 "프록시 랩" → "원본 정규화(un-wrap)".
 * 클라(ManualDealForm)와 워커(naver-image-search, seed heal) 공용 — 순수 함수만.
 */

const PROXY_HOST = 'https://search.pstatic.net/common/'

/** v1 프록시로 감싸진(=치유 대상) URL 인지 */
export function isNaverSafeImageUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(PROXY_HOST)
}

/** search.pstatic 프록시 래퍼에서 원본 src 를 추출. 래퍼가 아니면 그대로 반환. */
function unwrapProxy(url: string): string {
  if (!url.startsWith(PROXY_HOST)) return url
  try {
    const src = new URL(url).searchParams.get('src')
    if (src && /^https?:\/\//.test(src)) return src
  } catch { /* 파싱 실패 — 원문 유지 */ }
  return url
}

/**
 * 저장용 이미지 URL 정규화 — **항상 원본**을 반환.
 * - link 우선. link 가 프록시 래퍼면 src 추출(un-wrap).
 * - link 없으면 thumbnail 에서 un-wrap 시도.
 * - 렌더 시 cfImage() 가 원본을 안전하게 변환하므로 여기서 감싸지 않는다.
 */
export function toNaverSafeImageUrl(
  link: string | null | undefined,
  thumbnail?: string | null,
  _size = 'sc960',
): string | null {
  const raw = (link || thumbnail || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//.test(raw) && !raw.startsWith(PROXY_HOST)) return null
  const original = unwrapProxy(raw)
  return /^https?:\/\//.test(original) ? original : null
}

/**
 * 저장된 image_url 치유 필요 여부 — v1 프록시 래퍼(404 유발)만 대상.
 * 원본 http://·phinf 등은 더 이상 치유 불필요(렌더 시 cfImage 가 처리).
 */
export function needsNaverImageHeal(url: string | null | undefined): boolean {
  return isNaverSafeImageUrl(url)
}
