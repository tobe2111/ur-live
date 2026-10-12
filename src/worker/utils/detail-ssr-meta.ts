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
// 🏨 정본 상세 주소 SSOT — 숙소 이용권은 `/stays/:id` 다(두 벌로 적으면 갈린다).
import { canonicalDetailPath } from '../../shared/product-flow'
import { propertyTypeLabel } from '../../shared/stay-property-type'
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
    const ogImage = absImage(String(d.image_url || ''), origin, id)
    const isVoucher = pathname.startsWith('/vouchers/') // 교환권 — 클라 noindex 와 대칭

    if (isVoucher) {
      const title = `${name} 교환권 - 유어딜`
      const description = (String(d.description || '').replace(/\s+/g, ' ').trim().slice(0, 150))
        || `${name} — 기프티콘 교환권을 유어딜에서 할인가로 구매하고 바로 사용하세요.`
      return { pageTitle: title, title, description, canonical, ogImage, ogType: 'product', noindex: true, jsonLd: '' }
    }

    // 이용권/동네딜 (group-buy) — 인덱싱 + 풀 메타 + JSON-LD
    const pageTitle = `${name} 공동구매 - ${store || '유어딜'}`
    const priceStr = price.toLocaleString('ko-KR')
    const description = (discount > 0
      ? `🎉 ${discount}% 할인! ${store} ${name} — ${priceStr}원에 유어딜에서 바로 구매`
      : `${store} ${name} — ${priceStr}원, 유어딜에서 할인가로 바로 구매`).replace(/\s+/g, ' ').trim().slice(0, 200)

    const available = d.group_buy_status === 'active' || d.group_buy_status === 'achieved'
    const product: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'Product',
      name,
      description: (String(d.description || '') || `${store} ${name} 공동구매`).replace(/\s+/g, ' ').trim().slice(0, 300),
      ...(d.image_url ? { image: [ogImage] } : {}),
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
    const place = hasPlace ? {
      '@context': 'https://schema.org', '@type': bizType, '@id': placeId,
      name: store,
      ...(d.restaurant_address ? { address: { '@type': 'PostalAddress', streetAddress: String(d.restaurant_address), addressCountry: 'KR' } } : {}),
      ...(d.restaurant_lat && d.restaurant_lng ? { geo: { '@type': 'GeoCoordinates', latitude: d.restaurant_lat, longitude: d.restaurant_lng } } : {}),
      ...(d.restaurant_phone ? { telephone: String(d.restaurant_phone) } : {}),
      ...(d.image_url ? { image: [ogImage] } : {}),
    } : null
    if (place) (product.offers as Record<string, unknown>).availableAtOrFrom = { '@id': placeId }
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${origin}/` },
        // 🎟️ 2026-09-16: `/group-buy` 는 홈으로 301 되는 별칭이라 **빵부스러기가 리다이렉트를
        //   가리키고 있었다**(색인 신호가 한 홉 낭비된다). 정본인 홈으로 직접.
        { '@type': 'ListItem', position: 2, name: '동네딜', item: `${origin}/` },
        { '@type': 'ListItem', position: 3, name, item: canonical },
      ],
    }
    const jsonLd = escapeScript(JSON.stringify(place ? [product, place, breadcrumb] : [product, breadcrumb]))
    // 🦦 2026-10-09 (대표 확정 시안 ② · "바꾸기"): 공유 미리보기는 사진 원본이 아니라 **공유 카드**(사진 + 귀퉁이
    //   유달이 + `urdeal.`). JSON-LD 의 image 는 위에서 사진 그대로 둔다 — 검색엔진에겐 상품 사진이 맞다.
    const shareCard = id != null ? passShareCardUrl(id, origin) : ogImage
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
    const region = [p.region_sido, p.region_sigungu].filter(Boolean).join(' ').trim()
    const typeLabel = p.property_type ? propertyTypeLabel(p.property_type) : '숙소'
    const rooms = parsed?.data?.rooms || []
    const roomPrices = rooms.map(r => Number(r.base_price_weekday) || 0).filter(v => v > 0)
    const fromPrice = roomPrices.length ? Math.min(...roomPrices) : 0
    const toPrice = roomPrices.length ? Math.max(...roomPrices) : 0
    const canonical = `${origin}/stays/${id}`
    const ogImage = absImage(String(p.image_url || ''), origin, id)
    const pageTitle = `${stayName}${region ? ` (${region})` : ''} - 유어딜`
    const priceStr = fromPrice > 0 ? `1박 ${fromPrice.toLocaleString('ko-KR')}원~ ` : ''
    const rating = Number(p.avg_rating) || 0
    const ratingStr = rating > 0 ? `⭐${rating.toFixed(1)} ` : ''
    const baseDesc = String(p.description_full || p.description || '').replace(/\s+/g, ' ').trim()
    const description = (`${ratingStr}${region ? region + ' ' : ''}${typeLabel} · ${priceStr}${baseDesc}`
      || `${stayName} — 유어딜에서 숙소 이용권을 할인가로 예약하세요.`).trim().slice(0, 200)

    // 🏨 2026-10-12 [UNLOCK_LOADING] (대표 "둘 다 잠금 해제하고 가장 이상적으로"): **이 URL 이 정본이다.**
    //   실측으로 `/pass/:id`(숙소 이용권)와 `/stays/:id` 가 **같은 상품 id**를 각각 자기 canonical 로
    //   `index, follow` 하고 있었다(제목도 상품명↔매장명으로 달랐다) — 같은 엔티티의 두 색인 URL.
    //   SSOT(`canonicalDetailPath`)가 `stay_voucher` → `/stays/:id` 라 정본은 이쪽인데, 그때 이 페이지는
    //   **`Product`·`Offer` 가 없었다**(`LodgingBusiness`+빵부스러기뿐) — 즉 "살 수 있는 것" 신호가 0.
    //   정본으로 지목하기 전에 그걸 먼저 준다. 아래 `@graph` 로 노드를 모으고(종전엔 `@context` 를 노드마다
    //   얹은 배열) 매장을 `@id` 로 분리해 Offer 가 가리킨다 — `/pass/:id` 와 **같은 모양**.
    const placeId = `${canonical}#place`
    const lodging: Record<string, unknown> = {
      '@type': 'LodgingBusiness', '@id': placeId,
      name: stayName,
      ...(baseDesc ? { description: baseDesc.slice(0, 300) } : {}),
      ...(p.image_url ? { image: [ogImage] } : {}),
      ...(p.address ? { address: { '@type': 'PostalAddress', streetAddress: String(p.address), addressRegion: p.region_sido || undefined, addressCountry: 'KR' } } : {}),
      ...(p.latitude && p.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } } : {}),
      ...(p.star_rating ? { starRating: { '@type': 'Rating', ratingValue: p.star_rating } } : {}),
      ...(rating > 0 && Number(p.review_count) > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating, reviewCount: Number(p.review_count) } } : {}),
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
      ...(p.image_url ? { image: [ogImage] } : {}),
      brand: { '@type': 'Brand', name: stayName },
      offers: {
        '@type': 'AggregateOffer', url: canonical, priceCurrency: 'KRW',
        lowPrice: fromPrice, ...(toPrice > fromPrice ? { highPrice: toPrice } : {}),
        offerCount: roomPrices.length,
        availability: 'https://schema.org/InStock',
        availableAtOrFrom: { '@id': placeId },
      },
    } : null
    const breadcrumb = {
      '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: '숙소', item: `${origin}/stays` },
        { '@type': 'ListItem', position: 3, name: stayName, item: canonical },
      ],
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
    const ogImage = absImage(String(d.image_url || ''), origin, id, `${origin}/og-image.png`)
    const priceStr = price.toLocaleString('ko-KR')

    const pageTitle = `${name} - 유어딜`
    const description = (rate > 0
      ? `🎉 ${rate}% 할인! ${name} — ${priceStr}${unit}, 유어딜에서 바로 구매`
      : `${name} — ${priceStr}${unit}, 유어딜에서 할인가로 바로 구매`).replace(/\s+/g, ' ').trim().slice(0, 200)

    const product: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'Product',
      name,
      description: (String(d.description || '') || `${name} — 유어딜`).replace(/\s+/g, ' ').trim().slice(0, 300),
      ...(d.image_url ? { image: [ogImage] } : {}),
      ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
      // 💰 KRW 상품만 offer 가격 노출(딜 상품은 통화 스키마 부적합 → 가격 생략).
      ...(!isDeal && price > 0 ? {
        offers: {
          '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price,
          availability: 'https://schema.org/InStock',
          ...(d.seller_name ? { seller: { '@type': 'Organization', name: String(d.seller_name) } } : {}),
        },
      } : {}),
    }
    const jsonLd = escapeScript(JSON.stringify([product]))
    // 🔎 2026-07-29 (소비자 SEO 실측): **교환권이 두 URL 로 갈려 한쪽만 noindex 였다.**
    //   같은 상품 id 2192 가 `/vouchers/2192` 에선 `noindex, follow`(2026-07-07 결정)인데
    //   `/products/2192` 에선 `index, follow` 로 나갔고, sitemap 이 후자를 500건 제출하고 있었다
    //   — 즉 교환권 색인 제외 결정이 다른 URL 로 **우회**되고 있었다(실측 확인).
    //   deal_only 상품은 어느 경로로 오든 색인하지 않는다(DETAIL 슬롯의 교환권 처리와 대칭).
    return { pageTitle, title: pageTitle, description, canonical, ogImage, ogType: 'product', noindex: isDeal, jsonLd }
  } catch { return null }
}
