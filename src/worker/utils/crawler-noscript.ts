/**
 * 📰 **JS 를 안 돌리는 크롤러에게 줄 본문 요약(`<noscript>`)의 SSOT**
 * (2026-10-11 대표 *"네이버도 해주고 … 언제나 최상단에 노출이 될 수 있게끔"*)
 *
 * ## 왜 필요한가 — 제목은 완벽한데 본문이 49자였다 (라이브 실측, Yeti UA)
 *
 *     /pass/2915   본문 49자   "홈 / 식사 이용권 홍대돈까스 홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트 urdeal"
 *     /vouchers/…  본문 37자
 *
 * `<title>`·`og:*`·`canonical`·JSON-LD·네이버 확인 메타는 **전부 완비**였다. 빠진 것은 **본문**
 * 하나다. 서버 첫 화면(2026-09-15~10-09)이 그리는 것은 [빵부스러기 · 사진 · 제목]까지이고 —
 * 그건 의도다(그 아래는 per-user 값이거나 거리처럼 서버가 모르는 값이라 그리면 마운트 때 밀린다).
 * 그래서 사람에게는 맞지만 **크롤러에게는 "내용 없는 페이지"** 로 남았다. 네이버는 문서의 텍스트로
 * 주제를 판단하므로 49자는 롱테일 검색어(`홍대돈까스 할인`·`전주 돈가스 이용권`)에 걸릴 수가 없다.
 *
 * ⇒ `<noscript>` 는 **정확히 이 틈에 맞는 도구**다: JS 가 돌면 브라우저가 렌더하지 않고(사람에게
 * 영향 0), JS 를 안 돌리는 크롤러(Yeti·AI 검색)는 읽는다. 구글은 JS 를 돌려 무시하지만 구글은
 * 이미 마운트된 실제 본문을 본다.
 *
 * ## 🔒 두 가지 규율 — 이게 클로킹과 정직한 요약을 가르는 선이다
 *
 * **① 화면에 없는 문구를 지어내지 않는다.** 여기 들어가는 값은 전부 시드(`__SSR_INITIAL_*`)의
 *    필드이고, 그 필드는 마운트된 화면에 그대로 보인다. "매장에서 QR 을 보여 주세요" 같은
 *    *그럴듯한 안내문*을 내가 작성해 넣으면 — 화면 문구가 바뀌는 날 둘이 갈리고, 그건 크롤러에게만
 *    다른 내용을 주는 것이 된다(클로킹). 안내 문구가 필요하면 시드에 실어 와서 쓸 것.
 *
 * **② 첫 화면이 이미 그린 것은 다시 쓰지 않는다.** 제목(h1)·매장명은 같은 `#root` 안에 이미 있다.
 *    `<noscript>` 에 또 넣으면 크롤러가 같은 문구를 두 번 보고, 그건 정보가 아니라 반복이다.
 *    ⇒ 여기 담는 것은 **첫 화면이 안 그리는 것만**: 가격·정가·할인 · 주소 · 전화 · 설명 ·
 *    유효기간 · 유의사항.
 *
 * ## ❌ 이 파일이 안 하는 것
 * - 메타·OG·JSON-LD 는 건드리지 않는다(`detail-ssr-meta.ts`·`surface-ssr-meta.ts` 가 SSOT).
 * - 값이 없으면 **그 줄을 만들지 않는다**(빈 라벨 `주소:` 만 남는 것이 없는 것보다 나쁘다).
 * - 길이를 늘리려고 같은 값을 변형해 반복하지 않는다.
 */
import { priceDisplay } from '../../shared/price-display'
import { stayRegionShort } from '../../shared/stay-address'
import { canonicalDetailPath, FLOW_CONFIG } from '../../shared/product-flow'
import { CONCEPT_FAQ, CONCEPT_ABOUT_LINES } from '../../shared/seo/concept-content'
import { parseRegionPath, type RegionRef } from '../../shared/constants/region-slugs'
import { REGION_PATH_RE } from '../../shared/seo/region-seed'
import { regionChildLinks, REGION_NOSCRIPT_ROWS } from '../../shared/seo/region-digest'
import { voucherFacetLinks } from '../../shared/seo/voucher-facet'
import { CONSUMER_SURFACE_SEO } from '../../shared/seo/consumer-surfaces'
import { REGION_HUB_CRUMB } from './surface-list-jsonld'
import { buildUrshortsNoscript } from './urshorts-noscript'
import { surfaceCopyFor, lifeChildLinks } from '../../shared/seo/surface-copy'
import { CONSUMER_TERMS } from '../../pages/terms/consumer-terms-content'
import { SELLER_TERMS } from '../../pages/terms/seller-terms-content'
import type { TermsDoc } from '../../pages/terms/terms-types'
// 🧾 행·글자 조립은 `crawler-noscript-rows.ts` 로 추출됐다(2026-10-14, 685줄 → 래칫 600 초과).
//    `esc` 는 밖에서도 쓰므로(`urshorts-noscript.ts`) 여기서 다시 export 한다.
import {
  esc, won, lines, wrap,
  capRowImages, liOf, rowHref, rowLine, parseSeed, regionSeedRows, sizedCdnCgi,
  type RegionSeedRow, type Row,
} from './crawler-noscript-rows'
export { esc }
export type { RegionSeedRow, Row }

/**
 * 🏷️ 그 표면의 **제목 한 줄**(`<h1>`). 전수 실측표·판단 근거는 가드 머리말에 있다
 * (`src/tests/unit/crawler-heading-2026-10-12.test.ts`) — 색인 대상 23표면 중 **17개가 heading 0**
 * 이었고, h1 이 있던 여섯은 전부 **서버 첫 화면이 제목을 그리는** 표면이었다.
 *
 * 🔑 **새 문구를 쓰지 않는다** — 값은 그 표면의 **마지막 빵부스러기 단계**(`crumb`)이고, 목록·지역
 *    에서는 이미 본문 머리줄(`<p>`)로 떠 있던 같은 글자다(요소만 바뀐다 ⇒ 클로킹 불가 · 규율 ①).
 * 🔴 **첫 화면이 제목을 그리는 표면에는 넣지 않는다**(규율 ②) — 쓰는 곳은
 *    `buildStaticSurfaceNoscript` 뿐이다. `buildDetail/Stay/CuratorNoscript` 에 넣으면 한 문서에
 *    h1 이 둘이 된다(주입이 그 방향을 고정).
 * 🔴 **빈 라벨이면 아무것도 내지 않는다** — noindex 표면은 `crumb` 를 일부러 비워 둔다.
 */
export function h1Of(text: string | null | undefined): string {
  const t = String(text || '').trim()
  return t ? `<h1>${esc(t)}</h1>` : ''
}

/**
 * ⭐ 2026-10-14 — **평점 한 줄.** 숙소(`buildStayNoscript`)와 이용권(`buildDetailNoscript`)이
 * **같은 함수**를 쓴다.
 *
 * 🩸 **왜 SSOT 인가(라이브 실측)**: 숙소는 본문에 `평점 4.6 (9개 리뷰)` 를 내는데 이용권은
 *    **안 냈다** — `/pass/:id` **310건 중 약 294건(95%)** 이 `avg_rating`·`review_count` 를
 *    갖고 있고 JSON-LD `Product.aggregateRating` 으로는 멀쩡히 내보내면서(실측 `/pass/2793`
 *    `ratingValue 4.7 · reviewCount 9`) **크롤러 본문엔 그 숫자가 한 글자도 없었다.**
 *    `NoscriptDetailSeed` 에 두 필드가 선언돼 있지 않았을 뿐이고(값은 시드에 이미 와 있다)
 *    **에러가 안 나서** 아무도 몰랐다. #83(숙소 `Product` 별점)과 같은 비대칭이다.
 *
 * 🔑 **JSON-LD 가 있는데 왜 본문에도 쓰나**: 둘은 다른 층이다 — 구조화 데이터는 *리치결과*를,
 *    본문 텍스트는 *스니펫·인용*을 만든다. AI 검색엔진은 본문을 인용하고, 네이버는
 *    schema.org `aggregateRating` 지원이 구글보다 약하다.
 *
 * 🔴 **리뷰가 0이면 아무것도 내지 않는다** — 2026-10-11 에 `ratingValue: 0` 으로 값을 치른
 *    그 자리다(평점 0점짜리 상품이라고 말하는 셈이고 구글 정책 위반이다).
 */
export function ratingLine(avg: unknown, count: unknown): string {
  const rating = Number(avg) || 0
  const reviews = Number(count) || 0
  return rating > 0 && reviews > 0 ? `평점 ${rating.toFixed(1)} (${reviews}개 리뷰)` : ''
}

export interface NoscriptDetailSeed {
  name?: string | null
  description?: string | null
  long_description?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  restaurant_phone?: string | null
  voucher_expiry?: string | null
  voucher_terms?: string | null
  /** ⭐ 2026-10-14 — 평점(`ratingLine` 머리말에 실측·근거). 시드에 이미 오던 값이다. */
  avg_rating?: number | null
  review_count?: number | null
  /** 🖼️ 2026-10-14 — 쇼핑 상세 사진 한 장(근거는 `rowImg` 머리말). */
  image_url?: string | null
}

/**
 * 이용권·교환권 상세의 본문 요약.
 *
 * 규율 ②에 따라 **제목·매장명은 넣지 않는다** — 첫 화면의 h1 과 매장 줄이 이미 그 둘을 말한다.
 * 다만 주소 줄의 앞머리로 매장명이 필요하면 호출부가 아니라 여기서 판단하지 않는다(안 넣는다).
 */
export function buildDetailNoscript(d: NoscriptDetailSeed | null | undefined): string {
  if (!d) return ''
  const p = priceDisplay({ price: d.price, original_price: d.original_price, discount_rate: d.discount_rate })
  const priceLine = p.price > 0
    ? (p.hasDiscountLine && p.showOriginal
        ? `판매가 ${won(p.price)}원 · 정가 ${won(p.originalPrice)}원${p.discount > 0 ? ` · ${p.discount}% 할인` : ''}`
        : `판매가 ${won(p.price)}원`)
    : ''

  // 📍 주소·전화는 **로컬 검색의 본체**다(`전주 돈가스`·`가리내10길` 류). 화면 매장 카드에 그대로 있다.
  const addr = (d.restaurant_address || '').trim()
  const phone = (d.restaurant_phone || '').trim()
  const placeLine = addr || phone
    ? [addr && `주소 ${esc(addr)}`, phone && `전화 ${esc(phone)}`].filter(Boolean).join(' · ')
    : ''

  // 설명은 제목과 같을 때가 흔하다(시드 실측) — 같으면 반복이라 버린다(규율 ②).
  const name = (d.name || '').trim()
  const desc = (d.long_description || d.description || '').trim()
  const descLine = desc && desc !== name ? esc(desc) : ''

  const expiry = (d.voucher_expiry || '').trim()
  const terms = (d.voucher_terms || '').trim()

  return wrap(lines([
    priceLine && esc(priceLine),
    // ⭐ 자리는 **숙소와 같다**(가격 → 평점 → 주소) — 두 상세가 같은 순서로 읽힌다.
    ratingLine(d.avg_rating, d.review_count),
    placeLine,
    descLine,
    expiry && `유효기간 ${esc(expiry)}`,
    terms && esc(terms),
  ]))
}

export interface NoscriptStaySeed {
  product?: {
    name?: string | null
    restaurant_name?: string | null
    description?: string | null
    description_full?: string | null
    region_sido?: string | null
    region_sigungu?: string | null
    address?: string | null
    star_rating?: number | null
    avg_rating?: number | null
    review_count?: number | null
  } | null
  rooms?: Array<{ name?: string | null; base_price_weekday?: number | null } | null> | null
}

/**
 * 🏨 2026-10-12 — 숙소 상세(`/stays/:id`)의 본문.
 *
 * ## 왜 필요한가 (라이브 실측 · Googlebot UA)
 * 이 URL 이 **정본**(`canonicalDetailPath`)인데 크롤러가 받는 본문이 **6자**(`urdeal` — 로더뿐)였다.
 * 같은 상품의 `/pass/:id` 는 **188자**(가게·상품·판매가·정가·할인·주소·전화)였다 — 정본이 더 빈
 * 상태였던 것이고, 그 상태로 canonical 을 이쪽으로 모으면 리치 페이지에서 빈 페이지로 옮기는 셈이다.
 *
 * ## 왜 `<noscript>` 인가
 * `<noscript>` 는 **JS 가 돌면 렌더조차 안 되므로** 사람 화면이 byte-동일하고 **밀림이 0** 이다.
 * 첫 화면이 그리는 것(제목·성급)과 달리 주소·가격·객실은 그릴 수 없어(아이콘 SVG·거리 등 —
 * `stay-detail-ssr-body.ts` 의 "❌ 안 그리는 것") 그 몫을 여기서 배달한다.
 *
 * ## 🔀 2026-10-12 후속 — 첫 화면이 생겼다. `skipTitle` 이 그 짝이다
 * 이 주석은 한때 *"이 표면은 서버 첫 화면이 없다"* 고 적혀 있었고 그래서 규율 ②(**첫 화면이 그린
 * 것은 다시 쓰지 않는다**)를 면제받았다. 같은 날 `buildStayDetailFirstScreen` 이 생겨 그 전제가
 * 사라졌다 ⇒ 첫 화면을 **실제로 그린 경우에만** `skipTitle` 로 숙소명·성급을 뺀다.
 *
 * 🔴 **무조건 빼면 안 된다** — 첫 화면은 사진이 없거나 시드 파싱이 실패하면 `''` 를 돌려주고
 *    워커가 `<noscript>` + 로더로 폴백한다. 그때 숙소명까지 빠지면 **본문이 다시 비어** 이 수리가
 *    도로 무효가 된다(에러는 안 난다). 그래서 판정은 호출부(워커)가 한다.
 * ⚠️ 값은 **시드에 있는 것만**. `price` 는 이 페이로드에 없고(숙소 API 는 매장 지향 컬럼을 고른다)
 *    객실 가격에서만 범위를 만든다 — 하나의 정가를 지어내지 않는다(규율 ①).
 */
export function buildStayNoscript(
  seed: NoscriptStaySeed | null | undefined,
  opts: { skipTitle?: boolean } = {},
): string {
  const p = seed?.product
  if (!p) return ''
  const stay = String(p.restaurant_name || p.name || '').trim()
  if (!stay) return ''
  // 🔀 첫 화면이 제목·성급을 이미 그렸으면 반복하지 않는다(규율 ②). 지역은 첫 화면에 **없다** — 남긴다.
  const skip = !!opts.skipTitle, region = stayRegionShort(p.region_sido, p.region_sigungu, p.address) // 📍 제목과 같은 함수(2026-10-18)
  const prices = (seed?.rooms || [])
    .map((r) => Number(r?.base_price_weekday) || 0)
    .filter((v) => v > 0)
  const low = prices.length ? Math.min(...prices) : 0
  const high = prices.length ? Math.max(...prices) : 0
  const priceLine = low > 0
    ? (high > low ? `1박 ${won(low)}원~${won(high)}원` : `1박 ${won(low)}원`)
    : ''
  const addr = String(p.address || '').trim()
  const desc = String(p.description_full || p.description || '').replace(/\s+/g, ' ').trim()
  // 객실은 **이름 + 평일가**만. 화면 객실 목록이 그대로 보여 주는 값이다.
  const roomLines = (seed?.rooms || [])
    .map((r) => {
      const n = String(r?.name || '').trim()
      const v = Number(r?.base_price_weekday) || 0
      return n && v > 0 ? `${esc(n)} 1박 ${won(v)}원` : (n ? esc(n) : '')
    })
    .filter(Boolean)
    .slice(0, 8)

  return wrap(lines([
    skip ? (region ? esc(region) : '') : `${esc(stay)}${region ? ` · ${esc(region)}` : ''}`,
    priceLine && esc(priceLine),
    !skip && p.star_rating ? `${Number(p.star_rating)}성급` : '',
    ratingLine(p.avg_rating, p.review_count),
    addr && `주소 ${esc(addr)}`,
    desc && desc !== stay ? esc(desc) : '',
    ...roomLines,
  ]))
}

/** 워커 편의 — SSR 페이로드(`{data:{product,rooms}}`)에서 바로. 파싱 실패는 `''`(fail-soft). */
export function stayNoscriptFromPayload(
  ssrPayload: string | null | undefined,
  opts: { skipTitle?: boolean } = {},
): string {
  if (!ssrPayload) return ''
  try {
    return buildStayNoscript((JSON.parse(ssrPayload) as { data?: NoscriptStaySeed })?.data ?? null, opts)
  } catch {
    return ''
  }
}

/**
 * ⚠️ 핀은 **평평하다** — `pins[].product_name` 이고 `pins[].product.name` 이 아니다
 * (SSOT 는 `utils/curator-ssr-body.ts` 의 `CuratorSeedPin`). 처음 이 파일을 쓸 때 중첩으로
 * 가정했는데, 그러면 전부 `undefined` 가 되어 **`<noscript>` 가 조용히 비어도 에러가 안 난다.**
 * 시드 모양은 기억이 아니라 그 타입에서 가져올 것.
 */
export interface NoscriptCuratorSeed {
  curator?: { name?: string | null; bio?: string | null } | null
  /**
   * 🔗 2026-10-14 — `product_id`·`category`·`deal_only` 는 **링크를 만드는 재료**다.
   *   라이브 시드에 **이미 전부 와 있었다**(실측 `/u/user40` 핀: `product_id 2917` ·
   *   `category 'lifestyle'` · `deal_only 0`) — 선언만 없어서 쓰지 못하고 있었다.
   *   2026-10-14 의 `avg_rating` 과 **같은 클래스**다: 값은 도착했고 타입이 안 받았다.
   */
  pins?: Array<{
    product_name?: string | null; price?: number | null; restaurant_name?: string | null
    product_id?: number | string | null; category?: string | null; deal_only?: number | null
  } | null> | null
  /** 사업자 유어샵(`linked_seller`)의 진열 — 핀이 비었을 때의 **두 번째 재료**. curator 응답이 동봉한다. */
  linked_seller_products?: Array<{
    name?: string | null; price?: number | null; restaurant_name?: string | null
    id?: number | string | null; category?: string | null; deal_only?: number | null
  } | null> | null
}

/**
 * 유어샵의 본문 요약 — 소개 + 진열된 이용권 이름·가게.
 *
 * 첫 화면은 진열 **줄 4개**만 그린다(그 아래는 로더). 유어샵은 공유로 퍼지는 표면이라, 담긴 것이
 * 무엇인지 크롤러가 알아야 그 가게 이름으로 검색될 때 잡힌다.
 * ⚠️ 이름은 첫 화면이 이미 그리므로(규율 ②) **소개(bio)와 진열 목록만** 담는다.
 *
 * ## 🔖 2026-10-14 — `withName`(= 첫 화면이 없는 경로)에서는 **제목과 링크**까지 낸다
 *
 * **라이브 실측(Googlebot UA, sitemap 표본 48표면)**: `h1` 이 **0개인 표면이 정확히 하나**였다 —
 * `/u/user40`. 그 한 곳은 **내부 링크도 0개**였다(대조: `/u/jiwon1228` 는 `h1` 1 · 링크 5).
 *
 *       /u/user40     h1 0 · a 0 · 본문 58자 · ProfilePage+Person+ItemList(Product 1)
 *       /u/jiwon1228  h1 1 · a 5 · 본문 419자
 *       (나머지 46표면)  전부 h1 1
 *
 * 🔎 **원인은 이 경로다.** `/u/user40` 은 `linked_seller` 유어샵이라 `buildCuratorFirstScreen` 이
 *   설계대로 `''` 를 주고(React 가 `SellerPublicPage` 를 그린다 — 레이아웃이 통째로 다르다),
 *   그러면 이 폴백이 본문을 메운다. 그런데 그 폴백은 이름을 `<p>` 로 쓰고 행을 **링크 없는 `<li>`**
 *   로 냈다 ⇒ 2026-10-12 의 내부 링크 처방(`rowHref`)과 색인 표면의 heading 처방이 **이 경로에만
 *   오지 않았다.** 에러가 안 나고 본문 글자수는 늘어 있어서 측정만 보면 멀쩡해 보인다.
 *
 * 🔑 **재료는 이미 시드에 있었다** — 핀에 `product_id`·`category`·`deal_only` 가 전부 온다(실측).
 *   선언만 없어서 쓰지 못했다(위 타입의 🔗 주석). 주소는 **목록 표면과 같은 `rowHref`** 를 쓴다 —
 *   `canonicalDetailPath` SSOT 경유라 `ItemList`·sitemap 과 세 벌이 갈릴 수 없고, 교환권
 *   (`deal_only=1`, noindex)은 **링크하지 않는다**는 그 규율도 함께 따라온다.
 *   `/u/user40` 의 핀이 가리키는 `/products/2917` 은 **sitemap 의 유일한 `/products/` URL** 이라,
 *   그 한 건에게는 이것이 유일한 내부 링크 기회다.
 *
 * 🔴 **첫 화면이 있는 경로(`withName` 없음)는 byte-불변으로 둔다.** 그 경로의 `#root` 에는
 *   제목(`h1`)과 핀 링크가 **이미** 있다(jiwon1228 의 `h1` 1 · 링크 5 가 그것이다) — 여기서 또
 *   내면 같은 페이지에 `h1` 이 둘이 되고 같은 URL 로 가는 링크가 두 벌이 된다. 즉 이 분기는
 *   "폴백에만 모자란 것을 채운다" 이고, 그래서 판정이 `standalone` **하나**로 모여 있다.
 *
 * ⚠️ **못 보는 것**: 구글·네이버가 그 링크를 실제로 따라가는지(색인 수일~수주 · 서치콘솔은
 *   **대표만** 본다) · 사진은 **안 붙인다**(이번 실측은 heading·링크였다 — 별건).
 */
export function buildCuratorNoscript(
  seed: NoscriptCuratorSeed | null | undefined,
  opts: { withName?: boolean } = {},
): string {
  if (!seed) return ''
  const bio = (seed.curator?.bio || '').trim()
  const name = (seed.curator?.name || '').trim()
  // 🔗 첫 화면이 없는 경로에서만 링크를 만든다 — 아래 `standalone` 머리말 참조.
  const standalone = !!opts.withName
  const row = (nm: string, store: unknown, price: unknown, href: string | null): string => {
    const n = String(nm || '').trim()
    if (!n) return ''
    const st = String(store || '').trim()
    const pr = Number(price) || 0
    const tail = [st, pr > 0 ? `${won(pr)}원` : ''].filter(Boolean).join(' · ')
    // 🔗 `liOf` 가 글자 이스케이프와 `<a>` 감싸기를 함께 한다 — 목록 표면과 **같은 함수**다.
    return liOf({ text: `${n}${tail ? `, ${tail}` : ''}`, href })
  }
  const hrefOf = (id: unknown, category: unknown, dealOnly: unknown): string | null =>
    standalone ? rowHref({ id: id as number | string | null, category: category as string | null, deal_only: dealOnly as number | null }) : null
  const pins = (Array.isArray(seed.pins) ? seed.pins : [])
    .filter((x): x is NonNullable<NoscriptCuratorSeed['pins']>[number] & object => !!x)
    .slice(0, 20)
    .map((pr) => row(pr.product_name || '', pr.restaurant_name, pr.price, hrefOf(pr.product_id, pr.category, pr.deal_only)))
    .filter(Boolean)
  // 🔁 핀이 한 줄도 안 나오면 **사업자 진열**로 — 둘을 합치지 않는다(user40 실측에서 둘이 같은
  //    상품이었다 ⇒ 합치면 같은 줄을 두 번 말한다).
  const items = pins.length ? pins : (Array.isArray(seed.linked_seller_products) ? seed.linked_seller_products : [])
    .filter((x): x is NonNullable<NoscriptCuratorSeed['linked_seller_products']>[number] & object => !!x)
    .slice(0, 20)
    .map((pr) => row(pr.name || '', pr.restaurant_name, pr.price, hrefOf(pr.id, pr.category, pr.deal_only)))
    .filter(Boolean)

  // 🔴 **이름만 남는다면 아무것도 내지 않는다** — 그 이름은 `<title>`·`og:title` 이 이미 말한다.
  //   이름만 넣으면 본문 글자수는 늘지만 페이지가 thin 인 사실은 그대로다(측정만 좋아 보인다).
  //   재료가 없는 유어샵은 **본문을 꾸미는 대신 sitemap 에서 뺀다**(`sitemap.routes` 의 🩸 주석).
  if (!bio && !items.length) return ''
  // 🔖 2026-10-14 — 첫 화면이 없는 경로에서는 이름이 **제목(`h1`)** 이다. 아래 머리말 참조.
  // 🔖 조립은 `h1Of` 한 곳에서만 — 두 자리에서 각자 쓰면 한쪽이 `esc()` 를 빠뜨린다
  //    (`crawler-heading-2026-10-12.test.ts` ⑤ 가 지키는 그 불변식이고, 그 가드가 이 변경을 잡았다).
  const body = (standalone ? h1Of(name && `${name} 유어샵`) : '')
    + (bio ? `<p>${esc(bio)}</p>` : '')
    + (items.length ? `<ul>${items.join('')}</ul>` : '')
  return wrap(body)
}

/**
 * 워커 편의 — CURATOR 시드(**최상위** `{curator, pins, linked_seller_products}`)에서 바로.
 *
 * 🔑 **첫 화면이 `''` 를 돌려준 경로 전용**이다. `buildCuratorFirstScreen` 은 세 경우에 빈 문자열을
 *   준다(사업자 유어샵 `linked_seller` · 핀 0 · 파싱 실패) — 그때 크롤러가 받는 것은 **로더뿐**이고,
 *   라이브 실측(2026-10-12, Googlebot)에서 sitemap 이 제출한 유어샵 6건 중 **5건이 본문 6자**였다.
 * ⚠️ 그래서 이 경로는 **이름을 빼지 않는다**(`withName`) — 첫 화면이 없으니 규율 ②의 전제가
 *   사라진다. 숙소 상세 폴백(`stayNoscriptFromPayload`)이 숙소명을 남기는 것과 같은 판단이다.
 */
export function curatorNoscriptFromPayload(ssrPayload: string | null | undefined): string {
  if (!ssrPayload) return ''
  try {
    return buildCuratorNoscript(JSON.parse(ssrPayload) as NoscriptCuratorSeed, { withName: true })
  } catch {
    return ''
  }
}

/**
 * 🧭 2026-10-12 — **정적 컨셉 표면(`/faq`·`/about`)의 본문 요약.**
 *
 * 대표 *"합리적인 여행, 할인권 등의 우리 유어딜의 컨셉에 맞는 내용들을 바탕으로 해서 최대한
 * AI 검색에서도 노출이 될 수 있게"* · *"AI 서비스 유저가 여행 계획을 짠다던지 동네 맛집을
 * 찾는다던지 할 때 유어딜과 유어딜 이용권들이 나오게끔"*.
 *
 * **라이브 실측(2026-10-12, Googlebot UA)**: `/faq` **33자** · `/about` **30자**. 둘 다
 * `<title>`·`description`·canonical 은 멀쩡했고 **본문만** 비어 있었다 — 이 파일 머리말이
 * 설명하는 그 틈과 **똑같은 모양**이다(상세는 2026-10-11 에 메웠는데 정적 표면은 빠져 있었다).
 *
 * 🔑 **왜 이 둘이 중요한가**: 상품 상세는 `Product`+`Offer`+`FoodEstablishment` 로 *"이런 게
 * 있다"* 를 전달한다. 그런데 *"유어딜이 무엇이고 어떻게 쓰는가"*·*"동네 맛집 할인권은 어디서
 * 찾나"*·*"여행 숙소 이용권이 있나"* 를 답할 **문장**이 서버 HTML 에 한 줄도 없었다. 언어모델이
 * 인용하는 것은 그 문장이다.
 *
 * 🔒 **규율 ①(지어내지 않는다)을 지킨다** — 들어가는 값은 전부 `shared/seo/concept-content.ts`
 * 이고, `/faq` 화면(`FAQPage.tsx`)과 `/about` 히어로가 **같은 배열·같은 문장**을 그린다.
 * 그래서 크롤러가 받는 요약과 사람이 보는 화면이 구조적으로 갈릴 수 없다.
 *
 * 🧷 **첫 화면을 그리지 않는 이유**: 이 둘은 서버가 그릴 시드가 없고(정적 문서), `#root` 를
 * 텍스트로 채우면 마운트 때 통째로 교체돼 깜빡인다. `<noscript>` 는 JS 가 돌면 **렌더조차
 * 안 되므로** 사람 화면 영향 0 · 밀림 0 이다(이 파일의 존재 이유 그대로).
 *
 * ⚠️ **표면을 늘릴 때**: 그 화면이 실제로 그 문장을 그리고 있는지 먼저 확인할 것. 화면에 없는
 *    문장을 여기 넣으면 그건 요약이 아니라 클로킹이다.
 */
/**
 * 🧭 목록 표면 → 그 시드에서 **그 표면의 항목만** 고르는 술어.
 *
 * 라이브 실측(Googlebot UA, 2026-10-12)에서 이 넷의 서버 본문이 각각 **36·23·38·34자** 였다 —
 * 구글이 thin content 로 보는 수준이고, 그 상태로는 "동네 맛집 할인권"·"여행 숙소 이용권" 같은
 * 질의에 인용할 문장이 한 줄도 없다. 시드는 **이미 도착해 있다**(네 표면 전부 `kv-hit`).
 *
 * 🔑 `/stays` 는 자기 슬롯이 없어 **홈과 같은 캐시 키**(`MAIN_SEED_PATH`)를 받고 숙소만 걸러 쓴다 —
 *   `/region/*` 과 같은 수법이라 새 self-fetch 키가 0 이다(실측 그 시드에 `stay_voucher` 5건).
 *
 * ⚠️ 술어를 잘못 주면 **다른 표면의 상품을 그 목록의 내용이라고 말하게 된다**(식당이 숙소 목록에).
 *   가드가 네 술어를 각각 고정한다.
 */
const LIST_SURFACE_KEEP: Readonly<Record<string, (p: RegionSeedRow) => boolean>> = {
  '/vouchers': (p) => p?.deal_only === 1,
  '/browse': (p) => p?.deal_only !== 1,
  '/map': (p) => p?.deal_only !== 1,
  '/stays': (p) => p?.category === 'stay_voucher',
}

export function buildStaticSurfaceNoscript(pathname: string, ssrPayload?: string | null): string {
  // 끝 슬래시를 떼어 `resolveConsumerSurfaceSeo` 와 같은 키로 본다.
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  // 🛍️ 2026-10-12 (대표 "다 개선하고 또 개선할 것 있는지 찾아줘"): **쇼핑 상세의 크롤러 본문이 6자였다.**
  //   라이브 실측(Googlebot UA) — `/products/2917` 은 `index, follow` + sitemap 제출인데 서버 문서에
  //   첫 화면도 `<noscript>` 도 없다(첫 화면 빌더는 `/pass`·`/vouchers`·`/stays` 에만 있다). 시드는
  //   **이미 와 있었다**(`PRODUCT:edge-hit` 872B) — 쓰지 않고 있었을 뿐이다.
  //   🔑 **정본일 때만 낸다** — 같은 날 빵부스러기와 **같은 게이트**(`canonicalDetailPath(...) == null`
  //      = "cross-canonical 아님"). 이용권·숙소는 `/products/:id` 로도 닿지만 정본이 `/pass`·`/stays`
  //      이고 거기엔 서버 첫 화면이 이미 있다 ⇒ 정본 아닌 URL 을 키우지 않는다.
  //   🔒 **가게·주소·전화는 안 쓴다** — `ProductDetailPage` 는 그 줄을 `category === 'meal_voucher'`
  //      일 때만 그린다(실측 `:647`). 2917 은 `lifestyle` 인데 `restaurant_name='구서 우성아파트'`·
  //      전화가 응답에 담겨 온다 ⇒ 그걸 요약에 넣으면 **화면에 없는 말**이고 그건 클로킹이다.
  //   ⚠️ **오늘 이 처방이 메우는 양은 적다** — 라이브 유일 쇼핑 상품은 설명·정가·리뷰가 전부 비어
  //      이름+가격 ~20자뿐이다. 구조가 맞을 뿐이고, 쇼핑탭이 다시 열리면 그때 값을 한다.
  const prodId = path.match(/^\/products\/(\d+)$/)?.[1]
  if (prodId) {
    try {
      const d = (JSON.parse(ssrPayload || 'null') as { data?: NoscriptDetailSeed & { deal_only?: number; category?: string } } | null)?.data
      if (!d) return ''
      // id 는 **경로에서** 가져온다 — 시드에 없을 수도 있고, 정본 판정은 빠질 수 없는 게이트다.
      if (canonicalDetailPath({ id: prodId, deal_only: d.deal_only, category: d.category }) != null) return ''
      const p = priceDisplay({ price: d.price, original_price: d.original_price, discount_rate: d.discount_rate })
      const desc = (d.description || d.long_description || '').trim()
      // 상품명은 **그 화면의 h1 그대로** 다(`ProductDetailPage` 가 제목으로 그린다) — 요소만 맞춘다.
      // 🖼️ 2026-10-14 — 사진 한 장(근거는 `rowImg` 머리말). 시드에 없으면 **만들지 않는다**.
      //   `alt` 는 상품명 그대로다(그 화면의 h1 과 같은 글자).
      const shot = typeof d.image_url === 'string' ? sizedCdnCgi(d.image_url.trim(), 400) : ''
      const imgTag = shot && d.name ? `<img src="${esc(shot)}" alt="${esc(String(d.name))}">` : ''
      return wrap(h1Of(d.name) + imgTag + lines([
        p.price > 0 ? `판매가 ${won(p.price)}원${p.hasDiscountLine && p.showOriginal ? ` · 정가 ${won(p.originalPrice)}원` : ''}${p.discount > 0 ? ` · ${p.discount}% 할인` : ''}` : '',
        desc ? esc(desc) : '',
      ]))
    } catch {
      return ''
    }
  }

  // 🎬 2026-10-13 — `/urshorts` 는 모듈로 뺐다(이 파일이 600줄 래칫을 넘겼다 — pre-push 게이트가
  //   잡았다). 왜 `VideoObject` 를 안 내는지·왜 주입하지 않는지는 그 파일 머리말에 있다.
  if (path === '/urshorts') return buildUrshortsNoscript(ssrPayload, h1Of(CONSUMER_SURFACE_SEO[path]?.crumb))

  if (path === '/faq') {
    // Q&A 를 그대로 — 언어모델이 인용하기 가장 쉬운 모양이고, 같은 배열이 `FAQPage` JSON-LD
    // (`surface-list-jsonld.ts`)와 화면 아코디언을 만든다.
    const items = CONCEPT_FAQ.map(f => `<dt>${esc(f.question)}</dt><dd>${esc(f.answer)}</dd>`).join('')
    return items ? `<noscript>${h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)}<dl>${items}</dl></noscript>` : ''
  }

  if (path === '/about') {
    const lines = CONCEPT_ABOUT_LINES.map(l => `<p>${esc(l)}</p>`).join('')
    return lines ? `<noscript>${h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)}${lines}</noscript>` : ''
  }

  // ⚖️ 약관은 **그 문서 자체에서 파생**한다 — 제목 · 시행일 · 조항 제목. 손으로 요약을 쓰면
  //   개정될 때 갈리고(문구 변경은 대표 확인 사항이다), 전문을 통째로 쏟으면 요약이 아니다.
  //   라이브 실측 `/terms` **15자**였다 — sitemap 이 제출하는 URL 인데 조항 제목조차 없었다.
  const terms: TermsDoc | null = path === '/terms' ? CONSUMER_TERMS : path === '/terms/seller' ? SELLER_TERMS : null
  if (terms) {
    const heads = terms.sections.map(x => x.title).filter(Boolean)
    // 제목은 그 문서 자체의 `title` — 시행일·판 번호는 제목이 아니라 그 아래 한 줄로 둔다.
    return `<noscript>${h1Of(terms.title)}<p>시행 ${esc(terms.effective)} · v${esc(terms.version)}</p><ul>`
      + heads.map(h => `<li>${esc(h)}</li>`).join('') + '</ul></noscript>'
  }

  // 🧭 시드가 없는 정적 표면(입점·소개 파트너·체험단·새 가게·지역 인덱스 …) — 라이브 실측
  //   **15~40자**였고 전부 sitemap 제출 URL 이다. 문구는 `shared/seo/surface-copy.ts` SSOT 이고
  //   **그 화면에 떠 있는 문장과 같은 말**이어야 한다(가드가 페이지 소스와 대조 — 클로킹 방지).
  const copy = surfaceCopyFor(path)
  if (copy) {
    const lines = copy.lines.map(l => `<p>${esc(l)}</p>`).join('')
    // 🔗 지역 허브는 문구 뒤에 **색인 대상 시/도 링크**를 붙인다 — 라이브 실측에서 이 허브의
    //   a태그가 **0** 이었다(44개 지역이 sitemap 으로만 발견됐다). 링크 집합은 요약으로 판정해
    //   thin 지역을 가리키지 않는다(`regionChildLinks`). 요약이 없으면 종전과 byte-동일.
    const kids = childLinksHtml(path, ssrPayload)
    // `/region` 허브는 `CONSUMER_SURFACE_SEO` 에 항목이 없다(동적 경로라 `resolveRegionSeo` 가 맡는다)
    // — 빵부스러기가 쓰는 같은 상수에서 받는다(손으로 적으면 둘이 갈린다).
    const h1 = h1Of(path === '/region' ? REGION_HUB_CRUMB : CONSUMER_SURFACE_SEO[path]?.crumb)
    return lines || kids ? `<noscript>${h1}${lines}${kids}</noscript>` : ''
  }

  // 🗺️ 지역 착지 페이지 — "동네 맛집 할인권" 질의의 착지점인데 라이브 본문이 **26자**였다
  //   (`/region/서울`, Googlebot 실측). 그 페이지가 화면에 그리는 카드(가게 · 메뉴 · 판매가)를
  //   그대로 글로 옮긴다 — 규율 ①(지어내지 않는다)대로 **시드에 있는 값만** 쓴다.
  //   항목은 홈과 같은 시드(MAIN)에서 오고 지역 필터는 `addressInRegion`(화면과 같은 SSOT)이다.
  //   ⚠️ 상한은 `REGION_NOSCRIPT_ROWS` 다(2026-10-14: 8 → 30 — 고아 상세 수리, 아래 블록 주석).
  // 🧾 목록 네 표면 — 라벨은 `CONSUMER_SURFACE_SEO.crumb`(빵부스러기와 같은 SSOT)에서 온다.
  //   ⚠️ **여기는 8 그대로다** — 2026-10-14 에 지역 페이지만 30 으로 올렸고 이 블록은 안 올렸다.
  //      이유가 둘: ① 이 표면들은 **홈과 같은 50행 시드**를 쓰므로 올려도 새로 닿는 상세가 적다
  //      (고아 134건의 원인은 지역 요약의 묶음 캡이었고, 그건 359건 전체를 본다) ② `<noscript>` 는
  //      **사람이 받는 응답에도 그대로 실린다**(크롤러에게만 주는 것은 구글 가이드 위반) — 홈·지도는
  //      사람 트래픽의 본류라 바이트를 늘릴 근거가 측정으로 서야 한다. 올리려면 **문서 바이트를
  //      먼저 재고** 올릴 것. 두 값이 다른 것은 **의도**이고, 가드가 그 사실을 고정한다.
  const keep = LIST_SURFACE_KEEP[path]
  if (keep) {
    const rows: Row[] = []
    for (const p of parseSeed(ssrPayload)) {
      if (!keep(p)) continue
      const line = rowLine(p)
      if (line) rows.push(line)
      if (rows.length >= 8) break
    }
    if (!rows.length) return ''
    // 종전엔 같은 글자가 `<p>` 였다 — 단어는 그대로이고 요소만 `<h1>` 이 된다.
    const head = h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)
    /* 🎁 2026-10-18 (대표 착수 승인) — **교환권 허브만** 카테고리 facet 으로 가는 길을 낸다.
     *   라이브 실측: 허브 본문 295자 · h1·h2 멀쩡 · **a태그 0개**. facet 20개 중 sitemap 제출이
     *   3개뿐이라 **17개로 들어가는 내부 링크가 아예 없었다**(facet 자체는 2026-10-12 수리로 이미
     *   제목·self-canonical·본문 275자를 낸다 — 비어 있던 것은 발견 경로뿐이다).
     * 🔴 **상품 항목 링크는 여전히 0 이다** — 교환권 상세는 2026-07-07 결정으로 noindex 라
     *   `rowLine` 이 a태그를 안 단다. 카테고리는 index 대상이므로 그 이유에 해당하지 않는다.
     *   두 축이 다르고, 가드가 양방향을 고정한다(항목은 계속 0 · 카테고리는 20).
     * 🔑 다른 세 표면(`/browse`·`/map`·`/stays`)은 facet 체계가 없어 **byte-동일**이다. */
    const facetLinks = path === '/vouchers' ? facetLinksHtml() : ''
    return `<noscript>${head}<ul>${capRowImages(rows).map(liOf).join('')}</ul>${facetLinks}</noscript>`
  }

  const ref = regionRefOfPath(path)
  if (ref) {
    // 🕳️ 2026-10-14: 종전 `8` 이 **고아 상세 130건**의 절반을 만들고 있었다(라이브 실측 — 색인
    //   상세 360건 중 내부 링크 도달 226건). 지역 페이지는 **발견이 일**인 허브인데 8줄만 냈다.
    //   요약 묶음 상한과 **짝으로** 올렸다(한쪽만 올리면 아무 일도 안 일어난다 — 그쪽 주석 참조).
    //   `ItemList` 는 10 그대로다(리치결과 표시 ≠ 크롤 발견).
    const rows = regionSeedRows(ssrPayload, ref).slice(0, REGION_NOSCRIPT_ROWS)
    if (!rows.length) return ''
    const label = ref.sigungu ? `${ref.sido} ${ref.sigungu}` : ref.sido
    // 🔗 시/도 페이지는 **자식 시군구**로 가는 길을 함께 낸다(시군구 32곳이 색인 대상인데
    //   그 트리로 들어가는 내부 링크가 0 이었다). 시군구 페이지는 잎이라 아무것도 안 붙는다.
    return `<noscript>${h1Of(`${label} 이용권`)}<ul>${capRowImages(rows).map(liOf).join('')}</ul>`
      + `${childLinksHtml(path, ssrPayload)}</noscript>`
  }

  return ''
}

/**
 * 🎁 교환권 카테고리 링크 마크업. 목록은 `voucherFacetLinks()` SSOT(canonical·sitemap 과 같은 주소
 * 조립 함수를 지난다)이고, 여기는 **감싸기만** 한다 — `childLinksHtml` 과 같은 규율이다.
 */
function facetLinksHtml(): string {
  const links = voucherFacetLinks()
  if (!links.length) return ''
  return `<ul>${links.map(k => `<li><a href="${esc(k.href)}">${esc(k.label)}</a></li>`).join('')}</ul>`
}

/** 🎁 2026-10-18 첫 화면 경로에도 facet 링크(**상품 요약 제외** — 첫 화면이 이미 그렸다). 워커가 첫 화면 **또는** 요약 중 하나만 내서 따로 필요 — docs/handoff/2026-10-18-voucher-facet-firstscreen.md */
export function voucherFacetNoscript(path: string): string {
  const l = path === '/vouchers' ? facetLinksHtml() : ''; return l ? `<noscript>${l}</noscript>` : ''
}

/**
 * 🔗 자식 지역 링크 마크업. **조립은 한 곳에서만** 한다 — 두 자리에서 각자 쓰면 한쪽이 탈출을
 * 빠뜨린다(이 레포가 반복해 밟은 클래스). 링크가 없으면 `''` 라 종전 출력과 byte-동일이다.
 */
function childLinksHtml(path: string, digestJson?: string | null): string {
  const kids = [...regionChildLinks(path, digestJson), ...lifeChildLinks(path)] // 🏠 생활 허브·업종 링크(2026-10-25)
  if (!kids.length) return ''
  return `<ul>${kids.map(k => `<li><a href="${esc(k.href)}">${esc(k.label)}</a></li>`).join('')}</ul>`
}

/** 경로 → 지역. 판정·디코딩 규율은 `surface-list-jsonld.ts` 의 `regionRefOf` 와 같다. */
function regionRefOfPath(path: string): RegionRef | null {
  if (!REGION_PATH_RE.test(path)) return null
  const seg = path.replace(/\/+$/, '').split('/')
  try {
    return parseRegionPath(decodeURIComponent(seg[2] || ''), seg[3] ? decodeURIComponent(seg[3]) : undefined)
  } catch {
    return null
  }
}
