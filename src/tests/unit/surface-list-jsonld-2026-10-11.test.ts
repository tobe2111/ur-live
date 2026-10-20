/**
 * 🔎 2026-10-11 — **목록·유어샵 표면의 구조화 데이터** 가드.
 *
 * ## 왜 이 시험이 있나 (라이브 실측 — 네이버 Yeti UA 로 서버 HTML 을 받아 파싱해 셌다)
 *       /pass/2919    Product · Offer · FoodEstablishment · BreadcrumbList   ✅
 *       /vouchers     Organization · WebSite 뿐                              ❌
 *       /map          Organization · WebSite 뿐                              ❌
 *       /u/jiwon1228  Organization · WebSite 뿐                              ❌
 * `applySurfaceMeta` 는 `jsonLd` 자리를 **이미** 갖고 있었고(블로그 목록이 쓴다) 소비자 목록만
 * 아무도 넘기지 않았다.
 *
 * ## 이 시험이 지키는 두 규율 (둘 다 "에러가 안 나는" 종류다)
 * 1. **noindex 를 가리키지 않는다** — 교환권 상세(`/vouchers/:id`)는 2026-07-07 결정으로 noindex 다.
 *    그 URL 을 "이 목록의 항목" 으로 제출하면 서로 반대되는 신호를 보내는 것이고, **빌드도 화면도
 *    안 깨진다.**
 * 2. **추가 요청 0** — 항목은 그 표면이 이미 받아 둔 SSR 시드에서만 뽑는다. 구조화 데이터를 위해
 *    self-fetch 를 만들면 서브리퀘스트 예산(무료 50/인보케이션, 실측 ~49)을 깎는다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글이 그 리치결과를 실제로 쓰는지(색인은 수일~수주 · 판정은
 *    서치콘솔에서 대표만 본다) · HTMLRewriter 배선의 런타임 동작(워커 전용 API 라 유닛 밖 —
 *    배포 후 UA 별 `curl` 이 유일한 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSurfaceListJsonLd, buildCuratorJsonLd, SURFACE_LIST_MAX } from '@/worker/utils/surface-list-jsonld'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { canonicalDetailPath } from '@/shared/product-flow'
import { curatorHomePins } from '@/shared/curator-pin-order'
import { stripComments } from '../helpers/source-text'

const ORIGIN = 'https://urdeal.kr'
const workerSrc = readFileSync('src/worker/index.ts', 'utf8')

type Node = Record<string, any>
function graph(json: string): Node[] {
  expect(json, 'JSON-LD 가 비었다').not.toBe('')
  const d = JSON.parse(json.replace(/<\\\//g, '</')) as { '@graph'?: Node[] }
  expect(Array.isArray(d['@graph']), '@graph 배열이어야 한다').toBe(true)
  return d['@graph'] as Node[]
}
function node(json: string, type: string): Node | undefined {
  return graph(json).find(n => n['@type'] === type)
}

/** MAIN 시드 모양 — 라이브 `/api/group-buy/products?status=active&category=all` 실측 그대로. */
function mainSeed(items: unknown[]): string {
  return JSON.stringify({ success: true, data: items, total: items.length })
}
const PASS = {
  id: 2919, name: '달빛한스푼 닭도리탕', image_url: 'https://media.ur-team.com/a.jpg',
  price: 31000, original_price: 35000, category: 'meal_voucher', deal_only: 0,
  restaurant_name: '달빛한스푼', avg_rating: 0, review_count: 0,
}
const META = {
  title: '유어딜 - 테스트', description: '설명', canonical: `${ORIGIN}/`,
}

describe('① 항목은 색인 가능한 상세만 가리킨다', () => {
  it('교환권(`deal_only=1`)은 ItemList 에서 빠진다 — 그 상세는 noindex 다', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([
      PASS,
      { ...PASS, id: 7001, name: '스타벅스 아메리카노', deal_only: 1, category: 'cafe' },
    ]))
    const list = node(json, 'CollectionPage')!.mainEntity
    expect(list.numberOfItems).toBe(1)
    const urls = list.itemListElement.map((x: Node) => x.url)
    expect(urls).toEqual([`${ORIGIN}/pass/2919`])
    expect(urls.some((u: string) => u.includes('/vouchers/'))).toBe(false)
  })

  it('`/vouchers`(교환권 목록)는 ItemList 를 아예 안 낸다 — 항목 전체가 noindex 라서', () => {
    // 🩸 **픽스처 주의**: 시드를 전부 `deal_only=1` 로 두면 항목이 **어차피** 걸러져서, 이 규칙을
    //    통째로 없애도 초록이 뜬다(2026-10-11 주입 러너가 실제로 그걸 잡았다). 그래서 **항목이
    //    생길 수 있는 시드**(`deal_only=0`)로 재야 한다 — 그래도 안 나오는 것이 불변식이다.
    const seed = mainSeed([PASS, { ...PASS, id: 999 }])
    const json = buildSurfaceListJsonLd('/vouchers', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/vouchers` }, seed)
    expect(node(json, 'CollectionPage'), 'ItemList 가 생겼다').toBeUndefined()
    expect(node(json, 'WebPage'), 'WebPage 는 있어야 한다').toBeDefined()
    expect(node(json, 'BreadcrumbList'), '빵부스러기는 있어야 한다').toBeDefined()
    // 🔑 같은 시드를 허용 경로(`/`)에 주면 항목이 **생긴다** — 이 시험이 "데이터가 어차피
    //    걸러져서" 통과하는 게 아니라는 증거다(그게 첫 판의 결함이었다).
    expect(node(buildSurfaceListJsonLd('/', '', ORIGIN, META, seed), 'CollectionPage')!
      .mainEntity.numberOfItems).toBe(2)
  })

  // 🔁 2026-10-14 재조준 — 이 시험이 **두 가지로 낡아 있었다.** 이름은 *"`/`·`/browse` 뿐"* 인데
  //   `/stays` 는 2026-10-12 에 허용목록에 들어갔고, 그런데도 초록이던 이유가 고약하다: 픽스처가
  //   식사권 **1건**이라 `/stays` 의 `keepItem` 에 **어차피 걸러졌다**(= 그 표면을 허용목록에서
  //   빼도 결과가 같다 ⇒ 판정 불가). 이 레포가 반복해 당한 *"데이터 탓으로 헛도는 가드"* 다.
  //   ⇒ 표면마다 **항목이 생길 수 있는 시드**를 주고(숙소엔 숙소 행) 허용목록을 **동작으로** 센다.
  //   지키려던 불변식(`/vouchers`·정적 표면은 시드를 줘도 항목 0)은 한 글자도 안 바꿨다.
  it('항목을 내는 표면은 허용목록 넷뿐 — 나머지는 *낼 수 있는* 시드를 줘도 빵부스러기만', () => {
    const STAY = { ...PASS, id: 3100, category: 'stay_voucher', name: '양양 풀빌라' }
    // 두 종류를 함께 넣어 **어느 표면도 "어차피 걸러져서" 통과하지 못하게** 한다.
    const seed = mainSeed([PASS, STAY])
    for (const p of ['/', '/browse', '/stays', '/map']) {
      const list = node(buildSurfaceListJsonLd(p, '', ORIGIN, { ...META, canonical: ORIGIN + p }, seed),
        'CollectionPage')
      expect(list, `${p} 는 항목을 내야 한다`).toBeDefined()
      expect(list!.mainEntity.numberOfItems, `${p} 항목 0건`).toBeGreaterThan(0)
    }
    for (const p of ['/vouchers', '/faq', '/terms', '/experience', '/region']) {
      expect(node(buildSurfaceListJsonLd(p, '', ORIGIN, { ...META, canonical: ORIGIN + p }, seed),
        'CollectionPage'), `${p} 가 항목을 냈다`).toBeUndefined()
    }
  })

  // 🗺️ 2026-10-14: `/map` 은 **이미 크롤러 본문에서 그 항목들을 링크하고 있었다**(라이브 실측
  //   `<a href="/pass/…">` 8건) 그런데 `ItemList` 가 0건이었다 — 구조화 신호만 빠진 누락.
  //   `/stays` 와 달리 **필터가 없는 것이 의도다**: 동네딜 전부를 보여 주는 표면이라 이용권·숙소
  //   둘 다 정당한 항목이고, 교환권만 `listItem` 이 행마다 걸러 낸다.
  it('`/map` 은 이용권·숙소를 함께 내고 교환권만 빠진다', () => {
    const json = buildSurfaceListJsonLd('/map', '', ORIGIN, { ...META, canonical: `${ORIGIN}/map` },
      mainSeed([
        PASS,
        { ...PASS, id: 3100, category: 'stay_voucher', name: '양양 풀빌라' },
        { ...PASS, id: 7001, name: '스타벅스 아메리카노', deal_only: 1, category: 'cafe' },
      ]))
    const list = node(json, 'CollectionPage')!.mainEntity
    expect(list.itemListElement.map((x: Node) => x.url))
      .toEqual([`${ORIGIN}/pass/2919`, `${ORIGIN}/stays/3100`])
    expect(list.numberOfItems).toBe(2)
  })

  it('끝 슬래시(`/browse/`)도 같은 키로 본다 — 리졸버가 이미 떼고 찾는다', () => {
    const json = buildSurfaceListJsonLd('/browse/', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/browse` }, mainSeed([PASS]))
    expect(node(json, 'CollectionPage')!.mainEntity.numberOfItems).toBe(1)
    expect(node(json, 'BreadcrumbList')!.itemListElement[1].name).toBe('쇼핑')
  })

  it('항목 URL 은 `canonicalDetailPath` SSOT 와 같다 — 두 벌이면 같은 상품을 두 URL 로 제출한다', () => {
    const rows = [
      PASS,
      { ...PASS, id: 3100, category: 'stay_voucher', name: '양양 풀빌라' },
      { ...PASS, id: 3200, category: 'lifestyle', name: '무선 이어폰' },
    ]
    const json = buildSurfaceListJsonLd('/browse', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/browse` }, mainSeed(rows))
    const urls = node(json, 'CollectionPage')!.mainEntity.itemListElement.map((x: Node) => x.url)
    expect(urls).toEqual(rows.map(r => ORIGIN + (canonicalDetailPath(r) ?? `/products/${r.id}`)))
    expect(urls[0]).toBe(`${ORIGIN}/pass/2919`)
    expect(urls[1]).toBe(`${ORIGIN}/stays/3100`)
    expect(urls[2]).toBe(`${ORIGIN}/products/3200`)
  })

  it('이름·id 가 없는 행은 버리고 position 은 1..N 연속으로 다시 매긴다', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([
      { ...PASS, id: 1 }, { ...PASS, id: 2, deal_only: 1 }, { ...PASS, id: 3, name: '' },
      { id: undefined, name: '이름만' }, { ...PASS, id: 5 },
    ]))
    const el = node(json, 'CollectionPage')!.mainEntity.itemListElement
    expect(el.map((x: Node) => x.position)).toEqual([1, 2])
    expect(el.map((x: Node) => x.item.url)).toEqual([`${ORIGIN}/pass/1`, `${ORIGIN}/pass/5`])
  })

  it(`항목 상한 ${SURFACE_LIST_MAX} — 교환권을 걸러낸 **뒤**에도 상한까지 채운다`, () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({
      ...PASS, id: 1000 + i, deal_only: i % 2, // 절반이 교환권
    }))
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed(rows))
    const list = node(json, 'CollectionPage')!.mainEntity
    expect(list.numberOfItems).toBe(SURFACE_LIST_MAX)
    expect(list.itemListElement).toHaveLength(SURFACE_LIST_MAX)
  })
})

describe('② 평점은 실제로 있을 때만 (0건에 ratingValue:0 은 구글 정책 위반)', () => {
  it('리뷰 0건이면 aggregateRating 이 없다', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([PASS]))
    expect(node(json, 'CollectionPage')!.mainEntity.itemListElement[0].item.aggregateRating).toBeUndefined()
  })
  it('리뷰가 있으면 값을 그대로 낸다', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([{ ...PASS, avg_rating: 4.5, review_count: 12 }]))
    const r = node(json, 'CollectionPage')!.mainEntity.itemListElement[0].item.aggregateRating
    expect(r).toEqual({ '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 12 })
  })
  it('사진은 **절대 URL** 로 — 상대 경로면 구글이 그 `image` 를 버린다', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([
      { ...PASS, id: 1, image_url: '/api/media/uploads/a.jpg' },
      { ...PASS, id: 2, image_url: 'https://cdn.example.com/b.jpg' },
      { ...PASS, id: 3, image_url: 'data:image/gif;base64,R0lGOD' },
      { ...PASS, id: 4, image_url: '' },
    ]))
    const items = node(json, 'CollectionPage')!.mainEntity.itemListElement.map((x: Node) => x.item)
    expect(items[0].image).toBe(`${ORIGIN}/api/media/uploads/a.jpg`)
    expect(items[1].image).toBe('https://cdn.example.com/b.jpg')
    expect(items[2].image, 'data: URI 는 넣지 않는다').toBeUndefined()
    expect(items[3].image, '빈 값은 넣지 않는다').toBeUndefined()
    // 사진이 없어도 항목 자체는 남는다(사진이 주인공이 아니다).
    expect(items).toHaveLength(4)
  })

  it('가격이 0·없음이면 offers 를 안 낸다 (0원 상품이라고 말하지 않는다)', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([{ ...PASS, price: 0, current_price: null }]))
    expect(node(json, 'CollectionPage')!.mainEntity.itemListElement[0].item.offers).toBeUndefined()
  })
  it('`current_price`(공구 확정가)가 `price` 를 이긴다', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([{ ...PASS, price: 31000, current_price: 24800 }]))
    expect(node(json, 'CollectionPage')!.mainEntity.itemListElement[0].item.offers.price).toBe(24800)
  })
})

describe('③ 빵부스러기 — 체인은 경로 접두를 되짚는다', () => {
  it('홈은 빵부스러기를 안 낸다 (한 단계는 정보가 0)', () => {
    const json = buildSurfaceListJsonLd('/', '', ORIGIN, META, mainSeed([PASS]))
    expect(node(json, 'BreadcrumbList')).toBeUndefined()
    expect(node(json, 'CollectionPage')!.breadcrumb).toBeUndefined()
  })

  it('`/terms/seller` 는 3단계 — 유어딜 › 이용약관 › 판매자 약관 (손으로 적은 체인이 아니다)', () => {
    const json = buildSurfaceListJsonLd('/terms/seller', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/terms/seller` }, null)
    const el = node(json, 'BreadcrumbList')!.itemListElement
    expect(el.map((x: Node) => [x.position, x.name, x.item])).toEqual([
      [1, '유어딜', `${ORIGIN}/`],
      [2, '이용약관', `${ORIGIN}/terms`],
      [3, '판매자 약관', `${ORIGIN}/terms/seller`],
    ])
  })

  it('필터(`?category=`)가 붙으면 단계를 하나 더 — sitemap 이 그 URL 을 제출한다', () => {
    const json = buildSurfaceListJsonLd('/vouchers', '?category=편의점', ORIGIN,
      { ...META, canonical: `${ORIGIN}/vouchers?category=편의점` }, null)
    const el = node(json, 'BreadcrumbList')!.itemListElement
    expect(el).toHaveLength(3)
    expect(el[2].name).toBe('편의점')
    expect(el[2].item).toBe(`${ORIGIN}/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90`)
  })

  it('`?brand=` 가 `?category=` 보다 우선 (제목 분화 규칙과 같은 순서)', () => {
    const json = buildSurfaceListJsonLd('/vouchers', '?category=편의점&brand=스타벅스', ORIGIN,
      { ...META, canonical: `${ORIGIN}/vouchers` }, null)
    expect(node(json, 'BreadcrumbList')!.itemListElement[2].name).toBe('스타벅스')
  })

  it('`canonicalParams` 가 없는 표면은 쿼리로 단계가 늘지 않는다 (utm 등으로 체인이 오염되지 않게)', () => {
    const json = buildSurfaceListJsonLd('/map', '?utm_source=x&category=가짜', ORIGIN,
      { ...META, canonical: `${ORIGIN}/map` }, null)
    expect(node(json, 'BreadcrumbList')!.itemListElement).toHaveLength(2)
  })

  it('색인 가능한 모든 표면에 `crumb` 가 있고, noindex 표면엔 없다', () => {
    const miss: string[] = []
    const extra: string[] = []
    for (const [path, e] of Object.entries(CONSUMER_SURFACE_SEO)) {
      if (path === '/') continue // 루트는 체인의 1단계(사이트명)가 맡는다
      if (e.noindex) { if (e.crumb) extra.push(path) } else if (!e.crumb) miss.push(path)
    }
    expect(miss, '빵부스러기 라벨이 없는 색인 표면').toEqual([])
    expect(extra, 'noindex 인데 빵부스러기 라벨이 있다').toEqual([])
    expect(Object.keys(CONSUMER_SURFACE_SEO).length, '표가 비었다 — 이 시험이 헛돈다').toBeGreaterThan(20)
  })
})

describe('④ noindex 표면엔 구조화 데이터를 안 낸다', () => {
  it('`/search`·`/gb-market` → 빈 문자열', () => {
    for (const p of ['/search', '/gb-market']) {
      expect(CONSUMER_SURFACE_SEO[p].noindex, `${p} 가 noindex 가 아니게 됐다`).toBe(true)
      expect(buildSurfaceListJsonLd(p, '', ORIGIN,
        { ...META, canonical: ORIGIN + p, noindex: true }, mainSeed([PASS]))).toBe('')
    }
  })
})

describe('⑤ 시드가 없거나 깨져도 빵부스러기는 남는다 (fail-soft)', () => {
  it('슬롯 없음 · payload null → WebPage + 빵부스러기', () => {
    const json = buildSurfaceListJsonLd('/stays', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/stays` }, null)
    expect(node(json, 'WebPage')).toBeDefined()
    expect(node(json, 'BreadcrumbList')).toBeDefined()
    expect(node(json, 'CollectionPage')).toBeUndefined()
  })
  it('깨진 JSON → 터지지 않고 항목만 없다', () => {
    const json = buildSurfaceListJsonLd('/browse', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/browse` }, '{not json')
    expect(node(json, 'WebPage')).toBeDefined()
  })
  it('`data.products` 봉투도 받는다 (표면마다 모양이 다르다)', () => {
    const json = buildSurfaceListJsonLd('/browse', '', ORIGIN,
      { ...META, canonical: `${ORIGIN}/browse` }, JSON.stringify({ success: true, data: { products: [PASS] } }))
    expect(node(json, 'CollectionPage')!.mainEntity.numberOfItems).toBe(1)
  })
})

describe('⑥ 유어샵 — ProfilePage + 진열 순서는 첫 화면과 같은 SSOT', () => {
  const CURATOR = { name: '정지원', handle: 'jiwon1228', profile_image: 'https://media.ur-team.com/p.jpg' }
  const CMETA = { title: '정지원 유어샵 - 유어딜', description: '소개', canonical: `${ORIGIN}/u/jiwon1228` }
  const PINS = [
    { product_id: 11, product_name: '일반 상품', category: 'lifestyle', price: 9000, deal_pct: 0 },
    { product_id: 12, product_name: '이용권', category: 'meal_voucher', price: 12000, deal_pct: 0 },
    { product_id: 13, product_name: '딜 붙은 핀', category: 'beauty_voucher', price: 30000, deal_pct: 5 },
    { product_id: 14, product_name: '교환권', category: 'cafe', deal_only: 1, price: 4500, deal_pct: 0 },
  ]
  const seed = JSON.stringify({ success: true, curator: CURATOR, pins: PINS })

  it('ProfilePage 의 mainEntity 는 그 사람이다', () => {
    const p = node(buildCuratorJsonLd(seed, ORIGIN, CMETA, CURATOR), 'ProfilePage')!
    expect(p['@id']).toBe(CMETA.canonical)
    expect(p.mainEntity).toEqual({
      '@type': 'Person', name: '정지원', url: CMETA.canonical,
      identifier: 'jiwon1228', image: CURATOR.profile_image,
    })
    expect(p.isPartOf).toEqual({ '@id': `${ORIGIN}/#website` })
  })

  it('진열 순서가 `curatorHomePins` 와 같다 — 두 벌이면 순번이 다른 상품을 가리킨다', () => {
    const json = buildCuratorJsonLd(seed, ORIGIN, CMETA, CURATOR)
    const urls = node(json, 'ItemList')!.itemListElement.map((x: Node) => x.url)
    const expected = curatorHomePins(PINS)
      .filter(p => Number(p.deal_only) !== 1)
      .map(p => ORIGIN + (canonicalDetailPath({ id: p.product_id, deal_only: p.deal_only, category: p.category }) ?? `/products/${p.product_id}`))
    expect(urls).toEqual(expected)
    // 딜 붙은 핀이 맨 앞 · 교환권은 빠짐
    expect(urls[0]).toBe(`${ORIGIN}/pass/13`)
    expect(urls.some((u: string) => u.includes('/vouchers/'))).toBe(false)
  })

  it('빵부스러기는 두 단계 — `/u` 라는 없는 URL 을 가리키지 않는다', () => {
    const el = node(buildCuratorJsonLd(seed, ORIGIN, CMETA, CURATOR), 'BreadcrumbList')!.itemListElement
    expect(el.map((x: Node) => x.item)).toEqual([`${ORIGIN}/`, CMETA.canonical])
    expect(el.some((x: Node) => String(x.item).endsWith('/u'))).toBe(false)
  })

  it('핀이 0개여도 ProfilePage 는 남고 ItemList 만 없다', () => {
    const json = buildCuratorJsonLd(JSON.stringify({ curator: CURATOR, pins: [] }), ORIGIN, CMETA, CURATOR)
    expect(node(json, 'ProfilePage')).toBeDefined()
    expect(node(json, 'ItemList')).toBeUndefined()
  })

  it('이름이 없으면 핸들로 (빈 제목으로 덮어쓰지 않는다)', () => {
    const c = { handle: 'abc' }
    const json = buildCuratorJsonLd(JSON.stringify({ curator: c, pins: [] }), ORIGIN, CMETA, c)
    expect(node(json, 'ProfilePage')!.mainEntity.name).toBe('@abc')
  })

  it('깨진 payload → 빈 문자열 (기본 메타 유지)', () => {
    expect(buildCuratorJsonLd('{nope', ORIGIN, CMETA, CURATOR)).toBe('')
  })
})

describe('⑦ 문서를 깨뜨리지 않는다', () => {
  it('`</script>` 는 탈출하고 `&`·`<` 는 그대로 둔다 (HTML escape 하면 JSON 이 깨진다)', () => {
    const json = buildSurfaceListJsonLd('/browse', '', ORIGIN,
      { title: 'a & b', description: '1 < 2 </script> x', canonical: `${ORIGIN}/browse` }, mainSeed([{ ...PASS, name: 'x</script>y & z' }]))
    expect(json).not.toContain('</script>')
    expect(json).toContain('<\\/script>')
    expect(json).not.toContain('&amp;')
    const g = graph(json)
    // 항목이 있으니 `CollectionPage` 다(없으면 `WebPage`) — 둘 중 하나를 집는다.
    const page = g.find(n => n['@type'] === 'CollectionPage' || n['@type'] === 'WebPage')!
    expect(page['@type']).toBe('CollectionPage')
    expect(page.description).toBe('1 < 2 </script> x')
    expect(page.mainEntity.itemListElement[0].item.name).toBe('x</script>y & z')
    expect(g.length).toBeGreaterThan(0)
  })

  it('모든 분기가 유효 JSON 이다', () => {
    const cases: Array<[string, string, string | null]> = [
      ['/', '', mainSeed([PASS])],
      ['/vouchers', '?brand=스타벅스', mainSeed([PASS])],
      ['/browse', '', mainSeed([PASS])],
      ['/browse/', '', mainSeed([PASS])],
      ['/map', '', null],
      ['/faq', '', null],
      ['/area-report', '', null],
    ]
    for (const [p, q, seed] of cases) {
      const json = buildSurfaceListJsonLd(p, q, ORIGIN, { ...META, canonical: ORIGIN + p }, seed)
      expect(() => graph(json), `${p} 가 유효 JSON 이 아니다`).not.toThrow()
    }
  })
})

describe('⑧ 배선 — 워커가 두 빌더를 실제로 부른다', () => {
  const src = stripComments(workerSrc)

  it('정적/목록 표면: `applySurfaceMeta` 에 `jsonLd` 를 넘긴다', () => {
    // 🔁 2026-10-12 재조준: 마지막 인자가 `ssrPayload` → `crawlerPayload`(지역 요약 우선)로 바뀌었다.
    //   여기가 지키려는 불변식은 **"그 자리에서 빌더를 부른다"** 이므로 변수 이름은 묶지 않는다
    //   (어느 시드를 넘겨야 하는지는 `region-digest-2026-10-12.test.ts` ⑥ 이 따로 잠근다 —
    //    둘 다 여기서 잠그면 중복 잠금이 되어 어느 쪽도 출력으로 판정할 수 없다).
    expect(src).toMatch(/jsonLd: buildSurfaceListJsonLd\(url\.pathname, url\.search, origin2, sm, \w+Payload\)/)
  })

  it('유어샵(CURATOR): `buildCuratorJsonLd` 를 그 블록에서 부른다', () => {
    const i = src.indexOf("ssrSlot === 'CURATOR'")
    expect(i, 'CURATOR 블록 앵커가 낡았다').toBeGreaterThan(-1)
    const block = src.slice(i, src.indexOf('urdealLoaderHtml', i))
    expect(block).toContain('jsonLd: buildCuratorJsonLd(ssrPayload, origin2,')
  })

  it('구조화 데이터를 위해 self-fetch 를 새로 만들지 않았다 — 규율 2', () => {
    // 빌더는 payload 를 **받기만** 한다(fetch·env·DB 접근 0).
    const b = readFileSync('src/worker/utils/surface-list-jsonld.ts', 'utf8')
    expect(b).not.toMatch(/\bfetch\s*\(/)
    expect(b).not.toMatch(/\bc\.env\b|\bDB\b\s*\./)
  })
})
