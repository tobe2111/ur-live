/**
 * 🧩 홈페이지 삽입 위젯 (2026-10-31 대표 *"HTML 임베드를 여러개 만들어줘"*) — 진짜 SQLite 위에서 라우트를 돌려 판정한다.
 *
 * 지키는 것:
 *   ① 경로가 `/embed/` 아래다 — iframe 허용은 보안 헤더의 그 분기 하나뿐이라, 밖으로 나가면 남의 사이트에서 안 뜬다
 *   ② 소비자 피드와 같은 노출 조건 — 미승인 매장·도매 원본·판매 중지·교환권 아닌 쇼핑 상품은 안 보인다
 *   ③ 유어샵 핀은 서버 리다이렉트로 — 소개 값(?aff=)이 공유 링크와 똑같이 잡힌다
 *   ④ 에이전시는 맡김(active) 매장만, 그리고 **다른 에이전시가 맡은 이용권은 빼고**
 *   ⑤ 지역은 주소 SSOT(`addressInRegion`) — 서울 중구에 대구 중구가 섞이지 않는다
 *   ⑥ 위젯 문서에 스크립트 0 — CSP nonce 를 알 수 없어서 넣어도 막힌다(안 되는 것을 되는 척 금지)
 *   ⑦ 값은 HTML 탈출 — 상호·상품명이 남의 사이트 iframe 안에서 마크업으로 해석되지 않게
 *
 * ⚠️ 못 보는 것: 실제 브라우저에서 iframe 이 뜨는지(보안 헤더 분기는 워커 미들웨어라 이 시험 밖 — 소스로만 고정),
 *    카드가 예쁜지, 엣지 캐시 적중.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { Hono } from 'hono'
import { embedRoutes } from '@/worker/routes/embed.routes'
import { renderStrip, toEmbedCard, parseEmbedParams } from '@/worker/utils/embed-widget'
import { embedSrc, embedSnippet } from '@/worker/utils/embed-builder'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
    }
    return self
  }
  return { prepare: stmt } as unknown as D1Database
}

let app: Hono
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} }

beforeAll(() => {
  ;(globalThis as unknown as { caches: unknown }).caches = { default: { match: async () => undefined, put: async () => {} } }
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, handle TEXT, name TEXT);
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, name TEXT, username TEXT, status TEXT, linked_user_id INTEGER);
    CREATE TABLE seller_operators (seller_id INTEGER, user_id INTEGER, role TEXT, revoked_at TEXT);
    CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT);
    CREATE TABLE seller_influencer_deals (seller_id INTEGER, influencer_id TEXT, commission_pct REAL, status TEXT, ends_at TEXT, requires_content_proof INTEGER, proof_status TEXT);
    CREATE TABLE product_pins (id INTEGER PRIMARY KEY, user_id INTEGER, product_id INTEGER, position INTEGER, created_at TEXT DEFAULT '2026-10-01');
    CREATE TABLE agency_accounts (id INTEGER PRIMARY KEY, name TEXT, status TEXT);
    CREATE TABLE agency_store_links (agency_id INTEGER, seller_id INTEGER, status TEXT);
    CREATE TABLE agency_products (product_id INTEGER PRIMARY KEY, seller_id INTEGER, agency_id INTEGER);
    CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER, original_price INTEGER, discount_rate INTEGER,
      image_url TEXT, thumbnail TEXT, category TEXT, deal_only INTEGER, restaurant_name TEXT, restaurant_address TEXT,
      seller_id INTEGER, is_active INTEGER, group_buy_status TEXT, is_supply_product INTEGER, supply_source_id INTEGER,
      slug TEXT, sold_count INTEGER, created_at TEXT);
  `)
  db.exec(`
    INSERT INTO users VALUES (1,'jiwon1228','정지원'),(2,'nopins','빈손');
    INSERT INTO sellers VALUES (10,'달빛한스푼','moon','approved',NULL),(11,'대기중가게','wait','pending',NULL),
      (12,'정지원가게','jiwonshop','approved',1),(13,'대구가게','daegu','approved',NULL);
    INSERT INTO agency_accounts VALUES (5,'에이스 에이전시','active'),(6,'정지된 에이전시','suspended');
    INSERT INTO agency_store_links VALUES (5,10,'active'),(5,11,'active'),(5,13,'ended');
    INSERT INTO agency_products VALUES (102,10,9);
    INSERT INTO products VALUES
      (101,'닭도리탕 <b>2인</b>',31000,35000,0,'https://media.ur-team.com/a.jpg',NULL,'meal_voucher',0,'달빛한스푼','서울 중구 명동길 1',10,1,'active',0,NULL,NULL,5,'2026-10-01'),
      (102,'다른 에이전시 담당',10000,12000,0,NULL,NULL,'meal_voucher',0,'달빛한스푼','서울 중구 명동길 1',10,1,'active',0,NULL,NULL,9,'2026-10-02'),
      (103,'미승인 매장 이용권',9000,10000,0,NULL,NULL,'meal_voucher',0,'대기중가게','서울 중구 1',11,1,'active',0,NULL,NULL,0,'2026-10-03'),
      (104,'판매 중지',9000,10000,0,NULL,NULL,'meal_voucher',0,'달빛한스푼','서울 중구 1',10,0,'active',0,NULL,NULL,0,'2026-10-04'),
      (105,'쇼핑 상품',9000,10000,0,NULL,NULL,'lifestyle',0,'달빛한스푼','서울 중구 1',10,1,'active',0,NULL,NULL,0,'2026-10-05'),
      (106,'도매 원본',9000,10000,0,NULL,NULL,'meal_voucher',0,'달빛한스푼','서울 중구 1',10,1,'active',1,NULL,NULL,0,'2026-10-06'),
      (107,'정지원가게 이용권',20000,25000,0,NULL,NULL,'beauty_voucher',0,'정지원가게','부산 해운대구 1',12,1,'active',0,NULL,NULL,1,'2026-10-07'),
      (108,'대구 중구 막창',15000,20000,0,NULL,NULL,'meal_voucher',0,'대구가게','대구 중구 동성로 1',13,1,'active',0,NULL,NULL,3,'2026-10-08');
    INSERT INTO product_pins (id,user_id,product_id,position) VALUES (1,1,101,1),(2,1,105,2),(3,1,103,3);
  `)
  app = new Hono()
  app.route('/', embedRoutes)
  ;(app as unknown as { _env: unknown })._env = { DB: d1(db) }
})

async function get(path: string): Promise<{ status: number; body: string; headers: Headers }> {
  const env = (app as unknown as { _env: unknown })._env
  const res = await app.request(`https://urdeal.kr${path}`, {}, env, ctx as never)
  return { status: res.status, body: await res.text(), headers: res.headers }
}

describe('① 경로·보안 헤더 분기', () => {
  it('보안 헤더가 /embed/ 만 iframe 을 연다 — 위젯은 그 아래 있어야 한다', () => {
    const idx = readFileSync('src/worker/index.ts', 'utf8')
    expect(idx).toMatch(/url\.pathname\.startsWith\('\/embed\/'\)[\s\S]{0,200}frame-ancestors \*/)
    expect(idx).toMatch(/app\.route\('\/', embedRoutes\)/)
    const src = readFileSync('src/worker/routes/embed.routes.ts', 'utf8')
    const paths = [...src.matchAll(/embedRoutes\.get\('([^']+)'/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThanOrEqual(6)
    for (const p of paths) expect(p === '/embed' || p.startsWith('/embed/')).toBe(true)
  })
  it('robots 가 /embed/ 를 막고 응답이 noindex', async () => {
    expect(readFileSync('public/robots.txt', 'utf8')).toMatch(/^Disallow: \/embed\/$/m)
    const r = await get('/embed/store/moon')
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(r.body).toContain('name="robots" content="noindex"')
  })
})

describe('② 매장 위젯 — 소비자 노출 조건', () => {
  it('판매 중 이용권만 보이고 쇼핑·도매원본·중지 상품은 안 보인다', async () => {
    const r = await get('/embed/store/moon')
    expect(r.status).toBe(200)
    expect(r.body).toContain('달빛한스푼 이용권')
    expect(r.body).toContain('닭도리탕')
    for (const no of ['쇼핑 상품', '도매 원본', '판매 중지']) expect(r.body).not.toContain(no)
  })
  it('미승인 매장·없는 매장은 404 안내', async () => {
    expect((await get('/embed/store/wait')).status).toBe(404)
    expect((await get('/embed/store/zzz')).status).toBe(404)
  })
})

describe('③ 유어샵 위젯', () => {
  it('핀은 서버 리다이렉트로(소개 값), 쇼핑 핀·미승인 매장 핀은 빠지고 내 가게 이용권이 뒤에 붙는다', async () => {
    const r = await get('/embed/u/jiwon1228')
    expect(r.status).toBe(200)
    expect(r.body).toContain('정지원님의 유어샵')
    expect(r.body).toContain('href="/api/curator/jiwon1228/p/101/redirect"')
    expect(r.body).not.toContain('쇼핑 상품')
    expect(r.body).not.toContain('미승인 매장 이용권')
    expect(r.body).toContain('정지원가게 이용권')
    expect(r.body.indexOf('닭도리탕')).toBeLessThan(r.body.indexOf('정지원가게 이용권'))
    expect(r.body).toContain('/pass/107?utm_source=embed&amp;utm_medium=ushop')
  })
  it('담은 게 없으면 빈 안내, 없는 핸들은 404', async () => {
    const r = await get('/embed/u/nopins')
    expect(r.status).toBe(200)
    expect(r.body).toContain('아직 담은 이용권이 없어요')
    expect((await get('/embed/u/nobodyhere')).status).toBe(404)
  })
})

describe('④ 에이전시 위젯', () => {
  it('맡김(active) 매장만 · 다른 에이전시 담당 이용권 제외 · 미승인 매장 제외', async () => {
    const r = await get('/embed/agency/5')
    expect(r.status).toBe(200)
    expect(r.body).toContain('에이스 에이전시')
    expect(r.body).toContain('닭도리탕')
    expect(r.body).not.toContain('다른 에이전시 담당')
    expect(r.body).not.toContain('미승인 매장 이용권')
    expect(r.body).not.toContain('대구 중구 막창') // 맡김이 끝난(ended) 매장
  })
  it('정지된 에이전시는 404', async () => {
    expect((await get('/embed/agency/6')).status).toBe(404)
    expect((await get('/embed/agency/abc')).status).toBe(404)
  })
})

describe('⑤ 지역 위젯', () => {
  it('서울 중구에 대구 중구가 섞이지 않는다', async () => {
    const r = await get('/embed/region/' + encodeURIComponent('서울') + '/' + encodeURIComponent('중구'))
    expect(r.status).toBe(200)
    expect(r.body).toContain('닭도리탕')
    expect(r.body).not.toContain('막창')
    const d = await get('/embed/region/' + encodeURIComponent('대구'))
    expect(d.body).toContain('막창')
    expect(d.body).not.toContain('닭도리탕')
  })
  it('모르는 시/도는 404', async () => {
    expect((await get('/embed/region/' + encodeURIComponent('아틀란티스'))).status).toBe(404)
  })
})

describe('이용권 하나 · 코드 만들기', () => {
  it('판매 중 이용권만 카드로', async () => {
    const r = await get('/embed/pass/101')
    expect(r.status).toBe(200)
    expect(r.body).toContain('구매하기')
    expect((await get('/embed/pass/105')).status).toBe(404) // 쇼핑 상품
  })
  it('코드 만들기 — 입력이 맞으면 미리보기·코드, 틀리면 안내', async () => {
    const ok = await get('/embed?type=agency&key=5&count=4')
    expect(ok.body).toContain('src="/embed/agency/5?count=4"')
    expect(ok.body).toContain('https://urdeal.kr/embed/agency/5?count=4')
    const bad = await get('/embed?type=agency&key=abc')
    expect(bad.body).toContain('형식이 맞지 않아요')
    expect(embedSrc('region', '서울/종로구', 8, 'light')).toBe('/embed/region/%EC%84%9C%EC%9A%B8/%EC%A2%85%EB%A1%9C%EA%B5%AC')
    expect(embedSnippet('pass', '/embed/pass/1')).toContain('height:172px')
  })
})

describe('⑥ 스크립트 0 · ⑦ 탈출', () => {
  it('위젯·빌더 문서에 <script> 와 인라인 이벤트가 없다', async () => {
    for (const p of ['/embed/store/moon', '/embed/u/jiwon1228', '/embed/pass/101', '/embed?type=ushop&key=jiwon1228']) {
      const { body } = await get(p)
      expect(body).not.toMatch(/<script/i)
      expect(body).not.toMatch(/\son[a-z]+=/i)
    }
  })
  it('상품명의 마크업이 탈출된다', async () => {
    const { body } = await get('/embed/store/moon')
    expect(body).toContain('<span class="nm">닭도리탕 &lt;b&gt;2인&lt;/b&gt;</span>')
    expect(body).not.toContain('<b>2인</b>')
    const html = renderStrip({ kind: 'store', theme: 'light', title: '"><x>', moreHref: '/', cards: [] })
    expect(html).not.toContain('"><x>')
  })
  it('파라미터는 범위로 잘린다', () => {
    expect(parseEmbedParams((k) => ({ count: '999', theme: 'evil' } as Record<string, string>)[k])).toEqual({ count: 12, theme: 'light' })
    expect(toEmbedCard({ id: 1, name: 'a', price: 9000, original_price: 10000, category: 'meal_voucher' }, 'pass').discount).toBe(10)
  })
})
