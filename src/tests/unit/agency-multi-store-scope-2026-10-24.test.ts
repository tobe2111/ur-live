/**
 * 🤝 2026-10-24 대표 확정 — **한 매장 · 여러 에이전시 · 성과는 이용권 단위로 철저히 분리**
 *   대표: *"사장님 직접 관리와 에이전시 관리가 동시에 되도록 말이야. 성과나 이런건 분리가 철저히 되고.
 *          한 매장이 여러 에이전시와 함께 할 수 있는거지."*
 *   그리고 골랐다: 성과 = **이용권 단위** · 에이전시는 **자기 것만** 본다 · 수수료는 지금대로(중개 5%).
 *
 * 실제 라우트 · 실제 JWT · 실제 SQLite(node:sqlite) 로 판정한다.
 *
 * ## 가장 중요한 하나 — 에이전시 좌석은 **기본이 차단**이다
 * 셀러 API 는 거의 전부 토큰의 seller_id 하나로 **매장 전체**를 연다. 하나라도 열려 있으면 같은 매장의 다른
 * 에이전시·사장님 매출이 보이고, 그 누락은 에러가 안 난다. 그래서 허용목록 밖은 403 이고, 이용권 하나를
 * 가리키는 요청은 그 이용권이 그 에이전시 것일 때만 통과한다(남의 것은 404).
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 셀러 Bearer 를 안 쓰는 경로(소비자 쿠키 · 에이전시 토큰)는 이 차단 밖이다 — 그쪽은 각자 쿼리에서 거른다
 *   (콘솔 숫자 `agency-store-today` 는 아래 ④ 가 잰다).
 * - D1 과 node:sqlite 의 차이 · 화면이 보기 좋은지.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { sign as jwtSign } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { agencyStoreToday, agencySummary } from '@/features/agency-console/api/agency-store-today'
import { registerAgencyLinkRoutes, AGENCY_LINKS_PER_STORE_MAX } from '@/features/seller/api/seller-agency-link.routes'
import { buildSellerProductsQuery } from '@/features/seller/api/seller-products-query'
import { scopedStoreIds } from '@/features/seller/api/seller-store-notifications'
import {
  agencyScopeDecision, agencySeatFromClaims, agencySeatOf, stampAgencyProduct, AGENCY_SCOPE_DENIED,
} from '@/worker/utils/agency-product-scope'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-multi-0123456'

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = db.prepare(sql).run(...(binds as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    }
    return self
  }
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

/**
 * 매장 7(주인 100). 에이전시 1(직원 6) · 에이전시 2(직원 9) 둘 다 매장 7 을 운영 중.
 * 이용권: 30 = 사장님 · 31 = 에이전시 1 · 32 = 에이전시 2.
 */
async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT, name TEXT,
    username TEXT, email TEXT, status TEXT, seller_type TEXT, is_distributor INTEGER, address TEXT)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT, description TEXT, price INTEGER,
    stock INTEGER, stock_quantity INTEGER, thumbnail_url TEXT, image_url TEXT, status TEXT, is_active INTEGER DEFAULT 1,
    category TEXT, created_at TEXT, updated_at TEXT, original_price INTEGER, restaurant_name TEXT, restaurant_phone TEXT,
    store_owner_token TEXT, group_buy_current INTEGER, group_buy_status TEXT, is_supply_product INTEGER DEFAULT 0)`)
  db.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY, seller_id INTEGER, status TEXT, total_amount INTEGER, created_at TEXT, shipping_address TEXT)`)
  db.exec(`CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, quantity INTEGER, price INTEGER, subtotal INTEGER)`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, status) VALUES (7, 100, '직접카페', 'approved')`)
  db.exec(`INSERT INTO products (id, seller_id, name, price, category, created_at) VALUES
    (30, 7, '사장님 식사권', 10000, 'meal_voucher', '2026-10-01'), (31, 7, '대행1 식사권', 20000, 'meal_voucher', '2026-10-02'),
    (32, 7, '대행2 식사권', 30000, 'meal_voucher', '2026-10-03')`)
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active'), (2, '남의대행', 'active')`)
  db.exec(`INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES
    (5, 1, 'boss@ag.kr', 'admin', 1, 'active'), (6, 1, 'staff@ag.kr', 'staff', 0, 'active'), (9, 2, 'other@ag.kr', 'admin', 1, 'active')`)
  db.exec(`INSERT INTO agency_store_links (agency_id, seller_id, status, accepted_at) VALUES (1, 7, 'active', datetime('now')), (2, 7, 'active', datetime('now'))`)
  db.exec(`INSERT INTO agency_products (product_id, seller_id, agency_id) VALUES (31, 7, 1), (32, 7, 2)`)
  // 📊 맡은 기간(판매 귀속의 근거) — 지금 맡음과 늘 짝이다.
  db.exec(`INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES (31, 7, 1, '2026-01-01 00:00:00'), (32, 7, 2, '2026-01-01 00:00:00')`)
  return { db, DB }
}

const now = () => Math.floor(Date.now() / 1000) - 5
const agencySeat = (staff: number, agency: number) =>
  jwtSign({ type: 'seller', seller_id: 7, sub: '7', store_role: 'operator', agency_staff_id: staff, agency_id: agency, iat: now(), exp: now() + 3600 }, SECRET)
const ownerSeat = () =>
  jwtSign({ type: 'seller', seller_id: 7, sub: '7', seat_user_id: 100, store_role: 'owner', iat: now(), exp: now() + 3600 }, SECRET)

function guardApp(DB: D1Database) {
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  app.use('/api/*', storeSeatGuard())
  const ok = (c: { json: (v: unknown) => Response }) => c.json({ ok: true })
  app.get('/api/seller/orders', ok)
  app.get('/api/seller/settlements', ok)
  app.get('/api/seller/dashboard/stats', ok)
  app.get('/api/seller/voucher-draft', ok)
  app.get('/api/group-buy/seller-voucher-stats', ok)
  app.get('/api/seller/products', ok)
  app.post('/api/seller/products', ok)
  app.put('/api/seller/products/:id', ok)
  app.delete('/api/seller/products/:id', ok)
  app.post('/api/seller/products/:id/group-buy', ok)
  app.post('/api/seller/products/:id/copy-to/:to', ok)
  return (method: string, path: string, token: string) =>
    app.request(path, { method, headers: { Authorization: `Bearer ${token}` } }, { DB, JWT_SECRET: SECRET })
}

describe('① 에이전시 좌석은 기본 차단 — 매장 전체 API 는 403', () => {
  it.each([
    ['GET', '/api/seller/orders'], ['GET', '/api/seller/settlements'], ['GET', '/api/seller/dashboard/stats'],
    ['GET', '/api/seller/voucher-draft'], ['GET', '/api/group-buy/seller-voucher-stats'],
  ])('%s %s → 403 AGENCY_SCOPE', async (m, p) => {
    const { DB } = await fresh()
    const r = await guardApp(DB)(m, p, await agencySeat(6, 1))
    expect(r.status).toBe(403)
    expect(((await r.json()) as { code: string }).code).toBe(AGENCY_SCOPE_DENIED)
  })
  it('사장님 좌석은 그대로 다 열린다(이 차단은 에이전시 좌석에만)', async () => {
    const { DB } = await fresh()
    const call = guardApp(DB)
    for (const p of ['/api/seller/orders', '/api/seller/settlements', '/api/seller/dashboard/stats']) {
      expect((await call('GET', p, await ownerSeat())).status, p).toBe(200)
    }
  })
  it('🔴 판정은 서명된 claim — D1 이 흔들려도 차단은 그대로다', async () => {
    const broken = { prepare: () => { throw new Error('D1 down') } } as unknown as D1Database
    const r = await guardApp(broken)('GET', '/api/seller/orders', await agencySeat(6, 1))
    expect(r.status).toBe(403)
  })
})

describe('② 이용권 하나 — 그 에이전시 것일 때만', () => {
  it('자기 이용권은 고치고 지운다 · 남의 에이전시 것과 사장님 것은 404(있다는 사실도 안 알린다)', async () => {
    const { DB } = await fresh()
    const call = guardApp(DB)
    const a1 = await agencySeat(6, 1)
    expect((await call('PUT', '/api/seller/products/31', a1)).status).toBe(200)
    expect((await call('POST', '/api/seller/products/31/group-buy', a1)).status).toBe(200)
    expect((await call('DELETE', '/api/seller/products/31', a1)).status).toBe(200)
    expect((await call('PUT', '/api/seller/products/32', a1)).status, '에이전시 2 것').toBe(404)
    expect((await call('PUT', '/api/seller/products/30', a1)).status, '사장님 것').toBe(404)
    expect((await call('PUT', '/api/seller/products/31', await agencySeat(9, 2))).status, '에이전시 2 가 1 것을').toBe(404)
  })
  it('다른 매장으로 옮기기(copy-to)는 열지 않았다', async () => {
    const { DB } = await fresh()
    expect((await guardApp(DB)('POST', '/api/seller/products/31/copy-to/8', await agencySeat(6, 1))).status).toBe(403)
  })
  it('목록 · 등록은 열린다(라우트가 자기 몫으로 거르고 찍는다)', async () => {
    const { DB } = await fresh()
    const call = guardApp(DB)
    expect((await call('GET', '/api/seller/products', await agencySeat(6, 1))).status).toBe(200)
    expect((await call('POST', '/api/seller/products', await agencySeat(6, 1))).status).toBe(200)
  })
  it('허용목록 판정 — 순수 함수', () => {
    expect(agencyScopeDecision('GET', '/api/seller/products')).toEqual({ allow: true })
    expect(agencyScopeDecision('get', '/api/seller/products/')).toEqual({ allow: true })
    expect(agencyScopeDecision('PUT', '/api/seller/products/12')).toEqual({ allow: true, productId: 12 })
    expect(agencyScopeDecision('POST', '/api/seller/products/12')).toEqual({ allow: false })
    expect(agencyScopeDecision('GET', '/api/seller/products/12/booking-slots')).toEqual({ allow: true, productId: 12 })
    expect(agencyScopeDecision('GET', '/api/seller/orders')).toEqual({ allow: false })
    expect(agencyScopeDecision('GET', '/api/seller/products/abc')).toEqual({ allow: false })
  })
})

describe('③ 목록 · 등록 — 자기 이용권만 보이고, 만든 것은 자기 것이 된다', () => {
  it('목록과 count 가 같은 필터 — 에이전시 1 은 31 만, 사장님은 셋 다', async () => {
    const { db } = await fresh()
    const run = (agencyId: number | null) => {
      const q = buildSellerProductsQuery({ sellerId: 7, limit: 50, offset: 0, sort: 'ASC', agencyId })
      const rows = db.prepare(q.query).all(...(q.params as never[])) as Array<{ id: number }>
      const total = (db.prepare(q.countQuery).get(...(q.countParams as never[])) as { total: number }).total
      return { ids: rows.map((r) => r.id), total }
    }
    expect(run(1)).toEqual({ ids: [31], total: 1 })
    expect(run(2)).toEqual({ ids: [32], total: 1 })
    expect(run(null)).toEqual({ ids: [30, 31, 32], total: 3 })
  })
  it('라우트가 에이전시 좌석일 때만 agencyId 를 넘긴다', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf-8'))
    expect(src).toContain("const agencyId = (await agencySeatOf(c.req.header('Authorization'), c.env.JWT_SECRET))?.agencyId ?? null;")
    expect(src).toMatch(/sellerId, limit, offset, sort, search, includeDeleted, agencyId,/)
  })
  it('에이전시 좌석으로 만들면 그 에이전시가 찍힌다 · 사장님 좌석은 안 찍힌다(사장님 것)', async () => {
    const { db, DB } = await fresh()
    db.exec(`INSERT INTO products (id, seller_id, name, price) VALUES (40, 7, '새 이용권', 1000), (41, 7, '사장님 새 이용권', 1000)`)
    await stampAgencyProduct(DB, `Bearer ${await agencySeat(6, 1)}`, SECRET, 40, 7)
    await stampAgencyProduct(DB, `Bearer ${await ownerSeat()}`, SECRET, 41, 7)
    const rows = db.prepare('SELECT product_id, agency_id, created_by_staff_id FROM agency_products WHERE product_id >= 40').all()
    expect(rows).toEqual([{ product_id: 40, agency_id: 1, created_by_staff_id: 6 }])
  })
  it('찍기는 응답 전에 끝난다(바로 이어지는 이용권 설정이 404 가 되지 않게)', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf-8'))
    const stamp = src.indexOf('await stampAgencyProduct(db,')
    expect(stamp).toBeGreaterThan(0)
    expect(stamp).toBeLessThan(src.indexOf('return c.json({ success: true, data: newProduct }, 201);'))
  })
  it('claim 해석 — 에이전시 좌석만, 세 값이 다 있어야', async () => {
    expect(agencySeatFromClaims({ seller_id: 7, agency_staff_id: 6, agency_id: 1 })).toEqual({ sellerId: 7, agencyId: 1, staffId: 6 })
    expect(agencySeatFromClaims({ seller_id: 7, seat_user_id: 100 })).toBeNull()
    expect(agencySeatFromClaims({ seller_id: 7, agency_staff_id: 6 })).toBeNull()
    expect(await agencySeatOf(`Bearer ${await agencySeat(6, 1)}`, SECRET)).toEqual({ sellerId: 7, agencyId: 1, staffId: 6 })
    expect(await agencySeatOf(`Bearer ${await agencySeat(6, 1)}`, 'wrong-secret')).toBeNull()
  })
})

describe('④ 숫자 — 에이전시마다 자기 이용권 몫만', () => {
  it('한 주문에 남의 이용권이 섞여도 자기 줄의 금액만 센다 · 판매 중 개수도 자기 것만', async () => {
    const { db, DB } = await fresh()
    db.exec(`INSERT INTO orders (id, seller_id, status, total_amount, created_at) VALUES
      (1, 7, 'PAID', 60000, datetime('now')), (2, 7, 'PAID', 10000, datetime('now'))`)
    db.exec(`INSERT INTO order_items (order_id, product_id, quantity, price, subtotal) VALUES
      (1, 30, 1, 10000, 10000), (1, 31, 1, 20000, 20000), (1, 32, 1, 30000, 30000), (2, 30, 1, 10000, 10000)`)
    const a1 = (await agencyStoreToday(DB, [7], 1)).get(7)
    const a2 = (await agencyStoreToday(DB, [7], 2)).get(7)
    expect(a1).toMatchObject({ todayRevenue: 20000, todayOrders: 1, activeProducts: 1 })
    expect(a2).toMatchObject({ todayRevenue: 30000, todayOrders: 1, activeProducts: 1 })
    expect(await agencyStoreToday(DB, [7], 0)).toEqual(new Map()) // 에이전시를 모르면 아무것도 안 센다
  })
  it('🔴 매장 요약(/my-stores/summary)을 에이전시 좌석이 부르면 자기 몫만 — 매장 전체 숫자가 안 나간다', async () => {
    const { db, DB } = await fresh()
    db.exec(`INSERT INTO orders (id, seller_id, status, total_amount, created_at) VALUES (1, 7, 'PAID', 60000, datetime('now'))`)
    db.exec(`INSERT INTO order_items (order_id, product_id, quantity, price, subtotal) VALUES (1, 30, 1, 10000, 10000), (1, 31, 1, 20000, 20000), (1, 32, 1, 30000, 30000)`)
    const s = await agencySummary(DB, [{ seller_id: 7, business_name: '직접카페', status: 'approved', role: 'operator' }], 1, 7)
    expect(s.stores[0]).toMatchObject({ seller_id: 7, today_revenue: 20000, today_orders: 1, active_products: 1 })
    expect(s.totals.today_revenue).toBe(20000)
    const src = stripComments(readFileSync('src/features/seller/api/seller-operators.routes.ts', 'utf-8'))
    expect(src).toContain('if (scope.agencyId) return c.json({ success: true, data: await agencySummary(c.env.DB, stores, scope.agencyId, currentSellerId ?? null) })')
  })
  it('매장 알림함(사람 기준)도 에이전시 좌석에겐 비어 있다', () => {
    expect(scopedStoreIds({ userId: null, agencyId: 1, stores: [{ seller_id: 7, status: 'approved' }] })).toEqual([])
    expect(scopedStoreIds({ userId: 100, stores: [{ seller_id: 7, status: 'approved' }] })).toEqual([7])
  })
})

describe('⑤ 사장님 — 여러 에이전시를 함께 · 따로 끊는다', () => {
  function ownerApp(DB: D1Database) {
    const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
    registerAgencyLinkRoutes(app as never, async () => ({ userId: 100, sellerId: 7 }))
    return (method: string, path: string, body?: unknown) =>
      app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, { DB, JWT_SECRET: SECRET })
  }
  it('목록에 에이전시마다 상태와 맡은 이용권 수가 온다', async () => {
    const { DB } = await fresh()
    const j = await (await ownerApp(DB)('GET', '/agency-link')).json() as { data: { links: Array<{ agencyName: string; status: string; productCount: number }> } }
    expect(j.data.links.map((l) => [l.agencyName, l.status, l.productCount])).toEqual([['바른대행', 'active', 1], ['남의대행', 'active', 1]])
  })
  it('🔴 둘이 열려 있으면 어느 것을 끊는지 받아야 한다 · 하나만 끊으면 다른 하나는 산다', async () => {
    const { db, DB } = await fresh()
    const owner = ownerApp(DB)
    expect((await owner('POST', '/agency-link/end')).status).toBe(400)
    const links = (await (await owner('GET', '/agency-link')).json() as { data: { links: Array<{ linkId: number; agencyName: string }> } }).data.links
    const first = links.find((l) => l.agencyName === '바른대행')!
    expect((await owner('POST', '/agency-link/end', { link_id: first.linkId })).status).toBe(200)
    const open = db.prepare("SELECT agency_id FROM agency_store_links WHERE seller_id = 7 AND status = 'active'").all()
    expect(open).toEqual([{ agency_id: 2 }])
    // 끊긴 에이전시의 좌석은 다음 요청부터 401, 남은 에이전시는 그대로
    const call = guardApp(DB)
    expect((await call('GET', '/api/seller/products', await agencySeat(6, 1))).status).toBe(401)
    expect((await call('GET', '/api/seller/products', await agencySeat(9, 2))).status).toBe(200)
  })
  it('📊 끊으면 그 에이전시 이용권은 사장님께 돌아가고, 그동안의 맡은 기간은 성과 기록으로 남는다', async () => {
    const { db, DB } = await fresh()
    const owner = ownerApp(DB)
    const links = (await (await owner('GET', '/agency-link')).json() as { data: { links: Array<{ linkId: number; agencyName: string }> } }).data.links
    await owner('POST', '/agency-link/end', { link_id: links.find((l) => l.agencyName === '바른대행')!.linkId })
    expect(db.prepare('SELECT product_id FROM agency_products WHERE agency_id = 1').all()).toEqual([])
    expect(db.prepare('SELECT product_id FROM agency_products WHERE agency_id = 2').all()).toEqual([{ product_id: 32 }]) // 다른 에이전시는 그대로
    const p = db.prepare('SELECT agency_id, ended_at FROM agency_product_periods WHERE product_id = 31').all() as Array<{ agency_id: number; ended_at: string | null }>
    expect(p).toHaveLength(1)
    expect(p[0].agency_id).toBe(1)
    expect(p[0].ended_at).toBeTruthy()
  })
  it(`한 매장 에이전시 수 상한(${AGENCY_LINKS_PER_STORE_MAX})`, async () => {
    const { db, DB } = await fresh()
    for (let i = 3; i <= AGENCY_LINKS_PER_STORE_MAX; i++) {
      db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (${i}, '대행${i}', 'active')`)
      db.exec(`INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (${i}, 7, 'active')`)
    }
    db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (99, '하나 더', 'active')`)
    db.exec(`INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES (99, 99, 'more@ag.kr', 'admin', 1, 'active')`)
    const r = await ownerApp(DB)('POST', '/agency-link', { email: 'more@ag.kr' })
    expect(r.status).toBe(409)
    expect(((await r.json()) as { code: string }).code).toBe('TOO_MANY_AGENCIES')
  })
})
