import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  noindex?: boolean
  jsonLd?: Record<string, unknown>
}

const SITE_NAME = '유어딜'
const DEFAULT_DESC = '라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매, 실시간 라이브 쇼핑'
const DEFAULT_IMAGE = 'https://live.ur-team.com/og-image.png'
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
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="ko_KR" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Naver */}
      <meta name="naver-site-verification" content="7be066f6c7f451d994e3a5482aa76f87e96c3c2f" />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  )
}

/** 상품 JSON-LD */
export function productJsonLd(product: {
  name: string; price: number; image?: string; description?: string
  url: string; seller?: string; rating?: number; reviewCount?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image || DEFAULT_IMAGE,
    description: product.description || '',
    url: `${BASE_URL}${product.url}`,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      seller: product.seller ? { '@type': 'Organization', name: product.seller } : undefined,
    },
    ...(product.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
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
