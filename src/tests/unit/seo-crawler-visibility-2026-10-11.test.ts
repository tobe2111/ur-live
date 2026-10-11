/**
 * 🔎 **크롤러가 우리 본문을 보는가 — 네이버 본문 · 브랜드 이름 · 매장 엔티티**
 * (2026-10-11 대표 *"네이버도 해주고 … 언제나 최상단에 노출이 될 수 있게끔 … 특히 이용권 페이지들은 더욱"*)
 *
 * ## 이 파일이 고정하는 세 가지 (전부 라이브 실측에서 나온 결함이다)
 *
 * **① 네이버가 본문을 본다** — Yeti UA 로 재니 `/` 6자 · `/u/:handle` 6자 · `/pass/:id` 49자였다.
 *    홈·유어샵 첫 화면이 `isMobileUserAgent` 게이트 뒤였고 Yeti UA 엔 `Mobi|Android|iPhone` 이
 *    하나도 없다. Googlebot 은 스마트폰 크롤러라 **우연히** 보고 있었다(363자/242자).
 *
 * **② 사이트 이름이 브랜드다** — 구글이 `urdeal.kr`(도메인)로 쓰고 있었다. 사이트 이름의 1순위
 *    소스는 **홈페이지의 `WebSite` JSON-LD `name`** 인데 홈 JSON-LD 가 0건이었다.
 *
 * **③ 매장이 검색엔진에 전달된다** — `address`·`geo` 가 `Product` 안에 있었다. 그 둘은 Product 의
 *    표준 속성이 **아니라서** 구글이 버린다. 즉 "전주 덕진구의 돈가스집" 이라는 사실이 한 번도
 *    전달된 적이 없다 — 로컬 검색이 본류인 서비스에서.
 *
 * ## ⚠️ 이 테스트가 **못** 하는 것
 * - 실제로 색인되는지는 못 잰다(구글·네이버의 몫이고 수일~수주 걸린다). 여기서 보는 것은
 *   **"우리가 줄 것을 주고 있는가"** 까지다. E4 판정은 배포 후 서치콘솔·서치어드바이저다.
 * - 리치 결과로 **표시**될지도 못 잰다(구글이 고른다). 스키마가 유효한지까지다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { isSearchCrawlerUA, shouldRenderMobileFirstScreen } from '@/shared/seo/crawler-ua'
import { buildDetailNoscript, buildCuratorNoscript } from '../../worker/utils/crawler-noscript'
import { buildBrandJsonLd, BRAND_NAME } from '@/shared/seo/brand-jsonld'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { buildDetailMeta } from '../../worker/utils/detail-ssr-meta'

const ORIGIN = 'https://urdeal.kr'

// 라이브에서 실제로 받은 UA 들 — 지어낸 문자열로 재면 현실과 갈린다.
const UA = {
  yeti: 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
  googlebotSmart:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googlebotDesk:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/137.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  pcChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
}

describe('① 검색 크롤러 판정 — 네이버가 데스크톱으로 분류되던 것', () => {
  it('국내 검색이 전부 잡힌다 — 이게 이 수리의 본체다', () => {
    expect(isSearchCrawlerUA(UA.yeti), '네이버 Yeti 를 놓치면 수리가 통째로 무의미하다').toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; DaumOA/4.1; +http://cs.daum.net/robot)')).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; NaverBot/1.0)')).toBe(true)
  })

  it('글로벌 검색·AI 검색도 잡는다', () => {
    for (const ua of [UA.googlebotSmart, UA.googlebotDesk]) expect(isSearchCrawlerUA(ua)).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)')).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe(true)
  })

  it('🔴 사람 브라우저는 크롤러가 아니다 — 여기서 true 가 나오면 PC 에 모바일 레이아웃이 깔린다', () => {
    expect(isSearchCrawlerUA(UA.pcChrome)).toBe(false)
    expect(isSearchCrawlerUA(UA.mac)).toBe(false)
    expect(isSearchCrawlerUA(UA.iphone)).toBe(false)
    expect(isSearchCrawlerUA('')).toBe(false)
    expect(isSearchCrawlerUA(null)).toBe(false)
    expect(isSearchCrawlerUA(undefined)).toBe(false)
  })

  it('🔴 첫 화면 조건 = 폰 ∪ 크롤러. PC 브라우저는 종전대로 로더', () => {
    expect(shouldRenderMobileFirstScreen(UA.iphone)).toBe(true)
    expect(shouldRenderMobileFirstScreen(UA.yeti)).toBe(true)
    expect(shouldRenderMobileFirstScreen(UA.pcChrome)).toBe(false)
    expect(shouldRenderMobileFirstScreen(UA.mac)).toBe(false)
  })

  it('🔴 사진 폭 SSOT 를 오염시키지 않았다 — `isMobileUserAgent` 는 그대로', () => {
    // 그 술어는 히어로 preload 폭을 정한다. 크롤러를 거기 섞으면 한 함수가 "몇 px 로 받나" 와
    // "본문을 그려 주나" 두 질문에 동시에 답하게 되고, 한쪽을 고치면 다른 쪽이 조용히 움직인다.
    const hero = readCode('src/shared/detail-hero-image.ts')
    expect(hero, '사진 폭 술어에 크롤러가 섞였다').not.toMatch(/Yeti|Googlebot|bingbot|crawler/i)
    const worker = readCode('src/worker/index.ts')
    expect(worker, '히어로 preload 는 사진 폭 술어를 그대로 써야 한다')
      .toContain('isMobileUserAgent(c.req.header(\'user-agent\'))')
  })
})

describe('② `<noscript>` 본문 — 네이버가 49자로 보던 것', () => {
  const seed = {
    name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트',
    description: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트',
    price: 7500,
    original_price: 14500,
    discount_rate: 0,
    restaurant_name: '홍대돈까스',
    restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10',
    restaurant_phone: '063-251-6785',
  }

  it('가격·주소·전화가 들어간다 — 로컬 검색이 걸릴 수 있는 유일한 텍스트다', () => {
    const html = buildDetailNoscript(seed)
    expect(html).toContain('<noscript>')
    expect(html).toContain('7,500원')
    expect(html).toContain('14,500원')
    expect(html, '할인율은 선언값이 0 이어도 계산값으로 나와야 한다(priceDisplay SSOT)').toContain('48% 할인')
    expect(html).toContain('전북특별자치도 전주시 덕진구 가리내10길 10')
    expect(html).toContain('063-251-6785')
  })

  it('🔴 규율 ② — 첫 화면이 이미 그린 제목·매장명을 반복하지 않는다', () => {
    const html = buildDetailNoscript(seed)
    expect(html, '제목이 반복됐다 — 크롤러에게 같은 문구를 두 번 주는 셈').not.toContain(seed.name)
    // 설명이 제목과 같으면 버린다(시드 실측상 흔하다).
    expect(html.match(/돈가스/g) || [], '같은 낱말이 여러 번 — 반복은 정보가 아니다').toHaveLength(0)
  })

  it('🔴 값이 없으면 줄을 만들지 않는다 — 빈 라벨은 없는 것보다 나쁘다', () => {
    expect(buildDetailNoscript({ name: 'x' })).toBe('')
    expect(buildDetailNoscript(null)).toBe('')
    expect(buildDetailNoscript(undefined)).toBe('')
    const onlyPrice = buildDetailNoscript({ name: 'x', price: 1000 })
    expect(onlyPrice).toContain('1,000원')
    expect(onlyPrice, '주소가 없는데 라벨만 남았다').not.toContain('주소')
    expect(onlyPrice, '전화가 없는데 라벨만 남았다').not.toContain('전화')
  })

  it('🔴 주입 방어 — 매장명·주소의 꺾쇠가 escape 된다', () => {
    const html = buildDetailNoscript({
      name: 'a', price: 100,
      restaurant_address: '<script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('유어샵 — 소개와 진열 목록이 들어간다(핀은 **평평한** 구조)', () => {
    const html = buildCuratorNoscript({
      curator: { name: '정지원', bio: '동네 맛집 모음' },
      pins: [
        { product_name: '치즈돈가스', price: 7500, restaurant_name: '홍대돈까스' },
        { product_name: '아메리카노', price: 2000, restaurant_name: '메가커피' },
      ],
    })
    expect(html).toContain('동네 맛집 모음')
    expect(html).toContain('치즈돈가스')
    expect(html).toContain('홍대돈까스')
    expect(html).toContain('7,500원')
    expect(html, '이름은 첫 화면이 이미 그린다').not.toContain('정지원')
  })

  it('🔴 핀 구조를 중첩으로 바꾸면 조용히 비는 것을 잡는다', () => {
    // 처음 이 모듈을 쓸 때 `pins[].product.name` 으로 가정했다 — 전부 undefined 가 되는데
    // 에러가 안 난다. 그 실수를 테스트가 기억한다.
    const wrong = buildCuratorNoscript({ curator: { bio: '' }, pins: [{ product_name: null, price: 1 } as never] })
    expect(wrong, '이름 없는 핀은 줄을 만들지 않는다').toBe('')
  })
})

describe('③ 브랜드 — 구글이 사이트 이름을 `urdeal.kr` 로 쓰던 것', () => {
  it('홈에 `WebSite.name` 이 브랜드로 실린다 — 이 값이 검색 헤더의 사이트 이름이다', () => {
    const m = resolveConsumerSurfaceSeo('/', '', ORIGIN)
    expect(m, '홈이 표에서 빠졌다').toBeTruthy()
    expect(m!.jsonLd, '홈 JSON-LD 가 비었다 — 사이트 이름이 도메인으로 떨어진다').toBeTruthy()
    const parsed = JSON.parse(m!.jsonLd!.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
    const site = parsed.find((x: { '@type': string }) => x['@type'] === 'WebSite')
    const org = parsed.find((x: { '@type': string }) => x['@type'] === 'Organization')
    expect(site?.name).toBe(BRAND_NAME)
    expect(org?.name).toBe(BRAND_NAME)
    expect(org?.logo?.url).toBe(`${ORIGIN}/icon-512.png`)
    expect(site?.publisher?.['@id']).toBe(org?.['@id'])
  })

  it('🔴 홈 **밖**에는 브랜드를 싣지 않는다 — 중복 엔티티만 늘어난다', () => {
    for (const p of ['/vouchers', '/browse', '/stays']) {
      const m = resolveConsumerSurfaceSeo(p, '', ORIGIN)
      expect(m, `${p} 가 표에서 빠졌다`).toBeTruthy()
      expect(m!.jsonLd, `${p} 에 브랜드가 실렸다`).toBeFalsy()
    }
  })

  it('🔴 없는 SNS 계정을 지어내지 않는다', () => {
    const src = readCode('src/shared/seo/brand-jsonld.ts')
    expect(src, 'sameAs 를 넣으려면 실제 운영 계정이 있어야 한다').not.toMatch(/sameAs:\s*\[/)
  })

  it('🔴 `</script>` 가 JSON-LD 블록을 끊지 못한다', () => {
    const ld = buildBrandJsonLd(ORIGIN, 'a </script><script>alert(1)</script> b')
    expect(ld).not.toContain('</script>')
    expect(ld).not.toContain('<')
  })
})

describe('④ 이용권 상세 — 매장이 검색엔진에 전달된다 (대표 "특히 이용권 페이지들은 더욱")', () => {
  const payload = JSON.stringify({
    data: {
      id: 2915,
      name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트',
      restaurant_name: '홍대돈까스',
      restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10',
      restaurant_phone: '063-251-6785',
      restaurant_lat: 35.8424453951244,
      restaurant_lng: 127.111022905076,
      price: 7500,
      image_url: 'https://cdn.example.com/a.jpg',
      category: 'meal_voucher',
      group_buy_status: 'active',
      avg_rating: 4.6,
      review_count: 12,
    },
  })
  const ld = () => {
    const m = buildDetailMeta(payload, ORIGIN, '/pass/2915')!
    return JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
  }

  it('🔴 매장이 `Product` 안이 아니라 **독립 엔티티**다 — Product.address 는 구글이 버린다', () => {
    const arr = ld()
    const product = arr.find((x: { '@type': string }) => x['@type'] === 'Product')
    expect(product, 'Product 가 사라졌다').toBeTruthy()
    expect(product.address, 'Product 에 address 가 남았다 — 표준 속성이 아니라 무시된다').toBeUndefined()
    expect(product.geo, 'Product 에 geo 가 남았다').toBeUndefined()

    const place = arr.find((x: { '@type': string }) => x['@type'] === 'FoodEstablishment')
    expect(place, '식사 이용권인데 매장 엔티티가 없다 — 로컬 검색 신호가 통째로 비어 있다').toBeTruthy()
    expect(place.name).toBe('홍대돈까스')
    expect(place.address.streetAddress).toContain('가리내10길')
    expect(place.telephone).toBe('063-251-6785')
    expect(place.geo.latitude).toBeCloseTo(35.8424, 3)
  })

  it('🔴 Offer 가 그 매장을 가리킨다 — 둘이 연결돼야 "어디서 쓰는 이용권" 이 된다', () => {
    const arr = ld()
    const product = arr.find((x: { '@type': string }) => x['@type'] === 'Product')
    const place = arr.find((x: { '@type': string }) => x['@type'] === 'FoodEstablishment')
    expect(product.offers.availableAtOrFrom['@id']).toBe(place['@id'])
  })

  it('카테고리마다 업종 타입이 갈린다 — 덜 구체적인 쪽으로 폴백', () => {
    const t = (category: string) => {
      const p = JSON.parse(payload)
      p.data.category = category
      const m = buildDetailMeta(JSON.stringify(p), ORIGIN, '/pass/2915')!
      const arr = JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
      return arr.find((x: { '@id'?: string }) => String(x['@id'] || '').endsWith('#place'))?.['@type']
    }
    expect(t('meal_voucher')).toBe('FoodEstablishment')
    expect(t('beauty_voucher')).toBe('HealthAndBeautyBusiness')
    expect(t('stay_voucher')).toBe('LodgingBusiness')
    expect(t('etc_voucher'), '모르는 업종은 상위 타입 — 틀린 업종보다 낫다').toBe('LocalBusiness')
  })

  it('🔴 리뷰가 0건이면 평점을 선언하지 않는다 — 구글 정책 위반이고 0점짜리로 읽힌다', () => {
    const arr = ld()
    const withReviews = arr.find((x: { '@type': string }) => x['@type'] === 'Product')
    expect(withReviews.aggregateRating.ratingValue).toBe(4.6)
    expect(withReviews.aggregateRating.reviewCount).toBe(12)

    const p = JSON.parse(payload)
    p.data.review_count = 0
    p.data.avg_rating = 0
    const m = buildDetailMeta(JSON.stringify(p), ORIGIN, '/pass/2915')!
    const none = JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
      .find((x: { '@type': string }) => x['@type'] === 'Product')
    expect(none.aggregateRating, '리뷰 0건에 평점을 선언했다').toBeUndefined()
  })

  it('🔴 매장 정보가 없으면 빈 엔티티를 만들지 않는다', () => {
    const p = JSON.parse(payload)
    delete p.data.restaurant_address
    delete p.data.restaurant_lat
    delete p.data.restaurant_lng
    const m = buildDetailMeta(JSON.stringify(p), ORIGIN, '/pass/2915')!
    const arr = JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
    expect(arr.some((x: { '@id'?: string }) => String(x['@id'] || '').endsWith('#place'))).toBe(false)
    // 그래도 Product·BreadcrumbList 는 남아야 한다 — 매장이 없다고 상품까지 사라지면 안 된다.
    expect(arr.some((x: { '@type': string }) => x['@type'] === 'Product')).toBe(true)
    expect(arr.some((x: { '@type': string }) => x['@type'] === 'BreadcrumbList')).toBe(true)
  })
})
