/**
 * 🎁 교환권 facet **발견 경로** — sitemap 제출 + 허브 내부 링크 (2026-10-18, 대표 착수 승인)
 *
 * **라이브 실측으로 확정한 결함**(Googlebot UA 로 받아 파싱 · `/api/products?deal_only=1` 전수 페이징):
 *   - 교환권 **2,260건이 20종**으로 갈라져 있고 `VOUCHER_FILTER_CATEGORIES` 20종과 **정확히 일치**하며
 *     **전부 재고 5건 이상**(최소 `마트상품권` 5건).
 *   - 그런데 **sitemap 제출은 3개**(`편의점`·`커피/음료`·`베이커리/도넛`)뿐이고 허브(`/vouchers`)의
 *     크롤러 문서는 본문 295자 · h1·h2 멀쩡한데 **`<a href>` 가 0개** ⇒ **17종이 발견 경로 0.**
 *   - 제출 3개는 **상위 3종도 아니었다** — 상위는 커피/음료 775 · 치킨 278 · 편의점 274 이고
 *     `베이커리/도넛`(202)은 6위, 치킨·피자(222)·버거(206)가 더 많은데 빠져 있었다.
 *     2026-07-29 주석의 *"라이브 실측 상위 카테고리"* 가 **낡아 있었다.**
 *
 * 🔑 **facet 기계는 이미 멀쩡했다** — 제출 안 된 `?category=치킨` 도 제목(`치킨 기프티콘 교환권 …`)·
 *    self-canonical·`<noscript>` 본문 **275자**를 낸다(2026-10-12 수리가 20종 전부에 걸려 있다).
 *    비어 있던 것은 **발견 경로뿐**이고, 그래서 이 PR 은 본문 생성기를 한 글자도 안 건드린다.
 *
 * ⚠️ **이 가드가 못 보는 것**:
 *   - 구글·네이버가 그 facet 을 실제로 색인하는지(수일~수주 · 서치콘솔은 **대표만** 본다).
 *   - `VOUCHER_FILTER_CATEGORIES` 20종이 라이브와 어긋나는 순간(테스트는 라이브를 못 본다).
 *   - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import {
  VOUCHER_FACET_MIN_ITEMS,
  voucherFacetPath,
  voucherFacetsByStock,
  voucherFacetLinks,
} from '@/shared/seo/voucher-facet'
import { VOUCHER_FILTER_CATEGORIES, buildCanonical, resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { readCode } from '@/tests/helpers/source-text'
import { sitemapRoutes } from '@/worker/routes/sitemap.routes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const NOSCRIPT = 'src/worker/utils/crawler-noscript.ts'

/** 라이브 실측 분포(2026-10-18) — 20종 전부 문턱 이상. */
const LIVE: Array<[string, number]> = [
  ['커피/음료', 775], ['치킨', 278], ['편의점', 274], ['피자', 222], ['버거', 206],
  ['베이커리/도넛', 202], ['아이스크림', 97], ['외식', 33], ['기타상품권', 24],
  ['생활/가전/디지털', 22], ['백화점상품권', 18], ['올레', 16], ['마트', 15], ['도서', 15],
  ['주유상품권', 15], ['용역서비스', 14], ['영화', 12], ['3사 통합데이터 상품', 7],
  ['음악', 7], ['마트상품권', 5],
]

/** `/vouchers` 목록 시드 — `LIST_SURFACE_KEEP['/vouchers']` 가 보는 모양(`deal_only === 1`). */
function voucherSeed(n = 3): string {
  return JSON.stringify({
    success: true,
    data: Array.from({ length: n }, (_, i) => ({
      id: 9000 + i, name: `상품 ${i}`, price: 1000 + i, deal_only: 1,
      brand_name: 'GS25', image_url: 'https://bizimg.giftishow.com/a.jpg',
    })),
  })
}

describe('① voucherFacetsByStock — 제출 목록은 재고로 정한다', () => {
  it('라이브 분포를 먹이면 20종 전부 통과하고 건수 내림차순이다', () => {
    const out = voucherFacetsByStock(LIVE.map(([category, n]) => ({ category, n })))
    expect(out).toHaveLength(20)
    expect(out[0]).toEqual({ category: '커피/음료', count: 775 })
    expect(out.at(-1)).toEqual({ category: '마트상품권', count: 5 })
    const counts = out.map(o => o.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('허용목록(canonical 이 믿는 집합) 밖은 제출하지 않는다', () => {
    // 🔴 라이브에 실재하는 값이다 — `건강/식품/주방` 3건은 SSOT 에 없어 canonical 이 `/vouchers` 로
    //   통합한다. 제출하면 *제출한 URL 의 정본이 다른 곳을 가리키는* 모순이 된다.
    const out = voucherFacetsByStock([
      { category: '건강/식품/주방', n: 900 },
      { category: '테스트123', n: 900 },
      { category: '치킨', n: 278 },
    ])
    expect(out.map(o => o.category)).toEqual(['치킨'])
  })

  it(`재고가 문턱(${VOUCHER_FACET_MIN_ITEMS}) 미만이면 제출하지 않는다`, () => {
    const out = voucherFacetsByStock([
      { category: '치킨', n: VOUCHER_FACET_MIN_ITEMS },
      { category: '피자', n: VOUCHER_FACET_MIN_ITEMS - 1 },
      { category: '버거', n: 0 },
    ])
    expect(out.map(o => o.category)).toEqual(['치킨'])
  })

  it('빈 입력·비정상 행에 던지지 않고 빈 배열을 준다(폴백 판정은 호출부가 한다)', () => {
    expect(voucherFacetsByStock([])).toEqual([])
    expect(voucherFacetsByStock(undefined as never)).toEqual([])
    expect(voucherFacetsByStock([
      { category: null, n: 99 }, { category: '  ', n: 99 },
      { category: '치킨', n: null }, { category: '피자', n: Number.NaN },
    ])).toEqual([])
  })

  it('문턱 상수는 지역 상수와 공유하지 않는다(값이 같아도 다른 축이다)', () => {
    const src = readCode('src/shared/seo/voucher-facet.ts')
    expect(src).not.toMatch(/REGION_INDEX_MIN_DEALS/)
    expect(VOUCHER_FACET_MIN_ITEMS).toBeGreaterThan(0)
  })
})

describe('② voucherFacetPath — 주소 조립은 한 곳에서만', () => {
  it('한글을 인코딩한다(sitemap 이 43건을 날것으로 제출한 2026-10-13 클래스)', () => {
    expect(voucherFacetPath('커피/음료')).toBe('/vouchers?category=%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C')
    expect(voucherFacetPath('편의점')).toBe('/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90')
  })

  it('제출·링크 주소가 그 facet 의 canonical 과 byte-동일이다', () => {
    /* 🔑 **이 단언이 이 PR 의 중심이다.** sitemap 이 제출하는 URL 과 그 페이지가 선언하는 정본이
     *   갈리면 *색인해 달라고 한 URL 이 다른 곳을 정본이라 말하는* 모순이 된다(2026-10-12 에
     *   `/pass`↔`/stays` 로 그 대가를 치렀다). 문자열을 비교하는 게 아니라 **`buildCanonical` 을
     *   실제로 돌려** 대조한다 — 두 함수가 같은 `encodeURIComponent` 를 쓰는 것이 우연이 아님을
     *   출력으로 확인한다.
     * 🩸 `3사 통합데이터 상품` 은 **공백이 든 유일한 값**이라 따로 적는다 — `URLSearchParams.toString()`
     *   을 쓰면 `+` 가 되고 canonical(`%20`)과 갈린다. 라이브 실측으로 canonical 이 `%20` 임을
     *   확인했고(`+` 로 요청해도 `%20` 으로 통합한다), 이 단언이 그 쪽으로 새는 것을 막는다. */
    const O = 'https://urdeal.kr'
    for (const c of VOUCHER_FILTER_CATEGORIES) {
      const href = voucherFacetPath(c)
      const search = href.slice(href.indexOf('?'))
      expect(`${O}${href}`).toBe(buildCanonical(O, '/vouchers', search, ['category'], { category: VOUCHER_FILTER_CATEGORIES }))
    }
    // 공백 값이 실제로 목록에 있어야 이 단언이 그 경우를 덮는다(없으면 조용히 안 재게 된다).
    expect(VOUCHER_FILTER_CATEGORIES.some(c => c.includes(' '))).toBe(true)
    expect(voucherFacetPath('3사 통합데이터 상품')).toContain('%20')
    expect(voucherFacetPath('3사 통합데이터 상품')).not.toContain('+')
  })

  it('제출하는 facet 은 self-canonical + index 다(통합되지 않는다)', () => {
    // 🔴 반대 방향: 허용목록 밖 값은 `/vouchers` 로 통합돼야 한다.
    const O = 'https://urdeal.kr'
    const seo = resolveConsumerSurfaceSeo('/vouchers', '?category=치킨', O)
    expect(seo?.canonical).toBe(`${O}${voucherFacetPath('치킨')}`)
    expect(seo?.noindex).toBeFalsy()
    const bad = resolveConsumerSurfaceSeo('/vouchers', '?category=건강%2F식품%2F주방', O)
    expect(bad?.canonical).toBe(`${O}/vouchers`)
  })

  it('sitemap·허브가 그 함수를 지난다(손으로 조립하지 않는다)', () => {
    for (const f of [SITEMAP, NOSCRIPT]) {
      // 주석 제거본에서 센다 — 설명이 인용한 문자열이 섞이면 전후 대조가 틀어진다.
      expect(readCode(f)).not.toMatch(/`\/vouchers\?category=\$\{/)
    }
    expect(readCode(SITEMAP)).toMatch(/voucherFacetPath\(/)
  })
})

describe('③ voucherFacetLinks — 허브가 내보낼 링크', () => {
  it('허용목록 20종 전부를 낸다(발견 경로 0 이었던 17종 포함)', () => {
    const links = voucherFacetLinks()
    expect(links).toHaveLength(VOUCHER_FILTER_CATEGORIES.length)
    expect(links.map(l => l.label)).toEqual([...VOUCHER_FILTER_CATEGORIES])
    // 라이브 실측에서 제출 안 됐던 값 네 개가 실제로 들어 있는지.
    for (const c of ['치킨', '피자', '버거', '마트상품권']) {
      expect(links.some(l => l.label === c)).toBe(true)
    }
  })

  it('주소는 SSOT 함수와 byte-동일이다', () => {
    for (const l of voucherFacetLinks()) expect(l.href).toBe(voucherFacetPath(l.label))
  })

  it('라벨은 카테고리 이름 그대로다(regionChildLinks 와 같은 규율 — 꼬리를 안 붙인다)', () => {
    for (const l of voucherFacetLinks()) expect(l.label).not.toMatch(/교환권|기프티콘/)
  })
})

describe('④ 허브 noscript 가 그 링크를 실제로 낸다', () => {
  const html = buildStaticSurfaceNoscript('/vouchers', voucherSeed())

  it('facet 링크 20개가 a태그로 들어간다', () => {
    const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)].map(m => m[1])
    expect(hrefs).toHaveLength(20)
    // 전부 facet 주소이고, 그 집합이 SSOT 와 같다.
    expect(new Set(hrefs)).toEqual(new Set(voucherFacetLinks().map(l => l.href)))
  })

  it('항목(상품) 링크는 여전히 0 이다 — 교환권 상세는 noindex 다', () => {
    // 🔴 반대 방향. 이 방향이 깨지면 *색인 말라고 한 URL* 로 크롤 예산을 보낸다.
    const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)].map(m => m[1])
    expect(hrefs.filter(h => /\/vouchers\/\d|\/pass\/|\/products\//.test(h))).toEqual([])
  })

  it('시드가 비면 종전과 같이 아무것도 안 낸다(링크만 남기지 않는다)', () => {
    expect(buildStaticSurfaceNoscript('/vouchers', JSON.stringify({ data: [] }))).toBe('')
    expect(buildStaticSurfaceNoscript('/vouchers', null)).toBe('')
  })

  it('HTML 을 탈출한다 — 탐침 값으로 동작을 잰다', () => {
    const probe = JSON.stringify({
      data: [{ id: 1, name: 'a&b</script><b>', price: 100, deal_only: 1, brand_name: 'x"y' }],
    })
    const out = buildStaticSurfaceNoscript('/vouchers', probe)
    expect(out).not.toMatch(/<b>y?/)
    expect(out).toContain('&amp;')
  })
})

describe('⑤ 다른 목록 표면은 byte-동일이다(반대 방향)', () => {
  // `/browse`·`/map`·`/stays` 는 facet 체계가 없다 — 링크가 생기면 없는 URL 을 가리킨다.
  for (const [path, seed] of [
    ['/browse', JSON.stringify({ data: [{ id: 1, name: 'n', price: 1, deal_only: 0 }] })],
    ['/map', JSON.stringify({ data: [{ id: 2, name: 'n', price: 1, deal_only: 0 }] })],
    ['/stays', JSON.stringify({ data: [{ id: 3, name: 'n', price: 1, category: 'stay_voucher' }] })],
  ] as const) {
    it(`${path} 에 category 링크가 0 이다`, () => {
      const out = buildStaticSurfaceNoscript(path, seed)
      expect(out).not.toMatch(/category=/)
    })
  }
})

/**
 * 🧪 가짜 D1 — `node:sqlite` 를 D1 인터페이스로 감싼다. sitemap 라우트를 **실제로 돌려**
 * 제출된 XML 을 세기 위해서다.
 *
 * 🩸 **왜 문자열 검사로는 안 되는가**: 첫 판의 단언이 `voucherFacetsByStock(` 가 소스에 있는지만
 *   봤다. 그래서 주입 *"집계 대신 하드코딩 3개로 돌아간다"*(인자를 `[]` 로 바꾼다)가 **통과했다** —
 *   호출은 남고 결과만 비기 때문이다. 이 레포가 반복해 당한 *"계산은 하는데 쓰지 않는다"* 클래스
 *   (2026-08-02 `goneStatus`). ⇒ 판정을 **출력(XML)** 으로 옮겼다.
 */
function fakeD1(db: InstanceType<typeof DatabaseSync>): D1Database {
  const stmt = (sql: string) => ({
    bind: () => stmt(sql),
    all: async () => ({ results: db.prepare(sql).all() }),
    first: async () => db.prepare(sql).get() ?? null,
    run: async () => { db.prepare(sql).run(); return { meta: { changes: 0 } } },
    raw: async () => [],
  })
  return { prepare: (sql: string) => stmt(sql), batch: async () => [], exec: async () => ({}) } as unknown as D1Database
}

/** sitemap 이 읽는 테이블 최소 집합 + 교환권 재고. facet 블록은 다른 쿼리보다 **앞**이다. */
function sitemapDb(stock: Array<[string, number]>): InstanceType<typeof DatabaseSync> {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, category TEXT, is_active INTEGER,
    deal_only INTEGER, is_supply_product INTEGER, supply_source_id INTEGER, group_buy_status TEXT,
    image_url TEXT, updated_at TEXT, seller_id INTEGER, kt_alpha_gift_code TEXT);
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, username TEXT, is_active INTEGER, status TEXT, linked_user_id INTEGER);
    CREATE TABLE blog_posts (id INTEGER PRIMARY KEY, slug TEXT, is_published INTEGER, updated_at TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY, handle TEXT);
    CREATE TABLE product_pins (id INTEGER PRIMARY KEY, product_id INTEGER, user_id INTEGER);
    CREATE TABLE gift_catalog (gift_code TEXT, goods_type_detail TEXT, brand_name TEXT, brand_icon_url TEXT);`)
  const ins = db.prepare(`INSERT INTO products (category,is_active,deal_only,is_supply_product,supply_source_id,kt_alpha_gift_code)
    VALUES (?,1,1,0,0,?)`)
  const gc = db.prepare(`INSERT INTO gift_catalog (gift_code,goods_type_detail) VALUES (?,?)`)
  let k = 0
  for (const [cat, n] of stock) {
    for (let i = 0; i < n; i++) { const code = `G${k++}`; ins.run(cat, code); gc.run(code, cat) }
  }
  return db
}

/** sitemap 을 돌려 제출된 facet 경로를 뽑는다(디코딩해서 카테고리 이름으로). */
async function submittedFacets(stock: Array<[string, number]>): Promise<string[]> {
  const db = sitemapDb(stock)
  try {
    const res = await sitemapRoutes.request('/sitemap.xml', {}, { DB: fakeD1(db) } as never)
    const xml = await res.text()
    return [...xml.matchAll(/<loc>[^<]*\/vouchers\?category=([^<]*)<\/loc>/g)]
      .map(m => decodeURIComponent(m[1].replace(/&amp;/g, '&')))
  } finally {
    db.close()
  }
}

describe('⑥ sitemap 배선 — 하드코딩 목록이 제출 목록이 아니다', () => {
  const src = readCode(SITEMAP)

  it('제출 목록은 재고 집계가 정한다 — sitemap 을 돌려 XML 로 센다', async () => {
    // 🔑 **동작 판정**: 라이브 분포를 DB 에 넣고 라우트를 돌린다. 집계가 끊기면 폴백 3개만 나온다.
    const got = await submittedFacets(LIVE)
    expect(got).toHaveLength(20)
    expect(got[0]).toBe('커피/음료')          // 건수 내림차순
    expect(got).toContain('치킨')              // 종전 미제출 — 278건으로 2위
    expect(got).toContain('마트상품권')        // 종전 미제출 — 최소 5건
    expect(new Set(got).size).toBe(20)         // 중복 0(폴백이 겹쳐 들어오지 않았다)
  })

  it('재고가 문턱 미만·허용목록 밖인 카테고리는 제출되지 않는다', async () => {
    const got = await submittedFacets([
      ['치킨', 9], ['피자', VOUCHER_FACET_MIN_ITEMS - 1], ['건강/식품/주방', 50],
    ])
    expect(got).toEqual(['치킨'])
  })

  it('집계가 아무것도 못 내면 폴백 3개로 — 0 을 "재고 0" 으로 읽지 않는다', async () => {
    // 🔴 이 방향이 깨지면 이미 색인된 3건이 조용히 빠지고, 색인은 돌아오는 데 수주다.
    const got = await submittedFacets([])
    expect(got.sort()).toEqual(['커피/음료', '베이커리/도넛', '편의점'].sort())
  })

  it('종전 하드코딩 상수는 폴백 전용으로만 남는다', () => {
    expect(src).not.toMatch(/SITEMAP_VOUCHER_CATEGORIES/)
    expect(src).toMatch(/SITEMAP_VOUCHER_FALLBACK/)
    expect(src).toMatch(/facetsEmitted/)
  })

  it('집계 쿼리가 가시성 SSOT 와 deal_only 를 쓴다(본문을 만드는 쿼리와 같은 기준)', () => {
    const q = src.slice(src.indexOf('SELECT category, COUNT(*)'))
    expect(q.slice(0, 400)).toMatch(/deal_only\s*=\s*1/)
    expect(q.slice(0, 400)).toMatch(/consumerVisibleProductSql\('products'\)/)
    expect(q.slice(0, 400)).toMatch(/GROUP BY category/)
    // 🔴 `gift_catalog` JOIN 으로 세지 않는다 — 화면 칩 기준이고 facet 본문 기준과 다르다(실측 0 ↔ 3).
    expect(q.slice(0, 400)).not.toMatch(/gift_catalog/)
  })
})

describe('⑦ 집계 쿼리의 의미 — 소스에서 떼어 실제로 돌린다', () => {
  it('문턱 이상·허용목록 안인 카테고리만, 건수와 함께 나온다', () => {
    const src = readCode(SITEMAP)
    const i = src.indexOf('SELECT category, COUNT(*)')
    expect(i).toBeGreaterThan(0)
    // 템플릿 리터럴 안이라 **닫는 백틱을 뒤에서** 찾는다(앞에서 찾으면 열린 백틱을 집는다).
    const j = src.indexOf('`', i)
    const raw = src.slice(i, j > i ? j : undefined)
    // SSOT 호출만 실제 술어로 치환한다(`${...}` 를 통째로 지우면 `AND )` 가 된다).
    const sql = raw
      .replace(/\$\{consumerVisibleProductSql\('products'\)\}/g,
        "NOT (COALESCE(products.is_supply_product,0) = 1 AND COALESCE(products.supply_source_id,0) = 0)")
      .replace(/\$\{productScope\}/g, '')
    expect(sql).not.toMatch(/\$\{/)

    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, category TEXT, is_active INTEGER,
      deal_only INTEGER, is_supply_product INTEGER, supply_source_id INTEGER)`)
    const ins = db.prepare(`INSERT INTO products (category,is_active,deal_only,is_supply_product,supply_source_id)
      VALUES (?,?,?,?,?)`)
    const add = (cat: string | null, n: number, o: Partial<{ active: number; deal: number; supply: number }> = {}) => {
      for (let k = 0; k < n; k++) ins.run(cat, o.active ?? 1, o.deal ?? 1, o.supply ?? 0, 0)
    }
    add('치킨', 5)
    add('피자', VOUCHER_FACET_MIN_ITEMS - 1)         // 문턱 미만 → 제출 안 됨
    add('건강/식품/주방', 9)                          // 허용목록 밖 → 제출 안 됨
    add('커피/음료', 4, { active: 0 })                // 비활성 → 안 세어짐
    add('버거', 4, { deal: 0 })                       // 교환권 아님 → 안 세어짐
    add('마트', 4, { supply: 1 })                     // 도매 원본 → 가시성 SSOT 가 뺀다
    add(null, 9)                                      // 카테고리 없음

    const rows = db.prepare(sql).all() as Array<{ category: string | null; n: number | null }>
    const out = voucherFacetsByStock(rows)
    expect(out).toEqual([{ category: '치킨', count: 5 }])
    db.close()
  })
})

describe('⑧ 측정 하한 — 헛도는 가드 차단', () => {
  it('허용목록·소스가 비어 있으면 통과가 아니라 실패다', () => {
    expect(VOUCHER_FILTER_CATEGORIES.length).toBeGreaterThanOrEqual(10)
    expect(readCode(SITEMAP).length).toBeGreaterThan(5_000)
    expect(readCode(NOSCRIPT).length).toBeGreaterThan(5_000)
  })
})
