/**
 * 🏦 **cron·수동 생성 payout 이 은행 일괄이체 파일에서 통째로 빠졌다** (2026-10-10 감사)
 *
 * ■ 무엇이 깨져 있었나
 *   payout 을 만드는 세 곳(주간 cron · 어드민 수동 생성 · 손바뀜 마감)이 계좌를 각자 읽었고 셋 다
 *   `sellers.bank_name` 을 안 읽었다 → `payouts.bank_name` 이 늘 NULL → `isTransferable`(은행·번호·예금주
 *   셋 다 필요)이 거짓 → **은행 일괄이체 CSV 에서 전부 빠짐**(X-Skipped-Count 로만 보였다).
 *   예금주 칸엔 계좌 예금주(`account_holder`)가 아니라 **상호**(`business_name`)를 적었다.
 *
 *   함께 고친 것: 어드민 수동 생성의 기간 창이 차감 쪽에서 `A OR B OR C OR D AND 기간` 으로 묶여
 *   `user:` 차감에만 걸리던 OR 우선순위 결함.
 *
 * ■ 어떻게 재나 — `resolvePayeeAccount`·`handlePayoutsGenerate`·`payoutPeriodPendingSql` 를 실제 sqlite 에
 *
 * ■ 못 보는 것
 *   - 어드민 수동 생성 라우트(Hono) 실행 — 배선은 소스 단언으로 본다.
 *   - 실제 은행 업로드(은행마다 서식이 다르다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { resolvePayeeAccount, pickAccountHolder } from '@/worker/utils/payout-payee-account'
import { payoutPeriodPendingSql } from '@/worker/utils/payout-account'
import { isTransferable } from '@/worker/utils/payout-sent'
import { handlePayoutsGenerate } from '@/worker/cron/payouts-generate'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const exec = (sql: string, b: unknown[]) => db.prepare(sql)
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => exec(sql, binds).get(...(binds as never[])) ?? null,
        all: async () => ({ results: exec(sql, binds).all(...(binds as never[])) }),
        run: async () => {
          if (/^\s*CREATE\s/i.test(sql)) { try { db.exec(sql) } catch { /* exists */ } return { meta: { changes: 0 } } }
          const r = exec(sql, binds).run(...(binds as never[]))
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        },
      }
      return self
    },
  } as unknown as D1Database
}

function fresh(withVerified = true) {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, bank_name TEXT, bank_account TEXT,
      account_holder TEXT, status TEXT, seller_type TEXT ${withVerified ? ', is_verified INTEGER DEFAULT 1' : ''});
    CREATE TABLE users (id INTEGER PRIMARY KEY, bank_name TEXT, bank_account TEXT, account_holder TEXT, business_name TEXT);
    CREATE TABLE agencies (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL,
      amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL, fee_amount INTEGER DEFAULT 0,
      fee_account TEXT, metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT NOT NULL, payee_id TEXT NOT NULL,
      amount INTEGER NOT NULL, period_start TEXT, period_end TEXT, status TEXT NOT NULL, bank_name TEXT,
      account_number TEXT, account_holder TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(payee_type, payee_id, period_start, period_end));
    INSERT INTO platform_settings (key, value) VALUES ('payout_hold_days', '0');
    INSERT INTO sellers (id, business_name, bank_name, bank_account, account_holder, status, seller_type)
      VALUES (14, '홍대돈까스', '국민은행', '123-45-6789', '김사장', 'approved', 'store_owner');
    INSERT INTO sellers (id, business_name, bank_name, bank_account, account_holder, status, seller_type)
      VALUES (15, '대기매장', '신한은행', '111-1', '박대기', 'pending', 'store_owner');
    INSERT INTO sellers (id, business_name, bank_name, bank_account, account_holder, status, seller_type)
      VALUES (16, '상호만', '우리은행', '222-2', '', 'approved', 'influencer');
    INSERT INTO users (id, bank_name, bank_account, account_holder, business_name) VALUES (3, '하나은행', '333-3', '정유저', '유저상호');
  `)
  return { db, DB: d1(db) }
}

describe('① resolvePayeeAccount — 은행명·예금주를 함께 스냅샷한다', () => {
  it('매장: 은행명 포함, 예금주는 account_holder 우선, payee_type 은 역할에서', async () => {
    const { DB } = fresh()
    const a = await resolvePayeeAccount(DB, { kind: 'seller', id: '14' })
    expect(a).toMatchObject({ payeeType: 'store_owner', bankName: '국민은행', accountNumber: '123-45-6789',
      accountHolder: '김사장', eligible: true, accountVerified: true })
    expect(isTransferable({ bank_name: a.bankName, account_number: a.accountNumber, account_holder: a.accountHolder })).toBe(true)
  })
  it('예금주가 비었으면 상호로 폴백한다', async () => {
    const { DB } = fresh()
    expect((await resolvePayeeAccount(DB, { kind: 'seller', id: '16' })).accountHolder).toBe('상호만')
    expect(pickAccountHolder('  ', '상호')).toBe('상호')
    expect(pickAccountHolder(null, null)).toBeNull()
  })
  it('승인 전 매장은 eligible=false (돈은 사람이 승인한 매장에만)', async () => {
    const { DB } = fresh()
    expect((await resolvePayeeAccount(DB, { kind: 'seller', id: '15' })).eligible).toBe(false)
    expect((await resolvePayeeAccount(DB, { kind: 'seller', id: '999' })).eligible).toBe(false)
  })
  it('계좌 변경 후 미재확인(is_verified=0)을 그대로 알려 준다 · 컬럼 없는 env 는 검증된 것으로', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE sellers SET is_verified = 0 WHERE id = 14`)
    expect((await resolvePayeeAccount(DB, { kind: 'seller', id: '14' })).accountVerified).toBe(false)
    const legacy = fresh(false)
    const b = await resolvePayeeAccount(legacy.DB, { kind: 'seller', id: '14' })
    expect(b.accountVerified).toBe(true)
    expect(b.bankName).toBe('국민은행')
  })
  it('사업자 유저 payee 도 은행명을 싣는다', async () => {
    const { DB } = fresh()
    expect(await resolvePayeeAccount(DB, { kind: 'user', id: '3' })).toMatchObject({
      payeeType: 'user', bankName: '하나은행', accountNumber: '333-3', accountHolder: '정유저', eligible: true })
  })
})

describe('② 주간 cron — 만든 payout 이 일괄이체 파일에 실린다', () => {
  it('bank_name·account_holder 가 행에 박히고 isTransferable 이 참', async () => {
    const { db, DB } = fresh()
    db.exec(`
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('voucher_used', 'v1', 20000, 'platform:escrow', 'merchant:14');
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('voucher_used', 'v2', 20000, 'platform:escrow', 'merchant:15');
    `)
    const r = await handlePayoutsGenerate({ DB } as never)
    expect(r && r.created).toBe(1)
    const rows = db.prepare(`SELECT payee_type, payee_id, amount, bank_name, account_number, account_holder FROM payouts`).all() as Array<Record<string, unknown>>
    expect(rows).toEqual([{ payee_type: 'store_owner', payee_id: '14', amount: 20000, bank_name: '국민은행',
      account_number: '123-45-6789', account_holder: '김사장' }])
    expect(isTransferable(rows[0] as never)).toBe(true)
  })
  it('계좌 미재확인 매장도 payout 은 만든다 (받을 돈은 실재한다 — 막는 곳은 송금 직전)', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE sellers SET is_verified = 0 WHERE id = 14;
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('voucher_used', 'v1', 20000, 'platform:escrow', 'merchant:14');`)
    const r = await handlePayoutsGenerate({ DB } as never)
    expect(r && r.created).toBe(1)
  })
})

describe('③ 어드민 수동 생성 — 기간 창이 차감 양쪽에 대칭으로 걸린다', () => {
  it('기간 밖 seller:N 차감은 이번 기간 pending 에서 안 빠진다', () => {
    const { db } = fresh()
    db.exec(`
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, created_at)
        VALUES ('voucher_used', 'v1', 20000, 'platform:escrow', 'merchant:14', '2026-10-05 10:00:00');
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, created_at)
        VALUES ('broker_share', 'GB-0', 5000, 'seller:14', 'influencer:100', '2026-01-01 10:00:00');
    `)
    const rows = db.prepare(payoutPeriodPendingSql()).all(
      '2026-10-01 00:00:00', '2026-10-07 23:59:59', '2026-10-01 00:00:00', '2026-10-07 23:59:59', 1000) as Array<{ account: string; pending_amount: number }>
    expect(rows).toEqual([{ account: 'seller:14', pending_amount: 20000 }])
  })
})

describe('④ 배선 — 세 생성 경로가 같은 계좌 규칙을 쓴다', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('cron 과 어드민 수동 생성이 resolvePayeeAccount 를 부르고 bank_name 을 INSERT 에 싣는다', () => {
    const cron = src('src/worker/cron/payouts-generate.ts')
    expect(cron).toMatch(/await resolvePayeeAccount\(DB, payee\)/)
    expect(cron).toMatch(/acct\.bankName, acct\.accountNumber, acct\.accountHolder\)\.run\(\)/)
    expect(cron).not.toMatch(/business_name FROM sellers/)
    const admin = src('src/features/admin/api/admin-payouts.routes.ts')
    expect(admin).toMatch(/await resolvePayeeAccount\(DB, payee\)/)
    expect(admin).toMatch(/const bankName = acct\.bankName/)
    expect(admin).toMatch(/if \(!acct \|\| !acct\.eligible\)/)
  })
  it('손바뀜 마감도 은행명·예금주 규칙을 쓴다', () => {
    const h = src('src/features/admin/api/admin-payouts/handover-closeout.ts')
    expect(h).toMatch(/const holder = pickAccountHolder\(seller\.account_holder, seller\.business_name\)/)
    expect(h).toMatch(/seller\.bank_name \|\| null\)\.run\(\)/)
  })
})
