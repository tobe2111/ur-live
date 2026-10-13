/**
 * 🛍️ 2026-10-12 — **sitemap 이 제출한 유어샵·쇼핑 상세가 크롤러에게 빈 문서였다.**
 *
 * 대표 *"다 개선하고 또 개선할 것 있는지 찾아줘"*.
 *
 * ## 라이브 실측 (Googlebot UA 로 받아 **태그를 걷어내고** 본문 글자를 셌다)
 * ```
 *   sitemap URL              슬롯      시드      첫 화면   noscript   본문
 *   /u/jiwon1228             CURATOR   2639B     O         1          383자
 *   /u/user40                CURATOR   2179B     X         0          **6자**
 *   /u/user31                CURATOR    402B     X         0          **6자**
 *   /u/jongmun               CURATOR    429B     X         0          **6자**
 *   /s/store_muxlddtf74b     SELLER     520B     X         0          **6자**
 *   /s/store_mt9rvbhg1i6     SELLER     520B     X         0          **6자**
 *   /products/2917           PRODUCT    872B     X         0          **6자**
 * ```
 * 즉 **7건 중 6건이 `index, follow` + sitemap 제출인데 서버 문서가 비어 있었다**(= 구글이
 * soft-404 로 집계하는 모양). 그리고 **시드는 전부 도착해 있었다**(`*:edge-hit`, 402~2639B) —
 * 쓰지 않고 있었을 뿐이다.
 *
 * ## 🩸 sitemap 이 적어 둔 "짝" 주장이 세 군데서 깨져 있었다
 * `sitemap.routes.ts` 는 *"핀 ≥ 1 만 내보내면 제출한 URL 은 전부 본문이 있다"* 고 선언했는데:
 *   ① 센 것은 `product_pins` **행**이고 API 의 `pins` 는 `is_active = 1 AND
 *      consumerVisibleProductSql` 를 통과한 것만이다 ⇒ *"핀 행이 있다" ≠ "핀이 보인다"*.
 *      `/u/jongmun` 이 바로 그 경우다 — `consumer-visible-product.ts` 머리말이 그 핀
 *      (`Canvas Tote Bag`, 도매 원본)을 이름까지 적어 뒀다.
 *   ② 첫 화면 빌더는 `pins.length === 0` 말고도 **`linked_seller` 가 있으면** `''` 를 준다
 *      (React 가 `SellerPublicPage` 를 그리므로 레이아웃이 다르다) — `/u/user40` 이 그 경우.
 *   ③ `/s/:username`(SELLER 슬롯)엔 첫 화면 빌더가 **아예 없다**.
 *
 * ## 처방 — 층을 나눈다
 * - **재료가 있으면 본문을 메운다**: CURATOR 폴백(`curatorNoscriptFromPayload`) · `/products/:id`.
 * - **재료가 없으면 색인 요청을 안 한다**: sitemap 의 핀 EXISTS 를 **API 와 같은 술어**로.
 *   ⚠️ 이름만 적어 글자수를 늘리는 것은 **측정만 좋아 보이게 하는 것**이라 하지 않는다.
 *
 * ## 이 시험이 **못** 보는 것
 * - `/s/:username` 2건은 **미해소** — SELLER 페이로드에 상품이 안 담겨 있다(별건).
 * - 구글이 실제로 색인하는지(수일~수주 · 서치콘솔은 대표만 본다).
 * - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import {
  curatorNoscriptFromPayload,
  buildCuratorNoscript,
  buildStaticSurfaceNoscript,
} from '@/worker/utils/crawler-noscript'
import { consumerVisibleProductSql } from '@/shared/db/consumer-visible-product'
import { stripComments } from '../helpers/source-text'

// ⚠️ `node:sqlite` 는 vite 가 번들하려다 실패한다(jsdom 환경) — `createRequire` 로 우회.
//    선례: `legacy-seller-lookup-owner-seat-2026-10-10.test.ts`.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const read = (p: string) => fs.readFileSync(p, 'utf8')
const code = (p: string) => stripComments(read(p))
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const WORKER = 'src/worker/index.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const NOSCRIPT = 'src/worker/utils/crawler-noscript.ts'

// ── 탐침: 라이브 모양 그대로 (CURATOR 는 **최상위**, PRODUCT 는 `data` 안) ──────────
const curatorSeed = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  curator: { id: 1, handle: 'probe', name: '현정', bio: null },
  pins: [],
  ...over,
})
const productSeed = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  data: {
    id: 2917, name: '프리미엄 무선아이폰', price: 10000, original_price: null, discount_rate: 0,
    description: null, long_description: null, category: 'lifestyle', deal_only: 0,
    restaurant_name: '구서 우성아파트', restaurant_phone: '010-2207-3904', restaurant_address: null,
    ...over,
  },
})

describe('① 유어샵 — 첫 화면이 비면 noscript 가 받는다', () => {
  it('핀이 있으면 진열을 글로 낸다', () => {
    const ns = curatorNoscriptFromPayload(curatorSeed({
      pins: [{ product_name: '닭도리탕', price: 31000, restaurant_name: '달빛한스푼' }],
    }))
    expect(text(ns)).toContain('닭도리탕')
    expect(text(ns)).toContain('달빛한스푼')
    expect(text(ns)).toContain('31,000원')
  })

  it('이 경로는 **이름을 뺀 채 내지 않는다** — 첫 화면이 없으니 규율 ②의 전제가 사라진다', () => {
    const ns = curatorNoscriptFromPayload(curatorSeed({
      pins: [{ product_name: '닭도리탕', price: 31000, restaurant_name: '달빛한스푼' }],
    }))
    expect(text(ns)).toContain('현정')
  })

  it('핀이 비면 **사업자 진열**(linked_seller_products)로 — `/u/user40` 이 그 경우', () => {
    const ns = curatorNoscriptFromPayload(curatorSeed({
      pins: [],
      linked_seller: { id: 9, username: 'user_40', name: '현정' },
      linked_seller_products: [{ name: '프리미엄 무선아이폰', price: 10000, restaurant_name: '구서 우성아파트' }],
    }))
    expect(text(ns)).toContain('프리미엄 무선아이폰')
    expect(text(ns)).toContain('10,000원')
  })

  it('둘이 같은 상품이면 **한 번만** 말한다 (user40 실측에서 둘이 같았다)', () => {
    const ns = curatorNoscriptFromPayload(curatorSeed({
      pins: [{ product_name: '프리미엄 무선아이폰', price: 10000, restaurant_name: '구서 우성아파트' }],
      linked_seller_products: [{ name: '프리미엄 무선아이폰', price: 10000, restaurant_name: '구서 우성아파트' }],
    }))
    expect(text(ns).match(/프리미엄 무선아이폰/g) || []).toHaveLength(1)
  })

  it('🔴 이름만 남으면 아무것도 내지 않는다 — `<title>` 이 이미 말한다', () => {
    expect(curatorNoscriptFromPayload(curatorSeed())).toBe('')
    expect(curatorNoscriptFromPayload(curatorSeed({ pins: [{ product_name: '  ' }] }))).toBe('')
  })

  it('소개(bio)만 있어도 낸다 — 그건 새 정보다', () => {
    const ns = curatorNoscriptFromPayload(curatorSeed({ curator: { name: '현정', bio: '전국의 맛집을 소개합니다.' } }))
    expect(text(ns)).toContain('전국의 맛집을 소개합니다.')
  })

  it('첫 화면이 그려지는 경로는 **이름을 넣지 않는다**(규율 ② — h1 이 이미 말한다)', () => {
    const ns = buildCuratorNoscript(JSON.parse(curatorSeed({
      curator: { name: '현정', bio: '소개' },
      pins: [{ product_name: '닭도리탕', price: 1000 }],
    })))
    expect(text(ns)).not.toContain('현정')
    expect(text(ns)).toContain('닭도리탕')
  })

  it('시드가 깨졌거나 없으면 `` (fail-soft — 로더로 폴백)', () => {
    expect(curatorNoscriptFromPayload('{bad')).toBe('')
    expect(curatorNoscriptFromPayload(null)).toBe('')
    expect(curatorNoscriptFromPayload('')).toBe('')
  })

  it('시드 값을 HTML 탈출한다', () => {
    const ns = curatorNoscriptFromPayload(curatorSeed({
      curator: { name: 'a&b', bio: 'x</script><b>y' },
      pins: [{ product_name: '<img src=x>', price: 1000, restaurant_name: '"q"' }],
    }))
    expect(ns).not.toMatch(/<(img|b|script)\b/)
    expect(ns).toContain('&amp;')
    expect(ns).toContain('&lt;')
  })
})

describe('② 쇼핑 상세 — 정본일 때만 본문을 낸다', () => {
  it('순수 쇼핑 상품은 이름·가격을 낸다', () => {
    const t = text(buildStaticSurfaceNoscript('/products/2917', productSeed()))
    expect(t).toContain('프리미엄 무선아이폰')
    expect(t).toContain('10,000원')
  })

  it('정가·할인이 있으면 함께 낸다', () => {
    const t = text(buildStaticSurfaceNoscript('/products/5', productSeed({ original_price: 20000, discount_rate: 50 })))
    expect(t).toMatch(/정가 20,000원/)
    expect(t).toMatch(/50% 할인/)
  })

  it('🔴 cross-canonical(이용권·숙소·교환권)은 **0건** — 정본 아닌 URL 을 키우지 않는다', () => {
    for (const over of [
      { category: 'meal_voucher' },
      { category: 'stay_voucher' },
      { deal_only: 1, category: '피자' },
    ]) {
      expect(buildStaticSurfaceNoscript('/products/9', productSeed(over)), JSON.stringify(over)).toBe('')
    }
  })

  it('🔒 가게·주소·전화는 **안 낸다** — 화면이 `meal_voucher` 일 때만 그린다(클로킹 금지)', () => {
    const t = text(buildStaticSurfaceNoscript('/products/2917', productSeed()))
    expect(t).not.toContain('구서 우성아파트')
    expect(t).not.toContain('010-2207-3904')
    // 그리고 그 필드를 그리는 화면 조건이 실제로 `meal_voucher` 인지 소스로 확인(전제 고정)
    expect(code('src/pages/ProductDetailPage.tsx'))
      .toMatch(/category === 'meal_voucher' && product\.restaurant_name/)
  })

  it('설명이 있으면 낸다', () => {
    expect(text(buildStaticSurfaceNoscript('/products/7', productSeed({ description: '정품 보증 2년' }))))
      .toContain('정품 보증 2년')
  })

  it('시드 없음·깨짐·숫자 아닌 id 는 `` (fail-soft)', () => {
    expect(buildStaticSurfaceNoscript('/products/9', null)).toBe('')
    expect(buildStaticSurfaceNoscript('/products/9', '{bad')).toBe('')
    expect(buildStaticSurfaceNoscript('/products/abc', productSeed())).toBe('')
    expect(buildStaticSurfaceNoscript('/products/9/x', productSeed())).toBe('')
  })

  it('값을 HTML 탈출한다', () => {
    const ns = buildStaticSurfaceNoscript('/products/9', productSeed({ name: '<b>x</b>', description: 'a&b' }))
    expect(ns).not.toMatch(/<b>/)
    expect(ns).toContain('&amp;')
  })
})

describe('③ 워커 배선 — 폴백이 로더뿐이면 안 된다', () => {
  it('CURATOR 분기가 `curatorNoscriptFromPayload` 를 깔아 둔다', () => {
    const c = code(WORKER)
    // 🩸 `ssrSlot === 'CURATOR' && ssrPayload` 는 **메타 rewrite 분기에도** 있다(line 900) —
    //    그걸 집으면 엉뚱한 블록을 보고 늘 빨간불/초록불이 된다. 빌더 호출로 앵커.
    const i = c.indexOf('buildCuratorFirstScreen(ssrPayload')
    expect(i, 'CURATOR 첫 화면 분기를 못 찾았다 — 이 단언이 아무것도 안 지킨다').toBeGreaterThan(0)
    const block = c.slice(i, i + 600)
    expect(block).toMatch(/curatorFirst \|\| \(curatorNoscriptFromPayload\(ssrPayload\) \+ urdealLoaderHtml\)/)
  })

  it('STAYDETAIL 의 같은 처방은 그대로다(회귀 방지)', () => {
    expect(code(WORKER)).toMatch(/stayFirst \|\| \(stayNoscriptFromPayload\(ssrPayload\) \+ urdealLoaderHtml\)/)
  })

  it('`/products/:id` 는 catch-all 의 `buildStaticSurfaceNoscript` 가 받는다 — 새 분기를 만들지 않았다', () => {
    const c = code(WORKER)
    expect(c).toMatch(/buildStaticSurfaceNoscript\(url\.pathname, crawlerPayload\)/)
    // 워커 파일은 래칫(2672)에 꽉 차 있다 — PRODUCT 전용 `#root` 분기를 새로 만들면 넘친다.
    expect(c).not.toMatch(/ssrSlot === 'PRODUCT'[^\n]*#root/)
    expect(read(WORKER).trimEnd().split('\n').length).toBeLessThanOrEqual(2672)
  })
})

describe('④ sitemap — 핀 기준이 API 와 **같은 술어**인가 (실제 SQLite 로 판정)', () => {
  /** sitemap 의 쿼리를 소스에서 떼어 와 템플릿만 치환해 **그대로 돌린다**(베끼면 갈린다). */
  function sqlFrom(marker: string): string {
    const c = read(SITEMAP)
    const i = c.indexOf(marker)
    expect(i, `쿼리를 못 찾았다: ${marker}`).toBeGreaterThan(0)
    // 🩸 마커는 템플릿 **안**에 있다 — `indexOf` 로 열린 백틱을 찾으면 **닫는** 백틱을 집고
    //    다음 리터럴까지 섞여 SQL 이 깨진다(실제로 `near ")"` 로 터졌다). 뒤로 찾는다.
    const open = c.lastIndexOf('`', i)
    const close = c.indexOf('`', i)
    return c.slice(open + 1, close)
      .replace(/\$\{sellerScope\}/g, '')
      .replace(/\$\{consumerVisibleProductSql\('pq'\)\}/g, consumerVisibleProductSql('pq'))
  }

  // ⚠️ `createRequire` 로 가져온 `DatabaseSync` 는 **값**이다 — 타입으로 쓰려면 InstanceType.
  function db(): InstanceType<typeof DatabaseSync> {
    const d = new DatabaseSync(':memory:')
    d.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, handle TEXT);
      CREATE TABLE sellers (id INTEGER PRIMARY KEY, username TEXT, status TEXT, linked_user_id INTEGER);
      CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, is_active INTEGER,
        is_supply_product INTEGER, supply_source_id INTEGER);
      CREATE TABLE product_pins (id INTEGER PRIMARY KEY, user_id INTEGER, product_id INTEGER);`)
    return d
  }

  it('보이는 핀 하나면 유어샵이 들어온다', () => {
    const d = db()
    d.exec(`INSERT INTO users VALUES (1,'ok');
      INSERT INTO products VALUES (10, NULL, 1, 0, NULL);
      INSERT INTO product_pins VALUES (1, 1, 10);`)
    const rows = d.prepare(sqlFrom('SELECT u.handle AS handle')).all() as Array<{ handle: string }>
    expect(rows.map(r => r.handle)).toEqual(['ok'])
  })

  it('핀 행은 있는데 상품이 **비활성**이면 뺀다', () => {
    const d = db()
    d.exec(`INSERT INTO users VALUES (1,'dead');
      INSERT INTO products VALUES (10, NULL, 0, 0, NULL);
      INSERT INTO product_pins VALUES (1, 1, 10);`)
    expect((d.prepare(sqlFrom('SELECT u.handle AS handle')).all() as unknown[])).toHaveLength(0)
  })

  it('핀 행은 있는데 **도매 원본**이면 뺀다 — `/u/jongmun` 이 그 경우였다', () => {
    const d = db()
    d.exec(`INSERT INTO users VALUES (1,'jongmun');
      INSERT INTO products VALUES (6, NULL, 1, 1, NULL);
      INSERT INTO product_pins VALUES (1, 1, 6);`)
    expect((d.prepare(sqlFrom('SELECT u.handle AS handle')).all() as unknown[])).toHaveLength(0)
  })

  it('판매사 **재판매 복제본**(supply_source_id 있음)은 보인다 — 반대 방향', () => {
    const d = db()
    d.exec(`INSERT INTO users VALUES (1,'resell');
      INSERT INTO products VALUES (7, NULL, 1, 1, 6);
      INSERT INTO product_pins VALUES (1, 1, 7);`)
    expect((d.prepare(sqlFrom('SELECT u.handle AS handle')).all() as Array<{ handle: string }>).map(r => r.handle))
      .toEqual(['resell'])
  })

  it('승인 셀러 블록도 같은 술어 — 상품 보유 매장은 그대로 들어온다(반대 방향)', () => {
    const d = db()
    d.exec(`INSERT INTO users VALUES (1,'h1');
      INSERT INTO sellers VALUES (5,'store_a','approved',1);
      INSERT INTO products VALUES (20, 5, 1, 0, NULL);`)
    const rows = d.prepare(sqlFrom('SELECT s.id AS id, s.username AS username')).all() as Array<{ username: string }>
    expect(rows).toHaveLength(1)
  })

  it('승인 셀러 블록: 핀이 **비활성 상품**뿐이고 자기 상품도 없으면 뺀다', () => {
    const d = db()
    d.exec(`INSERT INTO users VALUES (1,'h1');
      INSERT INTO sellers VALUES (5,'store_a','approved',1);
      INSERT INTO products VALUES (20, NULL, 0, 0, NULL);
      INSERT INTO product_pins VALUES (1, 1, 20);`)
    expect((d.prepare(sqlFrom('SELECT s.id AS id, s.username AS username')).all() as unknown[])).toHaveLength(0)
  })

  it('도매 원본 제외 술어가 **SSOT 함수**에서 온다 — 인라인 사본 0', () => {
    const c = code(SITEMAP)
    expect(c).not.toMatch(/NOT \(COALESCE\((?:p|products|pq)?\.?is_supply_product/)
    expect((c.match(/consumerVisibleProductSql\(/g) || []).length).toBeGreaterThanOrEqual(4)
  })
})
