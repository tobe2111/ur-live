/**
 * 🤝 에이전시 몫 — 1단계: 정하고 계산해서 보여 주기만 (2026-10-24 대표 *"응 해줘"*)
 *
 * 지키는 것 (실제 SQLite 로 숫자를 잰다):
 *   ① 몫 = 맡은 기간 안의 **환불 안 된** 판매 × **판매 시각의 %**. 사장님 직접 판매에는 안 붙는다
 *   ② % 를 바꾸면 그 뒤 판매부터 — 지난 판매 금액이 바뀌지 않는다(이력)
 *   ③ 사장님 성과표와 에이전시 판매 내역이 **같은 숫자**를 낸다
 *   ④ 정하는 API — 사장님만 · 함께하는 에이전시만(409) · 0~90 밖은 400 · 같은 값은 기록 안 함
 *   ⑤ 에이전시 좌석은 % 를 못 바꾼다(기본 차단)
 *   ⑥ 돈은 안 움직인다 — 원장·정산·결제 테이블에 쓰지 않는다
 *
 * 못 보는 것: 라이브 화면(E4) · 매장이 실제로 돈을 보냈는지(그건 둘 사이의 거래라 유어딜이 모른다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { Hono } from 'hono'
import { readCode } from '../helpers/source-text'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { storeChannelPerformance, agencyStoreSales } from '@/features/agency-console/api/channel-sales'
import { validateSharePct, setAgencyShare, AGENCY_SHARE_PCT_MAX } from '@/features/agency-console/api/agency-share'
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

/** 매장 7. 에이전시 1 이 이용권 31 을 2026-02-01 부터 맡는다. 에이전시 2 는 함께하지만 맡은 이용권 없음. 3 은 끊김. */
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
    INSERT INTO sellers VALUES (7, '직접카페', NULL, 'approved');
    INSERT INTO products (id, seller_id, name, price) VALUES (30, 7, '아메리카노', 5000), (31, 7, '라떼', 10000);`)
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active'), (2, '남의대행', 'active'), (3, '끊긴대행', 'active');
    INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (1, 7, 'active'), (2, 7, 'pending'), (3, 7, 'ended');
    INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES (31, 7, 1, '2026-02-01 00:00:00');`)
  return { db, DB }
}

let oid = 0
let vid = 0
function sell(db: Db, productId: number, at: string, opts: { status?: string; price?: number } = {}) {
  const id = ++oid
  db.prepare('INSERT INTO orders (id, seller_id, status, created_at) VALUES (?, 7, ?, ?)').run(id, 'PAID', at)
  db.prepare('INSERT INTO vouchers (id, order_id, product_id, user_id, code, status, applied_price, is_experience) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
    .run(++vid, id, productId, 'buyer', `S${vid}`, opts.status ?? 'unused', opts.price ?? 10000)
}
function setTerm(db: Db, agencyId: number, pct: number, from: string) {
  db.prepare('INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from) VALUES (7, ?, ?, ?)').run(agencyId, pct, from)
}
const agencyRow = async (DB: D1Database, id: number) =>
  (await storeChannelPerformance(DB, 7, 'all')).rows.find((r) => r.agencyId === id)

describe('① 몫 = 맡은 기간 · 환불 제외 · 판매 시각의 %', () => {
  it('10% 로 정하면 맡은 기간의 환불 안 된 판매에만 붙는다', async () => {
    const { db, DB } = await fresh()
    setTerm(db, 1, 10, '2026-01-01 00:00:00')
    sell(db, 31, '2026-01-15 00:00:00') // 맡기 전 — 사장님 판매
    sell(db, 31, '2026-02-10 00:00:00') // 맡은 뒤
    sell(db, 31, '2026-02-11 00:00:00', { price: 8000 })
    sell(db, 31, '2026-02-12 00:00:00', { status: 'refunded' }) // 환불
    sell(db, 30, '2026-02-12 00:00:00') // 맡지 않은 이용권
    const r = await agencyRow(DB, 1)
    expect(r).toMatchObject({ sharePct: 10, shareAmount: 1800 })
    const owner = (await storeChannelPerformance(DB, 7, 'all')).rows.find((x) => x.kind === 'owner')
    expect(owner).toMatchObject({ sharePct: null, shareAmount: 0 })
  })
  it('정한 적 없으면 몫 미정(null) · 0원 — 0% 와 구분한다', async () => {
    const { db, DB } = await fresh()
    sell(db, 31, '2026-02-10 00:00:00')
    expect(await agencyRow(DB, 1)).toMatchObject({ sharePct: null, shareAmount: 0 })
    setTerm(db, 1, 0, '2026-01-01 00:00:00')
    expect(await agencyRow(DB, 1)).toMatchObject({ sharePct: 0, shareAmount: 0 })
  })
})

describe('② % 를 바꾸면 그 뒤 판매부터', () => {
  it('2월엔 10%, 3월부터 20% — 2월 판매 금액은 그대로', async () => {
    const { db, DB } = await fresh()
    setTerm(db, 1, 10, '2026-01-01 00:00:00')
    sell(db, 31, '2026-02-10 00:00:00')
    expect((await agencyRow(DB, 1))?.shareAmount).toBe(1000)
    setTerm(db, 1, 20, '2026-03-01 00:00:00')
    sell(db, 31, '2026-03-10 00:00:00')
    expect(await agencyRow(DB, 1)).toMatchObject({ sharePct: 20, shareAmount: 3000 }) // 1000 + 2000
  })
  it('같은 시각에 두 번 정하면 나중 기록(id 큰 쪽)이 이긴다', async () => {
    const { db, DB } = await fresh()
    setTerm(db, 1, 10, '2026-01-01 00:00:00')
    setTerm(db, 1, 15, '2026-01-01 00:00:00')
    sell(db, 31, '2026-02-10 00:00:00')
    expect(await agencyRow(DB, 1)).toMatchObject({ sharePct: 15, shareAmount: 1500 })
  })
})

describe('③ 사장님 성과표 = 에이전시 판매 내역', () => {
  it('같은 숫자를 낸다', async () => {
    const { db, DB } = await fresh()
    setTerm(db, 1, 12.5, '2026-01-01 00:00:00')
    sell(db, 31, '2026-02-10 00:00:00')
    sell(db, 31, '2026-02-11 00:00:00', { price: 7000 })
    const s = await agencyStoreSales(DB, 7, 1, 'all')
    expect(s.share).toEqual({ pct: 12.5, amount: 2125 })
    expect((await agencyRow(DB, 1))?.shareAmount).toBe(2125)
  })
})

describe('④ 정하는 API (사장님)', () => {
  it('검증 — 0~90 · 소수 한 자리 · 빈 값 거절', () => {
    expect(validateSharePct('10')).toEqual({ ok: true, pct: 10 })
    expect(validateSharePct(12.34)).toEqual({ ok: true, pct: 12.3 })
    expect(validateSharePct(0)).toEqual({ ok: true, pct: 0 })
    expect(validateSharePct(AGENCY_SHARE_PCT_MAX)).toEqual({ ok: true, pct: 90 })
    for (const bad of ['', '  ', 'abc', -1, 90.5, 100, null, undefined, false, true, [], {}]) expect(validateSharePct(bad).ok).toBe(false)
  })
  const app = (DB: D1Database) => {
    const h = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
    registerAgencyLinkRoutes(h as never, async () => ({ userId: 100, sellerId: 7 }))
    return (m: string, p: string, body?: unknown) =>
      h.request(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, { DB, JWT_SECRET: 'x' })
  }
  it('정하면 기록이 쌓이고 목록에 % 가 보인다 · 같은 값은 기록하지 않는다', async () => {
    const { db, DB } = await fresh()
    const call = app(DB)
    const r1 = await call('POST', '/agency-link/share', { agency_id: 1, pct: 15 })
    expect(r1.status).toBe(200)
    expect(await r1.json()).toMatchObject({ success: true, changed: true, data: { agencyId: 1, pct: 15 } })
    expect(await (await call('POST', '/agency-link/share', { agency_id: 1, pct: 15 })).json()).toMatchObject({ changed: false })
    expect(db.prepare('SELECT COUNT(*) AS n FROM agency_share_terms').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT set_by_user_id AS u FROM agency_share_terms').get()).toEqual({ u: 100 })
    // 수락 기다리는 에이전시에도 미리 정할 수 있다
    expect((await call('POST', '/agency-link/share', { agency_id: 2, pct: 5 })).status).toBe(200)
    const links = (await (await call('GET', '/agency-link')).json() as { data: { links: Array<{ agencyId: number; sharePct: number | null }> } }).data.links
    expect(links.find((l) => l.agencyId === 1)?.sharePct).toBe(15)
    expect(links.find((l) => l.agencyId === 2)?.sharePct).toBe(5)
  })
  it('🔴 끊긴·모르는 에이전시 409 · 엉뚱한 값 400', async () => {
    const { db, DB } = await fresh()
    const call = app(DB)
    expect((await call('POST', '/agency-link/share', { agency_id: 3, pct: 10 })).status).toBe(409)
    expect((await call('POST', '/agency-link/share', { agency_id: 99, pct: 10 })).status).toBe(409)
    expect((await call('POST', '/agency-link/share', { agency_id: 'x', pct: 10 })).status).toBe(400)
    expect((await call('POST', '/agency-link/share', { agency_id: 1, pct: 91 })).status).toBe(400)
    expect((await call('POST', '/agency-link/share', { agency_id: 1 })).status).toBe(400)
    expect(db.prepare('SELECT COUNT(*) AS n FROM agency_share_terms').get()).toEqual({ n: 0 })
  })
  it('setAgencyShare — 값이 같으면 false, 다르면 true', async () => {
    const { DB } = await fresh()
    expect(await setAgencyShare(DB, 7, 1, 10, 1)).toBe(true)
    expect(await setAgencyShare(DB, 7, 1, 10, 1)).toBe(false)
    expect(await setAgencyShare(DB, 7, 1, 11, 1)).toBe(true)
  })
})

describe('⑤ 에이전시 좌석은 몫을 못 바꾼다', () => {
  it('기본 차단 + 사장님 판정 먼저', () => {
    expect(agencyScopeDecision('POST', '/api/seller/agency-link/share')).toEqual({ allow: false })
    const src = readCode('src/features/seller/api/seller-agency-performance.routes.ts')
    const route = src.slice(src.indexOf("app.post('/agency-link/share'"))
    expect(route).toMatch(/^[^\n]*\n\s*try \{\n\s*const g = await requireOwner\(c\)\n\s*if \(g instanceof Response\) return g/)
  })
})

describe('⑥ 돈은 안 움직인다', () => {
  it('몫 모듈·라우트가 원장·정산·결제 테이블에 쓰지 않는다', () => {
    const code = readCode('src/features/agency-console/api/agency-share.ts') + readCode('src/features/seller/api/seller-agency-performance.routes.ts')
    expect(code).not.toMatch(/ledger_entries|payouts|settlement|point_transactions|adjustUserPoints/i)
    expect(code).toMatch(/INSERT INTO agency_share_terms/)
  })
  it('화면이 "유어딜은 계산만, 돈은 매장이 직접" 을 말한다', () => {
    expect(readCode('src/pages/seller-operators/AgencyShareEditor.tsx')).toContain('돈은 매장이 에이전시에 직접 보내고')
    expect(readCode('src/pages/seller-analytics/StoreChannelPerformance.tsx')).toMatch(/shareNote', \{ defaultValue: AGENCY_SHARE_NOTE \}/)
    expect(readCode('src/pages/agency-console/AgencySalesSheet.tsx')).toContain('돈은 매장이 직접 보내고')
  })
})
