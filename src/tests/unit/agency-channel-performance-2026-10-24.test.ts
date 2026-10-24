/**
 * 📊 누가 팔았나 · 이용권 맡기기 · 에이전시 판매 내역 (2026-10-24 대표 확정)
 *   대표: *"사장님 화면에서 에이전시 별 성과(인플루언서 혹은 고유링크별 성과)를 따로 보여줘야지. 이미 있는 이용권을
 *          특정 에이전시에도 배정하는 기능 필요해."* + 에이전시에게 '판매 내역·통계까지'.
 *
 * 지키는 것 (실제 SQLite 로 숫자를 잰다 — 문자열 검사 아님):
 *   ① 귀속 = **판 순간 맡고 있던 에이전시**. 맡기기 전 판매는 사장님, 옮긴 뒤 판매는 뒤 에이전시, 끊은 뒤에도 그동안의 성과는 남는다
 *   ② 장 단위 — 환불은 판매·매출에서 빠지고 환불 칸에, 0원 체험권은 아예 안 센다. '이번 달' 은 한국 시간 1일부터
 *   ③ 소개 링크 판매(유어샵) + 소개비 — 사장님/에이전시 줄과 별도(겹쳐 센다는 것을 화면이 말한다)
 *   ④ 맡기기 API — 이 매장 이용권만 · 운영 중 에이전시에만 · 옮겨도 기록이 쌓인다
 *   ⑤ 에이전시 판매 내역 — 우리 매장 · 우리 기간만, 손님 정보 없음
 *   ⑥ 에이전시 좌석은 사장님 성과·맡기기 API 를 못 부른다(기본 차단)
 *
 * 못 보는 것: 라이브 화면(E4) · 실제 결제로 생긴 이용권 행(여기선 손으로 넣는다).
 */
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { Hono } from 'hono'
import { readCode } from '../helpers/source-text'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import {
  periodSince, parsePeriod, storeChannelPerformance, agencyStoreSales, assignAgencyProduct, startAgencyProduct,
} from '@/features/agency-console/api/channel-sales'
import { registerAgencyLinkRoutes } from '@/features/seller/api/seller-agency-link.routes'
import { agencyScopeDecision } from '@/worker/utils/agency-product-scope'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => { const r = db.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } } },
    }
    return self
  }
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

/** 매장 7. 에이전시 1(운영 중) · 2(운영 중) · 3(요청만). 이용권 30·31·32. */
async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, name TEXT, status TEXT);
    CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT, price INTEGER, status TEXT, is_active INTEGER DEFAULT 1);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, seller_id INTEGER, status TEXT, created_at TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, user_id TEXT, code TEXT, status TEXT DEFAULT 'unused',
      applied_price INTEGER, is_experience INTEGER DEFAULT 0, used_at TEXT, created_at TEXT);
    CREATE TABLE ushop_sales (order_id INTEGER, product_id INTEGER, curator_user_id INTEGER, qty INTEGER, created_at TEXT, PRIMARY KEY (order_id, product_id));
    CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY, influencer_id TEXT, order_id INTEGER, voucher_id INTEGER, product_id INTEGER,
      seller_id INTEGER, commission_amount INTEGER, status TEXT, source TEXT, created_at TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, handle TEXT);
    INSERT INTO sellers VALUES (7, '직접카페', NULL, 'approved'), (8, '옆집', NULL, 'approved');
    INSERT INTO products (id, seller_id, name, price) VALUES (30, 7, '아메리카노', 5000), (31, 7, '라떼', 6000), (32, 7, '케이크', 8000), (90, 8, '옆집 이용권', 1000);
    INSERT INTO users VALUES (500, '지원', 'jiwon');`)
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active'), (2, '남의대행', 'active'), (3, '요청만', 'active');
    INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (1, 7, 'active'), (2, 7, 'active'), (3, 7, 'pending');`)
  return { db, DB }
}

let oid = 0
let vid = 0
/** 주문 하나에 이용권 n 장 — at = UTC 'YYYY-MM-DD HH:MM:SS'. */
function sell(db: Db, productId: number, at: string, n = 1, opts: { status?: string; price?: number; exp?: number } = {}) {
  const id = ++oid
  db.prepare('INSERT INTO orders (id, seller_id, status, created_at) VALUES (?, 7, ?, ?)').run(id, 'PAID', at)
  for (let i = 0; i < n; i++) {
    db.prepare('INSERT INTO vouchers (id, order_id, product_id, user_id, code, status, applied_price, is_experience) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(++vid, id, productId, 'buyer', `C${vid}`, opts.status ?? 'unused', opts.price ?? 1000, opts.exp ?? 0)
  }
  return id
}
const rowOf = (rows: Array<{ agencyId: number | null }>, id: number | null) => rows.find((r) => r.agencyId === id) as Record<string, number> | undefined

describe('① 귀속 = 판 순간 맡고 있던 에이전시', () => {
  it('맡기기 전 → 사장님 · 맡긴 뒤 → 에이전시 1 · 옮긴 뒤 → 에이전시 2 · 끊어도 2 의 성과는 남는다', async () => {
    const { db, DB } = await fresh()
    sell(db, 31, '2026-01-05 00:00:00') // 아무도 안 맡았을 때
    db.exec(`INSERT INTO agency_products (product_id, seller_id, agency_id, created_at) VALUES (31, 7, 1, '2026-02-01 00:00:00');
      INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES (31, 7, 1, '2026-02-01 00:00:00');`)
    sell(db, 31, '2026-02-05 00:00:00', 2)
    expect(await assignAgencyProduct(DB, 31, 7, 2)).toBe(true) // 지금(현재 시각)부터 에이전시 2
    expect(await assignAgencyProduct(DB, 31, 7, 2)).toBe(false) // 같은 곳이면 바뀌지 않는다
    // 판 순간은 과거여야 한다(끊는 시각 = 지금) — 옮긴 시각을 3월 1일로 고정해 둔다.
    db.exec(`UPDATE agency_product_periods SET ended_at = '2026-03-01 00:00:00' WHERE agency_id = 1;
      UPDATE agency_product_periods SET started_at = '2026-03-01 00:00:00' WHERE agency_id = 2;`)
    sell(db, 31, '2026-03-05 00:00:00', 3)
    let perf = await storeChannelPerformance(DB, 7, 'all')
    expect(rowOf(perf.rows, null)!.sold).toBe(1)
    expect(rowOf(perf.rows, 1)!.sold).toBe(2)
    expect(rowOf(perf.rows, 2)!.sold).toBe(3)
    // 에이전시 2 를 끊는다 → 이용권은 사장님께, 성과는 남는다.
    const { releaseAgencyProducts } = await import('@/features/agency-console/api/channel-sales')
    db.exec("UPDATE agency_store_links SET status = 'ended' WHERE agency_id = 2")
    await releaseAgencyProducts(DB, 7, 2)
    perf = await storeChannelPerformance(DB, 7, 'all')
    expect(rowOf(perf.rows, 2)).toMatchObject({ sold: 3, products: 0, linkStatus: 'ended' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM agency_products WHERE product_id = 31').get()).toEqual({ n: 0 })
  })
  it('요청만 하고 판 것이 없는 에이전시는 표에 "수락 기다리는 중" 으로 남고, 맡은 이용권 수는 사장님 줄에서 빠진다', async () => {
    const { DB } = await fresh()
    await startAgencyProduct(DB, 32, 7, 1, null)
    const perf = await storeChannelPerformance(DB, 7, 'all')
    expect(rowOf(perf.rows, null)!.products).toBe(2) // 30·31
    expect(rowOf(perf.rows, 1)!.products).toBe(1)
    expect(perf.rows.find((r) => r.agencyId === 3)?.linkStatus).toBe('pending')
  })
})

describe('② 장 단위 · 기간', () => {
  it('환불은 판매·매출에서 빠지고 환불 칸에 · 사용은 사용 칸에 · 0원 체험권은 안 센다', async () => {
    const { db, DB } = await fresh()
    const t = '2026-03-01 00:00:00'
    sell(db, 30, t, 1, { price: 4000 })
    sell(db, 30, t, 1, { status: 'used', price: 4000 })
    sell(db, 30, t, 1, { status: 'refunded', price: 4000 })
    sell(db, 30, t, 1, { exp: 1, price: 0 })
    const owner = rowOf((await storeChannelPerformance(DB, 7, 'all')).rows, null)!
    expect(owner).toMatchObject({ sold: 2, revenue: 8000, used: 1, refunded: 1 })
  })
  it("'이번 달' 은 한국 시간 1일 0시(= 전날 15시 UTC)부터", () => {
    expect(periodSince('month', new Date('2026-10-24T05:00:00Z'))).toBe('2026-09-30 15:00:00')
    // 한국은 이미 11월 1일 새벽 — 11월로 잡혀야 한다.
    expect(periodSince('month', new Date('2026-10-31T16:00:00Z'))).toBe('2026-10-31 15:00:00')
    expect(periodSince('all')).toBeNull()
    expect(parsePeriod('nonsense')).toBe('month')
  })
})

describe('③ 소개 링크로 판매', () => {
  it('유어샵을 거친 판매를 사람마다 세고, 소개비(환수 · 중개사 몫 제외)를 붙인다', async () => {
    const { db, DB } = await fresh()
    const o1 = sell(db, 30, '2026-03-02 00:00:00', 2, { price: 5000 })
    sell(db, 30, '2026-03-03 00:00:00', 1, { price: 5000 }) // 링크 없이
    db.prepare('INSERT INTO ushop_sales (order_id, product_id, curator_user_id, qty) VALUES (?, 30, 500, 2)').run(o1)
    db.exec(`INSERT INTO influencer_attributions (influencer_id, seller_id, commission_amount, status, source) VALUES
      ('500', 7, 500, 'pending', NULL), ('500', 7, 999, 'clawed_back', NULL), ('500', 7, 777, 'pending', 'broker_share')`)
    const r = (await storeChannelPerformance(DB, 7, 'all')).referrals
    expect(r).toEqual([expect.objectContaining({ userId: 500, name: '지원', handle: 'jiwon', sold: 2, revenue: 10000, commission: 500 })])
  })
})

describe('④ 맡기기 API (사장님)', () => {
  const app = (DB: D1Database) => {
    const h = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
    registerAgencyLinkRoutes(h as never, async () => ({ userId: 100, sellerId: 7 }))
    return (m: string, p: string, body?: unknown) =>
      h.request(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, { DB, JWT_SECRET: 'x' })
  }
  it('목록 → 맡기기 → 목록에 반영, 기간 기록이 열린다', async () => {
    const { db, DB } = await fresh()
    const call = app(DB)
    expect((await call('POST', '/agency-link/assign', { product_id: 30, agency_id: 1 })).status).toBe(200)
    const j = await (await call('GET', '/agency-link/products')).json() as { data: Array<{ id: number; agencyId: number | null }> }
    expect(j.data.find((p) => p.id === 30)?.agencyId).toBe(1)
    expect(db.prepare('SELECT agency_id FROM agency_product_periods WHERE product_id = 30 AND ended_at IS NULL').all()).toEqual([{ agency_id: 1 }])
    // 돌려받기
    expect((await call('POST', '/agency-link/assign', { product_id: 30, agency_id: null })).status).toBe(200)
    expect(db.prepare('SELECT COUNT(*) AS n FROM agency_product_periods WHERE product_id = 30 AND ended_at IS NULL').get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM agency_product_periods WHERE product_id = 30').get()).toEqual({ n: 1 }) // 기록은 남는다
  })
  it('🔴 다른 매장 이용권 404 · 수락 전 에이전시 409 · 엉뚱한 값 400', async () => {
    const { DB } = await fresh()
    const call = app(DB)
    expect((await call('POST', '/agency-link/assign', { product_id: 90, agency_id: 1 })).status).toBe(404)
    expect((await call('POST', '/agency-link/assign', { product_id: 30, agency_id: 3 })).status).toBe(409)
    expect((await call('POST', '/agency-link/assign', { product_id: 'x', agency_id: 1 })).status).toBe(400)
    expect((await call('POST', '/agency-link/assign', { product_id: 30, agency_id: -1 })).status).toBe(400)
  })
  it('성과 API 가 같은 집계를 돌려준다', async () => {
    const { db, DB } = await fresh()
    sell(db, 30, '2026-03-01 00:00:00')
    const j = await (await app(DB)('GET', '/agency-link/performance?period=all')).json() as { data: { rows: Array<{ kind: string; sold: number }> } }
    expect(j.data.rows[0]).toMatchObject({ kind: 'owner', sold: 1 })
  })
})

describe('⑤ 에이전시 판매 내역', () => {
  it('우리 기간의 우리 판매만 · 손님 정보와 이용권 코드는 없다', async () => {
    const { db, DB } = await fresh()
    db.exec(`INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES (31, 7, 1, '2026-02-01 00:00:00'), (32, 7, 2, '2026-02-01 00:00:00')`)
    sell(db, 31, '2026-01-15 00:00:00') // 맡기 전
    sell(db, 31, '2026-02-15 00:00:00', 2, { status: 'used' })
    sell(db, 32, '2026-02-15 00:00:00') // 남의 에이전시
    const s = await agencyStoreSales(DB, 7, 1, 'all')
    expect(s.summary).toMatchObject({ sold: 2, used: 2 })
    expect(s.items).toHaveLength(2)
    for (const it of s.items) {
      expect(Object.keys(it).sort()).toEqual(['id', 'price', 'productName', 'soldAt', 'status', 'usedAt'])
    }
  })
  it('🔴 라우트는 우리가 운영 중이고 배정된 매장만 연다', () => {
    const src = readCode('src/features/agency-console/api/agency-store-sales.ts')
    expect(src).toMatch(/l\.seller_id = \? AND l\.agency_id = \? AND l\.status = 'active' AND \$\{staffStoreAccessSql\('me', 'l\.seller_id'\)\}/)
    expect(src).toMatch(/if \(!ok\) return c\.json\(\{ success: false, error: '우리 에이전시가 맡은 매장이 아니에요\.' \}, 403\)/)
    expect(readCode('src/features/agency-console/api/agency-stores.routes.ts')).toContain('registerAgencySalesRoute(agencyStoresRoutes)')
  })
})

describe('⑥ 에이전시 좌석은 사장님 성과·맡기기를 못 부른다', () => {
  it('기본 차단에 걸린다', () => {
    for (const [m, p] of [['GET', '/api/seller/agency-link/performance'], ['GET', '/api/seller/agency-link/products'], ['POST', '/api/seller/agency-link/assign']]) {
      expect(agencyScopeDecision(m, p)).toEqual({ allow: false })
    }
  })
  it('네 라우트 모두 사장님 판정(requireOwner)을 먼저 한다(몫 정하기 포함)', () => {
    const src = readCode('src/features/seller/api/seller-agency-performance.routes.ts')
    expect(src.match(/const g = await requireOwner\(c\)\n\s*if \(g instanceof Response\) return g/g)?.length).toBe(4)
  })
  it('에이전시가 만든 이용권은 맡은 기간도 함께 연다(stamp → startAgencyProduct)', () => {
    expect(readCode('src/worker/utils/agency-product-scope.ts')).toMatch(/await startAgencyProduct\(DB, productId, seat\.sellerId, seat\.agencyId, seat\.staffId\)/)
  })
})

describe('화면 배선', () => {
  it('매출 분석 매출 탭에 누가 팔았나 카드 · 운영자 관리 에이전시 줄에 이용권 맡기기', () => {
    expect(readCode('src/pages/SellerAnalyticsPage.tsx')).toContain("{tab === 'revenue' && everSold && <StoreChannelPerformance />}")
    expect(readCode('src/pages/seller-operators/AgencyLinkCard.tsx')).toMatch(/<AgencyAssignList agencyId=\{link\.agencyId\}/)
  })
  it('🔴 사장님이 아니면(403) 카드를 그리지 않는다 — 0 으로 위장하지 않는다', () => {
    expect(readCode('src/pages/seller-analytics/StoreChannelPerformance.tsx')).toMatch(/if \(isError && !data\) \{\n\s*return null/)
  })
  it('에이전시 판에 판매 내역 · 판매 알림은 그 시트를 연다', () => {
    expect(readCode('src/pages/agency-console/AgencyStorePlate.tsx')).toContain('판매 내역 · 통계')
    expect(readCode('src/pages/agency-console/AgencyStoresPanel.tsx')).toMatch(/if \(n\.type === 'agency_sale'\) \{/)
  })
})

vi.setConfig({ testTimeout: 20_000 })
