/**
 * 🏢 2026-10-11 에이전시 2단계 — 매장을 에이전시에 맡기기 · 수락 · 운영 · 끊기.
 *   실제 라우트 · 실제 JWT · 실제 SQLite(node:sqlite) 로 판정한다(문자열 검사는 배선 확인에만).
 *
 * 대표 결정(`docs/decisions/2026-10-11-agency-model-email-only.md`):
 *   매장은 사람이 아니라 **에이전시**에 붙고 · 기간 없이 · 사장님이 언제든 끊는다.
 *
 * ## 가장 중요한 하나 — 에이전시 직원은 **절대** 사장님으로 되짚히지 않는다
 * 셀러 쪽엔 "토큰에 사람이 없으면 매장 주인(linked_user_id) 으로 본다" 는 폴백이 여러 곳에 있다.
 * 에이전시 좌석 토큰엔 소비자 사람이 없다 → 그 폴백을 타면 직원이 **주인으로 둔갑**해 정산 계좌를 바꾸고,
 * 주인의 소비자 세션까지 받는다. 그래서 그 폴백 전부를 여기서 실제로 두드린다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - D1 과 node:sqlite 의 차이 · isolate 간 캐시(다른 isolate 는 최대 15초 늦다).
 * - 셀러 화면의 수십 개 라우트를 하나하나 — 그 스코프는 전역 `storeSeatGuard` 한 입구가 지킨다(여기서 그 입구를 잰다).
 * - 화면이 보기 좋은지 — 그려서 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { sign as jwtSign } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import {
  storeSeatGuard, verifyStoreSeat, resolveTokenActorUserId, isSeatShapedToken, invalidateStoreSeatCache,
  liveAgencySeatStoreId,
} from '@/worker/utils/store-seat-guard'
import { resolveStoreActor } from '@/worker/utils/store-actor'
import { deriveDashboardSeat } from '@/worker/utils/dashboard-session'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { agencyStoresRoutes } from '@/features/agency-console/api/agency-stores.routes'
import { registerAgencyLinkRoutes } from '@/features/seller/api/seller-agency-link.routes'
import { isAgencySeatToken } from '@/components/seller/AgencySeatBar'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-stores-0123'

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
 * 매장 7(주인 100, linked) · 매장 8(linked 11 — 맡기지 않음).
 * 에이전시 1(관리자 5 boss@ag.kr · 직원 6) · 에이전시 2(관리자 9 — 다른 회사).
 */
async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT, name TEXT,
    username TEXT, email TEXT, status TEXT, seller_type TEXT, is_distributor INTEGER, address TEXT)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, status) VALUES (7, 100, '직접카페', 'approved'), (8, 11, '옛날분식', 'approved')`)
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active'), (2, '남의대행', 'active')`)
  db.exec(`INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES
    (5, 1, 'boss@ag.kr', 'admin', 1, 'active'), (6, 1, 'staff@ag.kr', 'staff', 0, 'active'), (9, 2, 'other@ag.kr', 'admin', 1, 'active')`)
  return { db, DB }
}

const staffToken = async (id: number, agency: number) => (await issueAgencyStaffToken(SECRET, { id, agency_id: agency })).token

function agencyApp(DB: D1Database) {
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  app.route('/api/agency-console', agencyStoresRoutes)
  return (method: string, path: string, token: string) =>
    app.request(`/api/agency-console${path}`, { method, headers: { Authorization: `Bearer ${token}` } }, { DB, JWT_SECRET: SECRET })
}

function ownerApp(DB: D1Database, owner = { userId: 100, sellerId: 7 }) {
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  registerAgencyLinkRoutes(app as never, async () => owner)
  return (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    }, { DB, JWT_SECRET: SECRET })
}

function guardApp(DB: D1Database) {
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  app.use('/api/*', storeSeatGuard())
  app.get('/api/seller/orders', (c) => c.json({ ok: true }))
  return (token: string) => app.request('/api/seller/orders', { headers: { Authorization: `Bearer ${token}` } }, { DB, JWT_SECRET: SECRET })
}

/** 사장님이 맡기고 관리자가 수락해 직원 6 이 매장 7 좌석을 받는다. */
async function linkedSeat() {
  const env = await fresh()
  const owner = ownerApp(env.DB)
  expect((await owner('POST', '/agency-link', { email: 'BOSS@ag.kr' })).status).toBe(200)
  const agency = agencyApp(env.DB)
  const list = await (await agency('GET', '/stores', await staffToken(6, 1))).json() as { stores: Array<{ linkId: number }> }
  expect((await agency('POST', `/stores/${list.stores[0].linkId}/accept`, await staffToken(5, 1))).status).toBe(200)
  const seat = await (await agency('POST', '/stores/7/seat', await staffToken(6, 1))).json() as { data: { seller_token: string } }
  return { ...env, owner, agency, seat: seat.data.seller_token, linkId: list.stores[0].linkId }
}

describe('① 맡기기 · 수락 · 운영', () => {
  it('사장님이 관리자 이메일로 맡기면 요청이 뜨고, 직원은 수락 못 하고 관리자만 수락한다', async () => {
    const { DB } = await fresh()
    const owner = ownerApp(DB)
    const r = await owner('POST', '/agency-link', { email: 'boss@ag.kr' })
    expect(r.status).toBe(200)
    const agency = agencyApp(DB)
    const list = await (await agency('GET', '/stores', await staffToken(6, 1))).json() as { stores: Array<{ linkId: number; status: string; name: string }> }
    expect(list.stores).toHaveLength(1)
    expect(list.stores[0]).toMatchObject({ status: 'pending', name: '직접카페' })
    expect((await agency('POST', `/stores/${list.stores[0].linkId}/accept`, await staffToken(6, 1))).status, '직원이 수락').toBe(403)
    expect((await agency('POST', `/stores/${list.stores[0].linkId}/accept`, await staffToken(5, 1))).status).toBe(200)
    const state = await (await owner('GET', '/agency-link')).json() as { data: { status: string; agencyName: string } }
    expect(state.data).toMatchObject({ status: 'active', agencyName: '바른대행' })
  })

  it('직원 이메일로는 맡길 수 없다(요청이 엉뚱한 곳에 가지 않게) · 한 매장은 한 에이전시만', async () => {
    const { DB } = await fresh()
    const owner = ownerApp(DB)
    expect((await owner('POST', '/agency-link', { email: 'staff@ag.kr' })).status).toBe(404)
    expect((await owner('POST', '/agency-link', { email: 'boss@ag.kr' })).status).toBe(200)
    const again = await owner('POST', '/agency-link', { email: 'other@ag.kr' })
    expect(again.status).toBe(409)
    expect(((await again.json()) as { code: string }).code).toBe('ALREADY_LINKED')
  })

  it('맡은 매장만 좌석을 받는다 — 맡기지 않은 매장·남의 에이전시는 403', async () => {
    const { agency } = await linkedSeat()
    expect((await agency('POST', '/stores/8/seat', await staffToken(6, 1))).status).toBe(403)
    expect((await agency('POST', '/stores/7/seat', await staffToken(9, 2))).status, '남의 에이전시').toBe(403)
  })

  it('수락 전에는 좌석이 안 나온다', async () => {
    const { DB } = await fresh()
    await ownerApp(DB)('POST', '/agency-link', { email: 'boss@ag.kr' })
    expect((await agencyApp(DB)('POST', '/stores/7/seat', await staffToken(6, 1))).status).toBe(403)
  })
})

describe('② 에이전시 직원은 절대 사장님으로 되짚히지 않는다', () => {
  it('좌석은 살아 있고 역할은 operator — 하지만 사람(users.id)은 없다', async () => {
    const { DB, seat } = await linkedSeat()
    expect(isSeatShapedToken({ agency_staff_id: 6 })).toBe(true)
    const p = JSON.parse(atob(seat.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    expect(p).toMatchObject({ type: 'seller', seller_id: 7, store_role: 'operator', agency_staff_id: 6, agency_id: 1 })
    expect(p.seat_user_id, '사람 claim 이 붙으면 그 사람의 좌석 규칙으로 판정된다').toBeUndefined()
    expect(p.operator_user_id).toBeUndefined()
    const v = await verifyStoreSeat(DB, p)
    expect(v).toMatchObject({ kind: 'live', sellerId: 7, userId: null, role: 'operator', agency: true })
  })

  it('resolveTokenActorUserId → null (매장 주인 100 으로 폴백하면 직원이 주인이 된다)', async () => {
    const { DB, seat } = await linkedSeat()
    expect(await resolveTokenActorUserId(DB, `Bearer ${seat}`, SECRET)).toBeNull()
  })

  it('resolveStoreActor → 소유자 아님 · 에이전시 표시 (D1 이 흔들려도 claim 만으로)', async () => {
    const { DB, seat } = await linkedSeat()
    const a = await resolveStoreActor(`Bearer ${seat}`, SECRET, DB)
    expect(a).toMatchObject({ sellerId: 7, isOwner: false, isAgency: true, operatorUserId: null })
    const broken = { prepare: () => { throw new Error('D1 down') } } as unknown as D1Database
    expect(await resolveStoreActor(`Bearer ${seat}`, SECRET, broken)).toMatchObject({ isOwner: false, isAgency: true })
  })

  it('대시보드 세션 시트는 직원 것 — 사장님의 (seller, 7) 시트와 다투지 않는다', () => {
    expect(deriveDashboardSeat({ type: 'seller', sub: '7', agency_staff_id: 6 })).toEqual({ role: 'seller_agency', id: 6 })
  })

  it('셀러 화면은 토큰 claim 으로 에이전시 좌석을 알아본다(이름만 남은 경우 띠가 거짓말하지 않게)', async () => {
    const { seat } = await linkedSeat()
    expect(isAgencySeatToken(seat)).toBe(true)
    const plain = await jwtSign({ type: 'seller', seller_id: 7, sub: '7' }, SECRET)
    expect(isAgencySeatToken(plain)).toBe(false)
  })
})

describe('③ 끊으면 다음 요청부터 막힌다 (기간 없음 — 대표 규칙 3)', () => {
  it('사장님이 끊으면 401', async () => {
    const { DB, owner, seat } = await linkedSeat()
    const call = guardApp(DB)
    expect((await call(seat)).status).toBe(200)
    expect((await owner('POST', '/agency-link/end')).status).toBe(200)
    expect((await call(seat)).status).toBe(401)
    expect(await liveAgencySeatStoreId(DB, `Bearer ${seat}`, SECRET)).toBeNull()
  })

  it('에이전시가 내려놓아도 401 · 관리자만 내려놓는다', async () => {
    const { DB, agency, seat, linkId } = await linkedSeat()
    expect((await agency('POST', `/stores/${linkId}/release`, await staffToken(6, 1))).status).toBe(403)
    expect((await agency('POST', `/stores/${linkId}/release`, await staffToken(5, 1))).status).toBe(200)
    expect((await guardApp(DB)(seat)).status).toBe(401)
  })

  it('직원을 내보내면 그 직원의 매장 좌석도 401 (tokens_valid_after)', async () => {
    const { db, DB, seat } = await linkedSeat()
    const call = guardApp(DB)
    expect((await call(seat)).status).toBe(200)
    db.exec(`UPDATE agency_staff SET status = 'removed', tokens_valid_after = ${Math.floor(Date.now() / 1000) + 1} WHERE id = 6`)
    invalidateStoreSeatCache(DB)
    expect((await call(seat)).status).toBe(401)
  })

  it('직원 상태만 removed 여도(경계값 갱신이 빠진 경로) 401 — 두 조건이 따로 선다', async () => {
    const { db, DB, seat } = await linkedSeat()
    db.exec(`UPDATE agency_staff SET status = 'removed' WHERE id = 6`)
    invalidateStoreSeatCache(DB)
    expect((await guardApp(DB)(seat)).status).toBe(401)
  })

  it('비밀번호를 바꿔 옛 로그인을 끊으면(tokens_valid_after) 직원이 active 여도 401', async () => {
    const { db, DB, seat } = await linkedSeat()
    db.exec(`UPDATE agency_staff SET tokens_valid_after = ${Math.floor(Date.now() / 1000) + 5} WHERE id = 6`)
    invalidateStoreSeatCache(DB)
    expect((await guardApp(DB)(seat)).status).toBe(401)
  })

  it('에이전시가 정지되면 401', async () => {
    const { db, DB, seat } = await linkedSeat()
    db.exec(`UPDATE agency_accounts SET status = 'suspended' WHERE id = 1`)
    invalidateStoreSeatCache(DB)
    expect((await guardApp(DB)(seat)).status).toBe(401)
  })

  it('claim 의 agency_id 를 남의 에이전시로 바꾼(위조 아님 — 다른 회사 직원) 토큰은 401', async () => {
    const { DB } = await linkedSeat()
    const now = Math.floor(Date.now() / 1000) - 5
    const tok = await jwtSign({ type: 'seller', seller_id: 7, sub: '7', agency_staff_id: 9, agency_id: 2, iat: now, exp: now + 3600 }, SECRET)
    expect((await guardApp(DB)(tok)).status).toBe(401)
  })

  it('끊은 뒤 다시 맡기면 새 요청이 생긴다(옛 행은 지우지 않고 ended 로 남는다)', async () => {
    const { db, owner } = await linkedSeat()
    await owner('POST', '/agency-link/end')
    expect((await owner('POST', '/agency-link', { email: 'boss@ag.kr' })).status).toBe(200)
    const rows = db.prepare('SELECT status FROM agency_store_links WHERE seller_id = 7 ORDER BY id').all() as Array<{ status: string }>
    expect(rows.map((r) => r.status)).toEqual(['ended', 'pending'])
  })
})

describe('④ 사장님으로 둔갑하는 폴백 자리 — 배선', () => {
  const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

  it('/switch-to-user 는 토큰의 사람이 linked_user_id 본인일 때만 (운영자·에이전시가 사장님 계정이 되던 구멍)', () => {
    const s = code('src/features/seller/api/seller-registration/session-routes.ts')
    const at = s.indexOf("'/switch-to-user'")
    expect(at).toBeGreaterThan(0)
    const body = s.slice(at, at + 2500)
    expect(body).toMatch(/resolveTokenActorUserId\(db, c\.req\.header\('Authorization'\), jwtSecret\)/)
    expect(body).toMatch(/Number\(actorUserId\) !== Number\(seller\.linked_user_id\)/)
    expect(body.indexOf('Number(actorUserId) !== Number(seller.linked_user_id)')).toBeLessThan(body.indexOf('createSessionCookie'))
  })

  it('카카오 봇 연결은 에이전시 좌석을 거절한다(linked_user_id 후보로 새지 않게)', () => {
    const s = code('src/features/seller/api/seller-kakao-bot.routes.ts')
    expect(s).toMatch(/if \(actor\.isAgency\) return null/)
    expect(s.indexOf('if (actor.isAgency) return null')).toBeLessThan(s.indexOf('SELECT linked_user_id FROM sellers'))
  })

  it('협업 코드 발급자는 에이전시 좌석이면 주인 id 가 아니다', () => {
    const s = code('src/features/group-buy/api/marketing/collab-codes.ts')
    expect(s.indexOf('if (u.agency_staff_id) return sellerId')).toBeLessThan(s.indexOf('SELECT linked_user_id FROM sellers'))
  })

  it('매장 목록(/my-stores · /summary)은 에이전시 좌석에 맡은 매장 하나로 답한다(401 이면 셀러 화면이 로그아웃시킨다)', () => {
    const s = code('src/features/seller/api/seller-operators.routes.ts')
    expect(s.match(/const scope = await resolveStoreScope\(c\)/g)?.length).toBe(2)
    expect(s).toMatch(/liveAgencySeatStoreId\(c\.env\.DB/)
  })

  it('에이전시 좌석에 들어갈 때 이 브라우저의 다른 셀러 refresh 토큰을 먼저 지운다', () => {
    const s = code('src/pages/agency-console/agency-api.ts')
    const at = s.indexOf('export async function enterAgencyStore')
    expect(s.slice(at)).toMatch(/'seller_refresh_token'/)
    expect(s.slice(at).indexOf("removeItem(k)")).toBeLessThan(s.slice(at).indexOf("setItem('seller_token'"))
  })

  it('끊기·내려놓기·직원 내보내기는 좌석 캐시를 바로 비운다', () => {
    expect(code('src/features/seller/api/seller-agency-link.routes.ts')).toMatch(/invalidateStoreSeatCache\(DB, g\.sellerId\)/)
    expect(code('src/features/agency-console/api/agency-stores.routes.ts')).toMatch(/if \(to === 'ended'\) invalidateStoreSeatCache\(DB, row\.seller_id\)/)
    expect(code('src/features/agency-console/api/agency-staff.routes.ts')).toMatch(/invalidateStoreSeatCache\(c\.env\.DB\)/)
  })

  it('한 매장 한 에이전시 — 부분 UNIQUE 인덱스', () => {
    expect(code('src/features/agency-console/api/agency-schema.ts')).toMatch(/idx_agency_store_links_open ON agency_store_links\(seller_id\) WHERE status IN \('pending','active'\)/)
  })
})
