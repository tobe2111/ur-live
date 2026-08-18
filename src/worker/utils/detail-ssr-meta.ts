/**
 * 🔎 2026-07-07 (대표 "각 이용권 페이지마다 SEO 다 잘 되지?"): 공구/이용권 상세(DETAIL slot) 서버측
 *   메타/구조화데이터 빌더. 그간 DETAIL 슬롯은 `__SSR_INITIAL_DETAIL__` 데이터만 주입하고 title/OG/canonical/
 *   JSON-LD 는 index.html 소비자 기본값(제네릭 홈)을 그대로 서빙 → JS 안 도는 크롤러(네이버/카카오/소셜
 *   스크래퍼)가 이용권 링크 공유·색인 시 "유어딜 홈" 카드를 봄(BLOGPOST/CURATOR/WHOLESALE 은 이미 rewrite).
 *   Googlebot 은 react-helmet(<SEO>)을 렌더해 페이지별 정밀 메타를 보지만, 비-JS 크롤러는 정적 HTML 메타만 봄.
 *   worker/index 의 HTMLRewriter `.on()` 배선은 이 결과값만 소비 — god 파일 성장 방지(file-size 래칫).
 */

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
}

/** 절대 URL 이미지로 정규화 (http → 그대로, / 상대 → origin 접두, 그 외 → fallback). */
function absImage(raw: string, origin: string, id: number | string | undefined, fallback?: string): string {
  if (raw.startsWith('http')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return fallback || `${origin}/api/og/group-buy/${id ?? ''}.png`
}

/**
 * 공구/이용권 상세(/group-buy/:id · /vouchers/:id) 서버 메타.
 *   - /vouchers/:id (교환권) → noindex(클라 대칭) + OG 는 공유 카드용으로 여전히 주입, JSON-LD 없음.
 *   - /group-buy/:id (이용권/동네딜) → 인덱싱 + Product/Offer/Breadcrumb JSON-LD.
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
    const canonical = `${origin}${pathname}`
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
        ...(d.group_buy_deadline ? { priceValidUntil: String(d.group_buy_deadline) } : {}),
        ...(d.seller_name ? { seller: { '@type': 'Organization', name: String(d.seller_name) } } : {}),
      },
      ...(d.restaurant_lat && d.restaurant_lng ? {
        ...(d.restaurant_address ? { address: { '@type': 'PostalAddress', streetAddress: String(d.restaurant_address), addressCountry: 'KR' } } : {}),
        geo: { '@type': 'GeoCoordinates', latitude: d.restaurant_lat, longitude: d.restaurant_lng },
      } : {}),
    }
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${origin}/` },
        // 🎟️ 2026-08-16: `/group-buy` 는 홈으로 301 되는 별칭이라 **빵부스러기가 리다이렉트를
        //   가리키고 있었다**(색인 신호가 한 홉 낭비된다). 정본인 홈으로 직접.
        { '@type': 'ListItem', position: 2, name: '동네딜', item: `${origin}/` },
        { '@type': 'ListItem', position: 3, name, item: canonical },
      ],
    }
    const jsonLd = escapeScript(JSON.stringify([product, breadcrumb]))
    return { pageTitle, title: pageTitle, description, canonical, ogImage, ogType: 'product', noindex: false, jsonLd }
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
const STAY_TYPE_LABEL: Record<string, string> = {
  pension: '펜션', hotel: '호텔', guesthouse: '게스트하우스', resort: '리조트', glamping: '글램핑',
}

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
    const typeLabel = p.property_type ? (STAY_TYPE_LABEL[p.property_type] || '숙소') : '숙소'
    const rooms = parsed?.data?.rooms || []
    const fromPrice = rooms.reduce((min, r) => {
      const v = Number(r.base_price_weekday) || 0
      return v > 0 && (min === 0 || v < min) ? v : min
    }, 0)
    const canonical = `${origin}/stays/${id}`
    const ogImage = absImage(String(p.image_url || ''), origin, id)
    const pageTitle = `${stayName}${region ? ` (${region})` : ''} - 유어딜`
    const priceStr = fromPrice > 0 ? `1박 ${fromPrice.toLocaleString('ko-KR')}원~ ` : ''
    const rating = Number(p.avg_rating) || 0
    const ratingStr = rating > 0 ? `⭐${rating.toFixed(1)} ` : ''
    const baseDesc = String(p.description_full || p.description || '').replace(/\s+/g, ' ').trim()
    const description = (`${ratingStr}${region ? region + ' ' : ''}${typeLabel} · ${priceStr}${baseDesc}`
      || `${stayName} — 유어딜에서 숙소 이용권을 할인가로 예약하세요.`).trim().slice(0, 200)

    const lodging: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'LodgingBusiness',
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
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: '숙소', item: `${origin}/stays` },
        { '@type': 'ListItem', position: 3, name: stayName, item: canonical },
      ],
    }
    const jsonLd = escapeScript(JSON.stringify([lodging, breadcrumb]))
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
    const canonical = `${origin}${pathname}`
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
