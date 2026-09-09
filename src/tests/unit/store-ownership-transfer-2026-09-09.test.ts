/**
 * 🪑 **매장 소유권 승계(3단계)** — 실제로 돌려서 판정한다 (2026-09-09)
 *
 * 대표 확정: *"지금은 유저가 없어서 지금 하면 좋은 게 아닐까"* → 3단계 착수.
 *
 * ## 이 시험이 지키는 것 — 셋 다 "에러 없이 조용히 틀리는" 종류다
 * 1. **영입 보상 불변** (설계 §5(c) — *"이게 설계의 핵심"*). 운영권이 넘어가도
 *    `introduced_by_*` · `introduced_at` · `referral_bonus_until` 은 그대로다.
 *    깨지면 중개자가 **사장님이 직접 계정 만드는 걸 막는다** — 그러면 매장이 안 올라온다.
 * 2. **이전 주인은 강등이지 회수가 아니다** (§5(a)). 그가 올려 둔 것을 계속 운영할 수 있어야 한다.
 * 3. **자물쇠 앞에서는 아무것도 안 쓴다.** 잔액이 남았는데 주인만 바뀌면 그 돈이 새 주인에게 간다
 *    (대표 확정 2026-09-08: *"번 돈은 일단 중개사에게 정산되어야지"*).
 *
 * ## 왜 배선 검사가 아니라 행동 시험인가
 * 어제(09-09) 이 세션에서만 헛도는 가드를 다섯 개 만들었다 — 정규식이 import 줄·주석에 걸렸다.
 * "그 함수 이름이 파일에 있다"는 아무것도 증명하지 않는다. 그래서 **실제 SQLite 에 매장을 놓고
 * 실제 함수를 태운다.**
 *
 * ## ⚠️ 못 막는 것
 * - D1 과 node:sqlite 의 차이(플래너·부분 UNIQUE 지원·동시성).
 * - HTTP 층(인증·2FA·감사로그). 라우트가 이 함수를 **부르는지**만 아래 배선 단언이 본다.
 * - 어드민이 등록증 사본을 실제로 열어 보는지(사람의 일이다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { transferStoreOwnership } from '@/worker/utils/store-ownership-transfer'
import { submitStoreClaim, decideStoreClaim } from '@/worker/utils/store-ownership-claims'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
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
    },
  } as unknown as D1Database
}

const CERT = '/api/media/uploads/biz-cert/202609/abc123.jpg'

/**
 * 매장 셋:
 *   1 옛 방식      — `linked_user_id = 11` 이 주인
 *   2 직접 등록    — linked NULL, operator(22, owner)
 *   3 중개 등록    — linked NULL, operator(33, **operator**) → 주인이 아무도 없다
 * 3 에는 영입 스탬프를 찍어 둔다 — 승계 후에도 그대로여야 한다(§5(c)).
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
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, business_number, status)
           VALUES (1, 11, '옛날분식', '1112233333', 'approved')`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, business_number, status)
           VALUES (2, NULL, '직접등록카페', '2223344444', 'approved')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (2, 22, 'owner')`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, business_number, status,
             introduced_by_influencer_id, introduced_at, referral_bonus_until)
           VALUES (3, NULL, '중개돈까스', '3334455555', 'approved', 99, '2026-01-01', '2028-01-01')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (3, 33, 'operator')`)
  return { db, DB: d1(db) }
}

const ops = (db: Db, sellerId: number) =>
  db.prepare('SELECT user_id, role, revoked_at FROM seller_operators WHERE seller_id = ? ORDER BY user_id')
    .all(sellerId) as Array<{ user_id: number; role: string; revoked_at: string | null }>

describe('🪑 소유권 이전 — 무엇이 움직이고 무엇이 안 움직이나', () => {
  it('주인이 없던 중개 매장에 소유자를 지정한다 (홍대돈까스가 잠겨 있던 이유)', async () => {
    const { db, DB } = fresh()
    const r = await transferStoreOwnership(DB, { sellerId: 3, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(true)
    expect(r.previousOwnerId).toBe(null)
    const rows = ops(db, 3)
    expect(rows.find((o) => o.user_id === 77)?.role).toBe('owner')
    // 중개자는 건드리지 않는다 — 그는 원래 주인이 아니었다.
    expect(rows.find((o) => o.user_id === 33)?.role).toBe('operator')
    expect(rows.find((o) => o.user_id === 33)?.revoked_at).toBe(null)
  })

  it('🔑 영입 보상은 승계에도 그대로 남는다 — 설계 §5(c) 핵심', async () => {
    const { db, DB } = fresh()
    const before = db.prepare('SELECT introduced_by_influencer_id i, introduced_at a, referral_bonus_until u FROM sellers WHERE id = 3').get() as Record<string, unknown>
    await transferStoreOwnership(DB, { sellerId: 3, nextUserId: 77, actorUserId: null })
    const after = db.prepare('SELECT introduced_by_influencer_id i, introduced_at a, referral_bonus_until u FROM sellers WHERE id = 3').get() as Record<string, unknown>
    expect(after).toEqual(before)
    expect(after.i).toBe(99)
  })

  it('이전 주인은 회수가 아니라 operator 로 강등된다 (§5(a))', async () => {
    const { db, DB } = fresh()
    const r = await transferStoreOwnership(DB, { sellerId: 2, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(true)
    expect(r.previousOwnerId).toBe(22)
    const rows = ops(db, 2)
    expect(rows.find((o) => o.user_id === 22)?.role).toBe('operator')
    expect(rows.find((o) => o.user_id === 22)?.revoked_at).toBe(null)   // 🔴 회수 아님
    expect(rows.find((o) => o.user_id === 77)?.role).toBe('owner')
  })

  it('옛 칸(linked_user_id)이 이전 주인을 가리켰으면 비운다 — 두 신호가 갈리지 않게', async () => {
    const { db, DB } = fresh()
    const r = await transferStoreOwnership(DB, { sellerId: 1, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(true)
    expect(r.previousOwnerId).toBe(11)
    const s = db.prepare('SELECT linked_user_id l FROM sellers WHERE id = 1').get() as { l: number | null }
    expect(s.l).toBe(null)
    expect(ops(db, 1).find((o) => o.user_id === 77)?.role).toBe('owner')
  })

  it('같은 사람이면 SAME_OWNER — 아무것도 안 바꾼다', async () => {
    const { db, DB } = fresh()
    const r = await transferStoreOwnership(DB, { sellerId: 2, nextUserId: 22, actorUserId: null })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('SAME_OWNER')
    expect(ops(db, 2).find((o) => o.user_id === 22)?.role).toBe('owner')
  })

  /**
   * 🩸 이 시험이 내 코드의 결함을 잡았다. 처음엔 "이전 주인 한 명"만 강등했는데,
   * `resolveStoreOwnerUserId` 는 linked 가 없으면 `owner` 행 중 **가장 먼저 부여된 것**을 고른다.
   * 그래서 옛 owner 행이 남으면 이전이 끝난 뒤에도 **새 주인이 주인이 아니게 된다** — 에러 없이.
   */
  it('🔴 두 신호가 어긋난 매장에서도 끝나면 주인은 정확히 하나다', async () => {
    const { db, DB } = fresh()
    // 옛 구조(linked=11) 위에 옛 owner 행(55)이 따로 남아 있는 모순 상태.
    db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (1, 55, 'owner')`)
    const r = await transferStoreOwnership(DB, { sellerId: 1, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(true)
    const owners = ops(db, 1).filter((o) => o.role === 'owner' && !o.revoked_at)
    expect(owners.map((o) => o.user_id)).toEqual([77])
    // 그리고 판정 함수도 새 주인을 가리킨다(행만 맞고 판정이 어긋나면 의미가 없다).
    const { resolveStoreOwnerUserId } = await import('@/worker/utils/seller-operators')
    expect(await resolveStoreOwnerUserId(DB, 1)).toBe(77)
  })

  it('없는 매장이면 STORE_NOT_FOUND', async () => {
    const { DB } = fresh()
    expect((await transferStoreOwnership(DB, { sellerId: 999, nextUserId: 77, actorUserId: null })).code).toBe('STORE_NOT_FOUND')
  })

  it('🔒 이전 주인 몫이 남아 있으면 막고 — 그 순간 아무것도 쓰지 않는다', async () => {
    const { db, DB } = fresh()
    db.exec(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
             VALUES ('order', 'o1', 50000, 'platform:cash', 'seller:2', 2500)`)
    const r = await transferStoreOwnership(DB, { sellerId: 2, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('STORE_HANDOVER_BLOCKED')
    expect(r.receivable).toBeGreaterThan(0)
    // 새 주인이 생기지도, 옛 주인이 강등되지도 않았다.
    expect(ops(db, 2).some((o) => o.user_id === 77)).toBe(false)
    expect(ops(db, 2).find((o) => o.user_id === 22)?.role).toBe('owner')
  })

  it('마감(payouts 배정)이 끝나면 다시 통과한다 — 자물쇠는 잠그기만 하는 게 아니다', async () => {
    const { db, DB } = fresh()
    db.exec(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
             VALUES ('order', 'o1', 50000, 'platform:cash', 'seller:2', 2500)`)
    db.exec(`INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES ('seller', '2', 47500, 'pending')`)
    const r = await transferStoreOwnership(DB, { sellerId: 2, nextUserId: 77, actorUserId: null })
    expect(r.ok).toBe(true)
    expect(ops(db, 2).find((o) => o.user_id === 77)?.role).toBe('owner')
  })
})

describe('🙋 소유권 신청 — 접수와 심사', () => {
  it('등록증 경로가 우리 업로드가 아니면 받지 않는다', async () => {
    const { DB } = fresh()
    const r = await submitStoreClaim(DB, { sellerId: 3, userId: 77, certUrl: 'https://evil.example/x.jpg' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('BAD_CERT')
  })

  it('사업자번호 대조는 3상태다 — 일치 / 불일치 / 대조 불가(모름)', async () => {
    const a = await submitStoreClaim(fresh().DB, { sellerId: 3, userId: 77, businessNumber: '333-44-55555', certUrl: CERT })
    expect(a.bnoMatch).toBe(true)
    const b = await submitStoreClaim(fresh().DB, { sellerId: 3, userId: 77, businessNumber: '0000000000', certUrl: CERT })
    expect(b.bnoMatch).toBe(false)
    // 번호를 안 냈으면 불일치가 아니라 **모름** — false 로 뭉뚱그리면 어드민이 오판한다.
    const c = await submitStoreClaim(fresh().DB, { sellerId: 3, userId: 77, certUrl: CERT })
    expect(c.bnoMatch).toBe(null)
  })

  it('이미 주인이면 접수하지 않는다 — 할 일 없는 행이 심사 큐에 쌓인다', async () => {
    const { DB } = fresh()
    const r = await submitStoreClaim(DB, { sellerId: 2, userId: 22, certUrl: CERT })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('ALREADY_OWNER')
  })

  it('같은 사람이 같은 매장에 두 번 내면 한 장만 남는다 (멱등)', async () => {
    const { db, DB } = fresh()
    expect((await submitStoreClaim(DB, { sellerId: 3, userId: 77, certUrl: CERT })).ok).toBe(true)
    const dup = await submitStoreClaim(DB, { sellerId: 3, userId: 77, certUrl: CERT })
    expect(dup.ok).toBe(false)
    expect(dup.code).toBe('DUPLICATE')
    const n = db.prepare("SELECT COUNT(*) c FROM store_ownership_claims WHERE seller_id = 3").get() as { c: number }
    expect(n.c).toBe(1)
  })

  it('거절은 사유가 남고 소유권은 움직이지 않는다', async () => {
    const { db, DB } = fresh()
    const s = await submitStoreClaim(DB, { sellerId: 3, userId: 77, certUrl: CERT })
    const r = await decideStoreClaim(DB, { claimId: s.claimId!, adminUserId: 10, approve: false, reason: '등록증 흐림' })
    expect(r.ok).toBe(true)
    const row = db.prepare('SELECT status, decision_reason r FROM store_ownership_claims WHERE id = ?').get(s.claimId!) as { status: string; r: string }
    expect(row.status).toBe('rejected')
    expect(row.r).toBe('등록증 흐림')
    expect(ops(db, 3).some((o) => o.user_id === 77)).toBe(false)
  })

  it('승인하면 주인이 바뀌고, 같은 매장의 다른 신청은 자동 종료된다', async () => {
    const { db, DB } = fresh()
    const mine = await submitStoreClaim(DB, { sellerId: 3, userId: 77, certUrl: CERT })
    const other = await submitStoreClaim(DB, { sellerId: 3, userId: 88, certUrl: CERT })
    const r = await decideStoreClaim(DB, { claimId: mine.claimId!, adminUserId: 10, approve: true, reason: '등록증 확인' })
    expect(r.ok).toBe(true)
    expect(ops(db, 3).find((o) => o.user_id === 77)?.role).toBe('owner')
    const rows = db.prepare('SELECT id, status FROM store_ownership_claims ORDER BY id').all() as Array<{ id: number; status: string }>
    expect(rows.find((x) => x.id === mine.claimId)?.status).toBe('approved')
    expect(rows.find((x) => x.id === other.claimId)?.status).toBe('cancelled')
  })

  it('🔴 자물쇠에 막히면 신청서는 pending 그대로 남는다 — 승인됐다고 찍어 두면 큐에서 사라진다', async () => {
    const { db, DB } = fresh()
    db.exec(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
             VALUES ('order', 'o1', 50000, 'platform:cash', 'seller:2', 2500)`)
    const s = await submitStoreClaim(DB, { sellerId: 2, userId: 77, certUrl: CERT })
    const r = await decideStoreClaim(DB, { claimId: s.claimId!, adminUserId: 10, approve: true, reason: '등록증 확인' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TRANSFER_BLOCKED')
    const row = db.prepare('SELECT status FROM store_ownership_claims WHERE id = ?').get(s.claimId!) as { status: string }
    expect(row.status).toBe('pending')
    expect(ops(db, 2).find((o) => o.user_id === 22)?.role).toBe('owner')
  })

  it('이미 처리된 신청은 다시 처리되지 않는다', async () => {
    const { DB } = fresh()
    const s = await submitStoreClaim(DB, { sellerId: 3, userId: 77, certUrl: CERT })
    await decideStoreClaim(DB, { claimId: s.claimId!, adminUserId: 10, approve: false, reason: '보류' })
    const again = await decideStoreClaim(DB, { claimId: s.claimId!, adminUserId: 10, approve: true, reason: '재검토' })
    expect(again.ok).toBe(false)
    expect(again.code).toBe('NOT_PENDING')
  })
})

describe('🔌 배선 — 라우트가 SSOT 를 부르는가', () => {
  const admin = stripComments(readFileSync('src/features/admin/api/admin-store-owner.routes.ts', 'utf8'))
  const claims = stripComments(readFileSync('src/features/seller/api/seller-store-claims.routes.ts', 'utf8'))
  const idx = stripComments(readFileSync('src/worker/index.ts', 'utf8'))
  const stores = stripComments(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf8'))

  it('어드민 이전 라우트가 transferStoreOwnership 을 부른다', () => {
    expect(admin).toMatch(/transferStoreOwnership\(\s*DB\s*,\s*\{\s*sellerId\s*,\s*nextUserId:\s*target\.id/)
  })

  it('🔴 어드민 경로는 actorUserId 에 어드민 id 를 넣지 않는다 (id 공간이 섞이면 조용히 오판한다)', () => {
    expect(admin).toMatch(/actorUserId:\s*null/)
    expect(admin).not.toMatch(/actorUserId:\s*adminId/)
  })

  it('승인·이전은 2FA + 감사로그를 거친다', () => {
    expect(admin).toMatch(/'\/stores\/:sellerId\/owner',[\s\S]{0,160}?require2FA\(\)/)
    expect(admin).toMatch(/auditLog\('stores\.transfer_owner'\)/)
    expect(admin).toMatch(/auditLog\('stores\.decide_claim'\)/)
  })

  it('어드민 라우터가 실제로 마운트돼 있다 — 안 붙으면 404 이고 아무 에러도 안 난다', () => {
    expect(idx).toMatch(/adminApp\.route\('\/',\s*adminStoreOwnerRoutes\)/)
  })

  it('소비자 신청 라우트가 매장 라우터에 등록돼 있다', () => {
    expect(stores).toMatch(/registerStoreClaimRoutes\(app,\s*resolveActorUserId\)/)
  })

  it('조회가 지금 주인이 누구인지는 알려주지 않는다 — 번호 하나로 남의 계정을 열람하게 두지 않는다', () => {
    expect(claims).toMatch(/has_owner:/)
    expect(claims).not.toMatch(/owner_user_id:/)
  })
})
