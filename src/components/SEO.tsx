import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

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
}

const SITE_NAME = '유어딜'
const DEFAULT_DESC = '라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매, 실시간 라이브 쇼핑'
const DEFAULT_IMAGE = 'https://live.ur-team.com/og-image.svg'
const BASE_URL = 'https://live.ur-team.com'

export default function SEO({
  title,
  description = DEFAULT_DESC,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = title ? `${title} - ${SITE_NAME}` : `${SITE_NAME} - 라이브 커머스 & 맛집 공동구매`
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL

  // v39 FIX: 현재 사용자 언어 기반 og:locale
  const { i18n } = useTranslation()
  const currentLang = (i18n.language || 'ko').split('-')[0]
  const primaryLocale = LOCALE_MAP[currentLang] || 'ko_KR'
  const alternateLocales = ALL_LOCALES.filter(l => l !== primaryLocale)

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} - ${description.slice(0, 60)}`} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={primaryLocale} />
      {alternateLocales.map(loc => (
        <meta key={loc} property="og:locale:alternate" content={loc} />
      ))}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@urdeal_kr" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={`${SITE_NAME} 라이브 커머스`} />

      {/* Theme color (모바일 status bar) */}
      <meta name="theme-color" content="#020202" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />

      {/* Naver */}
      <meta name="naver-site-verification" content="7be066f6c7f451d994e3a5482aa76f87e96c3c2f" />

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
    telephone: '0507-0177-0432',
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
