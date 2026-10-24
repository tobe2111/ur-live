/**
 * 🖼️ 이미지 허브 표면 — 2026-10-24 (대표 "구글 이미지에서 이용권 사진 제목이 전부 홈 제목으로 같다").
 *
 * ## 왜
 * 구글 이미지는 사진 하나를 **처음·가장 자주 본 페이지**의 제목으로 보여 준다. 우리 상품 사진은 홈·지도·
 * 목록·유어샵 카드에 **같은 URL** 로 수십 번 실리고 상세엔 한 번 실린다 ⇒ 사진의 출처가 홈으로 잡혀
 * "유어딜 - 우리 동네 맛집…" 이라는 같은 제목이 수백 장에 붙었다(대표 화면). 이미지 검색에서 사진을 눌러도
 * 그 상품이 아니라 홈으로 간다.
 *
 * ## 무엇을
 * 사진을 **모아 보여 주기만 하는** 표면(허브)에 `<meta name="robots" content="noimageindex">` 를 붙인다.
 * 그 페이지 자체는 그대로 색인되고(`index, follow` 유지), **그 페이지의 사진만** 이미지 색인에서 빠진다
 * ⇒ 사진은 상세 페이지(`/pass/:id`·`/stays/:id`·`/products/:id`)를 출처로 다시 잡힌다.
 *
 * ## 🔒 사람 화면은 그대로
 * 메타 태그 하나다. 렌더·첫 화면·사진 로딩과 무관하다.
 *
 * ## 🔴 상세는 절대 넣지 않는다
 * 상세가 사진의 **정당한 출처**다. 상세에 붙이면 우리 사진이 이미지 검색에서 통째로 사라진다(에러 0).
 * 시험이 그 방향을 고정한다.
 *
 * ## 판정은 canonical 로
 * 쿼리(`?category=`)·끝 슬래시와 무관하게 같은 표면으로 보려고 **정본 주소의 경로**로 판정한다.
 */

/** 정확히 일치하는 허브 경로 — 목록·지도·홈. */
export const HUB_EXACT: ReadonlySet<string> = new Set([
  '/', '/map', '/browse', '/vouchers', '/stays', '/region', '/urshorts', '/videos',
])

/** 접두로 판정하는 허브 — 지역 허브(1~2단계) · 유어샵 · 사업자 가게 공개 페이지. 상세 접두(`/pass/` 등)는 없다. */
export const HUB_PREFIX: readonly RegExp[] = [
  /^\/region\/[^/]+(\/[^/]+)?$/,
  /^\/u\/[^/]+$/,
  /^\/s\/[^/]+$/,
  /^\/profile\/[^/]+$/,
]

export const NOIMAGEINDEX_META = '<meta name="robots" content="noimageindex" />'

/** 경로가 이미지 허브인가. 끝 슬래시는 떼고 본다(`/` 자체는 예외). */
export function isImageHubPath(pathname: string): boolean {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (HUB_EXACT.has(p)) return true
  return HUB_PREFIX.some(re => re.test(p))
}

/** 정본 주소(절대 URL)로 판정 — 파싱 실패면 허브가 아니다(붙이지 않는 쪽이 안전하다). */
export function isHubCanonical(canonical: string | null | undefined): boolean {
  if (!canonical) return false
  try {
    return isImageHubPath(decodeURI(new URL(canonical).pathname))
  } catch {
    return false
  }
}
