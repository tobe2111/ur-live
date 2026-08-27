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

/**
 * 목록 응답의 각 행에서 `images` 를 카드용으로 잘라 새 행을 돌려준다.
 *
 * 🩸 2026-08-27: 원래 이 함수는 `ProductRepository` 안의 **비-export 지역 함수**였다. 그래서 배선
 *   가드(호출이 4곳인가)는 있는데 **몸통을 통째로 무력화해도 초록**이었다 — 주입 검증에서 드러났다
 *   (`if (row.images == null) return r` 를 `return r` 로 바꿔도 통과). 이 레포가 반복해 만난
 *   "가드가 실패할 수 없음" 클래스라, 자르는 쪽 SSOT 로 끌어올려 **동작 자체를 테스트**하게 한다.
 *
 * `images` 가 없는 행은 **손대지 않고 그대로** 돌려준다(빈 배열을 새로 만들지 않는다 — 그러면
 * 갤러리를 안 쓰는 소비자에게 없던 필드가 생긴다).
 */
export function capRowGalleries<T>(rows: T[]): T[] {
  return rows.map((r) => {
    const row = r as unknown as { images?: unknown; image_url?: unknown }
    if (row.images == null) return r
    return { ...(r as object), images: sliceCardGallery(row.images, row.image_url) } as T
  })
}
