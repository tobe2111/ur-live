/**
 * 🔎 2026-07-07 (대표 "각 이용권 페이지마다 SEO 다 잘 되지?"): 공구/이용권 상세(DETAIL slot) 서버측
 *   메타/구조화데이터 빌더. 그간 DETAIL 슬롯은 `__SSR_INITIAL_DETAIL__` 데이터만 주입하고 title/OG/canonical/
 *   JSON-LD 는 index.html 소비자 기본값(제네릭 홈)을 그대로 서빙 → JS 안 도는 크롤러(네이버/카카오/소셜
 *   스크래퍼)가 이용권 링크 공유·색인 시 "유어딜 홈" 카드를 봄(BLOGPOST/CURATOR/WHOLESALE 은 이미 rewrite).
 *   Googlebot 은 react-helmet(<SEO>)을 렌더해 페이지별 정밀 메타를 보지만, 비-JS 크롤러는 정적 HTML 메타만 봄.
 *   worker/index 의 HTMLRewriter `.on()` 배선은 이 결과값만 소비 — god 파일 성장 방지(file-size 래칫).
 */

// 🔄 이용권 공유 카드 주소·판 번호는 `shared/pass-share-card.ts` 한 곳(화면의 공유 버튼과 같은 값).
import { passShareCardUrl } from '@/shared/pass-share-card'
import { stayDetailTitle, voucherDetailTitle, passDetailTitle } from '../../shared/seo/detail-title'
// 🏨 정본 상세 주소 SSOT — 숙소 이용권은 `/stays/:id` 다(두 벌로 적으면 갈린다).
import { canonicalDetailPath } from '../../shared/product-flow'
import { productShareImage } from '@/shared/og-share-image'
import { propertyTypeLabel } from '../../shared/stay-property-type'
import { kakaoPlaceCanonicalUrl } from '../../shared/kakao-place-url'
import { parseRegionFromAddress } from '../../shared/constants/region-slugs'
import { priceDisplay } from '../../shared/price-display'
import { storeNameJoin } from '@/shared/seo/store-name-dedupe'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { withCrumbRoot, crumbItems } from '@/shared/seo/breadcrumb'

/**
 * 🏠 한국 주소를 `PostalAddress` 로 — **시/도·시군구를 채워서** 돌려준다 (2026-10-13 신설).
 *
 * ## 무엇이 문제였나 (라이브 실측)
 * ```
 * /pass/2919   FoodEstablishment  {"streetAddress":"서울 서초구 방배중앙로 165","addressCountry":"KR"}
 * /stays/2887  LodgingBusiness    addressRegion:"강원" 만 있고 addressLocality 없음
 * ```
 * `addressLocality`(시군구)가 **전 매장 0건**이었다. 구글 `LocalBusiness` 가 권하는 필드이고,
 * **로컬 질의가 이 서비스의 본류**라 가장 아쉬운 자리다. 재료와 도구가 둘 다 있었는데
 * (API 가 주소를 주고, `/region/*` 44개를 가르는 파서가 레포에 있다) 그 둘이 안 만나고 있었다.
 *
 * 🔴 **`streetAddress` 는 전체 주소를 그대로 둔다.** 앞머리를 떼면 파싱이 어긋난 주소에서
 *    길 이름이 잘려 나간다 — *덜 정확한 쪽*이 아니라 *틀린 주소*가 되는 거래다. 시/도가
 *    두 번 나오는 것은 구글이 허용하고, 숙소가 이미 그 모양으로 돌고 있다(동작 보존).
 * 🔴 파싱이 실패하면 **아무것도 안 넣는다** — 지어내지 않는다(이 레포가 `aggregateRating`·
 *    `Offer` 에서 지키는 규율과 같다).
 */
function postalAddress(raw: unknown, sidoHint?: unknown): Record<string, unknown> | null {
  const addr = raw == null ? '' : String(raw).trim()
  if (!addr) return null
  const ref = parseRegionFromAddress(addr)
  const region = ref?.sido || (sidoHint ? String(sidoHint) : '')
  return {
    '@type': 'PostalAddress',
    streetAddress: addr,
    ...(region ? { addressRegion: region } : {}),
    ...(ref?.sigungu ? { addressLocality: ref.sigungu } : {}),
    addressCountry: 'KR',
  }
}

export { PASS_OG_VERSION } from '@/shared/pass-share-card'

// script 종료 태그 이스케이프 — <script type="application/ld+json"> 안전 임베드.
function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script')
}

export interface DetailMeta {
  /** <title> 값 */
  pageTitle: string
  /** og/twitter title */
  title: string
  description: string
  canonical: string
  ogImage: string
  /** og:type — 'product' */
  ogType: string
  /** true 면 robots noindex (교환권 /vouchers/:id — 클라 <SEO noindex> 와 대칭) */
  noindex: boolean
  /** 이스케이프 완료된 JSON-LD 문자열 ('' 면 미주입 — 교환권) */
  jsonLd: string
}

interface DetailData {
  id?: number | string
  name?: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_lat?: number
  restaurant_lng?: number
  seller_name?: string
  brand_name?: string
  price?: number
  original_price?: number
  deal_only?: number
  current_discount_pct?: number
  description?: string
  image_url?: string
  category?: string
  group_buy_status?: string
  group_buy_deadline?: string
  // 🏪 2026-10-11 (대표 "특히 이용권 페이지들은 더욱") — 로컬 엔티티용. 전부 시드에 이미 온다.
  restaurant_phone?: string
  avg_rating?: number
  review_count?: number
  // 🔗 2026-10-12 — 카카오 장소 프로필(`sameAs`). 시드에 이미 온다(실측 14/14).
  kakao_place_url?: string
  // 📦 2026-10-13 — `Offer.availability` 를 화면과 같은 술어로 판정하기 위해. **두 벌 다 받는다**:
  //   라이브 실측(id 2917) `stock: 200` ↔ `stock_quantity: 0` 이라 한쪽만 보면 멀쩡한 상품을
  //   품절로 내보낸다(2026-07-02 에 구매 버튼에서 같은 갭으로 값을 치렀다).
  stock?: number | null
  stock_quantity?: number | null
}

/**
 * 🔗 그 매장의 **카카오 장소 프로필**(`sameAs`) — 같은 실체를 가리키는 외부 주소.
 *
 * 🔑 **왜 로컬에 값진가**: `sameAs` 는 "이 가게가 저기 그 가게다" 를 말하는 유일한 표준 속성이고,
 *    국내 로컬 질의에서 그 권위는 카카오맵이다. 실측(2026-10-12 · Googlebot UA 로 받아 **재귀로**
 *    훑었다) `/pass/:id`·`/stays/:id`·`/products/:id` 전 표면 `sameAs` **0** 인데 `kakao_place_url` 은
 *    딜 **14/14** · 숙소에도 있었다 — **가진 신호를 안 쓰고 있었다.**
 *
 * 🔒 **모양이 맞을 때만 낸다** — 죽은 `sameAs` 는 신뢰 신호를 **깎는다**(이 레포가 브랜드 `sameAs` 를
 *    *실제 계정이 없다*는 이유로 일부러 비워 둔 것과 같은 판단). 값의 출처는 셀러가 카카오 장소 검색
 *    결과에서 **고른 것**이지만(`StoreRegisterModal` 이 카카오가 준 `place_url` 을 그대로 저장) 어드민
 *    입력 경로도 있어, host + 숫자 id 를 확인하고 **정규형으로** 돌려준다(끝 슬래시·쿼리·해시 제거).
 *
 * ⚠️ **살아 있는지는 확인하지 않는다** — 요청마다 외부를 두드리면 서브리퀘스트 예산(무료 50/인보케이션,
 *    실측 ~49)을 먹는다. 이 함수가 보장하는 것은 *모양*이고 *실재가 아니다*(실측: 진짜 id 200 ·
 *    지어낸 id **400** — 즉 숫자라고 살아 있는 건 아니다).
 * 🔴 **이 값으로 매장 노드를 새로 만들지 않는다** — 주소·좌표가 없어 노드가 없던 페이지는 종전과
 *    byte-동일이다(`hasPlace` 게이트 불변 — 주입이 그 방향을 고정).
 */
export function placeSameAs(raw: unknown): string | null {
  // 🔢 2026-10-13 — 판정을 SSOT(`shared/kakao-place-url`)에 위임한다. 종전엔 이 파일이
  //   `place.map.kakao.com/{id}` **한 모양만** 직접 검사해서, 사람이 `map.kakao.com/?itemId=`
  //   나 `link/map/` 으로 붙여넣은 매장은 **같은 가게인데 `sameAs` 가 안 나갔다**(라이브
  //   실측으로 세 모양이 같은 id 공간임을 확인 — 그 파일 머리말에 표로 적어 뒀다).
  //   ⚠️ `kko.to` 단축링크는 URL 안에 id 가 없어 여기서 접을 수 없다(= `sameAs` 부재, 종전과 같다).
  return kakaoPlaceCanonicalUrl(raw)
}

/**
 * 🏪 이용권 카테고리 → `LocalBusiness` 하위 타입.
 *
 * 구체적인 타입일수록 구글이 업종을 정확히 이해한다(`FoodEstablishment` 는 음식점 리치 결과의
 * 전제이기도 하다). 모르면 상위 타입으로 — **틀린 업종을 선언하는 것보다 덜 구체적인 쪽이 낫다.**
 */
function localBusinessType(category: string | undefined): string {
  switch (String(category || '')) {
    case 'meal_voucher': return 'FoodEstablishment'
    case 'beauty_voucher': return 'HealthAndBeautyBusiness'
    case 'stay_voucher': return 'LodgingBusiness'
    default: return 'LocalBusiness'
  }
}

/** 절대 URL 이미지로 정규화 (http → 그대로, / 상대 → origin 접두, 그 외 → fallback). */

function absImage(raw: string, origin: string, id: number | string | undefined, fallback?: string): string {
  if (raw.startsWith('http')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return fallback || `${origin}/api/og/group-buy/${id ?? ''}.png`
}

/**
 * 공구/이용권 상세(/pass/:id · /vouchers/:id) 서버 메타.
 *   - /vouchers/:id (교환권) → noindex(클라 대칭) + OG 는 공유 카드용으로 여전히 주입, JSON-LD 없음.
 *   - /pass/:id (이용권/동네딜) → 인덱싱 + Product/Offer/Breadcrumb JSON-LD.
 *     (옛 `/group-buy/:id` 는 워커 진입부에서 301 되므로 canonical 은 언제나 정본이다.)
 * payload 없거나 파싱 실패 시 null(기본 메타 유지).
 */
export function buildDetailMeta(ssrPayload: string, origin: string, pathname: string): DetailMeta | null {
  try {
    const d = (JSON.parse(ssrPayload) as { data?: DetailData })?.data
    if (!d || !d.name) return null
    const id = d.id
    const name = String(d.name).trim()
    const store = String(d.restaurant_name || '').trim()
    const price = Number(d.price) || 0
    const discount = Number(d.current_discount_pct) || 0
    // 🏨 2026-10-12 [UNLOCK_LOADING] (대표 "둘 다 잠금 해제하고 가장 이상적으로"): canonical 을 **SSOT 가
    //   말하는 정본 주소**로. 실측에서 숙소 이용권 49건이 `/pass/:id` 와 `/stays/:id` 두 URL 로 각각
    //   자기 canonical 을 선언해 **같은 상품이 색인에서 경쟁**했고, sitemap(`/pass/`)과 `/stays` ItemList
    //   (`/stays/`)가 서로 다른 URL 을 가리키고 있었다. 정본은 `canonicalDetailPath` 하나로 정한다 —
    //   그 함수가 `stay_voucher` → `/stays/:id`, 그 밖의 이용권 → `/pass/:id`, 교환권 → `/vouchers/:id` 다.
    //   ⚠️ noindex 를 **같이 붙이지 않는다** — canonical 로 통합하는 URL 에 noindex 는 서로 반대 신호다.
    //   폴백은 종전과 같은 `pathname`(판정 불가 시 자기 자신).
    const canonicalPath = canonicalDetailPath({ id: id ?? '', deal_only: d.deal_only, category: d.category })
    const canonical = `${origin}${canonicalPath && canonicalPath.startsWith('/') ? canonicalPath : pathname}`
    // 🖼️ 2026-10-12: `photo`=원본(JSON-LD `Product.image` — 구글 상품 사진은 고해상이 낫다) ↔
    //   `ogImage`=1200×630 카드(소셜). **두 축이다** — 섞으면 한쪽이 손해다(`og-share-image.ts` 머리말).
    const photo = absImage(String(d.image_url || ''), origin, id)
    const isVoucher = pathname.startsWith('/vouchers/') // 교환권 — 클라 noindex 와 대칭

    if (isVoucher) {
      // 🏷️ 2026-10-14: 이름에 이미 `교환권` 이 든 ~135건이 `교환권 교환권` 이었다.
      //   판정·문구는 `shared/seo/detail-title.ts` 하나 — 클라(`VoucherDetailPage`)가 같은 함수를 쓴다.
      const title = voucherDetailTitle(name)
      const description = (String(d.description || '').replace(/\s+/g, ' ').trim().slice(0, 150))
        || `${name} 기프티콘 교환권을 유어딜에서 할인가로 구매하고 바로 사용하세요.`
      return { pageTitle: title, title, description, canonical, ogImage: productShareImage(photo, origin), ogType: 'product', noindex: true, jsonLd: '' }
    }

    // 이용권/동네딜 (group-buy) — 인덱싱 + 풀 메타 + JSON-LD
    const pageTitle = passDetailTitle(name, store)
    const priceStr = price.toLocaleString('ko-KR')
    // 🏪 2026-10-13 — 가게명이 상품명 앞에 그대로 든 경우 같은 말을 두 번 하지 않는다
    //   (실측 `/pass/2919`: `달빛한스푼 달빛한스푼 닭도리탕`). 판단은 SSOT 하나다 —
    //   `crawler-noscript` 가 교환권 목록에서 쓰던 그 규칙이고, 이 파일만 밖에 있었다.
    const storeName = storeNameJoin(store, name)
    // 📝 2026-10-14 — **설명을 숙소와 같은 모양으로.** 라이브 실측(샘플 50): `/pass` 310건의
    //   meta description 이 **중앙값 50자 · 46%가 50자 미만 · 전부 80자 미만**이고, 그중
    //   `유어딜에서 할인가로 바로 구매`(14자)는 **310건에 똑같이 붙는 상투구**라 고유한 부분은
    //   25~30자뿐이었다. 같은 날 백필을 받은 숙소는 **중앙값 71자**에
    //   `⭐4.5 강원 춘천시 호텔 · 1박 129,000원~ {소개}` 로 별점·지역·가격·소개를 담는다.
    //   ⇒ #83·#84 와 **같은 비대칭**이다(숙소가 풍부해졌는데 이용권이 안 따라왔다).
    //
    // 🔑 **지어내지 않는다 — 전부 시드에 이미 온 값이다**: 별점은 `avg_rating`(실측 294/310건이
    //    보유) · 지역은 `restaurant_address` 를 **`parseRegionFromAddress` SSOT**(같은 파일의
    //    `postalAddress` 가 `addressLocality` 에 쓰는 그 함수)로 · 정가·할인율은 그 상품의 값 ·
    //    소개는 `description`. 하나라도 없으면 그 조각만 빠지고 나머지는 종전과 같다.
    // 🔴 **리뷰 0이면 별점을 말하지 않는다** — `ratingLine` 과 같은 규율(평점 0점짜리로 읽힌다).
    // 🔴 **설명이 상품명과 같으면 버린다** — 시드 실측상 흔하다(같은 말을 두 번 하지 않는다).
    // 📏 `slice(0, 200)` 은 종전 그대로. 구글은 ~155자에서 자르지만 자르는 쪽이 모자란 쪽보다 낫다.
    // 🩸 **할인율이 310건 전부에서 사라지고 있었다.** 종전 분기는 `d.current_discount_pct` 를
    //    믿는데 라이브 샘플 45건에서 그 값과 `discount_rate` 가 **전부 0**이고, 정가·판매가로
    //    계산하면 **45/45건에 할인이 있다(중앙 20%)**. 즉 `🎉 N% 할인` 분기는 한 번도 돈 적이 없고,
    //    커머스 스니펫에서 가장 강한 신호가 구조적으로 빠져 있었다. **에러가 안 나서 아무도 몰랐다.**
    // 🔑 이 레포엔 바로 그 사고를 위해 만든 SSOT 가 있다 — `priceDisplay` 의 `Math.max(선언값,
    //    계산값)`(2026-08-19 대표 신고 *"할인율도 나타나야 할 것 같다"* 의 처방). **같은 파일의
    //    `<noscript>` 본문은 이미 그 함수를 써서 "11% 할인" 을 맞게 말하고 있었고** description
    //    만 밖에 있었다 ⇒ 둘을 같은 함수로 모은다(한 문서가 두 할인율을 말할 수 없게 된다).
    const pd = priceDisplay({ price, original_price: d.original_price, discount_rate: d.current_discount_pct })
    const passRating = Number(d.avg_rating) || 0
    const passReviews = Number(d.review_count) || 0
    const ratingPrefix = passRating > 0 && passReviews > 0 ? `⭐${passRating.toFixed(1)} ` : ''
    const passRef = parseRegionFromAddress(String(d.restaurant_address || ''))
    const regionStr = passRef ? `${passRef.sido}${passRef.sigungu ? ` ${passRef.sigungu}` : ''} · ` : ''
    const origStr = pd.showOriginal && pd.originalPrice > pd.price ? ` (정가 ${pd.originalPrice.toLocaleString('ko-KR')}원)` : ''
    const passDesc = String(d.description || '').replace(/\s+/g, ' ').trim()
    const descTail = passDesc && passDesc !== name && passDesc !== storeName ? ` ${passDesc}` : ''
    const description = (pd.discount > 0
      ? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인${descTail}`
      : `${ratingPrefix}${regionStr}${storeName} ${priceStr}원, 유어딜에서 할인가로 바로 구매${descTail}`)
      .replace(/\s+/g, ' ').trim().slice(0, 200)

    const available = d.group_buy_status === 'active' || d.group_buy_status === 'achieved'
    const product: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'Product',
      name,
      description: (String(d.description || '') || `${storeName} 이용권`).replace(/\s+/g, ' ').trim().slice(0, 300),
      ...(d.image_url ? { image: [photo] } : {}),
      ...(store ? { brand: { '@type': 'Brand', name: store } } : {}),
      offers: {
        '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price,
        availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        ...(d.seller_name ? { seller: { '@type': 'Organization', name: String(d.seller_name) } } : {}),
      },
    }
    // ⭐ 리뷰가 실제로 있을 때만. 0건에 `ratingValue: 0` 을 선언하면 **평점 0점짜리 상품**이라고
    //   말하는 셈이고, 구글은 리뷰 없는 aggregateRating 을 정책 위반으로 본다.
    const rc = Number(d.review_count) || 0
    const rv = Number(d.avg_rating) || 0
    if (rc > 0 && rv > 0) {
      product.aggregateRating = { '@type': 'AggregateRating', ratingValue: Math.round(rv * 10) / 10, reviewCount: rc }
    }

    // 🏪 2026-10-11 (대표 "특히 이용권 페이지들은 더욱"): **매장을 독립 엔티티로 분리한다.**
    //   종전에는 `address`·`geo` 가 `Product` 안에 들어 있었는데 — 그 둘은 schema.org 의 Product
    //   표준 속성이 **아니라서** 구글이 그냥 버린다(에러가 안 나서 몇 달간 몰랐다). 즉 우리 이용권이
    //   "전주 덕진구 가리내10길의 돈가스집" 이라는 사실이 **검색엔진에 한 번도 전달된 적이 없다.**
    //   로컬 검색(`전주 돈가스 할인`·동네 질의)이 이 서비스의 본류인데 그 신호가 통째로 비어 있었다.
    //   ⇒ `LocalBusiness` 하위 타입으로 빼고 Offer 가 `availableAtOrFrom` 으로 가리킨다.
    const bizType = localBusinessType(d.category)
    const hasPlace = !!(store && (d.restaurant_address || (d.restaurant_lat && d.restaurant_lng)))
    const placeId = `${canonical}#place`
    const sameAs = placeSameAs(d.kakao_place_url)
    const place = hasPlace ? {
      '@context': 'https://schema.org', '@type': bizType, '@id': placeId,
      name: store,
      // 🔗 2026-10-15 — **빌더 둘이 갈려 있었다.** 라이브 실측(Googlebot UA, 표본 44):
      //
      //     LodgingBusiness (숙소)      url 14/14 · priceRange 14/14 · description 14/14
      //     FoodEstablishment (이용권)  url  0/30 · priceRange  0/30 · description  0/30
      //
      //   빌더 단위로 정확히 쪼개진다 — 데이터가 없어서가 아니라 **이 자리에 안 적혀 있어서**다.
      //   `url` 은 구글 LocalBusiness 권장 필드("그 지점의 완전한 URL")이고 `canonical` 은 바로
      //   위에서 이미 계산돼 있으므로 **새 조회·새 데이터가 0** 이다.
      //   🔑 **페이지 간 모순이 안 생기는지 먼저 쟀다**: 활성 딜 359건의 고유 매장이 **358**
      //     (1매장=1딜, 2개인 곳 한 곳). 한 매장이 여러 딜을 가지면 각 딜 페이지가 서로 다른
      //     `url` 을 주장하게 되는데, 실측 분포가 1:1 이라 그 일이 안 일어난다. `@id` 는 원래
      //     페이지 스코프(`#place`)라 엔티티는 이미 페이지별이고, 숙소가 이미 같은 방식이다.
      //   🔴 `priceRange`·`description` 은 **일부러 안 넣는다** — 숙소는 상품이 곧 그 숙소라
      //     객실 가격대·소개가 그 업체의 것이지만, 이용권은 **상품 ≠ 매장**이다. 딜 한 건의 값을
      //     식당의 가격대·소개라고 말하는 것은 지어내기다(이 레포가 `aggregateRating`·`Offer` 에서
      //     지키는 규율 그대로). 영업시간도 같은 이유가 아니라 **데이터가 아예 없다**(실측:
      //     `/api/group-buy/products/:id` 응답에 시간 관련 키 0개).
      url: canonical,
      ...(sameAs ? { sameAs: [sameAs] } : {}),
      ...((a => a ? { address: a } : {})(postalAddress(d.restaurant_address))),
      ...(d.restaurant_lat && d.restaurant_lng ? { geo: { '@type': 'GeoCoordinates', latitude: d.restaurant_lat, longitude: d.restaurant_lng } } : {}),
      ...(d.restaurant_phone ? { telephone: String(d.restaurant_phone) } : {}),
      ...(d.image_url ? { image: [photo] } : {}),
    } : null
    if (place) (product.offers as Record<string, unknown>).availableAtOrFrom = { '@id': placeId }
    // 🍞 2026-10-14 — 조립은 `shared/seo/breadcrumb` 한 곳. 루트 이름이 상세·목록에서 갈려 있었고,
    //   `동네딜` 단계가 홈과 **같은 URL** 이라 사슬이 안 나아갔다(310건). 그 단계는 **접힌다** —
    //   유어딜의 `/` 가 곧 동네딜 피드라 줄 URL 이 따로 없다(모듈 머리말에 버린 길 둘 포함).
    //   2026-09-16 의 의도(*리다이렉트를 가리키지 않는다*)는 그대로다: 별칭 URL 을 쓰지 않는다.
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbItems(withCrumbRoot(origin, [
        { name: '동네딜', url: `${origin}/` },
        { name, url: canonical },
      ])),
    }
    const jsonLd = escapeScript(JSON.stringify(place ? [product, place, breadcrumb] : [product, breadcrumb]))
    // 🖼️ 2026-10-13 대표 확정(안 1-가): 공유 미리보기 = 사진을 가득 채운 1200×630 한 장(사진 없으면 종전 카드).
    //   `d.image_url` 이 없을 때 `photo` 는 SVG 카드 주소로 떨어지므로 그걸 다시 감싸지 않게 원본 유무로 가른다.
    //   JSON-LD 의 image 는 위에서 사진 그대로 둔다 — 검색엔진에겐 상품 사진이 맞다.
    const shareCard = id != null ? passShareCardUrl(id, origin, d.image_url ? photo : null) : productShareImage(photo, origin)
    return { pageTitle, title: pageTitle, description, canonical, ogImage: shareCard, ogType: 'product', noindex: false, jsonLd }
  } catch { return null }
}

interface StayData {
  id?: number | string
  name?: string
  restaurant_name?: string
  description?: string
  description_full?: string
  image_url?: string
  region_sido?: string
  region_sigungu?: string
  address?: string
  property_type?: string
  star_rating?: number
  avg_rating?: number
  review_count?: number
  latitude?: number
  longitude?: number
  kakao_place_url?: string
}
// 🔀 2026-10-12: 5종짜리 사본이 여기 있었다 — guesthouse 를 '게스트하우스' 로 불러 **화면(스테이)과
//   13건이 갈려 있었고**, motel·villa·camping 은 표에 없어 전부 '숙소' 로 뭉개졌다. 표는 SSOT 하나.


/**
 * 🏨 2026-07-20 (대표 — 숙소 상세 SSR/OG): /stays/:id 서버 메타/JSON-LD. 응답 형태가 DETAIL 과 달라
 *   `{ data: { product, rooms } }` — product + rooms(최저가) 로 빌드. 숙소명(restaurant_name) 우선 타이틀,
 *   지역·유형·평점 설명, LodgingBusiness/Offer JSON-LD. id 는 pathname 에서 추출(psi.* 컬럼 충돌 회피).
 */
export function buildStayDetailMeta(ssrPayload: string, origin: string, pathname: string): DetailMeta | null {
  try {
    const parsed = JSON.parse(ssrPayload) as { data?: { product?: StayData; rooms?: Array<{ base_price_weekday?: number }> } }
    const p = parsed?.data?.product
    if (!p || !(p.restaurant_name || p.name)) return null
    const idm = pathname.match(/\/stays\/(\d+)/)
    const id = idm ? idm[1] : (p.id ?? '')
    const stayName = String(p.restaurant_name || p.name).trim()
    // 🏷️ 2026-10-14: 이 공식은 **그대로 둔다** — 제목 SSOT 도 컬럼을 먼저 쓰므로 둘이 같고,
    //   주소 우선으로 바꾸면 `강원` → `강원특별자치도` 가 되어 49건의 설명이 달라진다.
    const region = [p.region_sido, p.region_sigungu].filter(Boolean).join(' ').trim()
    const typeLabel = p.property_type ? propertyTypeLabel(p.property_type) : '숙소'
    const rooms = parsed?.data?.rooms || []
    const roomPrices = rooms.map(r => Number(r.base_price_weekday) || 0).filter(v => v > 0)
    const fromPrice = roomPrices.length ? Math.min(...roomPrices) : 0
    const toPrice = roomPrices.length ? Math.max(...roomPrices) : 0
    const canonical = `${origin}/stays/${id}`
    const photo = absImage(String(p.image_url || ''), origin, id) // JSON-LD 용 원본
    const ogImage = productShareImage(photo, origin) // 🖼️ 소셜 카드 — 실측 원본 1397×748·518KB 였다
    // 🏷️ 2026-10-14: 클라(`StayDetailPage`)는 지역 없이 제목을 냈고 react-helmet 이 이걸 덮어
    //   **Googlebot 이 지역을 잃고 있었다**(Yeti 는 받았다 — 한 URL 두 값). 제목은 SSOT 하나로.
    //   🔒 공식은 **컬럼 우선** 이라 라이브 49건의 제목은 byte-동일이다(아래 설명의 지역과도 같다).
    const pageTitle = stayDetailTitle(stayName, { sido: p.region_sido, sigungu: p.region_sigungu, address: p.address })
    const priceStr = fromPrice > 0 ? `1박 ${fromPrice.toLocaleString('ko-KR')}원~ ` : ''
    const rating = Number(p.avg_rating) || 0
    const ratingStr = rating > 0 ? `⭐${rating.toFixed(1)} ` : ''
    const baseDesc = String(p.description_full || p.description || '').replace(/\s+/g, ' ').trim()
    const description = (`${ratingStr}${region ? region + ' ' : ''}${typeLabel} · ${priceStr}${baseDesc}`
      || `${stayName}. 유어딜에서 숙소 이용권을 할인가로 예약하세요.`).trim().slice(0, 200)

    // 🏨 2026-10-12 [UNLOCK_LOADING] (대표 "둘 다 잠금 해제하고 가장 이상적으로"): **이 URL 이 정본이다.**
    //   실측으로 `/pass/:id`(숙소 이용권)와 `/stays/:id` 가 **같은 상품 id**를 각각 자기 canonical 로
    //   `index, follow` 하고 있었다(제목도 상품명↔매장명으로 달랐다) — 같은 엔티티의 두 색인 URL.
    //   SSOT(`canonicalDetailPath`)가 `stay_voucher` → `/stays/:id` 라 정본은 이쪽인데, 그때 이 페이지는
    //   **`Product`·`Offer` 가 없었다**(`LodgingBusiness`+빵부스러기뿐) — 즉 "살 수 있는 것" 신호가 0.
    //   정본으로 지목하기 전에 그걸 먼저 준다. 아래 `@graph` 로 노드를 모으고(종전엔 `@context` 를 노드마다
    //   얹은 배열) 매장을 `@id` 로 분리해 Offer 가 가리킨다 — `/pass/:id` 와 **같은 모양**.
    const placeId = `${canonical}#place`
    const staySameAs = placeSameAs(p.kakao_place_url)
    // ⭐ 평점은 **한 곳에서만** 조립한다 — 두 엔티티가 각자 만들면 둘 중 하나가 조용히 갈린다.
    const hasRating = rating > 0 && Number(p.review_count) > 0
    const aggregateRatingNode = { '@type': 'AggregateRating', ratingValue: rating, reviewCount: Number(p.review_count) }
    const lodging: Record<string, unknown> = {
      '@type': 'LodgingBusiness', '@id': placeId,
      name: stayName,
      ...(staySameAs ? { sameAs: [staySameAs] } : {}),
      ...(baseDesc ? { description: baseDesc.slice(0, 300) } : {}),
      ...(p.image_url ? { image: [photo] } : {}),
      ...((a => a ? { address: a } : {})(postalAddress(p.address, p.region_sido))),
      ...(p.latitude && p.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } } : {}),
      ...(p.star_rating ? { starRating: { '@type': 'Rating', ratingValue: p.star_rating } } : {}),
      // ⭐ 2026-10-14: 평점은 **`Product` 로 옮겼다**(아래). 여기엔 `Product` 가 안 만들어질 때만
      //   남긴다 — 같은 리뷰 묶음을 두 엔티티에 선언하면 무엇의 평점인지 문서가 스스로 모순된다.
      //   `starRating`(호텔 등급)은 다른 사실이라 그대로 둔다.
      ...(hasRating && fromPrice <= 0 ? { aggregateRating: aggregateRatingNode } : {}),
      ...(fromPrice > 0 ? { priceRange: `₩${fromPrice.toLocaleString('ko-KR')}~` } : {}),
      url: canonical,
    }
    // 🛒 살 수 있는 것 = 이 숙소의 1박 숙박권. 값은 **객실 가격에서만** 온다(이 페이로드엔 `price` 가
    //   없다 — 숙소 API 는 매장 지향 컬럼을 고른다). 하나의 정가를 지어내지 않고 `AggregateOffer`
    //   (`lowPrice`~`highPrice`)로 **"1박 N원~"** 을 그대로 말한다. 화면이 객실 목록으로 보여 주는 것과
    //   같은 범위라 내용-스키마 불일치가 없다. 객실 가격이 없으면 **Offer 를 아예 안 만든다**(지어내기 금지).
    const product: Record<string, unknown> | null = fromPrice > 0 ? {
      '@type': 'Product',
      name: String(p.name || stayName).trim(),
      ...(baseDesc ? { description: baseDesc.slice(0, 300) } : {}),
      ...(p.image_url ? { image: [photo] } : {}),
      brand: { '@type': 'Brand', name: stayName },
      // ⭐ 2026-10-14 — **정본이 사본보다 약했다.** 라이브 실측(Googlebot UA, 같은 상품의 두 URL):
      //
      //     /pass/2887  (사본, canonical → /stays/2887)   Product.aggregateRating  4.6(9)  ← 있음
      //     /stays/2887 (정본)                            Product.aggregateRating  없음     ← 별점 0
      //                                                   LodgingBusiness          4.6(9)
      //
      //   구글은 정본으로 통합하므로 **숙소 49건이 Product 리치결과의 별점을 잃는다**(그 리치결과는
      //   `Product.aggregateRating` 또는 `review` 를 요구한다). 게다가 두 URL 이 같은 4.6 을 서로
      //   **다른 엔티티의 평점**이라고 주장하고 있었다. 🔑 출처가 `products.avg_rating` ·
      //   `products.review_count`(**상품 컬럼**)이므로 `Product` 가 맞는 자리이고, 식사·쇼핑 경로와
      //   `/pass` 사본이 이미 그렇게 한다 — 즉 숙소 한 자리만 갈려 있었다.
      //   🔴 지어내지 않는다: 평점·리뷰수 둘 다 양수일 때만 낸다(리뷰 0 에 평점 0 을 내면 "0점짜리
      //      상품" 이라고 말하는 것이고 구글 정책 위반이다 — 2026-10-11 에 값을 치른 자리).
      ...(hasRating ? { aggregateRating: aggregateRatingNode } : {}),
      offers: {
        '@type': 'AggregateOffer', url: canonical, priceCurrency: 'KRW',
        lowPrice: fromPrice, ...(toPrice > fromPrice ? { highPrice: toPrice } : {}),
        offerCount: roomPrices.length,
        // 🏨 2026-10-13: 숙소는 `InStock` **유지**가 맞다 — 쇼핑과 다른 축이다.
        //   `AggregateOffer.availability` 는 "하나라도 살 수 있는가" 이고, 이 분기는 이미
        //   `fromPrice > 0`(= 가격이 붙은 활성 객실이 하나 이상)일 때만 들어온다. 날짜별 잔여는
        //   **달력**(`stay_calendar.available_count`)이 쥐고 있고 이 페이로드엔 안 온다 ⇒
        //   그걸 모른 채 `OutOfStock` 으로 내리면 멀쩡한 숙소를 품절이라고 말하게 된다.
        //   ⚠️ 쇼핑과 "일관성" 을 이유로 한쪽으로 몰지 말 것(두 축이다).
        availability: 'https://schema.org/InStock',
        availableAtOrFrom: { '@id': placeId },
      },
    } : null
    const breadcrumb = {
      '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
      itemListElement: crumbItems(withCrumbRoot(origin, [
        { name: '숙소', url: `${origin}/stays` },
        { name: stayName, url: canonical },
      ])),
    }
    const jsonLd = escapeScript(JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': product ? [product, lodging, breadcrumb] : [lodging, breadcrumb],
    }))
    return { pageTitle, title: pageTitle, description, canonical, ogImage, ogType: 'product', noindex: false, jsonLd }
  } catch { return null }
}

/**
 * 🔎 2026-07-20 [UNLOCK_LOADING] 쇼핑 상품 상세(/products/:id · PRODUCT slot) 서버 메타.
 *   그간 PRODUCT 슬롯은 데이터(`__SSR_INITIAL_PRODUCT__`)만 주입하고 메타는 index.html 기본(제네릭 홈)을
 *   서빙 → 카톡/소셜/네이버가 상품 링크를 "유어딜 홈" 카드로 봄(가장 약한 서버 OG). DETAIL(공구/이용권)과
 *   동일 패턴으로 가격·할인율이 들어간 정밀 OG + Product/Offer JSON-LD 주입.
 *   딜(원화 아님) 상품은 offer 가격을 생략(KRW 전용 스키마). payload 파싱 실패 시 null(기본 메타 유지).
 */
export function buildProductMeta(ssrPayload: string, origin: string, pathname: string): DetailMeta | null {
  try {
    const d = (JSON.parse(ssrPayload) as { data?: DetailData })?.data
    if (!d || !d.name) return null
    const id = d.id
    const name = String(d.name).trim()
    const brand = String(d.brand_name || '').trim()
    // 📦 화면(`ProductDetailPage` 구매 버튼)과 **같은 술어**: 두 컬럼이 다 0 이하일 때만 품절.
    const inStock = Number(d.stock ?? 0) > 0 || Number(d.stock_quantity ?? 0) > 0
    const price = Number(d.price) || 0
    const original = Number(d.original_price) || 0
    const isDeal = Number(d.deal_only) === 1
    const unit = isDeal ? '딜' : '원'
    const rate = original > price && price > 0 ? Math.round((1 - price / original) * 100) : 0
    // 🔗 2026-10-12 (대표 "다 개선하고"): canonical 을 **SSOT 가 말하는 정본 주소**로. 실측에서
    //   같은 상품이 `/pass/2919`·`/products/2919` 로, `/stays/2887`·`/products/2887` 로 각각
    //   **자기 자신**을 정본이라 선언하고 있었다(둘 다 `index, follow`). 서로를 가리키지도 않으니
    //   구글은 둘 다 무시하고 자기가 고른다 — 2026-10-12 오전 `/pass`↔`/stays` 수리의 세 번째 얼굴이다.
    //   규모: sitemap 의 `/pass` 310 + `/stays` 50 = 360건이 `/products/:id` 로도 색인 가능했다.
    //   ⚠️ noindex 를 **같이 붙이지 않는다**(canonical 통합 + noindex 는 서로 반대 신호).
    //      교환권의 `noindex: isDeal` 은 그대로 — 그건 "이 상품은 색인 대상이 아니다" 로 축이 다르다.
    //   폴백은 종전과 같은 `pathname`(판정 불가 시 자기 자신).
    //   🔴 **교환권(`deal_only=1`)은 self-canonical 을 유지한다.** 그쪽은 `noindex: isDeal` 이 붙는데,
    //      거기에 cross-canonical 을 겹치면 *"이 페이지를 버리고 X 로 합쳐라"* 와 *"색인하지 마라"* 가
    //      서로 반대 신호가 된다(오전 audit log 가 경고한 그 자리). 색인 안 하는 URL 은 합칠 것도 없다.
    //      ⇒ 바뀌는 것은 **색인 대상인 이용권·숙소 360건**뿐이고 교환권 2,260건은 byte-동일이다.
    const canonicalPath = isDeal
      ? null
      : canonicalDetailPath({ id: id ?? '', deal_only: d.deal_only, category: d.category })
    const canonical = `${origin}${canonicalPath && canonicalPath.startsWith('/') ? canonicalPath : pathname}`
    const photo = absImage(String(d.image_url || ''), origin, id, `${origin}/og-image.png`) // JSON-LD 용 원본
    const ogImage = productShareImage(photo, origin) // 🖼️ 소셜 카드 — 실측 남의 CDN 500×500·258KB 였다
    const priceStr = price.toLocaleString('ko-KR')

    const pageTitle = `${name} - 유어딜`
    const description = (rate > 0
      ? `🎉 ${rate}% 할인! ${name} ${priceStr}${unit}, 유어딜에서 바로 구매`
      : `${name} ${priceStr}${unit}, 유어딜에서 할인가로 바로 구매`).replace(/\s+/g, ' ').trim().slice(0, 200)

    const product: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'Product',
      name,
      description: (String(d.description || '') || `${name}, 유어딜`).replace(/\s+/g, ' ').trim().slice(0, 300),
      ...(d.image_url ? { image: [photo] } : {}),
      ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
      // 💰 KRW 상품만 offer 가격 노출(딜 상품은 통화 스키마 부적합 → 가격 생략).
      ...(!isDeal && price > 0 ? {
        offers: {
          '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price,
          // 📦 2026-10-13: 종전엔 **항상 `InStock`** 이라 품절 상품도 구조화 데이터로는 "재고 있음"
          //   이었다. 구글 상품 정책은 availability 가 **페이지와 일치**하기를 요구하고, 어긋나면
          //   리치결과가 통째로 거절될 수 있다(그리고 사용자는 품절을 클릭한다).
          //   🩸 **재고 컬럼이 두 벌이라 순진하게 고치면 더 나빠진다** — 라이브 실측(id 2917):
          //   `stock: 200` 인데 `stock_quantity: 0` 이다. 어느 한쪽만 보면 **멀쩡한 상품이
          //   OutOfStock** 이 되고 그건 오늘보다 나쁘다. 그래서 판정은 화면과 **같은 술어**다 —
          //   `ProductDetailPage.tsx` 의 구매 버튼 `disabled`(둘 다 0 이하일 때만 품절,
          //   2026-07-02 에 `null === 0` 갭으로 한 번 값을 치른 그 줄).
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          ...(d.seller_name ? { seller: { '@type': 'Organization', name: String(d.seller_name) } } : {}),
        },
      } : {}),
    }
    // 🍞 2026-10-12 (대표 "다 개선하고 또 개선할 것 있는지 찾아줘"): **쇼핑 상세에 빵부스러기가 없었다.**
    //   라이브 전수(Googlebot UA 로 받아 파싱) — 색인 대상 상세 넷 중 `/products/:id` **하나만**
    //   `BreadcrumbList` 0건이었다(`/pass`·`/stays`·`/u/:handle` 은 전부 있다). 같은 날 오전에
    //   `/region` 44개 + `/blog` 23편에서 고친 것과 **같은 클래스**이고, 그때 쇼핑만 빠졌다.
    //   빵부스러기가 없으면 검색결과 제목 아래에 경로 대신 **생 URL** 이 뜬다.
    //   🔑 중간 라벨을 손으로 적지 않는다 — `/browse` 의 `crumb`(= '쇼핑')을 **같은 표**에서 받는다
    //      (두 벌이면 목록 표면의 빵부스러기와 갈리는데 에러가 전혀 안 난다).
    //   ⚠️ 마지막 항목은 `canonical` 이다(자기 경로 아님) — 교환권이 아닌 이용권·숙소는 canonical 이
    //      `/pass`·`/stays` 를 가리키므로, 여기서 `pathname` 을 쓰면 빵부스러기가 **정본 아닌 URL** 을
    //      가리켜 canonical 과 반대 신호가 된다.
    //   📌 첫 항목은 형제(`/pass`·`/stays`)와 같은 `홈` 이다 — 목록 표면은 `유어딜` 로 시작하는데,
    //      상세 셋의 관행을 이 한 건 때문에 바꾸면 이미 색인된 360건의 빵부스러기가 흔들린다.
    //   🩸 **빌더를 돌려 눈으로 보고서 조건을 좁혔다.** 첫 판은 무조건 달았는데, 이용권
    //      (`/products/2919` → canonical `/pass/2919`)에도 `홈 › 쇼핑 › 닭도리탕` 이 붙으면서
    //      **같은 정본 항목에 두 URL 이 서로 다른 빵부스러기**를 주장했다(그 정본의 제 빵부스러기는
    //      `홈 › 동네딜 › …` 다). 교환권(noindex)도 쇼핑이 아니다. ⇒ **이 페이지가 정본인
    //      순수 쇼핑 상품일 때만** 낸다(`canonicalPath == null` = cross-canonical 아님).
    //      이용권·숙소·교환권은 각자의 정본 표면이 이미 제 빵부스러기를 갖고 있다.
    const shopCrumb = !isDeal && canonicalPath == null && pathname.startsWith('/products/')
      ? CONSUMER_SURFACE_SEO['/browse']?.crumb
      : null
    const breadcrumb = shopCrumb ? {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbItems(withCrumbRoot(origin, [
        { name: shopCrumb, url: `${origin}/browse` },
        { name, url: canonical },
      ])),
    } : null
    const jsonLd = escapeScript(JSON.stringify(breadcrumb ? [product, breadcrumb] : [product]))
    // 🔎 2026-07-29 (소비자 SEO 실측): **교환권이 두 URL 로 갈려 한쪽만 noindex 였다.**
    //   같은 상품 id 2192 가 `/vouchers/2192` 에선 `noindex, follow`(2026-07-07 결정)인데
    //   `/products/2192` 에선 `index, follow` 로 나갔고, sitemap 이 후자를 500건 제출하고 있었다
    //   — 즉 교환권 색인 제외 결정이 다른 URL 로 **우회**되고 있었다(실측 확인).
    //   deal_only 상품은 어느 경로로 오든 색인하지 않는다(DETAIL 슬롯의 교환권 처리와 대칭).
    return { pageTitle, title: pageTitle, description, canonical, ogImage, ogType: 'product', noindex: isDeal, jsonLd }
  } catch { return null }
}
