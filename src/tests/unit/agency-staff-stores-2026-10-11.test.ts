/**
 * 👥 2026-10-11 에이전시 직원별 매장 배정 — "맡은 매장 전부" / "고른 매장만".
 *   실제 라우트 · 실제 JWT · 실제 SQLite(node:sqlite) 로 판정한다(문자열 검사는 배선 확인에만).
 *
 * ## 지키는 것
 * - 기본은 전부(이 기능 전과 같다) — 아무것도 안 고르면 직원은 맡은 매장 전부에 들어간다.
 * - 배정에서 빼면 **열어 둔 매장 화면도** 다음 요청부터 401 이다(좌석 발급만 막으면 이미 연 사람은 계속 쓴다).
 * - 관리자는 가릴 수 없고 · 남의 매장 id 는 배정할 수 없다(나중에 맡김이 생기면 열리는 길).
 * - 좌석 발급 · 매 요청 판정 · 목록이 **같은 조건**을 쓴다(두 벌이면 목록엔 안 보이는데 좌석은 열린다).
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - D1 과 node:sqlite 의 차이 · 다른 isolate 의 캐시(최대 15초 늦다).
 * - 화면이 보기 좋은지 — 그려서 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { stripComments } from '../helpers/source-text'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { agencyStoresRoutes } from '@/features/agency-console/api/agency-stores.routes'
import { agencyStaffRoutes } from '@/features/agency-console/api/agency-staff.routes'
import { parseStaffStoreBody } from '@/features/agency-console/api/agency-staff-stores'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-staff-stores-01'

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
 * 에이전시 1(관리자 5 · 직원 6) 이 매장 7·8 을 운영 중 · 에이전시 2(관리자 9) 는 매장 10 을 운영 중.
 * 매장 11 은 아무에게도 안 맡겼다.
 */
async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT, name TEXT,
    username TEXT, email TEXT, status TEXT, seller_type TEXT, is_distributor INTEGER, address TEXT)`)
  db.exec(`INSERT INTO sellers (id, business_name, status) VALUES
    (7, '직접카페', 'approved'), (8, '옛날분식', 'approved'), (10, '남의가게', 'approved'), (11, '혼자가게', 'approved')`)
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active'), (2, '남의대행', 'active')`)
  db.exec(`INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES
    (5, 1, 'boss@ag.kr', 'admin', 1, 'active'), (6, 1, 'staff@ag.kr', 'staff', 0, 'active'), (9, 2, 'other@ag.kr', 'admin', 1, 'active')`)
  db.exec(`INSERT INTO agency_store_links (agency_id, seller_id, status, accepted_at) VALUES
    (1, 7, 'active', datetime('now')), (1, 8, 'active', datetime('now')), (2, 10, 'active', datetime('now'))`)
  return { db, DB }
}

const tok = async (id: number, agency: number) => (await issueAgencyStaffToken(SECRET, { id, agency_id: agency })).token

function app(DB: D1Database) {
  const a = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  a.route('/api/agency-console', agencyStoresRoutes)
  a.route('/api/agency-console', agencyStaffRoutes)
  return (method: string, path: string, token: string, body?: unknown) =>
    a.request(`/api/agency-console${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, { DB, JWT_SECRET: SECRET })
}

function guard(DB: D1Database) {
  const a = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  a.use('/api/*', storeSeatGuard())
  // 🤝 2026-10-24 — 에이전시 좌석은 기본 차단이라 매장 전체 주문(`/orders`)은 403 이다. 좌석 생사 탐침은 열린 길로.
  a.get('/api/seller/products', (c) => c.json({ ok: true }))
  return (seat: string) => a.request('/api/seller/products', { headers: { Authorization: `Bearer ${seat}` } }, { DB, JWT_SECRET: SECRET })
}

const storeIds = async (r: Response) => ((await r.json()) as { stores: Array<{ sellerId: number }> }).stores.map((s) => s.sellerId).sort()
const seatOf = async (r: Response) => ((await r.json()) as { data: { seller_token: string } }).data.seller_token

describe('① 기본은 전부 — 이 기능 전과 같다', () => {
  it('아무것도 안 고르면 직원은 맡은 매장 둘 다 보고 둘 다 들어간다', async () => {
    const { DB } = await fresh()
    const call = app(DB)
    const t6 = await tok(6, 1)
    expect(await storeIds(await call('GET', '/stores', t6))).toEqual([7, 8])
    expect((await call('POST', '/stores/7/seat', t6)).status).toBe(200)
    expect((await call('POST', '/stores/8/seat', t6)).status).toBe(200)
    const staff = await (await call('GET', '/staff', t6)).json() as { staff: Array<{ id: number; storeScope: string }> }
    expect(staff.staff.find((s) => s.id === 6)?.storeScope).toBe('all')
  })
})

describe('② 고른 매장만', () => {
  it('매장 7 만 배정하면 목록·좌석 둘 다 7 만 · 8 은 STORE_NOT_ASSIGNED', async () => {
    const { DB } = await fresh()
    const call = app(DB)
    const put = await call('PUT', '/staff/6/stores', await tok(5, 1), { scope: 'assigned', sellerIds: [7] })
    expect(put.status).toBe(200)
    const t6 = await tok(6, 1)
    expect(await storeIds(await call('GET', '/stores', t6))).toEqual([7])
    expect((await call('POST', '/stores/7/seat', t6)).status).toBe(200)
    const denied = await call('POST', '/stores/8/seat', t6)
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as { code: string }).code).toBe('STORE_NOT_ASSIGNED')
    const staff = await (await call('GET', '/staff', t6)).json() as { staff: Array<{ id: number; storeScope: string; assignedCount: number }> }
    expect(staff.staff.find((s) => s.id === 6)).toMatchObject({ storeScope: 'assigned', assignedCount: 1 })
  })

  it('🔐 이미 열어 둔 매장 화면도 배정에서 빼는 순간 다음 요청부터 401', async () => {
    const { DB } = await fresh()
    const call = app(DB)
    const seat8 = await seatOf(await call('POST', '/stores/8/seat', await tok(6, 1)))
    const g = guard(DB)
    expect((await g(seat8)).status).toBe(200)
    expect((await call('PUT', '/staff/6/stores', await tok(5, 1), { scope: 'assigned', sellerIds: [7] })).status).toBe(200)
    expect((await g(seat8)).status, '배정에서 뺀 매장').toBe(401)
    // 다시 전부로 돌리면 같은 좌석이 다시 산다(맡김·직원은 그대로라 끊긴 게 아니다).
    expect((await call('PUT', '/staff/6/stores', await tok(5, 1), { scope: 'all' })).status).toBe(200)
    expect((await g(seat8)).status).toBe(200)
  })

  it('전부로 돌리면 배정 행도 지운다(다시 고른 매장만으로 갈 때 옛 배정이 살아나지 않게)', async () => {
    const { db, DB } = await fresh()
    const call = app(DB)
    await call('PUT', '/staff/6/stores', await tok(5, 1), { scope: 'assigned', sellerIds: [7, 8] })
    await call('PUT', '/staff/6/stores', await tok(5, 1), { scope: 'all' })
    expect((db.prepare('SELECT COUNT(*) n FROM agency_staff_stores WHERE staff_id = 6').get() as { n: number }).n).toBe(0)
  })
})

describe('③ 막아야 하는 것', () => {
  it('관리자에겐 배정을 걸 수 없고 · 관리자는 언제나 전부다', async () => {
    const { db, DB } = await fresh()
    const call = app(DB)
    expect((await call('PUT', '/staff/5/stores', await tok(5, 1), { scope: 'assigned', sellerIds: [7] })).status).toBe(400)
    // 누가 DB 를 손으로 고쳐 놔도 관리자는 가려지지 않는다(조건이 role 을 먼저 본다).
    db.exec("UPDATE agency_staff SET store_scope = 'assigned' WHERE id = 5")
    expect(await storeIds(await call('GET', '/stores', await tok(5, 1)))).toEqual([7, 8])
    expect((await call('POST', '/stores/8/seat', await tok(5, 1))).status).toBe(200)
  })

  it('🔐 우리가 운영하지 않는 매장(남의 에이전시 것·아무도 안 맡은 것)은 배정할 수 없고 아무것도 안 쓴다', async () => {
    const { db, DB } = await fresh()
    const call = app(DB)
    for (const id of [10, 11]) {
      const r = await call('PUT', '/staff/6/stores', await tok(5, 1), { scope: 'assigned', sellerIds: [7, id] })
      expect(r.status, `매장 ${id}`).toBe(400)
    }
    expect((db.prepare('SELECT COUNT(*) n FROM agency_staff_stores').get() as { n: number }).n).toBe(0)
    expect((db.prepare('SELECT store_scope FROM agency_staff WHERE id = 6').get() as { store_scope: string | null }).store_scope).toBeNull()
  })

  it('직원은 배정을 못 바꾸고 · 남의 에이전시 관리자는 우리 직원을 못 건드린다', async () => {
    const { DB } = await fresh()
    const call = app(DB)
    expect((await call('PUT', '/staff/6/stores', await tok(6, 1), { scope: 'assigned', sellerIds: [7] })).status).toBe(403)
    expect((await call('GET', '/staff/6/stores', await tok(6, 1))).status).toBe(403)
    expect((await call('PUT', '/staff/6/stores', await tok(9, 2), { scope: 'all' })).status).toBe(404)
    expect((await call('GET', '/staff/6/stores', await tok(9, 2))).status).toBe(404)
  })

  it('본문 검사 — 고른 매장만인데 비었으면 거절 · 같은 id 는 한 번 · 이상한 값은 버린다', () => {
    expect(parseStaffStoreBody({ scope: 'assigned', sellerIds: [] })).toHaveProperty('error')
    expect(parseStaffStoreBody({ scope: 'assigned' })).toHaveProperty('error')
    expect(parseStaffStoreBody({ scope: 'nope' })).toHaveProperty('error')
    expect(parseStaffStoreBody(null)).toHaveProperty('error')
    expect(parseStaffStoreBody({ scope: 'assigned', sellerIds: [7, '7', 7.5, -1, 8] })).toEqual({ scope: 'assigned', sellerIds: [7, 8] })
    expect(parseStaffStoreBody({ scope: 'all', sellerIds: [7] })).toEqual({ scope: 'all', sellerIds: [] })
  })
})

describe('④ 배선 — 세 곳이 같은 조건을 쓴다', () => {
  const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('매 요청 판정 · 좌석 발급 · 목록이 staffStoreAccessSql 을 부른다', () => {
    expect(read('src/worker/utils/store-seat-guard.ts')).toMatch(/\$\{staffStoreAccessSql\('s', 'l\.seller_id'\)\}/)
    const stores = read('src/features/agency-console/api/agency-stores.routes.ts')
    expect(stores).toMatch(/\$\{staffStoreAccessSql\('me', 'l\.seller_id'\)\}/)
    expect(stores).toMatch(/code: 'STORE_NOT_ASSIGNED'/)
    expect(stores).toMatch(/registerStaffStoreRoutes\(agencyStoresRoutes\)/)
  })
  it('배정을 바꾸면 좌석 캐시를 비운다(같은 isolate 즉시)', () => {
    const src = read('src/features/agency-console/api/agency-staff-stores.ts')
    expect(src).toMatch(/invalidateStoreSeatCache\(DB\)/)
  })
})
