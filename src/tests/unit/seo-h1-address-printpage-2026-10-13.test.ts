/**
 * 🔎 크롤러 문서의 **제목 요소·매장 주소·인쇄판 색인** (2026-10-13)
 *
 * 셋 다 "에러가 안 나서 재 본 사람만 아는" 클래스다. 라이브에서 Googlebot UA 로 받아 파싱해
 * 찾았고, 여기서는 **판정 함수와 배선**을 직접 잰다.
 *
 * ## ① 홈에 `<h1>` 이 0개였다
 * 색인 대상 7표면 중 홈만 제목 요소가 `<h3>`(섹션 라벨) 하나였다. PC 에는 h1 이 있지만
 * 2026-10-11 부터 **검색 크롤러는 모바일 첫 화면을 받으므로** 그 h1 은 크롤러에 영영 안 간다.
 *
 * ## ② 매장 `addressLocality` 가 전 건 0개였다
 * 로컬 질의가 본류인 서비스인데 구글이 권하는 필드가 비어 있었다.
 *
 * ## ③ `/about/print` 만 제네릭 홈 제목을 받았다
 * 색인 가능 16표면 중 유일하게 SEO 표에 없어 fallback 을 받고 있었고, `/about` 의 인쇄판이라
 * 내용까지 겹쳤다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글이 실제로 그 h1·주소를 쓰는지(외부 판정, 수일~수주) ·
 *   브라우저 렌더(jsdom 에 레이아웃이 없다 — `sr-only` 가 정말 0px 인지는 CSS 가 정한다) ·
 *   HTMLRewriter 런타임 배선.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOME_H1, CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { buildDetailMeta, buildStayDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { readCode } from '../helpers/source-text'

const jsonLdNodes = (meta: { jsonLd?: string } | null): Record<string, unknown>[] => {
  if (!meta?.jsonLd) return []
  const out: Record<string, unknown>[] = []
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>
      if (o['@type']) out.push(o)
      Object.values(o).forEach(walk)
    }
  }
  walk(JSON.parse(meta.jsonLd))
  return out
}
const placeOf = (meta: { jsonLd?: string } | null) =>
  jsonLdNodes(meta).find(n =>
    ['FoodEstablishment', 'LodgingBusiness', 'LocalBusiness', 'HealthAndBeautyBusiness'].includes(String(n['@type'])))

/* 라이브 시드에서 그대로 떠 온 모양이다(손으로 지어 쓰면 빌더가 null 을 돌려주고 아무것도
   판정하지 못한다 — 2026-10-12 에 숙소 픽스처로 그 값을 치렀다). */
const passSeed = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  data: {
    id: 2919, name: '달빛한스푼 닭도리탕', price: 31000, original_price: 35000,
    image_url: 'https://media.ur-team.com/x.jpg', category: 'meal_voucher',
    restaurant_name: '달빛한스푼', restaurant_address: '서울 서초구 방배중앙로 165',
    restaurant_lat: 37.4937775227776, restaurant_lng: 126.986122793171, restaurant_phone: '02-535-8848',
    ...over,
  },
})
const PASS_SEED = passSeed()
const STAY_SEED = JSON.stringify({
  success: true,
  data: {
    product: {
      id: 2887, name: '평일 1박 숙박권 (프리미엄 리버뷰 스위트)', restaurant_name: '그랑블루글램핑&펜션',
      address: '강원특별자치도 양양군 강현면 동해대로 3275', region_sido: '강원', region_sigungu: '속초시',
      latitude: 38.13169222683341, longitude: 128.619270100705, image_url: 'https://media.ur-team.com/y.jpg',
    },
    rooms: [{ id: 1, name: '스탠다드', base_price_weekday: 149000 }],
  },
})

describe('① 크롤러가 받는 홈 문서에 제목 요소가 있다', () => {
  const worker = readCode('src/worker/utils/home-first-screen.ts')
  const page = readCode('src/pages/mobile-home/MobileHomePage.tsx')

  it('워커 첫 화면이 sr-only h1 을 그린다', () => {
    expect(worker).toMatch(/<h1 class="sr-only">\$\{escText\(HOME_H1\)\}<\/h1>/)
  })

  it('React 모바일 홈도 **같은 자리에 같은 값**을 그린다 (마운트 때 제목이 바뀌지 않게)', () => {
    expect(page).toMatch(/<h1 className="sr-only">\{HOME_H1\}<\/h1>/)
  })

  it('🔴 둘 다 SSOT 를 import 한다 — 문자열을 손으로 적으면 두 벌이 갈린다', () => {
    expect(worker).toMatch(/import \{[^}]*HOME_H1[^}]*\} from '\.\.\/\.\.\/shared\/seo\/consumer-surfaces'/)
    expect(page).toMatch(/import \{[^}]*HOME_H1[^}]*\} from '@\/shared\/seo\/consumer-surfaces'/)
  })

  it('🔴 h1 은 **보이지 않아야** 한다 — 2026-08-31 대표 결정(보이는 머리글 제거)이 그대로다', () => {
    // `sr-only` 가 아닌 h1 을 홈에 세우면 그 결정을 되돌리는 것이고, 첫 화면 박스도 밀린다.
    for (const src of [worker, page]) {
      const h1s = src.match(/<h1[^>]*>/g) || []
      expect(h1s.length).toBeGreaterThan(0)
      for (const tag of h1s) expect(tag).toMatch(/sr-only/)
    }
  })

  it('h1 값이 비어 있지 않다', () => {
    expect(HOME_H1.trim().length).toBeGreaterThan(5)
  })
})

describe('② 매장 주소가 시/도·시군구로 분해된다', () => {
  it('식사권 — addressLocality·addressRegion 이 채워진다 (종전엔 둘 다 없었다)', () => {
    const place = placeOf(buildDetailMeta(PASS_SEED, 'https://urdeal.kr', '/pass/2919'))
    expect(place?.['@type']).toBe('FoodEstablishment')
    expect(place?.address).toMatchObject({
      '@type': 'PostalAddress',
      addressRegion: '서울',
      addressLocality: '서초구',
      addressCountry: 'KR',
    })
  })

  it('🔴 streetAddress 는 전체 주소를 그대로 둔다 — 앞머리를 떼면 틀린 주소가 된다', () => {
    const place = placeOf(buildDetailMeta(PASS_SEED, 'https://urdeal.kr', '/pass/2919'))
    expect((place?.address as Record<string, unknown>).streetAddress).toBe('서울 서초구 방배중앙로 165')
  })

  it('숙소 — addressLocality 가 **주소**에서 온다 (시드의 region_sigungu 와 어긋날 때 주소가 권위다)', () => {
    // 라이브 실측: 이 행은 address 가 '양양군' 인데 region_sigungu 는 '속초시' 다.
    // PostalAddress 안에서 streetAddress 와 addressLocality 가 서로 다른 곳을 가리키면 안 된다.
    const place = placeOf(buildStayDetailMeta(STAY_SEED, 'https://urdeal.kr', '/stays/2887'))
    expect(place?.['@type']).toBe('LodgingBusiness')
    expect(place?.address).toMatchObject({ addressRegion: '강원', addressLocality: '양양군' })
  })

  it('🔴 파싱이 안 되면 지어내지 않는다 — 없는 필드는 안 낸다', () => {
    const seed = passSeed({ restaurant_address: 'Somewhere 12-3' })
    const addr = placeOf(buildDetailMeta(seed, 'https://urdeal.kr', '/pass/2919'))?.address as Record<string, unknown>
    expect(addr.streetAddress).toBe('Somewhere 12-3')
    expect(addr.addressLocality).toBeUndefined()
    expect(addr.addressRegion).toBeUndefined()
  })

  it('주소가 비면 address 노드 자체를 안 낸다', () => {
    const seed = passSeed({ restaurant_address: '   ' })
    expect(placeOf(buildDetailMeta(seed, 'https://urdeal.kr', '/pass/2919'))?.address).toBeUndefined()
  })
})

describe('③ /about/print 는 고유 메타 + noindex', () => {
  const e = CONSUMER_SURFACE_SEO['/about/print']

  it('표에 등재돼 제네릭 fallback 을 안 받는다', () => {
    expect(e).toBeDefined()
    expect(e.title.trim().length).toBeGreaterThan(5)
    expect(e.description.trim().length).toBeGreaterThan(10)
  })

  it('🔴 noindex — /about 의 인쇄판이라 같은 내용의 두 URL 을 경쟁시키지 않는다', () => {
    expect(e.noindex).toBe(true)
  })

  it('🔴 noindex 표면은 crumb 를 비워 둔다 (기존 규약)', () => {
    expect(e.crumb).toBeUndefined()
  })

  it('반대 방향 — /about 본체는 색인 대상으로 남는다', () => {
    expect(CONSUMER_SURFACE_SEO['/about']?.noindex).toBeFalsy()
  })
})
