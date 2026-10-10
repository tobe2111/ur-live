/**
 * 💸 **매장 사장님의 정산 화면이 0건이었다** (2026-10-10 감사)
 *
 * ■ 무엇이 깨져 있었나
 *   `payouts-generate` cron 은 매장 몫 payout 에 `payoutPayeeType()` 으로 **`store_owner`** 를 박고,
 *   이용권 매출은 사용 시점에 **`merchant:N`** 으로만 쌓인다(#1591 이후). 그런데 셀러 정산 화면
 *   (`GET /api/seller/settlements/payouts`)은
 *     - payout 이력을 `payee_type = 'seller'` 로만,
 *     - 유보액을 `credit_account = 'seller:N'` 으로만
 *   물었다 ⇒ 매장 사장님에게 **지급 이력 0건 · 유보 0원**. 에러는 없다.
 *
 *   같은 클래스가 어드민 승인 가드에도 있었다 — `store_owner` 를 `merchant:N` 으로 바꿔 원장을 물으면
 *   `ledgerAccountAliases('merchant:N')` 가 `seller:N` 을 못 붙여서, 같은 가게의 `seller:N` 차감
 *   (중개사 몫·인플루언서 커미션)이 빠지고 승인 상한이 **과대**로 읽혔다.
 *
 * ■ 어떻게 재나 — 실제 함수를 실제 sqlite 에
 *
 * ■ 못 보는 것
 *   - HTTP 층(JWT·스코프). 배선은 아래 소스 단언이 본다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { loadSellerPayoutRows, loadSellerHeld } from '@/features/seller/api/seller-settlements/payouts'
import { payoutRowLedgerAccount, paidPayeeAliases } from '@/worker/utils/payout-account'
import { getLedgerReceivable } from '@/worker/utils/ledger'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function fakeD1() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL,
      amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL,
      fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT NOT NULL, payee_id TEXT NOT NULL,
      amount INTEGER NOT NULL, period_start TEXT, period_end TEXT, status TEXT NOT NULL,
      account_number TEXT, account_holder TEXT, admin_memo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, approved_at TEXT, sent_at TEXT);
  `)
  const run = (sql: string, binds: unknown[]) => {
    if (/^\s*CREATE\s/i.test(sql)) return []
    return db.prepare(sql).all(...(binds as never[]))
  }
  const DB = {
    prepare(sql: string) {
      const self = { _b: [] as unknown[],
        bind(...b: unknown[]) { self._b = b; return self },
        async first<T>() { return (run(sql, self._b)[0] ?? null) as T },
        async all<T>() { return { results: run(sql, self._b) as T[] } },
        async run() { run(sql, self._b); return { meta: { changes: 0 } } },
      }
      return self
    },
  } as unknown as D1Database
  return { db, DB }
}

describe('① 셀러 정산 화면 — store_owner payout 과 merchant:N 적립을 센다', () => {
  it('cron 이 만든 store_owner payout 이 이력에 뜬다(seller 행과 함께)', async () => {
    const { db, DB } = fakeD1()
    db.exec(`
      INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES ('store_owner', '14', 9000, 'sent');
      INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES ('seller', '14', 500, 'pending');
      INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES ('store_owner', '15', 7777, 'sent');
      INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES ('agency', '14', 1111, 'sent');
    `)
    const rows = await loadSellerPayoutRows(DB, 14, null)
    expect(rows.map(r => Number(r.amount)).sort((a, b) => a - b)).toEqual([500, 9000])
  })

  it('유보액이 merchant:N 의 사용 시점 적립을 센다', async () => {
    const { db, DB } = fakeD1()
    db.exec(`
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('voucher_used', 'v1', 900, 'platform:escrow', 'merchant:14');
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
        VALUES ('x', 'v2', 300, 'user:3', 'seller:14', 100);
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('voucher_used', 'v3', 5000, 'platform:escrow', 'merchant:15');
    `)
    // heldSql 은 payout-hold 가 만드는 'AND …' 조각 — 여기선 전부 유보로 본다.
    expect(await loadSellerHeld(DB, 14, 'AND 1 = 1')).toBe(900 + 200)
    expect(await loadSellerHeld(DB, 14, 'AND 1 = 0')).toBe(0)
  })
})

describe('② 어드민 승인 가드 — 접힌 계정으로 원장을 묻는다', () => {
  it('store_owner/seller payout 행은 seller:N 으로 접힌다', () => {
    expect(payoutRowLedgerAccount('store_owner', '14')).toBe('seller:14')
    expect(payoutRowLedgerAccount('seller', 14)).toBe('seller:14')
    expect(payoutRowLedgerAccount('agency', '3')).toBe('agency:3')
    expect(payoutRowLedgerAccount('seller', 'null')).toBeNull()
  })
  it('접힌 계정이면 seller:N 차감(중개사 몫)이 승인 상한에서 빠진다', async () => {
    const { db, DB } = fakeD1()
    db.exec(`
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('voucher_used', 'v1', 10000, 'platform:escrow', 'merchant:14');
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
        VALUES ('broker_share', 'GB-1', 1000, 'seller:14', 'influencer:100');
    `)
    const account = payoutRowLedgerAccount('store_owner', '14')!
    expect(await getLedgerReceivable(DB, account)).toBe(9000)
    // 종전 방식(merchant:N 하나)은 차감을 못 봐서 10000 이었다.
    expect(await getLedgerReceivable(DB, 'merchant:14')).toBe(10000)
    expect(paidPayeeAliases(account)).toEqual(['seller:14', 'store_owner:14'])
  })
})

describe('③ 배선', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('셀러 정산 화면이 두 헬퍼를 부르고 payee_type = \'seller\' 하드코딩이 없다', () => {
    const s = src('src/features/seller/api/seller-settlements/payouts.ts')
    expect(s).toMatch(/await loadSellerPayoutRows\(c\.env\.DB, sellerId, since\)/)
    expect(s).toMatch(/await loadSellerHeld\(c\.env\.DB, sellerId, hold\.heldSql\)/)
    expect(s).not.toMatch(/payee_type = 'seller'/)
  })
  it('어드민 승인·목록이 payoutRowLedgerAccount 로 원장을 묻는다(merchant 치환 없음)', () => {
    const s = src('src/features/admin/api/admin-payouts.routes.ts')
    expect((s.match(/payoutRowLedgerAccount\((String\()?(row|r)\.payee_type/g) || []).length).toBe(2)
    expect(s).not.toMatch(/=== 'store_owner' \? 'merchant'/)
  })
})
