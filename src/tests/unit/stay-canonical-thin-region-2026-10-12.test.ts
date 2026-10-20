/**
 * 🏨🪧 2026-10-12 — 숙소 정본 단일화(#18) + thin 지역 noindex(#21)
 *
 * 대표 *"둘 다 잠금 해제하고 가장 이상적으로 개선"*.
 *
 * ## #18 — 같은 상품이 두 URL 로 색인 경쟁하고 있었다 (Googlebot UA 실측)
 *
 *       /pass/2887   200 · canonical 자기자신 · index,follow · 본문 188자 · Product+Offer+LodgingBusiness
 *       /stays/2887  200 · canonical 자기자신 · index,follow · 본문   6자 · LodgingBusiness 만(Offer 0)
 *       sitemap      /pass/ 359건 · /stays/ 0건   ↔   /stays ItemList·/region 항목은 /stays/ 를 가리킨다
 *
 * 같은 `products.id` 다(`StayDetailPage` 가 param 을 `productId` 로 받고, `/api/group-buy/stays/:id` 가
 * 그 행 + 객실을 돌려준다). SSOT(`canonicalDetailPath`)는 `stay_voucher` → `/stays/:id` 라 정본은 이쪽인데
 * **그때 이 페이지엔 "살 수 있는 것" 신호가 0 이었다.**
 *
 * 🩸 **그래서 애초 제안("`/pass` → canonical `/stays`")은 반만 맞았다** — 그대로 하면 리치 페이지에서
 *   빈 페이지로 canonical 을 옮기는 셈이다. 정본으로 지목하기 **전에** `Product`/`AggregateOffer` 와
 *   크롤러 본문을 먼저 준다. 이 순서가 이 변경의 요점이다.
 *
 * ## #21 — thin 지역이 색인 가능했다
 * `resolveRegionSeo` 는 DB 를 안 본다(그 함수 주석이 스스로 적어 둔 한계) → 게이트가 클라 렌더에만 있었고
 * `/region/인천`·`세종`·`울산`·`서울/없는구` 가 **200 + index,follow + 본문 26자**였다. `SIGUNGU_RE` 가
 * *한글+시|군|구* 면 통과시키니 **지어낸 구 이름도 색인 가능**(사실상 무한 thin URL).
 * 🔑 cron 요약이 이미 KV 에 있고 워커가 지역 경로에서 그걸 **이미 읽으므로** DB 조회 0 으로 닫는다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: 구글이 canonical 통합·색인 제외를 실제로 적용하는지(수일~수주 ·
 *    서치콘솔은 대표만 본다) · HTMLRewriter 런타임 배선 · KV 가 그 키를 들고 있는지(cron 1회 필요).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildDetailMeta, buildStayDetailMeta } from '../../worker/utils/detail-ssr-meta'
import { stayNoscriptFromPayload } from '../../worker/utils/crawler-noscript'
import { regionThinByDigest } from '../../shared/seo/region-digest'
import { buildSurfaceListJsonLd } from '../../worker/utils/surface-list-jsonld'
import { canonicalDetailPath } from '../../shared/product-flow'
import { REGION_INDEX_MIN_DEALS } from '../../shared/constants/region-slugs'
import { stripComments } from '../helpers/source-text'

const O = 'https://urdeal.kr'
const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))

/** 라이브 `/api/group-buy/stays/2887` 실측 모양(필드만 추림). */
const staySeed = (rooms: Array<{ name: string; base_price_weekday: number }>) => JSON.stringify({
  data: {
    product: {
      id: 2887, name: '평일 1박 숙박권 (프리미엄 리버뷰 스위트)', restaurant_name: '그랑블루글램핑&펜션',
      region_sido: '강원', region_sigungu: '속초시', property_type: 'glamping',
      address: '강원특별자치도 양양군 강현면 동해대로 3275', image_url: 'https://media.ur-team.com/a.jpg',
      avg_rating: 4.6, review_count: 12, star_rating: 4, description: '리버뷰 글램핑',
    },
    rooms,
  },
})
const ROOMS = [
  { name: '스탠다드 텐트', base_price_weekday: 149000 },
  { name: '프리미엄 리버뷰 스위트', base_price_weekday: 209000 },
]
const passSeed = (category: string, deal_only = 0) => JSON.stringify({
  data: { id: 2887, name: '평일 1박 숙박권', restaurant_name: '그랑블루글램핑&펜션', price: 209000, original_price: 272000, category, deal_only, group_buy_status: 'active' },
})

function graph(json: string): Array<Record<string, unknown>> {
  const g = JSON.parse(json) as { '@graph'?: Array<Record<string, unknown>> }
  return g['@graph'] ?? []
}
function node(json: string, type: string): Record<string, unknown> | undefined {
  return graph(json).find(n => n['@type'] === type)
}
/** 정의된 `@id` 와 참조된 `@id` 를 모아 **매달린 참조**를 찾는다(사이트 전역 노드 제외). */
function dangling(json: string): string[] {
  const ids = new Set<string>(); const refs = new Set<string>()
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const o = n as Record<string, unknown>
    const id = o['@id']
    if (typeof id === 'string') (o['@type'] ? ids : refs).add(id)
    Object.values(o).forEach(walk)
  }
  walk(JSON.parse(json))
  return [...refs].filter(r => !ids.has(r) && !/#(organization|website)$/.test(r))
}

describe('🏨 #18 숙소 정본 단일화', () => {
  it('① `/stays/:id` 가 Product + AggregateOffer 를 낸다 (종전 0)', () => {
    const m = buildStayDetailMeta(staySeed(ROOMS), O, '/stays/2887')!
    expect(m).not.toBeNull()
    expect(graph(m.jsonLd).map(n => n['@type'])).toEqual(['Product', 'LodgingBusiness', 'BreadcrumbList'])
    const offers = (node(m.jsonLd, 'Product')!.offers) as Record<string, unknown>
    // 🛒 하나의 정가를 지어내지 않는다 — 이 페이로드엔 `price` 가 없고 객실 가격만 있다.
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers.lowPrice).toBe(149000)
    expect(offers.highPrice).toBe(209000)
    expect(offers.offerCount).toBe(2)
    expect(offers.priceCurrency).toBe('KRW')
    // 매장은 독립 엔티티이고 Offer 가 `@id` 로 가리킨다(`/pass/:id` 와 같은 모양).
    expect(offers.availableAtOrFrom).toEqual({ '@id': `${O}/stays/2887#place` })
    expect(node(m.jsonLd, 'LodgingBusiness')!['@id']).toBe(`${O}/stays/2887#place`)
    // `@context` 는 바깥에 한 번만(종전엔 노드마다 얹은 배열이었다) · 매달린 참조 0.
    expect((m.jsonLd.match(/@context/g) || []).length).toBe(1)
    expect(dangling(m.jsonLd)).toEqual([])
  })

  it('② 객실 가격이 없으면 Offer 를 **안 만든다** (지어내기 금지 · ①이 데이터 탓이 아니라는 증거)', () => {
    const m = buildStayDetailMeta(staySeed([{ name: '룸', base_price_weekday: 0 }]), O, '/stays/2887')!
    expect(node(m.jsonLd, 'Product')).toBeUndefined()
    // 매장·빵부스러기는 그대로 — 가격이 없다고 페이지 정보가 통째로 사라지면 안 된다.
    expect(node(m.jsonLd, 'LodgingBusiness')).toBeDefined()
    expect(node(m.jsonLd, 'BreadcrumbList')).toBeDefined()
  })

  it('③ `/pass/:id`(숙소)의 canonical = SSOT 가 말하는 정본 (문자열을 손으로 적지 않는다)', () => {
    const m = buildDetailMeta(passSeed('stay_voucher'), O, '/pass/2887')!
    const ssot = canonicalDetailPath({ id: 2887, deal_only: 0, category: 'stay_voucher' })
    expect(ssot).toBe('/stays/2887')
    expect(m.canonical).toBe(`${O}${ssot}`)
    // 🔴 cross-canonical 에 noindex 를 같이 붙이지 않는다 — 서로 반대 신호다.
    expect(m.noindex).toBe(false)
  })

  it('④ 숙소가 아닌 상세는 종전 그대로 (회귀 0)', () => {
    expect(buildDetailMeta(passSeed('meal_voucher'), O, '/pass/2919')!.canonical).toBe(`${O}/pass/2887`)
    const v = buildDetailMeta(JSON.stringify({ data: { id: 5, name: 'x', deal_only: 1, category: 'etc_voucher' } }), O, '/vouchers/5')!
    expect(v.canonical).toBe(`${O}/vouchers/5`)
    expect(v.noindex).toBe(true) // 교환권은 2026-07-07 결정대로 noindex 유지
  })

  it('⑤ sitemap 의 `loc` 이 같은 SSOT 를 지난다 (하드코딩 금지)', () => {
    const src = read('src/worker/routes/sitemap.routes.ts')
    expect(src).toContain('canonicalDetailPath({')
    // 🩸 종전엔 전 카테고리를 `/pass/${g.id}` 로 박아 숙소만 sitemap↔ItemList 가 갈렸다.
    expect(src).not.toMatch(/loc:\s*`\/pass\/\$\{/)
  })

  it('⑥ 정본에 크롤러 본문이 있다 (종전 6자 = 로더뿐)', () => {
    const ns = stayNoscriptFromPayload(staySeed(ROOMS))
    const text = ns.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(text.length).toBeGreaterThan(100)
    // 🔁 2026-10-18: 이 픽스처(라이브 2887)는 컬럼이 `속초시` 인데 주소는 양양군이다 — 그 틀린 지역을
    //   고정하던 단언이었다. 크롤러 본문은 이제 주소를 읽는다(`stayRegionShort`).
    expect(text).toContain('양양군')
    expect(text).not.toContain('속초시')
    expect(text).toContain('149,000')
    expect(text).toContain('강원특별자치도 양양군')
    expect(text).toContain('스탠다드 텐트')
    // HTML 탈출 — 가게 이름에 `&` 가 들어 있다(실측: 그랑블루글램핑&펜션).
    expect(ns).toContain('&amp;')
    expect(ns).not.toContain('글램핑&펜션')
    // `<noscript>` 여야 사람 화면이 byte-동일하고 밀림이 0 이다.
    expect(ns.startsWith('<noscript>')).toBe(true)
    // 시드가 없으면 조용히 빈 문자열(fail-soft — 로더만 남는다).
    expect(stayNoscriptFromPayload(null)).toBe('')
    expect(stayNoscriptFromPayload('{bad json')).toBe('')
  })

  it('⑦ 워커는 본문을 로더 **앞에** 덧붙인다 (대체가 아니다)', () => {
    // 🔀 2026-10-12 후속 재조준: 같은 날 서버 첫 화면(`buildStayDetailFirstScreen`)이 생기면서
    //   배선이 [첫 화면 || (`<noscript>` + 로더)] 가 됐다. **지키려던 불변식은 그대로다** —
    //   ⓐ 로더를 대체하지 않는다(앞에 덧붙인다) ⓑ 첫 화면이 `''` 인 경우에도 본문이 남는다.
    //   ⚠️ 폴백 쪽은 `skipTitle` 을 **쓰지 않는다**(쓰면 숙소명까지 빠져 본문이 다시 빈다) —
    //      그 방향은 `stay-detail-ssr-first-screen-2026-10-12.test.ts` 가 함께 잠근다.
    const src = read('src/worker/index.ts')
    expect(src).toMatch(/stayNoscriptFromPayload\(ssrPayload\)/)
    expect(src, '로더를 대체하면 안 된다 — 앞에 덧붙인다')
      .toMatch(/setInnerContent\(stayFirst \|\| \(stayNoscriptFromPayload\(ssrPayload\) \+ urdealLoaderHtml\)/)
  })
})

describe('🪧 #21 thin 지역 noindex', () => {
  const row = (addr: string, extra: Record<string, unknown> = {}) => ({ id: Math.random(), restaurant_address: addr, deal_only: 0, ...extra })
  const digest = (rows: unknown[]) => JSON.stringify({ success: true, data: rows })
  const seoul = (n: number) => Array.from({ length: n }, (_, i) => row(`서울특별시 종로구 ${i + 1}길`))

  it('① 요약 기준 항목이 임계값 미만이면 noindex', () => {
    expect(REGION_INDEX_MIN_DEALS).toBe(3)
    expect(regionThinByDigest('/region/서울/종로구', digest(seoul(2)))).toBe(true)
    expect(regionThinByDigest('/region/서울/종로구', digest(seoul(3)))).toBe(false)
    // 시/도 단위는 그 안의 시군구를 합산한다.
    expect(regionThinByDigest('/region/서울', digest(seoul(3)))).toBe(false)
    // 요약에 그 지역이 아예 없으면 0 건 → thin(실측 `/region/인천`·`세종`·`울산`이 이 경우).
    expect(regionThinByDigest('/region/인천', digest(seoul(5)))).toBe(true)
  })

  it('🔴 ② 요약이 **없으면** 절대 noindex 하지 않는다 (부재 ≠ thin)', () => {
    // 이 방향이 뒤집히면 배포 직후 지역 44개가 통째로 색인에서 빠지고, 색인은 돌아오는 데 수주 걸린다.
    for (const bad of [null, undefined, '', '{bad json', '{"success":true,"data":[]}', '{"success":true}']) {
      expect(regionThinByDigest('/region/인천', bad as string | null), String(bad)).toBe(false)
    }
  })

  it('③ 허브·비지역 경로는 대상이 아니다', () => {
    expect(regionThinByDigest('/region', digest(seoul(1)))).toBe(false)
    expect(regionThinByDigest('/vouchers', digest(seoul(1)))).toBe(false)
    expect(regionThinByDigest('/', digest(seoul(1)))).toBe(false)
    // 모르는 시/도는 리졸버가 이미 noindex 를 준다 — 여기서 중복 판정하지 않는다.
    expect(regionThinByDigest('/region/없는도', digest(seoul(1)))).toBe(false)
  })

  it('④ 교환권(`deal_only=1`)은 세지 않는다 — 매장이 없다', () => {
    const rows = [...seoul(1), ...Array.from({ length: 5 }, () => row('서울특별시 종로구 9길', { deal_only: 1 }))]
    expect(regionThinByDigest('/region/서울/종로구', digest(rows))).toBe(true)
  })

  it('⑤ 임계값 상수가 하나다 (두 번째를 만들면 sitemap 과 갈린다)', () => {
    const src = read('src/shared/seo/region-digest.ts')
    expect(src).toContain('REGION_INDEX_MIN_DEALS')
    expect(src).not.toMatch(/<\s*3\b|>=\s*3\b/) // 숫자를 손으로 적지 않는다
  })

  it('⑥ 워커가 **요약 원본**을 넘긴다 (crawlerPayload 를 넘기면 MAIN 시드로 오판한다)', () => {
    const src = read('src/worker/index.ts')
    expect(src).toMatch(/const digestRaw = digestP \? await digestP : null;/)
    expect(src).toMatch(/regionThinByDigest\(url\.pathname, digestRaw\)/)
    // 🩸 둘은 봉투 모양이 같아 받는 쪽이 못 가른다 — 시드를 넘기면 멀쩡한 지역이 thin 이 된다.
    expect(src).not.toMatch(/regionThinByDigest\([^)]*crawlerPayload/)
  })

  it('⑦ noindex 가 켜지면 리치결과도 안 낸다 (색인 말라면서 리치결과를 달라고 하지 않는다)', () => {
    const meta = { title: 't', description: 'd', canonical: `${O}/region/인천`, noindex: true }
    expect(buildSurfaceListJsonLd('/region/인천', '', O, meta, null)).toBe('')
    // 그리고 워커가 **갱신된 메타**를 빌더에 넘겨야 이 성질이 선다(옛 메타를 넘기면 그대로 나온다).
    const src = read('src/worker/index.ts')
    expect(src).toMatch(/jsonLd: buildSurfaceListJsonLd\(url\.pathname, url\.search, origin2, sm, crawlerPayload\)/)
    expect(src).toMatch(/\{ \.\.\.sm0, noindex: true \}/)
  })
})
