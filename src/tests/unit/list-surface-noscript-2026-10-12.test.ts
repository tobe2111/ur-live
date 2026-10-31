/**
 * 🧾 목록 네 표면이 크롤러에게 줄 문장을 갖는다 (2026-10-12, 대표 *"나머진 다 해줘"*)
 *
 * ## 실측 (Googlebot UA 로 라이브, 색인 대상 17경로 전수)
 *
 *     /faq 1515자 · / 384자 · /about 288자  ← 2026-10-12 오전에 고친 셋
 *     /vouchers 36 · /browse 23 · /map 38 · /stays 34  ← 전부 thin content
 *     /experience 33 · /new-openings 40 · /creators 28 · /partners 37 · /join 15 …
 *
 * 구글이 thin 으로 보는 수준이고, 그 상태로는 *"동네 맛집 할인권"*·*"여행 숙소 이용권"* 같은
 * 질의에 **인용할 문장이 한 줄도 없다.** 그런데 네 표면은 시드가 **이미 도착해 있었다**
 * (`VOUCHERS:kv-hit`·`BROWSE:kv-hit`·`MAP:kv-hit`, `/stays` 만 슬롯 부재).
 *
 * ## 설계
 *
 * - 각 표면의 카드가 화면에 그리는 값만 글로 옮긴다(규율 ① 지어내지 않는다).
 * - `/stays` 는 자기 슬롯이 없어 **홈과 같은 캐시 키**를 받고 숙소만 걸러 쓴다 — `/region/*` 과
 *   같은 수법이라 **새 self-fetch 키가 0** 이다(실측 그 시드에 `stay_voucher` 5건).
 * - `/stays` 상세는 색인 대상이므로(`canonicalDetailPath`) `ItemList` 도 함께 낸다.
 *   `/vouchers` 는 **여전히 제외** — 그 상세가 noindex 다.
 *
 * ## 못 보는 것
 *
 * 시드가 없는 표면(`/experience`·`/new-openings`·`/creators`·`/partners`·`/join` …)은 그대로
 * 20~40자다. 거기엔 재사용할 캐시 키가 없어 **새 self-fetch** 가 필요하고, 그건 어제 세운 규율
 * (추가 요청 0)을 깨므로 별건으로 예산을 먼저 재야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

const worker = readCode('src/worker/index.ts')
const noscript = readCode('src/worker/utils/crawler-noscript.ts')
const META = { title: 't', description: 'd', canonical: 'https://urdeal.kr/x' }

/** 네 표면이 한 시드에 섞여 있는 탐침 — 술어가 실제로 가르는지는 이 모양으로만 잴 수 있다. */
const MIXED = JSON.stringify({
  data: [
    { id: 1, name: '닭도리탕', restaurant_name: '달빛한스푼', category: 'meal_voucher', price: 31000, original_price: 35000, deal_only: 0, restaurant_address: '전주시 덕진구' },
    { id: 2, name: '평일 1박 숙박권', restaurant_name: '그랑블루글램핑', category: 'stay_voucher', price: 209000, original_price: 272000, deal_only: 0, restaurant_address: '강원특별자치도 홍천군' },
    { id: 3, name: '츄파춥스300', brand_name: 'GS25', category: '편의점', price: 300, deal_only: 1 },
    { id: 4, name: '무선 이어폰', category: 'lifestyle', price: 10000, deal_only: 0 },
  ],
})

/**
 * 🔁 2026-10-18 재조준: 불변식은 그대로다 — *술어가 그 표면의 항목만 고른다*. 그런데 같은 날
 * `/vouchers` 허브에 **카테고리 facet 링크**가 `<li>` 로 붙어, 모든 `<li>` 를 "상품 줄" 로 세던
 * 이 헬퍼가 그 20줄까지 항목으로 집었다. 항목 줄과 facet 줄을 **구조로** 가른다(facet 줄은
 * 언제나 `?category=` 링크를 담는다 — 상품 줄은 그 표면에서 링크를 아예 안 단다).
 */
function rowsOf(path: string, seed = MIXED): string[] {
  return [...buildStaticSurfaceNoscript(path, seed).matchAll(/<li>(.*?)<\/li>/g)]
    .map((m) => m[1])
    .filter((li) => !li.includes('?category='))
}

describe('① 네 표면의 술어가 각각 정확하다 (동작으로 잰다)', () => {
  it('교환권 목록은 교환권만 말한다', () => {
    const r = rowsOf('/vouchers')
    expect(r.join('|')).toContain('GS25')
    expect(r.join('|'), '매장 이용권이 교환권 목록에 섞였다').not.toContain('달빛한스푼')
    expect(r).toHaveLength(1)
  })

  it('숙소 목록은 숙소만 말한다', () => {
    const r = rowsOf('/stays')
    expect(r.join('|')).toContain('그랑블루글램핑')
    expect(r.join('|'), '식당이 숙소 목록의 내용이라고 말한다').not.toContain('달빛한스푼')
    expect(r.join('|')).not.toContain('GS25')
    expect(r).toHaveLength(1)
  })

  it('지도·쇼핑은 교환권을 뺀 나머지를 말한다', () => {
    for (const p of ['/map', '/browse']) {
      const r = rowsOf(p)
      expect(r.join('|'), `${p} 에 교환권이 섞였다`).not.toContain('GS25')
      expect(r.length, `${p} 가 비었다`).toBeGreaterThanOrEqual(3)
    }
  })

  it('가격·할인율은 화면 SSOT 와 같은 값으로 붙는다', () => {
    expect(rowsOf('/map').join('|')).toContain('판매가 31,000원 (11% 할인)')
  })

  it('브랜드가 상품명 앞에 그대로 들어가면 한 번만 말한다', () => {
    const seed = JSON.stringify({ data: [{ id: 9, name: '네이버페이 포인트 500원', brand_name: '네이버페이 포인트', price: 500, deal_only: 1 }] })
    expect(rowsOf('/vouchers', seed)[0]).toBe('네이버페이 포인트 500원 판매가 500원')
  })
})

describe('② 라벨은 crumb SSOT 에서 온다 — 손으로 적지 않는다', () => {
  // 🏷️ 2026-10-12: 같은 글자가 `<p>` → `<h1>` 이 됐다(라이브 실측 — 색인 대상 23표면 중 17개가
  //    heading 0 이었다). **불변식은 그대로**(라벨이 crumb SSOT 에서 온다)이고 앵커만 옮긴다 —
  //    그리고 `<p>` 로 되돌아가는 방향을 함께 막는다(제목 신호가 조용히 사라지는 쪽이 더 나쁘다).
  it('네 표면의 라벨이 빵부스러기 라벨과 같다 — 그리고 제목 요소로 낸다', () => {
    for (const p of ['/vouchers', '/browse', '/map', '/stays']) {
      const html = buildStaticSurfaceNoscript(p, MIXED)
      const head = /<h1>(.*?)<\/h1>/.exec(html)
      expect(head, `${p} 제목이 없다`).not.toBeNull()
      expect(head![1], `${p} 라벨이 crumb 와 갈렸다`).toBe(CONSUMER_SURFACE_SEO[p]?.crumb)
      // 문서에 제목은 정확히 하나여야 한다(첫 화면이 그리는 표면과 달리 여기엔 h1 이 없었다).
      expect([...html.matchAll(/<h1>/g)], `${p} h1 개수`).toHaveLength(1)
    }
  })
})

describe('③ 상한과 안전', () => {
  it('8줄을 넘기지 않는다 — noscript 도 사람이 받는 응답에 실린다', () => {
    const many = JSON.stringify({ data: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `메뉴${i}`, restaurant_name: `가게${i}`, category: 'meal_voucher', price: 1000, deal_only: 0 })) })
    expect(rowsOf('/map', many)).toHaveLength(8)
  })

  it('시드가 없거나 비면 아무것도 안 낸다 (무회귀)', () => {
    for (const seed of [null, '', '{bad json', JSON.stringify({ data: [] })]) {
      expect(buildStaticSurfaceNoscript('/stays', seed), `시드 ${String(seed).slice(0, 12)} 에서 뭔가 났다`).toBe('')
    }
  })

  it('시드 값을 탈출해서 넣는다', () => {
    const probe = JSON.stringify({ data: [{ id: 1, name: 'x</script><b>y', restaurant_name: 'a&b', category: 'stay_voucher', price: 100, deal_only: 0 }] })
    const html = buildStaticSurfaceNoscript('/stays', probe)
    expect(html).not.toContain('</script>')
    expect(html).not.toContain('<b>')
    expect(html).toContain('a&amp;b')
  })

  it('목록 표면이 아니면 안 낸다', () => {
    for (const p of ['/', '/search', '/gb-market', '/partners']) {
      // 🔁 2026-10-31 재조준: `/partners` 가 화면 헤더 링크(`/`·`/about`)를 `<li><a>` 로 낸다(landing-seo).
      //   불변식은 그대로 — *시드의 상품 줄이 목록 아닌 표면에 새지 않는다* — 라서 `<li>` 전체가 아니라
      //   **시드 상품 이름**으로 판정한다(MIXED 의 네 이름 중 어느 것도 나오면 안 된다).
      const html = buildStaticSurfaceNoscript(p, MIXED)
      for (const name of ['닭도리탕', '평일 1박 숙박권', '츄파춥스300', '무선 이어폰']) {
        expect(html, `${p} 에 목록 요약(${name})이 났다`).not.toContain(name)
      }
    }
  })
})

describe('④ /stays ItemList — 숙소만, 전부 /stays/', () => {
  const ld = buildSurfaceListJsonLd('/stays', '', 'https://urdeal.kr', META, MIXED)

  it('ItemList 가 생기고 항목 URL 이 전부 숙소 상세다', () => {
    // 🩸 이 단언을 두 번 고쳤다. ① `"url"` 을 전체에서 찾아 `CollectionPage.url`(canonical)까지
    //   집었다 ② `<script>` 태그를 찾았는데 **빌더는 JSON 문자열만 돌려준다**(태그는 호출부
    //   `applySurfaceMeta` 가 붙인다). ⇒ 바로 파싱하고 **재귀로 훑어 `ItemList` 만** 본다
    //   (어제 `@graph` 중첩에서 같은 함정을 밟았다).
    expect(ld.startsWith('{'), '빌더 반환 모양이 바뀌었다').toBe(true)
    const doc = JSON.parse(ld) as unknown
    const lists: Array<{ itemListElement?: Array<{ url?: string; position?: number }> }> = []
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(walk); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (r['@type'] === 'ItemList') lists.push(r as never)
        Object.values(r).forEach(walk)
      }
    }
    walk(doc)
    expect(lists.length, 'ItemList 노드가 없다').toBe(1)
    const els = lists[0].itemListElement || []
    expect(els.length, 'ItemList 항목이 0 이다').toBeGreaterThan(0)
    for (const e of els) expect(e.url, `숙소 아닌 항목: ${e.url}`).toMatch(/\/stays\/\d+$/)
    expect(els.map((e) => e.position), 'position 이 1..N 연속이 아니다')
      .toEqual(els.map((_, i) => i + 1))
  })

  it('교환권 목록은 여전히 항목을 안 낸다 — 그 상세가 noindex 다', () => {
    const v = buildSurfaceListJsonLd('/vouchers', '', 'https://urdeal.kr', META, MIXED)
    expect(v, '색인 말라고 한 URL 을 목록 항목으로 제출했다').not.toContain('"ItemList"')
  })

  it('noindex 표면엔 아무것도 안 낸다', () => {
    expect(buildSurfaceListJsonLd('/search', '', 'https://urdeal.kr', { ...META, noindex: true }, MIXED)).toBe('')
  })
})

describe('⑤ 워커 배선 — /stays 가 홈 시드를 받는다', () => {
  it('쿼리가 없을 때만, 지역과 같은 분기에서', () => {
    expect(worker, '/stays 슬롯 배선이 사라졌다')
      .toMatch(/!url\.search && \(REGION_PATH_RE\.test\(url\.pathname\) \|\| url\.pathname === '\/stays'\)/)
  })

  it('숙소 전용 시드 경로를 새로 만들지 않는다 — 새 self-fetch 키 0', () => {
    // 🩸 첫 판은 분기 뒤 600자에서 `path: MAIN_SEED_PATH` 를 찾았는데, 주입이 **홈 분기**(같은
    //   문자열이 두 곳)를 바꿔도 통과했다 — 홈에선 그 조건이 거짓이라 행동이 안 변한다.
    //   ⇒ 자리를 보는 대신 **결과**를 본다: 워커 어디에도 숙소 전용 시드 경로가 없어야 한다.
    //   `readCode` 는 주석 제거본이라 설명 속 `stay_voucher`(이 분기 주석)는 걸리지 않는다.
    expect(/stay_voucher/.test(worker), '숙소 전용 시드 경로를 만들면 cron 예열에 없는 키라 매 요청이 콜드 D1 을 친다').toBe(false)
    // 시드 경로 상수는 import·홈·지역숙소 셋뿐이다 — 늘면 새 키가 생겼다는 뜻이다.
    expect((worker.match(/MAIN_SEED_PATH/g) || []).length, 'MAIN_SEED_PATH 사용 수가 바뀌었다').toBe(3)
  })
})

describe('⑥ 지역 페이지 회귀 0', () => {
  it('지역 요약이 그 지역 행만 고른다', () => {
    const r = rowsOf('/region/강원')
    expect(r.join('|')).toContain('그랑블루글램핑')
    expect(r.join('|'), '다른 지역이 섞였다').not.toContain('달빛한스푼')
  })
})

describe('⑦ 읽기 하한 — 0건이면 통과가 아니라 실패', () => {
  it('소스가 실재하고 술어 표가 비어 있지 않다', () => {
    expect(worker.length).toBeGreaterThan(10000)
    expect(noscript.length).toBeGreaterThan(2000)
    const keys = [...noscript.matchAll(/^  '(\/[a-z]+)': \(p\) =>/gm)].map((m) => m[1])
    expect(keys.sort(), '술어 표가 바뀌었다').toEqual(['/browse', '/map', '/stays', '/vouchers'])
  })
})
