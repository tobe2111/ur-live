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
        { '@type': 'ListItem', position: 2, name: '동네딜', item: `${origin}/group-buy` },
        { '@type': 'ListItem', position: 3, name, item: canonical },
      ],
    }
    const jsonLd = escapeScript(JSON.stringify([product, breadcrumb]))
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
    return { pageTitle, title: pageTitle, description, canonical, ogImage, ogType: 'product', noindex: false, jsonLd }
  } catch { return null }
}
