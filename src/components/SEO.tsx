import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { withSiteName } from '@/shared/seo/consumer-surfaces'

// v39 FIX: og:locale 동적화 — i18n 언어 코드를 BCP47로 변환
const LOCALE_MAP: Record<string, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  ja: 'ja_JP',
  zh: 'zh_CN',
  es: 'es_ES',
  fr: 'fr_FR',
}
const ALL_LOCALES = Object.values(LOCALE_MAP)

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  noindex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /**
   * 🏭 2026-06-08 도메인 인식 — canonical/og:url/site_name 베이스 도메인 선택.
   *   'main' (기본): urdeal.kr / '유어딜' (소비자몰) — 기존 동작과 byte-identical.
   *   'wholesale': utongstart.com / '유통스타트' (B2B 도매몰, utongstart.com 정규 도메인).
   *   ⚠️ 'main' default 라 기존 호출부는 전부 변경 불필요 (하위 호환).
   */
  domain?: 'main' | 'wholesale'
}

const SITE_NAME = '유어딜'
// 🛡️ 2026-05-21: SEO 타이틀/설명 변경 (사용자 요청) — "돈버는 쇼핑" 강조, 오프라인 공동구매 우선.
// 🧹 2026-07-20 (소비자 감사): 폐기된 '라이브 쇼핑/라이브커머스'(2026-07-07 영구중단) 문구 제거 —
//   이 기본 메타는 전 소비자 페이지 타이틀/설명/트위터 카드에 실려 구글/소셜 공유에 노출됨.
const DEFAULT_DESC = '동네 가게 공동구매로 결제하고 딜 적립까지. 인플루언서 추천 이용권 · 동네딜 · 교환권.'
// 🎨 2026-07-19 확정 로고: 기본 OG = 신규 브랜드 래스터(og-image.png — 카카오 등 raster 선호 크롤러 호환).
const DEFAULT_IMAGE = 'https://urdeal.kr/og-image.png'
const BASE_URL = 'https://urdeal.kr'

// 🏭 2026-06-08 도매몰(유통스타트) 정규 도메인 — utongstart.com 을 canonical 로 성장.
const WHOLESALE_SITE_NAME = '유통스타트'
const WHOLESALE_BASE_URL = 'https://utongstart.com'
// 도매 전용 OG 이미지가 없으면 소비자 기본 이미지 재사용(존재 보장 — 깨진 OG 방지).
const WHOLESALE_DEFAULT_IMAGE = `${WHOLESALE_BASE_URL}/og-image.svg`

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  noindex = false,
  jsonLd,
  domain = 'main',
}: SEOProps) {
  const isWholesale = domain === 'wholesale'
  const siteName = isWholesale ? WHOLESALE_SITE_NAME : SITE_NAME
  const baseUrl = isWholesale ? WHOLESALE_BASE_URL : BASE_URL
  // image/description 기본값을 도메인별로 — 'main' 은 기존 상수와 동일(byte-identical).
  const resolvedDescription = description ?? DEFAULT_DESC
  const resolvedImage = image ?? (isWholesale ? WHOLESALE_DEFAULT_IMAGE : DEFAULT_IMAGE)

  // 🐛 2026-07-29 (라이브 실측 — `/vouchers` 의 <title> 이 `교환권 - 유어딜 - 유어딜` 이었다):
  //   접미사를 붙이는 자리가 여기 하나인데, 호출부 다수가 이미 `- 유어딜` 을 포함한 문자열을 넘긴다
  //   (VouchersPage·JoinChoicePage·CreatorApplyPage·랜딩 3종…). 호출부를 하나씩 고치면 새로 생긴다.
  //   → `withSiteName`(SSOT)이 중복을 흡수한다. 접미사 없는 title 의 결과는 기존과 byte-동일.
  const fullTitle = title
    ? withSiteName(title, siteName)
    : (isWholesale
      ? `${siteName} - B2B 도매사이트, 제조사 직거래 도매가 사입`
      : `${siteName} - 돈버는 쇼핑, 동네 가게 공동구매 · 이용권`)
  const fullUrl = url ? `${baseUrl}${url}` : baseUrl
  const twitterSite = isWholesale ? '@utongstart' : '@urdeal_kr'

  // v39 FIX: 현재 사용자 언어 기반 og:locale
  const { i18n } = useTranslation()
  const currentLang = (i18n.language || 'ko').split('-')[0]
  const primaryLocale = LOCALE_MAP[currentLang] || 'ko_KR'
  const alternateLocales = ALL_LOCALES.filter(l => l !== primaryLocale)

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={resolvedDescription} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${siteName} - ${resolvedDescription.slice(0, 60)}`} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={primaryLocale} />
      {alternateLocales.map(loc => (
        <meta key={loc} property="og:locale:alternate" content={loc} />
      ))}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={twitterSite} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />
      <meta name="twitter:image:alt" content={isWholesale ? `${siteName} B2B 도매몰` : `${siteName} 동네 공동구매 · 이용권`} />

      {/* Theme color (모바일 status bar) */}
      <meta name="theme-color" content={isWholesale ? '#0A0A0A' : '#0D0F12'} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={siteName} />

      {/* 🔎 2026-07-28 (대표 "네이버에 유어딜 검색해도 안 나옴" 조사): 네이버 인증 토큰을 여기서 제거.
          ❌ 이 컴포넌트는 react-helmet(=JS 렌더) 이라 **네이버 크롤러(Yeti)가 볼 수 없다** — 검증된 근거:
             7/20 여기에 토큰 추가 + 사이트 등록 → 7/21 수집 0 → 7/22 index.html 에 정적 토큰 배포된
             바로 그날 수집 2·색인 1 발생(서치어드바이저 실측). 즉 정적 토큰만 실효.
          ✅ 인증 토큰 SSOT = `index.html` 정적 meta(프리렌더 → JS 없이 Yeti 도달).
             서로 다른 두 토큰이 공존하면 소유확인이 어느 쪽을 볼지 불확실해지므로 여기선 삭제한다.
          ⚠️ utongstart.com(도매)은 별도 등록·별도 토큰 필요 — 필요 시 그 도메인 정적 HTML 에 추가할 것. */}

      {/* JSON-LD — 단일 또는 배열 둘 다 지원 (Google 권장: 페이지당 여러 개 OK) */}
      {Array.isArray(jsonLd) ? (
        jsonLd.map((ld, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
        ))
      ) : jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Helmet>
  )
}

/** 상품 JSON-LD */
export function productJsonLd(product: {
  name: string; price: number; image?: string; description?: string
  url: string; seller?: string; rating?: number; reviewCount?: number
  originalPrice?: number; stock?: number; sku?: string | number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image || DEFAULT_IMAGE,
    description: product.description || '',
    url: `${BASE_URL}${product.url}`,
    sku: product.sku ? String(product.sku) : undefined,
    brand: { '@type': 'Brand', name: product.seller || '유어딜' },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'KRW',
      availability: (product.stock ?? 1) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: product.seller ? { '@type': 'Organization', name: product.seller } : undefined,
      ...(product.originalPrice && product.originalPrice > product.price ? {
        priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      } : {}),
    },
    ...(product.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        bestRating: 5,
        worstRating: 1,
        reviewCount: product.reviewCount || 0,
      },
    } : {}),
  }
}

/** 조직 JSON-LD */
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '유어딜',
  alternateName: 'UR-Deal',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'jiwon@ur-team.com',
    contactType: 'customer service',
    availableLanguage: ['Korean'],
  },
}

/** 라이브 이벤트 JSON-LD */
export function liveEventJsonLd(stream: {
  title: string; id: number; sellerName?: string
  scheduledAt?: string; description?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: stream.title,
    description: stream.description || `${stream.sellerName || '셀러'} 라이브 방송`,
    url: `${BASE_URL}/live/${stream.id}`,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'VirtualLocation',
      url: `${BASE_URL}/live/${stream.id}`,
    },
    organizer: stream.sellerName ? {
      '@type': 'Organization',
      name: stream.sellerName,
    } : undefined,
    ...(stream.scheduledAt ? { startDate: stream.scheduledAt } : {}),
  }
}

/**
 * 🛡️ 2026-04-29: Breadcrumb JSON-LD — 검색결과 빵부스러기 노출
 *   사용: <SEO jsonLd={breadcrumbJsonLd([{name:'홈',url:'/'},{name:'상품',url:'/products/1'}])} />
 */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url.startsWith('http') ? it.url : `${BASE_URL}${it.url}`,
    })),
  }
}

/**
 * 🛡️ 2026-04-29: FAQ JSON-LD — 자주묻는질문 검색 노출
 *   사용: <SEO jsonLd={faqJsonLd([{q:'배송기간?',a:'2-3일'}])} />
 */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(it => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.a,
      },
    })),
  }
}

/**
 * 🛡️ 2026-04-29: ItemList JSON-LD — 상품 리스트/카테고리 페이지
 *   사용: <SEO jsonLd={itemListJsonLd(products.map((p,i)=>({...p, position:i+1})))} />
 */
export function itemListJsonLd(items: { position: number; name: string; url: string; image?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map(it => ({
      '@type': 'ListItem',
      position: it.position,
      name: it.name,
      url: it.url.startsWith('http') ? it.url : `${BASE_URL}${it.url}`,
      ...(it.image ? { image: it.image } : {}),
    })),
  }
}

/**
 * 🛡️ 2026-04-29: WebSite JSON-LD with SearchAction — Google 검색결과 sitelinks 검색박스
 */
export const webSiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '유어딜',
  url: BASE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE_URL}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

/**
 * 🏭 2026-06-08 도매몰(유통스타트) Organization/Store JSON-LD — utongstart.com 브랜드 정규화.
 *   ⚠️ 공급가/거래정보는 절대 포함하지 않음 (도매가 비노출 룰).
 */
export const wholesaleStoreJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '유통스타트 도매몰',
  alternateName: ['유통스타트', 'UtongStart', 'utongstart'],
  url: WHOLESALE_BASE_URL,
  logo: `${WHOLESALE_BASE_URL}/logo.png`,
  description: '제조사와 판매사를 직접 잇는 B2B 도매 플랫폼. 도매가 사입과 OEM/ODM 제작, 무재고 위탁판매.',
  areaServed: 'KR',
  sameAs: [],
}
