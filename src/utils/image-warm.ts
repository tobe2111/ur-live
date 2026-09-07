/**
 * 🔥 **방금 본 사진을 기억한다** — 카드 → 상세 전환에서 사진이 "늦게 반응"하지 않게 (2026-09-02).
 *
 * ## 문제
 * 홈 카드 사진(폭 600)은 이미 브라우저 캐시에 있다. 그런데 상세 히어로는 **다른 변형**(900×600 크롭)을
 * 요청하므로 클릭 직후 화면은 **회색 프레임**이고, 콜드 콜로면 1~4초 뒤에야 사진이 뜬다.
 * 대표: *"클릭하면 늦어 반응이."* 데이터(SSR 시드·RQ 캐시)는 0ms 인데 **사진만** 늦었다.
 *
 * ## 처방 — 이미 받은 변형을 밑에 깐다
 * 카드가 사진을 **실제로 어떤 URL 로 받았는지**(`img.currentSrc` — srcSet 이 고른 밀도까지 정확히)
 * 원본 URL 키로 기억해 둔다. 상세는 히어로 배경을 `url(고해상), url(카드에서 본 것)` **두 겹**으로
 * 깐다 — CSS 다중 배경은 앞이 위다. 아래 겹은 캐시에서 **즉시** 그려지고, 위 겹이 도착하면 덮는다.
 * JS 도, 상태도, 추가 요청도 없다(카드 변형은 이미 캐시라 재요청 0).
 *
 * ## 한계
 * - SPA 전환에서만 효과가 있다. 하드로드는 워커 preload 가 맡는다(`shared/detail-hero-image`).
 * - 메모리 맵이라 탭을 닫으면 사라진다. 그게 맞다 — 캐시에 없을 사진을 기억해 봐야 소용없다.
 */
const warm = new Map<string, string>()
const MAX = 300

/** 카드 커버가 로드됐을 때 부른다. `currentSrc` 가 비어 있으면(아직 미결정) 아무것도 안 한다. */
export function rememberWarmImage(src: string | null | undefined, currentSrc: string | null | undefined): void {
  if (!src || !currentSrc) return
  if (warm.size >= MAX) {
    const first = warm.keys().next().value
    if (first !== undefined) warm.delete(first)
  }
  warm.set(src, currentSrc)
}

/** 원본 URL 로 "이 브라우저가 이미 받아 둔 변형"을 돌려준다. 없으면 null. */
export function getWarmImage(src: string | null | undefined): string | null {
  if (!src) return null
  return warm.get(src) ?? null
}
