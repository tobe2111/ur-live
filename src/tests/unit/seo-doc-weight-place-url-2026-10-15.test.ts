/**
 * 🔎 2026-10-15 — 대표 *"Seo, geo 개선해줘"* 로 라이브를 다시 쓸어 나온 **두 건**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ① **서빙 `index.html` 의 HTML 주석 = gzip 8,073B** (`scripts/strip-html-comments.mjs`)
 *
 *    실측: 주석 31개 **19,557B / 65,471B(30%)**, gzip 으로 **8,073B**. 문서는 임계 경로의 맨 앞이라
 *    모든 하드로드가 그만큼을 먼저 받는데, `check-bundle-size` 는 dist index.html 의 `script`·
 *    `modulepreload` 만 세므로 **그 예산 밖**이었다. 그중 **12개 9,913B** 는 내부 파일·심볼 이름을 담은
 *    개발 메모이고, 사람 화면엔 안 보이지만 **언어모델은 토큰으로 읽는다**(GEO).
 *
 * ② **매장 엔티티 `url` 비대칭** (`detail-ssr-meta.ts`)
 *
 *        빌더                       url      priceRange  description   (Googlebot UA, 표본 44)
 *        LodgingBusiness  (숙소)   14/14      14/14        14/14
 *        FoodEstablishment(이용권)  **0/30**   0/30         0/30
 *
 *    빌더 단위로 정확히 쪼개진다 — 데이터가 없어서가 아니라 그 자리에 안 적혀 있어서다.
 *    `url` 은 구글 LocalBusiness 권장 필드이고 `canonical` 이 이미 계산돼 있어 **새 조회 0**.
 *    🔑 페이지 간 모순이 안 생기는지 먼저 쟀다: 활성 딜 **359건의 고유 매장 358**(1매장=1딜).
 *
 * ⚠️ **이 가드가 못 보는 것**
 *    - ①이 실제로 **빠른지**(바이트는 쟀지만 TTFB·LCP 는 브라우저가 판정한다) · Vite 가
 *      `transformIndexHtml` 을 부르는 런타임 배선(빌드를 돌려야 보인다 — 머지 전 실측으로 확인).
 *    - ②를 구글이 실제로 쓰는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).
 *
 * 🧾 **같은 측정에서 결함 아님으로 판정**(다시 파지 말 것)
 *    - `/products/:id` 의 `Product.brand` 부재 — `brand_name` 이 응답에 **없고**(빌더가 늘
 *      `undefined` 를 읽는다) 쓸 수 있는 값은 `restaurant_name` 인데 실측값이 **`구서 우성아파트`**
 *      (브랜드가 아닌 장소명)다. 게다가 sitemap 의 `/products` 는 **0건**이라 색인 대상도 아니다.
 *    - 제목·설명 중복 — 표본 50(`/pass` 34 · `/stays` 16)에서 **고유 50/50**, 길이 18~41 / 76~109자.
 *    - 산문 ⭐평점 ↔ `Product.aggregateRating` — 표본 60에서 **불일치 0**.
 *    - UA 별 본문·구조화 데이터 차이 — Googlebot·Yeti·OAI·Perplexity·iPhone **전부 동일**
 *      (139/228/451/350/451자). 🩸 처음에 "Googlebot 이 139, AI 봇이 290" 으로 읽었는데 그건
 *      **제 주석 제거기가 `<[^>]+>` 로 주석 안의 `>` 에서 끊겨** 나머지를 본문으로 센 것이었다.
 *    - 유어샵(`/s/*`·`/u/user40`)이 자기 상품을 링크하지 않는다 — **틀렸다.** 원문에
 *      `<a href="/pass/2919">`·`<a href="/products/2917">` 가 있고, `a태그 1개`는 봇 셸에 로고
 *      `<a>` 가 없어서 **그 상품 링크 하나**였다. 본문 64자는 그 가게 상품이 1개라서다.
 *    - `openingHours`·`servesCuisine` — 데이터가 **아예 없다**(`/api/group-buy/products/:id`
 *      응답에 시간 관련 키 0개). 지어낼 자리가 아니다.
 *    - `Organization`(logo·address·email·parentOrganization) · `WebSite` · `ItemList.numberOfItems`
 *      · image sitemap(359) · sitemap 분할(455 ≪ 50,000) — 전부 완비.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { readCode } from '../helpers/source-text'
import { buildDetailMeta, buildStayDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { stripHtmlComments, inlineBlocks, COUNTED_TAGS } from '../../../scripts/strip-html-comments.mjs'

const ORIGIN = 'https://urdeal.kr'

/** 🩸 모양을 손으로 지어 쓰지 않는다 — 라이브 `/api/group-buy/products/:id` 의 키 그대로. */
function passSeed(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    success: true,
    data: {
      id: 2919, name: '닭도리탕', price: 31000, original_price: 35000, category: 'meal_voucher',
      restaurant_name: '달빛한스푼', restaurant_address: '서울 서초구 방배중앙로 165',
      restaurant_lat: 37.4937775227776, restaurant_lng: 126.986122793171,
      restaurant_phone: '02-535-8848', group_buy_status: 'active',
      kakao_place_url: 'https://place.map.kakao.com/10256701', ...extra,
    },
  })
}
/** 라이브 `/api/group-buy/stays/:id` 는 `{ data: { product, rooms } }` 다. */
function staySeed(): string {
  return JSON.stringify({
    success: true,
    data: {
      product: {
        id: 2887, restaurant_name: '그랑블루글램핑&펜션', address: '강원특별자치도 양양군 강현면 동해대로 3275',
        region_sido: '강원', property_type: 'glamping', kakao_place_url: 'https://place.map.kakao.com/1688516364',
      },
      rooms: [{ base_price_weekday: 149000 }, { base_price_weekday: 209000 }],
    },
  })
}

type Node = Record<string, unknown>
function nodes(jsonLd: string): Node[] {
  const parsed = JSON.parse(jsonLd.replace(/<\\\/script/g, '</script')) as unknown
  const flat: Node[] = []
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(walk); return }
    if (o && typeof o === 'object') {
      flat.push(o as Node)
      Object.values(o as Node).forEach(walk)
    }
  }
  walk(parsed)
  return flat
}
const LOCAL = new Set(['FoodEstablishment', 'LodgingBusiness', 'HealthAndBeautyBusiness', 'LocalBusiness'])
/** 🩸 `@id` 가 `#place` 로 끝나는 것으로 찾으면 `availableAtOrFrom` **참조**가 잡힌다(실제로 당했다). */
const placeNode = (ns: Node[]): Node | undefined =>
  ns.find((n) => {
    const t = n['@type']
    const ts = Array.isArray(t) ? t : [t]
    return ts.some((x) => LOCAL.has(String(x)))
  })

describe('① 서빙 index.html 주석 제거 — 무손실이거나 빌드를 멈춘다', () => {
  const html = readFileSync('index.html', 'utf8')

  it('실제 index.html 에서 주석을 떼도 인라인 스크립트/스타일이 한 글자도 안 바뀐다', () => {
    const out = stripHtmlComments(html)
    expect(inlineBlocks(out)).toEqual(inlineBlocks(html))
    expect(out.length).toBeLessThan(html.length) // 떼어낼 것이 실제로 있다
  })

  it('잠금표가 지키는 항목이 전부 살아남는다 (preload·Speculation Rules·preconnect·nonce)', () => {
    const out = stripHtmlComments(html)
    for (const t of COUNTED_TAGS) expect(out.split(t).length).toBe(html.split(t).length)
    expect(out).toContain('speculationrules')
    expect(out).toContain('csp-nonce')
    expect(out.match(/rel="preconnect"/g)?.length).toBe(html.match(/rel="preconnect"/g)?.length)
  })

  /**
   * 🩸 **위험한 방향은 하나뿐이고, 처음에 반대쪽을 심었다.**
   *   홀로 있는 `-->` 는 **매치를 시작하지 않으므로** 아무 일도 안 일어난다(그 주입은 통과했고,
   *   그래서 이 시험이 한 번 빨간불을 냈다 — 가드가 아니라 **내 탐침**이 틀렸던 것이다).
   *   진짜 사고는 **스크립트 안의 `<!--`** 가 뒤에 오는 **다른** 주석의 `-->` 까지 삼켜
   *   그 사이 마크업을 통째로 먹는 경우다. 그걸 심는다.
   */
  it('🔴 반대 방향 — 스크립트 안 `<!--` 가 뒤 마크업을 먹으면 **던진다**', () => {
    const doc = '<html><head><script>var a="<!--"</script>'
      + '<meta charset="utf-8"><!-- 평범한 주석 --><title>t</title></head></html>'
    expect(() => stripHtmlComments(doc)).toThrow(/무손실이 아니다/)
  })

  /**
   * 🩸 **주입이 내 탐침의 두 번째 결함을 잡았다.** 위 탐침은 태그 수까지 바꾸므로, 무손실 검증을
   *   *"블록 **수**만 비교"* 로 약화시켜도 태그 검사에 걸려 여전히 던진다 — 즉 그 약화를 **판정하지
   *   못한다**. 내용만 먹히는 경우를 따로 심어야 `every(...)` 비교가 출력으로 검증된다.
   */
  it('🔴 반대 방향 — 블록 수·태그 수가 같고 **내용만** 먹혀도 던진다', () => {
    // 한 스크립트 **안에서** `<!--` ... `-->` 가 닫히므로 블록은 1개 그대로이고 내용만 짧아진다.
    const doc = '<html><head><script>var a="<!--" + "-->" + "z"</script><title>t</title></head></html>'
    expect(inlineBlocks(doc)).toHaveLength(1)
    expect(() => stripHtmlComments(doc)).toThrow(/무손실이 아니다/)
  })

  it('홀로 있는 `-->` 는 안 던진다 — 매치가 시작되지 않으므로 무변화가 맞다', () => {
    const doc = '<html><head><script>var s="a-->b"</script><title>t</title></head></html>'
    expect(stripHtmlComments(doc)).toBe(doc)
  })

  it('닫히지 않은 주석도 무변화 — 정규식이 매치하지 않는다(뒤를 먹지 않는다)', () => {
    const doc = '<html><head><!-- 열고 안 닫음 <meta charset="utf-8"><title>x</title></head></html>'
    expect(stripHtmlComments(doc)).toBe(doc)
  })

  it('vite.config 에 배선돼 있고 `order: post` 다 (다른 플러그인이 태그를 다 넣은 뒤)', () => {
    const cfg = readCode('vite.config.ts')
    expect(cfg).toContain("import { stripHtmlCommentsPlugin } from './scripts/strip-html-comments.mjs'")
    expect(cfg).toContain('stripHtmlCommentsPlugin(),')
    expect(readCode('scripts/strip-html-comments.mjs')).toContain("order: 'post'")
  })

  it('소스 index.html 은 주석을 그대로 갖고 있다 (이 레포의 자산 — 빌드에서만 뗀다)', () => {
    expect(html.match(/<!--[\s\S]*?-->/g)?.length ?? 0).toBeGreaterThan(20)
  })
})

describe('② 매장 엔티티 url — 빌더 둘이 같은 자리를 채운다', () => {
  it('이용권(FoodEstablishment)의 매장 노드가 url 을 내고, 그 값이 canonical 과 같다', () => {
    const m = buildDetailMeta(passSeed(), ORIGIN, '/pass/2919')
    expect(m).not.toBeNull()
    const pl = placeNode(nodes(m!.jsonLd))
    expect(pl?.['@type']).toBe('FoodEstablishment')
    expect(pl?.url).toBe(m!.canonical)
  })

  /**
   * 🩸 **주입이 세 번째 결함을 잡았다.** 위 시험은 `/pass/2919` 로 부르는데 그 경로에서는
   *   `canonical` 과 `${origin}${pathname}` 이 **같은 값**이다 ⇒ `url` 을 요청 경로로 바꿔도
   *   출력이 1바이트도 안 변해 **그 결함을 판정하지 못한다**. 이 레포가 빵부스러기 작업에서
   *   이미 치른 자리다(*"그 게이트 때문에 canonical 은 언제나 pathname 과 같다"*).
   *   ⇒ 둘이 **갈리는** 경로로 부른다: `/group-buy/:id` 는 이용권의 **사본**이고 정본은 `/pass/:id` 다.
   */
  it('사본 경로로 들어와도 매장 url 은 **정본**을 가리킨다 (요청 경로가 아니다)', () => {
    const m = buildDetailMeta(passSeed(), ORIGIN, '/group-buy/2919')
    expect(m!.canonical).toBe(`${ORIGIN}/pass/2919`)
    expect(m!.canonical).not.toBe(`${ORIGIN}/group-buy/2919`) // 두 값이 실제로 갈린다
    expect(placeNode(nodes(m!.jsonLd))?.url).toBe(`${ORIGIN}/pass/2919`)
  })

  it('숙소(LodgingBusiness)도 같다 — 비대칭이 사라졌다', () => {
    const s = buildStayDetailMeta(staySeed(), ORIGIN, '/stays/2887')
    const p = buildDetailMeta(passSeed(), ORIGIN, '/pass/2919')
    const a = placeNode(nodes(s!.jsonLd))
    const b = placeNode(nodes(p!.jsonLd))
    expect(typeof a?.url).toBe('string')
    expect(typeof b?.url).toBe('string')
  })

  it('🔴 반대 방향 — priceRange·description·openingHours 를 이용권 매장에 **지어내지 않는다**', () => {
    // 이용권은 상품 ≠ 매장이다: 딜 한 건의 값을 식당의 가격대·소개라고 말하면 지어내기다.
    const pl = placeNode(nodes(buildDetailMeta(passSeed(), ORIGIN, '/pass/2919')!.jsonLd))
    expect(pl).toBeDefined()
    expect(pl).not.toHaveProperty('priceRange')
    expect(pl).not.toHaveProperty('description')
    expect(pl).not.toHaveProperty('openingHours')
    expect(pl).not.toHaveProperty('servesCuisine')
  })

  it('매장 정보가 없으면 노드를 아예 안 만든다 (url 만 든 빈 노드가 생기지 않는다)', () => {
    const m = buildDetailMeta(
      JSON.stringify({ success: true, data: { id: 1, name: 'x', price: 1000, category: 'meal_voucher', group_buy_status: 'active' } }),
      ORIGIN, '/pass/1',
    )
    expect(placeNode(nodes(m!.jsonLd))).toBeUndefined()
  })

  it('Offer 의 availableAtOrFrom 이 여전히 그 매장 노드의 @id 를 가리킨다', () => {
    const ns = nodes(buildDetailMeta(passSeed(), ORIGIN, '/pass/2919')!.jsonLd)
    const pl = placeNode(ns)
    const prod = ns.find((n) => n['@type'] === 'Product') as Node | undefined
    const offer = prod?.offers as Node | undefined
    expect((offer?.availableAtOrFrom as Node)?.['@id']).toBe(pl?.['@id'])
  })
})
