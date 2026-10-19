/**
 * 🚪 회원 탈퇴 — 돈·가게가 걸려 있으면 막는다 (2026-10-19 대표 결재 *"권장안대로 해줘"*)
 *
 * 결재 `docs/decisions/2026-10-19-account-deletion-assets.md` 안 2:
 *   안 쓴 매장 이용권 · 환급할 수 있는 충전 딜 · 처리 중인 딜 환급 · 주인인 가게 → 탈퇴 차단 + 정리하는 길.
 *   무상 딜(선물·보상)은 막지 않는다(고지 후 소멸). 쿠폰·찜·단골은 지금대로.
 *
 * 문자열 검사가 아니라 **실제 SQLite** 에 넣고 센다 — 막는 함수가 틀리면 손님 돈이 사라지거나
 * 영원히 못 나간다(둘 다 에러가 안 난다).
 *
 * ⚠️ 이 시험이 **못 보는 것**: D1 실제 스키마(컬럼이 라이브와 같은지 — 스키마 가드의 몫) ·
 *   화면 렌더(`visual-preview`) · 환급 시트가 실제로 신청을 보내는지(그건 `deal-cash-out` 시험).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readCode } from '../helpers/source-text'
import {
  countAccountDeleteBlockers,
  isAccountDeleteBlocked,
  type AccountDeleteBlockers,
} from '@/worker/utils/account-delete-blockers'

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
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
      }
      return self
    },
  } as unknown as D1Database
}

function fresh(opts: { noOperators?: boolean } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, firebase_uid TEXT)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, deal_only INTEGER, kt_alpha_gift_code TEXT)`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY, user_id TEXT, product_id INTEGER, status TEXT)`)
  db.exec(`CREATE TABLE user_points (user_id TEXT PRIMARY KEY, balance INTEGER, free_balance INTEGER NOT NULL DEFAULT 0, total_charged INTEGER DEFAULT 0)`)
  db.exec(`CREATE TABLE point_transactions (id INTEGER PRIMARY KEY, user_id TEXT, type TEXT, amount INTEGER)`)
  db.exec(`CREATE TABLE user_withdrawals (id INTEGER PRIMARY KEY, user_id TEXT, amount INTEGER, status TEXT)`)
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, status TEXT)`)
  if (!opts.noOperators) {
    db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY, seller_id INTEGER, user_id INTEGER, role TEXT, revoked_at TEXT)`)
  }
  db.exec(`INSERT INTO users VALUES (7, NULL)`)
  db.exec(`INSERT INTO products VALUES (1, 0, NULL), (2, 1, NULL), (3, 0, 'KT123')`)
  return { db, D: d1(db) }
}

async function count(D: D1Database, uid: string | number = 7): Promise<AccountDeleteBlockers> {
  const r = await countAccountDeleteBlockers(D, uid, true)
  if (!r.ok) throw new Error('blockers not ok')
  return r.blockers
}

describe('🎟️ 안 쓴 매장 이용권 — 지갑의 사용 가능과 같은 집합', () => {
  it('안 쓴 매장 이용권만 센다 (쓴 것·교환권·KT 기프티콘·남의 것은 아니다)', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO vouchers (user_id, product_id, status) VALUES
      ('7', 1, 'unused'), ('7', 1, 'unused'),
      ('7', 1, 'used'), ('7', 1, 'expired'),
      ('7', 2, 'unused'),   -- 교환권(딜 결제)
      ('7', 3, 'unused'),   -- KT 기프티콘
      ('8', 1, 'unused')    -- 남의 것`)
    const b = await count(D)
    expect(b.unused_vouchers).toBe(2)
    expect(isAccountDeleteBlocked(b)).toBe(true)
  })
})

describe('💸 딜 — 환급할 수 있는 충전 딜만 막고, 무상 딜은 막지 않는다', () => {
  it('충전한 딜이 남아 있으면 막는다(환급 화면과 같은 숫자)', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO user_points VALUES ('7', 5000, 1000, 4000)`)
    db.exec(`INSERT INTO point_transactions (user_id, type, amount) VALUES ('7', 'charge', 4000)`)
    const b = await count(D)
    expect(b.refundable_deal).toBe(4000)
    expect(isAccountDeleteBlocked(b)).toBe(true)
  })

  it('🔴 무상 딜(선물·보상)만 남았으면 막지 않는다 — 결재: 고지 후 소멸', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO user_points VALUES ('7', 1800, 1800, 0)`)
    const b = await count(D)
    expect(b.refundable_deal).toBe(0)
    expect(isAccountDeleteBlocked(b)).toBe(false)
  })

  it('충전하지 않은 유상 잔액(번 돈)은 환급 대상이 아니라 막지 않는다 — 막으면 영원히 못 나간다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO user_points VALUES ('7', 3000, 0, 0)`)
    const b = await count(D)
    expect(b.refundable_deal).toBe(0)
    expect(isAccountDeleteBlocked(b)).toBe(false)
  })

  it('처리 중인 딜 환급이 있으면 막는다 — 반려되면 딜이 탈퇴한 계정으로 돌아간다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO user_points VALUES ('7', 0, 0, 4000)`)
    db.exec(`INSERT INTO point_transactions (user_id, type, amount) VALUES ('7', 'charge', 4000)`)
    // 첫 호출이 환급 테이블을 만든다(ensure) — 그 뒤 대기 신청을 넣는다.
    await count(D)
    db.exec(`INSERT INTO deal_refund_requests (user_id, amount, bank_name, bank_account, account_holder, status)
             VALUES ('7', 4000, '국민', '12345678', '홍길동', 'requested')`)
    const b = await count(D)
    expect(b.deal_refund_pending).toBe(true)
    expect(b.refundable_deal).toBe(0)
    expect(isAccountDeleteBlocked(b)).toBe(true)
  })
})

describe('🏪 주인인 가게 — 회원 탈퇴는 가게를 닫지 않는다', () => {
  it('옛 길(linked_user_id)의 운영 중 가게를 센다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (10, 7, 'approved')`)
    expect((await count(D)).owned_stores).toBe(1)
  })

  it('주인 좌석(/store/new 길)을 센다 · 중개자·회수된 좌석은 아니다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (11, NULL, 'pending'), (12, NULL, 'approved'), (13, NULL, 'approved')`)
    db.exec(`INSERT INTO seller_operators (seller_id, user_id, role, revoked_at) VALUES
      (11, 7, 'owner', NULL), (12, 7, 'operator', NULL), (13, 7, 'owner', '2026-10-01')`)
    expect((await count(D)).owned_stores).toBe(1)
  })

  it('가게 탈퇴로 정지된 가게·반려된 신청은 막지 않는다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (14, 7, 'suspended'), (15, 7, 'rejected')`)
    const b = await count(D)
    expect(b.owned_stores).toBe(0)
    expect(isAccountDeleteBlocked(b)).toBe(false)
  })

  it('seller_operators 가 없는 옛 환경도 옛 길로 센다(통째로 실패하지 않는다)', async () => {
    const { db, D } = fresh({ noOperators: true })
    db.exec(`INSERT INTO sellers VALUES (16, 7, 'approved')`)
    expect((await count(D)).owned_stores).toBe(1)
  })
})

describe('🔒 아무것도 없으면 열리고, 못 세면 막는다', () => {
  it('정리할 게 없으면 탈퇴할 수 있다', async () => {
    const { D } = fresh()
    expect(isAccountDeleteBlocked(await count(D))).toBe(false)
  })

  it('딜을 못 읽으면 ok:false — 호출부가 막는다(충전 딜이 소리 없이 사라지지 않게)', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, firebase_uid TEXT)`)
    db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, deal_only INTEGER, kt_alpha_gift_code TEXT)`)
    db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY, user_id TEXT, product_id INTEGER, status TEXT)`)
    db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, status TEXT)`)
    // user_points 가 없다 → 환급 한도 SQL 이 던진다
    const r = await countAccountDeleteBlockers(d1(db), 7, true)
    expect(r.ok).toBe(false)
  })
})

describe('🔗 배선 — 서버가 최종 방어하고 화면은 서버 값만 쓴다', () => {
  const route = readCode('src/features/account/api/account.routes.ts')
  const del = route.slice(route.indexOf("accountRoutes.delete('/delete'"))

  it('탈퇴 실행 전에 같은 함수로 막는다 (409) · 못 세면 503', () => {
    const pre = del.indexOf('countAccountDeleteBlockers(')
    const run = del.indexOf('deleteUserAccount(')
    expect(pre, '탈퇴 경로가 막는 함수를 안 부른다').toBeGreaterThan(-1)
    expect(pre, '막는 검사가 탈퇴 실행보다 뒤에 있다').toBeLessThan(run)
    // 조건문 모양까지 본다 — `if (false && …)` 로 중성화해도 문자열은 남는다.
    expect(del.slice(pre, run)).toMatch(/if \(!pre\.ok\) \{[\s\S]{0,240}\}, 503\)/)
    expect(del.slice(pre, run)).toMatch(/if \(isAccountDeleteBlocked\(pre\.blockers\)\) \{[\s\S]{0,320}\}, 409\)/)
  })

  it('화면용 조회 경로가 있다', () => {
    expect(route).toMatch(/accountRoutes\.get\('\/delete-blockers', requireAuth\(\)/)
  })

  it('탈퇴 오류 응답이 서버 원문을 싣지 않는다', () => {
    expect(del).not.toMatch(/detail: errMsg|error: errMsg/)
    expect(del).toMatch(/safeError\(c, error/)
  })

  it('화면은 서버의 can_delete 로만 연다 — 이용권을 따로 세지 않는다', () => {
    const page = readCode('src/pages/AccountDeleteWarningPage.tsx')
    expect(page).toMatch(/api\.get\('\/api\/account\/delete-blockers'\)/)
    expect(page).toMatch(/const blockersClear = blockersQ\.data\?\.can_delete === true/)
    expect(page, '탈퇴 버튼이 막힘 판정 없이 열린다').toMatch(/const canProceed = agreed && !dealChecking && blockersClear &&/)
    expect(page, '화면이 이용권을 다시 센다 — 서버와 숫자가 갈린다').not.toMatch(/useMyVouchers|isUsableWalletItem/)
  })

  it('정리하는 길이 붙어 있다 — 막고 끝내지 않는다', () => {
    const ui = readCode('src/pages/account-delete/DeleteBlockers.tsx')
    expect(ui).toMatch(/to="\/my-vouchers"/)
    expect(ui).toMatch(/<RefundSheet\b/)
    expect(ui).toMatch(/sellerEntryPath\(STORE_WITHDRAW_PATH\)/)
    // 가게 탈퇴 버튼이 실제로 그 화면에 있다.
    expect(readCode('src/pages/SellerStoresPage.tsx')).toMatch(/<SellerWithdrawSection\b/)
  })
})
