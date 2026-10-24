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
import { isAgencySeatToken } from '@/shared/agency-seat-token'
import { storeAgencyInviteRoutes } from '@/features/seller/api/store-agency-invite.routes'
import { createSessionCookie } from '@/worker/utils/session'
import { agencyActivityLabel } from '@/shared/agency-activity-label'

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
  // 🤝 2026-10-24 — 에이전시 좌석은 기본 차단이라 매장 전체를 여는 `/api/seller/orders` 는 403 이다. 좌석 생사를 재는
  //   탐침은 에이전시에게 열린 길(자기 이용권 목록)로 옮겼다 — 지키는 것(끊으면 401)은 그대로다.
  app.get('/api/seller/products', (c) => c.json({ ok: true }))
  return (token: string) => app.request('/api/seller/products', { headers: { Authorization: `Bearer ${token}` } }, { DB, JWT_SECRET: SECRET })
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
    const state = await (await owner('GET', '/agency-link')).json() as { data: { links: Array<{ status: string; agencyName: string }> } }
    expect(state.data.links).toHaveLength(1)
    expect(state.data.links[0]).toMatchObject({ status: 'active', agencyName: '바른대행' })
  })

  it('직원 이메일로는 맡길 수 없다(요청이 엉뚱한 곳에 가지 않게) · 🤝 여러 에이전시와 함께 · 같은 에이전시엔 두 번 못 맡긴다', async () => {
    const { DB } = await fresh()
    const owner = ownerApp(DB)
    expect((await owner('POST', '/agency-link', { email: 'staff@ag.kr' })).status).toBe(404)
    expect((await owner('POST', '/agency-link', { email: 'boss@ag.kr' })).status).toBe(200)
    // 2026-10-24 대표 확정: 한 매장이 여러 에이전시와 함께 한다.
    expect((await owner('POST', '/agency-link', { email: 'other@ag.kr' })).status, '다른 에이전시').toBe(200)
    const again = await owner('POST', '/agency-link', { email: 'boss@ag.kr' })
    expect(again.status).toBe(409)
    expect(((await again.json()) as { code: string }).code).toBe('ALREADY_LINKED')
    const state = await (await owner('GET', '/agency-link')).json() as { data: { links: Array<{ agencyName: string }> } }
    expect(state.data.links.map((l) => l.agencyName)).toEqual(['바른대행', '남의대행'])
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
    // 📊 2026-10-24 — 내려놓을 때 우리 이용권을 사장님께 돌리는 일이 같은 분기에 붙었다(캐시 비우기는 그대로).
    expect(code('src/features/agency-console/api/agency-stores.routes.ts')).toMatch(/if \(to === 'ended'\) \{ await releaseAgencyProducts\(DB, row\.seller_id, me\.agencyId\); invalidateStoreSeatCache\(DB, row\.seller_id\) \}/)
    expect(code('src/features/agency-console/api/agency-staff.routes.ts')).toMatch(/invalidateStoreSeatCache\(c\.env\.DB\)/)
  })

  it('🤝 한 매장 · 여러 에이전시 — 열린 맡김은 (매장, 에이전시) 쌍마다 하나 · 옛 매장당 하나 인덱스는 지운다', () => {
    const src = code('src/features/agency-console/api/agency-schema.ts')
    expect(src).toMatch(/idx_agency_store_links_open_pair ON agency_store_links\(seller_id, agency_id\) WHERE status IN \('pending','active'\)/)
    expect(src).toContain("DROP INDEX IF EXISTS idx_agency_store_links_open'")
    // 옛 인덱스가 남아 있으면 두 번째 에이전시가 에러 없이 막힌다 — 다시 만드는 줄이 있으면 안 된다.
    expect(src).not.toMatch(/idx_agency_store_links_open ON agency_store_links\(seller_id\) WHERE/)
  })
})

describe('⑤ 매장 초대 링크 — 에이전시가 보내고 사장님이 [맡기기] 한 번 (대표 "링크 방식도 넣어줘")', () => {
  function inviteApp(DB: D1Database) {
    const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
    app.route('/api/store-agency-invite', storeAgencyInviteRoutes)
    return {
      lookup: (t: string) => app.request(`/api/store-agency-invite/${t}`, {}, { DB, JWT_SECRET: SECRET }),
      accept: (body: unknown, cookie?: string) => app.request('/api/store-agency-invite/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
      }, { DB, JWT_SECRET: SECRET }),
    }
  }
  const cookieOf = async (userId: number) => (await createSessionCookie(userId, '사장님', 'o@x.kr', null, SECRET)).split(';')[0]
  const tokenOf = (url: string) => url.split('/store/agency/')[1]

  async function withInvite() {
    const env = await fresh()
    const agency = agencyApp(env.DB)
    const r = await agency('POST', '/store-invite', await staffToken(5, 1))
    expect(r.status).toBe(200)
    const { invite } = await r.json() as { invite: { url: string } }
    return { ...env, agency, inv: inviteApp(env.DB), token: tokenOf(invite.url) }
  }

  it('관리자만 링크를 만든다 · 링크는 /store/agency/<64자> 형태', async () => {
    const { DB } = await fresh()
    const agency = agencyApp(DB)
    expect((await agency('POST', '/store-invite', await staffToken(6, 1))).status, '직원').toBe(403)
    const { token } = await withInvite()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('링크를 열면 어느 에이전시인지 보인다 · 모르는 링크는 404', async () => {
    const { inv, token } = await withInvite()
    expect(await (await inv.lookup(token)).json()).toMatchObject({ success: true, agencyName: '바른대행' })
    expect((await inv.lookup('f'.repeat(64))).status).toBe(404)
    expect((await inv.lookup('nope')).status).toBe(404)
  })

  it('로그인 안 했으면 401 · 남의 매장(주인 아님)은 403 · 주인이면 바로 운영 중(active)', async () => {
    const { db, DB, inv, agency, token } = await withInvite()
    expect((await inv.accept({ token, seller_id: 7 })).status).toBe(401)
    expect((await inv.accept({ token, seller_id: 7 }, await cookieOf(11))).status, '매장 8 주인이 매장 7 을 맡김').toBe(403)
    const ok = await inv.accept({ token, seller_id: 7 }, await cookieOf(100))
    expect(ok.status).toBe(200)
    const row = db.prepare('SELECT status, decided_by_staff_id FROM agency_store_links WHERE seller_id = 7').get() as { status: string; decided_by_staff_id: number }
    expect(row).toEqual({ status: 'active', decided_by_staff_id: 5 })
    // 수락 단계 없이 직원이 바로 들어간다
    expect((await agency('POST', '/stores/7/seat', await staffToken(6, 1))).status).toBe(200)
    void DB
  })

  it('새로 만들면 옛 링크는 그 순간 죽는다 · 끊기도 마찬가지', async () => {
    const { agency, inv, token } = await withInvite()
    const r2 = await (await agency('POST', '/store-invite', await staffToken(5, 1))).json() as { invite: { url: string } }
    expect((await inv.lookup(token)).status).toBe(404)
    const t2 = tokenOf(r2.invite.url)
    expect((await inv.lookup(t2)).status).toBe(200)
    expect((await agency('POST', '/store-invite/revoke', await staffToken(5, 1))).status).toBe(200)
    expect((await inv.lookup(t2)).status).toBe(404)
  })

  it('🤝 다른 에이전시에 맡긴 매장도 링크로 함께 한다 · 같은 에이전시 요청이 대기 중이면 수락으로 올린다', async () => {
    const { db, DB, inv, token } = await withInvite()
    await ownerApp(DB)('POST', '/agency-link', { email: 'other@ag.kr' }) // 에이전시 2 에 요청 중
    await ownerApp(DB)('POST', '/agency-link', { email: 'boss@ag.kr' }) // 에이전시 1 에도 요청 중
    expect((await inv.accept({ token, seller_id: 7 }, await cookieOf(100))).status).toBe(200)
    const open = db.prepare("SELECT agency_id, status FROM agency_store_links WHERE seller_id = 7 AND status IN ('pending','active') ORDER BY agency_id").all()
    expect(open).toEqual([{ agency_id: 1, status: 'active' }, { agency_id: 2, status: 'pending' }])
    // 같은 링크를 또 눌러도 맡김이 둘이 되지 않는다
    expect((await inv.accept({ token, seller_id: 7 }, await cookieOf(100))).status).toBe(200)
    expect((db.prepare("SELECT COUNT(*) AS n FROM agency_store_links WHERE seller_id = 7 AND agency_id = 1").get() as { n: number }).n).toBe(1)
  })

  it('정지된 에이전시의 링크는 죽는다', async () => {
    const { db, inv, token } = await withInvite()
    db.exec("UPDATE agency_accounts SET status = 'suspended' WHERE id = 1")
    expect((await inv.lookup(token)).status).toBe(404)
  })

  it('배선: CSRF 가 라우트보다 먼저 · 소유 판정은 소비자 세션 쿠키 하나(좌석 토큰 폴백 없음)', () => {
    const w = readFileSync('src/worker/index.ts', 'utf-8')
    const use = w.indexOf("app.use('/api/store-agency-invite/accept', csrfProtection())")
    const route = w.indexOf("app.route('/api/store-agency-invite', storeAgencyInviteRoutes)")
    expect(use).toBeGreaterThan(0)
    expect(use).toBeLessThan(route)
    const src = stripComments(readFileSync('src/features/seller/api/store-agency-invite.routes.ts', 'utf-8'))
    expect(src).toMatch(/parseSessionCookie\(c\.req\.header\('Cookie'\), c\.env\.JWT_SECRET, \['user'\]\)/)
    expect(src).not.toMatch(/resolveTokenActorUserId|Authorization/)
  })
})

describe('⑥ 사장님이 보는 "에이전시가 한 일" — 성공한 변경만 기록', () => {
  function mutApp(DB: D1Database) {
    const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
    app.use('/api/*', storeSeatGuard())
    app.post('/api/seller/products', (c) => c.json({ ok: true }))
    app.post('/api/seller/products/3/group-buy', (c) => c.json({ ok: true }))
    app.put('/api/seller/products/3', (c) => c.json({ ok: false }, 400))
    app.post('/api/seller/orders/9/confirm', (c) => c.json({ ok: true }))
    app.get('/api/seller/products', (c) => c.json({ ok: true }))
    return (method: string, path: string, token: string) =>
      app.request(path, { method, headers: { Authorization: `Bearer ${token}` } }, { DB, JWT_SECRET: SECRET })
  }
  const rows = (db: Db) => db.prepare('SELECT seller_id, agency_id, staff_id, method, label FROM agency_store_activity ORDER BY id').all()

  it('에이전시 좌석의 성공한 변경만 남는다 — 조회(GET)·실패(4xx)·🤝 막힌 길(403)은 안 남는다', async () => {
    const { db, DB, seat } = await linkedSeat()
    db.exec('INSERT INTO agency_products (product_id, seller_id, agency_id) VALUES (3, 7, 1)') // 이 에이전시가 맡은 이용권
    const call = mutApp(DB)
    await call('POST', '/api/seller/products', seat)
    await call('POST', '/api/seller/products/3/group-buy', seat)
    await call('PUT', '/api/seller/products/3', seat) // 라우트가 400
    expect((await call('POST', '/api/seller/orders/9/confirm', seat)).status, '매장 전체 주문은 에이전시에게 막힌다').toBe(403)
    await call('GET', '/api/seller/products', seat)
    expect(rows(db)).toEqual([
      { seller_id: 7, agency_id: 1, staff_id: 6, method: 'POST', label: '상품 등록·처리' },
      { seller_id: 7, agency_id: 1, staff_id: 6, method: 'POST', label: '이용권 등록·처리' },
    ])
  })

  it('사장님 본인·사람 운영자의 변경은 이 기록에 안 들어간다', async () => {
    const { db, DB } = await linkedSeat()
    const now = Math.floor(Date.now() / 1000) - 5
    const ownerTok = await jwtSign({ type: 'seller', seller_id: 7, sub: '7', seat_user_id: 100, store_role: 'owner', iat: now, exp: now + 3600 }, SECRET)
    await mutApp(DB)('POST', '/api/seller/products', ownerTok)
    expect(rows(db)).toEqual([])
  })

  it('사장님은 운영자 관리에서 누가·무엇을 했는지 읽는다(끊은 뒤에도 남는다)', async () => {
    const { DB, seat, owner } = await linkedSeat()
    await mutApp(DB)('POST', '/api/seller/products', seat)
    await owner('POST', '/agency-link/end')
    const r = await (await owner('GET', '/agency-link/activity')).json() as { data: Array<{ label: string; agencyName: string; staff: string }> }
    expect(r.data).toHaveLength(1)
    expect(r.data[0]).toMatchObject({ label: '상품 등록·처리', agencyName: '바른대행', staff: 'staff' })
  })

  it('경로를 사람이 읽는 말로 — 모르는 경로는 "매장 정보"', () => {
    expect(agencyActivityLabel('DELETE', '/api/seller/products/4')).toBe('상품 삭제')
    expect(agencyActivityLabel('PUT', '/api/seller/group-buy/8')).toBe('이용권 수정')
    expect(agencyActivityLabel('POST', '/api/seller/whatever')).toBe('매장 정보 등록·처리')
  })
})

describe('⑦ 어드민 — 에이전시 목록·정지(정지 버튼이 없던 빈칸)', () => {
  const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))
  it('adminApp(관리자 인증·감사 로그) 아래에 붙는다 — 옛 /agenc 마운트 형태가 아니다', () => {
    const w = code('src/worker/index.ts')
    expect(w).toMatch(/adminApp\.route\('\/', agencyAdminRoutes\)/)
  })
  it('정지·해제는 super/ops 만 · 정지는 상태 CAS + 좌석 캐시 즉시 비움', () => {
    const s = code('src/features/agency-console/api/agency-admin.routes.ts')
    expect(s).toMatch(/'\/agency-accounts\/:id\/suspend', requireAdminRole\('super', 'ops'\)/)
    expect(s).toMatch(/'\/agency-accounts\/:id\/unsuspend', requireAdminRole\('super', 'ops'\)/)
    expect(s).toMatch(/WHERE id = \? AND status = \?/)
    const suspend = s.slice(s.indexOf("'/agency-accounts/:id/suspend'"), s.indexOf("'/agency-accounts/:id/unsuspend'"))
    expect(suspend).toMatch(/invalidateStoreSeatCache\(c\.env\.DB\)/)
  })
  it('화면은 /admin/agencies · 메뉴에서 닿는다 · 옛 agencies 테이블을 읽지 않는다', () => {
    expect(code('src/routes/admin.routes.tsx')).toMatch(/path="\/admin\/agencies"/)
    expect(code('src/components/admin/admin-nav-config.ts')).toMatch(/path: '\/admin\/agencies'/)
    expect(code('src/features/agency-console/api/agency-admin.routes.ts')).not.toMatch(/\b(FROM|JOIN)\s+agencies\b/)
  })
})
