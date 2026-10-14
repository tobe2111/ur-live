/**
 * 🏪 `/s/:username`(사업자 유어샵)의 **크롤러용 본문 요약** (2026-10-14 신설)
 *
 * ## 실측 — 이 표면만 통째로 비어 있었다
 * Googlebot UA 로 sitemap 제출 URL 을 전수로 받아 `#root` 안의 글자를 셌더니, 가게 유어샵 3건 중
 * **2건이 6자**(`urdeal` 워드마크뿐)였다 — `/s/store_mt9rvbhg1i6`(홍대돈까스)·
 * `/s/store_muxlddtf74b`(달빛한스푼). `sitemap.routes.ts` 가 스스로 ③으로 적어 둔 **미해소** 항목이고,
 * 그 주석은 *"페이로드에 상품이 안 담겨"* 라고만 적었는데 **더 나빴다**: 페이로드를 열어 보니
 * `bio`·`business_address`·`profile_image`·SNS·`website_url` 이 **전부 null** 이고 이름뿐이었다.
 *
 * ## 🔴 왜 2건이 아니라 구조 문제인가
 * D1 실측 — 승인 셀러 **10곳 중 `linked_user_id` 가 있는 곳은 1곳**이고(`seller_operators(owner)` 도
 * 1곳), 2026-10-10 기록대로 `/store/new`(유일한 가입 문)는 그 컬럼을 **비운다.** sitemap 은
 * `s.handle ? '/u/'+handle : '/s/'+username` 으로 갈리므로 ⇒ **앞으로 등록되는 모든 매장의 유어샵
 * URL 이 `/s/store_xxx`** 다. 지금 2건인 것은 매장이 2곳이라서일 뿐이다.
 *
 * ## 🧷 왜 첫 화면이 아니라 `<noscript>` 인가
 * `#root` 를 텍스트로 채우면 마운트 때 통째로 교체돼 깜빡인다. `<noscript>` 는 JS 가 돌면 **렌더조차
 * 안 되므로** 사람 화면 byte-동일 · 밀림 0 이다(이 파일 계열의 존재 이유 그대로). 그리고 Googlebot 은
 * JS 를 렌더해 어차피 상품을 보지만 **네이버 Yeti·AI 검색봇은 이 문서가 전부**다.
 *
 * ## 규율
 * - **지어내지 않는다** — 들어가는 값은 전부 그 페이로드이고, `SellerPublicPage` 가 화면에 그리는 것
 *   (가게 이름 · 소개 · 상품 카드의 이름/가격/할인)과 같은 말이다.
 * - **이름만 남으면 아무것도 내지 않는다** — 그 이름은 `<title>`·`og:title` 이 이미 말한다.
 *   이름만 넣으면 글자수는 늘지만 thin 인 사실은 그대로다(측정만 좋아 보인다).
 *   `buildCuratorNoscript` 가 같은 판단을 적어 둔 그 규율이다.
 * - **행 조립을 다시 쓰지 않는다** — `rowLine`/`liOf`/`capRowImages`(목록·지역 표면이 쓰는 것)를
 *   그대로 쓴다. 그래서 링크 주소(`canonicalDetailPath` SSOT) · 사진 상한 · 가격 표기 · 가게명 중복
 *   제거가 **자동으로 같다**. 손으로 다시 쓰면 반드시 갈린다.
 * - **h1 을 낸다** — 이 표면은 서버 첫 화면이 **없으므로** 규율 ②(첫 화면이 제목을 그리면 h1 을
 *   넣지 않는다)의 전제가 성립하지 않는다. 2026-10-12 heading 전수에서 색인 대상 23표면 중 17개가
 *   heading 0 이었고 그 처방과 같은 자리다.
 *
 * ⚠️ **이 파일이 안 하는 것**: 메타·OG·JSON-LD(그쪽 SSOT 는 `surface-ssr-meta.ts`) · 사업자 주소·
 *    대표자·사업자번호(그 값들은 라이브에서 전부 null 이고, **차 있더라도** 유어샵의 사업자정보
 *    섹션은 접힌 영역이라 본문 요약의 재료로 쓸지는 따로 판단할 일이다).
 */
import { esc, capRowImages, liOf, rowLine, type RegionSeedRow, type Row } from './crawler-noscript-rows'
import { h1Of } from './crawler-noscript'

/** `<noscript>` 도 **사람이 받는 응답에 그대로 실린다** — 요약이지 전량 덤프가 아니다(목록 표면과 같은 상한). */
const ROW_MAX = 8

type SellerSeed = {
  name?: string | null
  bio?: string | null
  products?: unknown[] | null
}

/**
 * SELLER 시드(`{ success, data: {...} }`) → `<noscript>` 요약. 재료가 없으면 `''`
 * (그러면 워커가 종전처럼 로더만 둔다 — 무회귀).
 */
export function buildSellerNoscript(ssrPayload: string | null | undefined): string {
  if (!ssrPayload) return ''
  let s: SellerSeed | undefined
  try {
    s = (JSON.parse(ssrPayload) as { data?: SellerSeed } | null)?.data
  } catch {
    return ''
  }
  if (!s) return ''
  const name = String(s.name || '').trim()
  const bio = String(s.bio || '').trim()
  const rows: Row[] = []
  for (const p of Array.isArray(s.products) ? s.products : []) {
    // 🩸 **빌더를 돌려 보고 고쳤다** — `rowLine` 은 행 머리에 `restaurant_name || brand_name` 을
    //   붙이는데(목록·지역 표면에서는 그게 유일한 가게 단서다) **이 페이지는 그 가게 자신**이라
    //   h1 이 이미 말한 이름을 줄마다 되풀이했다: `홍대돈까스 유어샵 홍대돈까스 — 홍대 돈가스 …`.
    //   이 레포가 `storeNameParts` 를 둔 이유("같은 말을 두 번 안 한다")와 정면으로 어긋난다.
    //   ⇒ 머리를 떼고 상품명만 남긴다(사진 `alt` 도 그 이름이 된다 — 제 페이지에선 그게 맞다).
    //   🔎 그리고 `restaurant_name` 이 가게 이름과 **다른** 경우(유어샵 주인 이름 ≠ 매장명)에도
    //      떼는 쪽을 고른다 — 상품 카드가 화면에 그리는 것은 이름·가격이고, 거기 없는 말을
    //      요약에 넣는 것은 클로킹 쪽이다.
    const line = rowLine({ ...(p as RegionSeedRow), restaurant_name: null, brand_name: null })
    if (line) rows.push(line)
    if (rows.length >= ROW_MAX) break
  }
  // 🔴 이름만 남는 경우 — 아무것도 내지 않는다(위 규율).
  if (!bio && !rows.length) return ''
  const head = h1Of(name ? `${name} 유어샵` : '')
  const items = rows.length ? `<ul>${capRowImages(rows).map(liOf).join('')}</ul>` : ''
  return `<noscript>${head}${bio ? `<p>${esc(bio)}</p>` : ''}${items}</noscript>`
}
