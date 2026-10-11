/**
 * 🪑 **회수·소유권 이전 뒤 옛 좌석 토큰이 죽는가** — 실제 함수·실제 JWT·실제 SQLite 로 판정 (2026-10-10)
 *
 * ## 무엇이 뚫려 있었나
 * 좌석 토큰은 30일 JWT 이고 권한(`canOperateStore`)은 **발급 순간 한 번만** 봤다.
 *   (a) 사장님이 중개자를 회수해도 그 토큰은 30일 동안 그 매장을 연다.
 *   (b) 소유권 이전으로 강등된 옛 주인의 토큰이 계속 `store_role:'owner'` → 자기 PIN 으로 정산 계좌 교체.
 *   (c) 쿠키 없이 운영자 좌석 토큰만 보내면 `resolveActorUserId` 가 **매장 주인 id** 로 되짚었다.
 *   (d) 좌석 토큰을 `/api/seller/refresh` 에 넣으면 claim 빠진 매장 계정 토큰이 나왔다.
 * 처방: `store-seat-guard` — 매 요청 (매장, 사람)의 **지금** 권한을 DB 에서 본다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - D1 과 node:sqlite 의 차이 · isolate 간 캐시(다른 isolate 는 최대 15초 늦다 — 여기선 한 isolate).
 * - `ud_seller_token` SSR 쿠키 경로(미들웨어는 Bearer 만 본다).
 * - 이전 주인이 매장 계정 **비밀번호**를 알아 새로 로그인하는 것(에포크 뒤 새 토큰 — 계정 자격 문제).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { sign as jwtSign } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import {
  storeSeatGuard, verifyStoreSeat, resolveTokenActorUserId, isSeatShapedToken,
  isStoreSeatGuardSkipped, STORE_SEAT_REVOKED, invalidateStoreSeatCache,
} from '@/worker/utils/store-seat-guard'
import { resolveStoreActor } from '@/worker/utils/store-actor'
import { revokeOperator, grantOperator } from '@/worker/utils/seller-operators'
import { transferStoreOwnership } from '@/worker/utils/store-ownership-transfer'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db, opts: { fail?: boolean } = {}) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const guard = () => { if (opts.fail) throw new Error('D1_ERROR: simulated outage') }
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => { guard(); return db.prepare(sql).get(...(binds as never[])) ?? null },
        all: async () => { guard(); return { results: db.prepare(sql).all(...(binds as never[])) } },
        run: async () => {
          guard()
          const r = db.prepare(sql).run(...(binds as never[]))
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        },
      }
      return self
    },
  } as unknown as D1Database
}

const SECRET = 'test-secret-store-seat-revocation'

/**
 * 매장 둘:
 *   7 직접 등록 — linked NULL, 주인 100(grant owner), 위임 운영자 200
 *   8 옛 방식   — linked_user_id 11
 */
function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, linked_user_id INTEGER,
    business_name TEXT, business_number TEXT, status TEXT,
    introduced_by_influencer_id INTEGER, introduced_by_agency_id INTEGER,
    introduced_at TEXT, referral_bonus_until TEXT, updated_at TEXT)`)
  db.exec(`CREATE TABLE seller_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER,
    granted_at TEXT DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT, created_at TEXT)`)
  db.exec(`CREATE UNIQUE INDEX idx_seller_operators_pair ON seller_operators(seller_id, user_id)`)
  db.exec(`CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL,
    amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL,
    fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT, created_at TEXT)`)
  db.exec(`CREATE TABLE payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT, payee_id TEXT, amount INTEGER, status TEXT)`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, status) VALUES (7, NULL, '직접등록카페', 'approved')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 100, 'owner')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 200, 'operator')`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, status) VALUES (8, 11, '옛날분식', 'approved')`)
  return { db, DB: d1(db) }
}

/** `POST /stores/:id/token` 이 싣는 claim 그대로(발급부 배선은 아래 소스 단언이 따로 본다). */
async function seatToken(sellerId: number, userId: number, source: 'link' | 'grant', role: 'owner' | 'operator', iat?: number) {
  const now = iat ?? Math.floor(Date.now() / 1000) - 60
  const p: Record<string, unknown> = { sub: String(sellerId), seller_id: sellerId, type: 'seller', iat: now, exp: now + 30 * 86400 }
  if (source === 'grant') p.operator_user_id = userId
  p.store_role = role
  p.seat_user_id = userId
  return jwtSign(p, SECRET)
}
async function plainToken(sellerId: number, iat?: number, extra: Record<string, unknown> = {}) {
  const now = iat ?? Math.floor(Date.now() / 1000) - 60
  return jwtSign({ sub: String(sellerId), seller_id: sellerId, type: 'seller', iat: now, exp: now + 30 * 86400, ...extra }, SECRET)
}

/** 셀러 라우트 하나 + 소비자 정체성 라우트 하나에 진짜 미들웨어를 건다. */
function appWith(DB: D1Database) {
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  app.use('/api/*', storeSeatGuard())
  app.get('/api/seller/orders', (c) => c.json({ ok: true }))
  app.get('/api/seller/my-stores', (c) => c.json({ ok: true }))
  const call = (path: string, token: string) =>
    app.request(path, { headers: { Authorization: `Bearer ${token}` } }, { DB, JWT_SECRET: SECRET })
  return call
}

beforeEach(() => { /* 캐시는 DB 객체 단위라 fresh() 마다 새로 시작한다 */ })

describe('(a) 회수된 운영자의 이미 발급된 좌석 토큰은 거절된다', () => {
  it('회수 전에는 통과, 회수 뒤에는 401 STORE_SEAT_REVOKED', async () => {
    const { DB } = fresh()
    const call = appWith(DB)
    const tok = await seatToken(7, 200, 'grant', 'operator')
    expect((await call('/api/seller/orders', tok)).status).toBe(200)

    await revokeOperator(DB, 7, 200)
    const r = await call('/api/seller/orders', tok)
    expect(r.status, '회수된 중개자가 30일 동안 그 매장을 연다').toBe(401)
    expect(((await r.json()) as { code: string }).code).toBe(STORE_SEAT_REVOKED)
  })

  it('다시 초대하면 같은 토큰이 바로 살아난다 — 판정은 토큰이 아니라 지금의 DB', async () => {
    const { DB } = fresh()
    const call = appWith(DB)
    const tok = await seatToken(7, 200, 'grant', 'operator')
    await revokeOperator(DB, 7, 200)
    expect((await call('/api/seller/orders', tok)).status).toBe(401)
    await grantOperator(DB, 7, 200, 100, 'operator')
    expect((await call('/api/seller/orders', tok)).status).toBe(200)
  })

  it('회수돼도 소비자 정체성 경로(매장 전환·목록)는 막지 않는다 — 다른 매장으로 옮겨 갈 수 있어야 한다', async () => {
    const { DB } = fresh()
    const call = appWith(DB)
    const tok = await seatToken(7, 200, 'grant', 'operator')
    await revokeOperator(DB, 7, 200)
    expect((await call('/api/seller/my-stores', tok)).status).toBe(200)
    expect(isStoreSeatGuardSkipped('/api/seller/stores/9/token')).toBe(true)
    expect(isStoreSeatGuardSkipped('/api/seller/orders')).toBe(false)
    expect(isStoreSeatGuardSkipped('/api/seller/stores/9/token/x')).toBe(false)
  })

  it('…그러나 그 경로들도 죽은 좌석 토큰을 정체성으로 쓰지 않는다', async () => {
    const { DB } = fresh()
    const tok = await seatToken(7, 200, 'grant', 'operator')
    expect(await resolveTokenActorUserId(DB, `Bearer ${tok}`, SECRET)).toBe(200)
    await revokeOperator(DB, 7, 200)
    expect(await resolveTokenActorUserId(DB, `Bearer ${tok}`, SECRET), '회수된 좌석이 정체성 증명이 되면 안 된다').toBeNull()
  })

  it('살아 있는 주인·운영자는 그대로 들어온다 — 사장님이 튕기면 안 된다', async () => {
    const { DB } = fresh()
    const call = appWith(DB)
    expect((await call('/api/seller/orders', await seatToken(7, 100, 'grant', 'owner'))).status).toBe(200)
    expect((await call('/api/seller/orders', await seatToken(7, 200, 'grant', 'operator'))).status).toBe(200)
    expect((await call('/api/seller/orders', await seatToken(8, 11, 'link', 'owner'))).status).toBe(200)
    expect((await call('/api/seller/orders', await plainToken(8))).status, '매장 계정 로그인 토큰').toBe(200)
  })

  it('운영자 회수가 그 사람의 **다른 매장** 좌석까지 끊지는 않는다', async () => {
    const { db, DB } = fresh()
    db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, status) VALUES (9, NULL, '다른가게', 'approved')`)
    db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (9, 200, 'operator')`)
    const call = appWith(DB)
    await revokeOperator(DB, 7, 200)
    expect((await call('/api/seller/orders', await seatToken(9, 200, 'grant', 'operator'))).status).toBe(200)
  })

  it('D1 장애면 통과한다(fail-open) — 한 번 흔들렸다고 모든 사장님을 로그아웃시키지 않는다', async () => {
    const { db } = fresh()
    const call = appWith(d1(db, { fail: true }))
    expect((await call('/api/seller/orders', await seatToken(7, 200, 'grant', 'operator'))).status).toBe(200)
  })

  it('셀러 토큰이 아니면 관여하지 않는다', async () => {
    const { DB } = fresh()
    const call = appWith(DB)
    const admin = await jwtSign({ sub: '1', type: 'admin', iat: 1, exp: 9999999999 }, SECRET)
    expect((await call('/api/seller/orders', admin)).status).toBe(200)
  })
})

describe('(b) 소유권 이전으로 강등된 옛 주인은 정산 계좌를 못 바꾼다', () => {
  it('grant 주인(100) → 77 이전: 옛 토큰은 여전히 owner claim 이지만 소유자가 아니다', async () => {
    const { DB } = fresh()
    const oldTok = await seatToken(7, 100, 'grant', 'owner')
    expect((await resolveStoreActor(`Bearer ${oldTok}`, SECRET, DB)).isOwner).toBe(true)

    const r = await transferStoreOwnership(DB, { sellerId: 7, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(true)
    const actor = await resolveStoreActor(`Bearer ${oldTok}`, SECRET, DB)
    expect(actor.isOwner, '강등된 옛 주인이 자기 PIN 으로 정산 계좌를 갈아끼운다').toBe(false)
    // 강등이지 회수가 아니다 — 운영은 계속한다(설계 §5(a)).
    expect((await verifyStoreSeat(DB, { type: 'seller', seller_id: 7, operator_user_id: 100, seat_user_id: 100 })).kind).toBe('live')
  })

  it('link 주인(11) → 77 이전: 이전 전에 발급된 정체성 없는 토큰(매장 계정·옛 link 좌석)은 전부 끊긴다', async () => {
    const { DB } = fresh()
    const call = appWith(DB)
    const legacySeat = await plainToken(8, undefined, { store_role: 'owner' })   // 이 수리 전 link 좌석 모양
    const accountTok = await plainToken(8)                                       // 매장 계정 카카오/비번 로그인
    expect((await resolveStoreActor(`Bearer ${legacySeat}`, SECRET, DB)).isOwner).toBe(true)

    expect((await transferStoreOwnership(DB, { sellerId: 8, nextUserId: 77, actorUserId: null })).ok).toBe(true)
    expect((await resolveStoreActor(`Bearer ${legacySeat}`, SECRET, DB)).isOwner).toBe(false)
    expect((await resolveStoreActor(`Bearer ${accountTok}`, SECRET, DB)).isOwner).toBe(false)
    expect((await call('/api/seller/orders', legacySeat)).status).toBe(401)
    expect((await call('/api/seller/orders', accountTok)).status).toBe(401)
  })

  it('(c) 새 주인은 정산 계좌를 바꿀 수 있다 — 이전 뒤 받은 좌석', async () => {
    const { DB } = fresh()
    expect((await transferStoreOwnership(DB, { sellerId: 7, nextUserId: 77, actorUserId: null })).ok).toBe(true)
    // 정체성 있는 좌석은 에포크가 아니라 DB 행으로 판정된다 — 같은 초에 받아도 안 막힌다.
    const newTok = await seatToken(7, 77, 'grant', 'owner', Math.floor(Date.now() / 1000))
    expect((await resolveStoreActor(`Bearer ${newTok}`, SECRET, DB)).isOwner).toBe(true)
    expect((await appWith(DB)('/api/seller/orders', newTok)).status).toBe(200)
  })

  it('운영자(200)를 나중에 주인으로 올리면 그의 옛 operator 토큰도 바로 소유자다(DB 가 정답)', async () => {
    const { DB } = fresh()
    const opTok = await seatToken(7, 200, 'grant', 'operator')
    expect((await resolveStoreActor(`Bearer ${opTok}`, SECRET, DB)).isOwner).toBe(false)
    expect((await transferStoreOwnership(DB, { sellerId: 7, nextUserId: 200, actorUserId: null })).ok).toBe(true)
    expect((await resolveStoreActor(`Bearer ${opTok}`, SECRET, DB)).isOwner).toBe(true)
  })

  it('판단 근거를 못 얻으면 소유자가 아니다(fail-closed) — 이 게이트는 돈의 목적지를 지킨다', async () => {
    const { db } = fresh()
    const tok = await seatToken(7, 100, 'grant', 'owner')
    expect((await resolveStoreActor(`Bearer ${tok}`, SECRET, d1(db, { fail: true }))).isOwner).toBe(false)
  })

  it('회수된 운영자의 좌석은 소유자 판정에서도 당연히 소유자가 아니다', async () => {
    const { DB } = fresh()
    const tok = await seatToken(7, 100, 'grant', 'owner')
    await revokeOperator(DB, 7, 100)
    invalidateStoreSeatCache(DB)
    expect((await resolveStoreActor(`Bearer ${tok}`, SECRET, DB)).isOwner).toBe(false)
  })
})

describe('(c) 쿠키 없는 운영자 좌석 토큰이 주인으로 둔갑하지 않는다', () => {
  it('link 주인(11) 매장의 운영자(300) 토큰 → 정체성은 300 이지 11 이 아니다', async () => {
    const { db, DB } = fresh()
    db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (8, 300, 'operator')`)
    const tok = await seatToken(8, 300, 'grant', 'operator')
    expect(await resolveTokenActorUserId(DB, `Bearer ${tok}`, SECRET), '운영자가 주인 id 로 운영자 추가·회수·다른 매장 전환').toBe(300)
    // 매장 계정 토큰은 종전 규칙 그대로(그 매장의 linked_user_id).
    expect(await resolveTokenActorUserId(DB, `Bearer ${await plainToken(8)}`, SECRET)).toBe(11)
  })

  it('두 라우터의 resolveActorUserId 가 좌석 정체성 헬퍼를 쓴다(주인 id 로 되짚는 옛 코드 부활 금지)', () => {
    for (const f of ['src/features/seller/api/seller-operators.routes.ts', 'src/features/seller/api/seller-stores.routes.ts']) {
      const src = stripComments(readFileSync(f, 'utf8'))
      const fn = src.slice(src.indexOf('async function resolveActorUserId'), src.indexOf('async function resolveActorUserId') + 900)
      expect(fn, f).toMatch(/return resolveTokenActorUserId\(c\.env\.DB, c\.req\.header\('Authorization'\), c\.env\.JWT_SECRET\)/)
      expect(fn, `${f}: 좌석 토큰을 매장 linked_user_id 로 되짚으면 운영자가 주인이 된다`).not.toMatch(/linked_user_id FROM sellers/)
    }
  })
})

describe('(d) 배선 — 문이 실제로 달려 있는가', () => {
  it('좌석 토큰 모양 판별', () => {
    expect(isSeatShapedToken({ operator_user_id: 5 })).toBe(true)
    expect(isSeatShapedToken({ seat_user_id: 5 })).toBe(true)
    expect(isSeatShapedToken({ store_role: 'owner' })).toBe(true)
    expect(isSeatShapedToken({ type: 'seller', seller_id: 1 })).toBe(false)
  })

  it('refresh 가 좌석 토큰을 거절한다 — 저장 행 대조보다 먼저', () => {
    const src = stripComments(readFileSync('src/features/auth/api/seller.routes.ts', 'utf8'))
    const h = src.slice(src.indexOf("sellerRoutes.post('/refresh'"))
    const i = h.indexOf('if (isSeatShapedToken(payload)) return c.json')
    expect(i, '좌석 토큰이 refresh 되면 claim 빠진 매장 계정 토큰(=주인 판정)이 나온다').toBeGreaterThan(0)
    expect(i).toBeLessThan(h.indexOf('auth_refresh_tokens'))
  })

  it('발급부가 좌석 주인(seat_user_id)을 link·grant 모두에 싣는다', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-operators.routes.ts', 'utf8'))
    expect(src).toMatch(/\n\s*payload\.seat_user_id = userId\n/)
  })

  it('워커가 /api/* 전역에 가드를 셀러 라우트보다 먼저 건다', () => {
    const src = stripComments(readFileSync('src/worker/index.ts', 'utf8'))
    const g = src.indexOf("app.use('/api/*', storeSeatGuard());")
    expect(g, '가드가 안 붙으면 26개 셀러 라우트가 서명만 보고 매장을 연다').toBeGreaterThan(0)
    expect(g).toBeLessThan(src.indexOf("app.route('/api/seller', sellerAuthRoutes);"))
  })

  it('소유권 이전과 탈퇴가 매장 좌석 에포크를 올린다', () => {
    const t = stripComments(readFileSync('src/worker/utils/store-ownership-transfer.ts', 'utf8'))
    expect(t).toMatch(/await bumpStoreSeatEpoch\(DB, sellerId, 'ownership_transfer'\)/)
    const w = stripComments(readFileSync('src/features/seller/api/seller-withdraw.routes.ts', 'utf8'))
    expect(w).toMatch(/await bumpStoreSeatEpoch\(c\.env\.DB, seat, 'withdraw'\)/)
  })

  it('탈퇴로 에포크가 오르면 그 전 매장 계정 토큰이 죽는다(옛 no-op 대체)', async () => {
    const { DB } = fresh()
    const { bumpStoreSeatEpoch } = await import('@/worker/utils/store-seat-guard')
    const call = appWith(DB)
    const tok = await plainToken(8)
    expect((await call('/api/seller/orders', tok)).status).toBe(200)
    await bumpStoreSeatEpoch(DB, 8, 'withdraw')
    expect((await call('/api/seller/orders', tok)).status).toBe(401)
    // 같은 매장 다른 사람 좌석은 에포크가 아니라 DB 행으로 판정된다.
    expect((await verifyStoreSeat(DB, { type: 'seller', seller_id: 8, seat_user_id: 11, iat: 1 })).kind).toBe('live')
  })
})
