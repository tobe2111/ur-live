/**
 * 🔐 **계좌를 바꾼 뒤 재확인 전인데 주간 정산이 그 계좌로 나갈 수 있었다** (2026-10-10 감사)
 *
 * ■ 무엇이 깨져 있었나
 *   셀러가 계좌를 바꾸면 `sellers.is_verified=0` 이 되고 어드민 재검증(`verify-account`) 전까지
 *   **출금 신청**은 막힌다. 그런데 주간 정산(payouts)의 승인·송금·이체파일은 그 값을 안 읽었다.
 *   세션을 탈취해 계좌를 바꾸면 다음 주 정산이 그 계좌로 그대로 나간다.
 *   그리고 payout 행은 **생성 시점 계좌**를 스냅샷하므로, 재확인이 끝나도 행에 탈취자 계좌가
 *   박혀 있을 수 있다(STALE).
 *
 * ■ 무엇을 재나 — 실제 `markPayoutSent` · `checkPayeeAccountCurrent` 를 sqlite 에
 *
 * ■ 못 보는 것
 *   - 어드민 화면에서 토스트가 실제로 뜨는지(배선만 본다)
 *   - 계좌 변경을 탐지하는 쪽(seller-profile)의 정확성 — 그건 기존 가드 몫
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { markPayoutSent, checkPayeeAccountCurrent } from '@/worker/utils/payout-sent'

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
          return { meta: { changes: Number(r.changes) } }
        },
      }
      return self
    },
  } as unknown as D1Database
}

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, bank_name TEXT, bank_account TEXT,
      account_holder TEXT, status TEXT, seller_type TEXT, is_verified INTEGER DEFAULT 1);
    CREATE TABLE payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT NOT NULL, payee_id TEXT NOT NULL,
      amount INTEGER NOT NULL, period_start TEXT, period_end TEXT, status TEXT NOT NULL, bank_name TEXT,
      account_number TEXT, account_holder TEXT, kind TEXT, sent_at TEXT, transaction_id TEXT, admin_memo TEXT);
    INSERT INTO sellers (id, business_name, bank_name, bank_account, account_holder, status, seller_type)
      VALUES (14, '홍대돈까스', '국민은행', '123-45-6789', '김사장', 'approved', 'store_owner');
    INSERT INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, bank_name, account_number, account_holder)
      VALUES ('store_owner', '14', 20000, '2026-10-01', '2026-10-07', 'approved', '국민은행', '123-45-6789', '김사장');
  `)
  return { db, DB: d1(db) }
}
const status = (db: Db) => (db.prepare('SELECT status FROM payouts WHERE id = 1').get() as { status: string }).status

describe('① 송금 완료 — 계좌 재확인 전이면 막는다', () => {
  it('is_verified=0 이면 PAYOUT_ACCOUNT_UNVERIFIED · 행은 그대로', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE sellers SET is_verified = 0 WHERE id = 14`)
    const r = await markPayoutSent(DB, 1, 'TX-1')
    expect(r).toMatchObject({ ok: false, code: 'PAYOUT_ACCOUNT_UNVERIFIED' })
    expect(status(db)).toBe('approved')
  })
  it('어드민이 재검증하면(is_verified=1) 통과한다', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE sellers SET is_verified = 0 WHERE id = 14`)
    expect((await markPayoutSent(DB, 1, 'TX-1')).ok).toBe(false)
    db.exec(`UPDATE sellers SET is_verified = 1 WHERE id = 14`)
    expect((await markPayoutSent(DB, 1, 'TX-1')).ok).toBe(true)
    expect(status(db)).toBe('sent')
  })
  it('생성 뒤 계좌가 바뀌었으면(재확인을 마쳤어도) 옛 계좌로 안 보낸다 — PAYOUT_ACCOUNT_STALE', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE sellers SET bank_account = '999-99-9999', is_verified = 1 WHERE id = 14`)
    expect(await markPayoutSent(DB, 1, 'TX-1')).toMatchObject({ ok: false, code: 'PAYOUT_ACCOUNT_STALE' })
    expect(status(db)).toBe('approved')
  })
  it('하이픈·공백만 다르면 같은 계좌다', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE sellers SET bank_account = '1234 5678 9' WHERE id = 14`)
    expect((await markPayoutSent(DB, 1, 'TX-1')).ok).toBe(true)
  })
})

describe('② 예외 — 손바뀜 마감과 셀러 아닌 payee', () => {
  it('손바뀜 마감 행은 옛 주인 계좌가 목적이라 검사하지 않는다', async () => {
    const { DB } = fresh()
    const r = await checkPayeeAccountCurrent(DB, { payee_type: 'seller', payee_id: '14', account_number: '000-0', kind: 'handover_closeout' })
    expect(r.ok).toBe(true)
  })
  it('에이전시·유저 payee 는 이 게이트 대상이 아니다', async () => {
    const { DB } = fresh()
    expect((await checkPayeeAccountCurrent(DB, { payee_type: 'agency', payee_id: '14', account_number: 'x' })).ok).toBe(true)
    expect((await checkPayeeAccountCurrent(DB, { payee_type: 'user', payee_id: '14', account_number: 'x' })).ok).toBe(true)
  })
})

describe('③ 배선 — 승인·일괄 승인·이체 파일·화면', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
  const R = src('src/features/admin/api/admin-payouts.routes.ts')
  it('단건 승인이 CAS 전에 검사하고 code 를 돌려준다', () => {
    const at = R.indexOf("adminPayoutsRoutes.patch('/admin/payouts/:id/approve'")
    const body = R.slice(at, R.indexOf("adminPayoutsRoutes.patch('/admin/payouts/:id/sent'"))
    const chk = body.indexOf('await checkPayeeAccountCurrent(DB, row)')
    expect(chk).toBeGreaterThan(0)
    expect(body.indexOf("SET status = 'approved'")).toBeGreaterThan(chk)
    expect(body).toMatch(/code: acctCheck\.code/)
  })
  it('일괄 승인도 같은 검사를 건별로 한다', () => {
    const at = R.indexOf("adminPayoutsRoutes.patch('/admin/payouts/bulk-approve'")
    const body = R.slice(at, at + 2000)
    expect(body).toMatch(/const chk = await checkPayeeAccountCurrent\(DB, pr\)/)
    expect(body, '검사만 하고 막지 않으면 헛도는 가드다').toMatch(/if \(!chk\.ok\) \{ blocked\.push\([^)]*\); continue \}/)
  })
  it('이체 파일이 막힌 건을 빼고 X-Blocked-Count 로 알린다', () => {
    const at = R.indexOf("adminPayoutsRoutes.get('/admin/payouts/transfer-csv'")
    const body = R.slice(at, at + 2500)
    expect(body).toMatch(/\(await checkPayeeAccountCurrent\(DB, r\)\)\.ok/)
    expect(body).toMatch(/'X-Blocked-Count'/)
  })
  it('화면이 승인 거절 사유를 보여 준다', () => {
    const page = src('src/pages/AdminPayoutsPage.tsx')
    const at = page.indexOf('async function approve(')
    expect(page.slice(at, at + 700)).toMatch(/ax\.response\?\.data\?\.error/)
    expect(src('src/pages/admin-payouts/BulkPayoutBar.tsx')).toMatch(/x-blocked-count/)
  })
})
