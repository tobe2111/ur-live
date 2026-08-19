/**
 * 🖼️ 2026-08-19 (대표 시안 — 그루폰 카드 hover 캐러셀): 카드 갤러리 자르기 **SSOT**.
 *
 * 라이브 쿼리(`group-buy-public.routes`)와 materialized cron(`group-buy-feed-cache`)이 **같은 규칙**을
 * 써야 한다 — 한쪽만 자르면 캐시 hit 여부에 따라 페이로드가 달라진다(그리고 그건 조용하다).
 *
 * ## 왜 자르나 (트래픽/페이로드 보호)
 * 홈 한 화면에 카드가 50개다. 상품당 원본 갤러리가 5~8장이라 그대로 실으면 응답이 몇 배가 되고,
 * 그 페이로드는 SSR 0-RTT 주입과 엣지 캐시에도 그대로 올라탄다. 카드 캐러셀은 **커버 포함 4장**이면
 * 충분하므로 커버 중복을 뺀 3장만 남긴다.
 */

/** 커버를 제외하고 카드가 실어 나를 최대 장수. 커버까지 하면 캐러셀 4장. */
export const CARD_GALLERY_MAX = 3

/**
 * `products.images`(JSON 문자열)에서 커버 중복을 뺀 갤러리를 최대 `CARD_GALLERY_MAX` 장 돌려준다.
 * 값이 없거나 JSON 이 깨졌으면 **빈 배열** — 카드는 커버만으로 정상 동작한다(캐러셀만 안 뜬다).
 */
export function sliceCardGallery(raw: unknown, cover: unknown): string[] {
  if (typeof raw !== 'string' || !raw.startsWith('[')) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const coverUrl = String(cover ?? '')
    return arr
      .filter((u): u is string => typeof u === 'string' && !!u && u !== coverUrl)
      .slice(0, CARD_GALLERY_MAX)
  } catch {
    return []
  }
}
