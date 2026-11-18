/**
 * 🧾 2026-11-18 장부 조정 — 대표 *"장부 조정 기능도 만들어줘"*. 라이브 두 건을 그대로 픽스처로 담아 진짜 SQLite 로 돌린다:
 *  ① 매장 14 이중 적립 950원 → 원장 순액 16,150 → 15,200, 지급 대기 #1 도 15,200. 같은 키 재전송은 아무것도 안 한다.
 *  ② 운영사 자기 거래 중개사 몫 620원 취소 → 잔액 0 · 매장 26 순액 0 · 두 번째 취소는 거부.
 *  ③ 안전: 승인된 지급 행·다른 payee·이상한 계정/금액/사유는 거부.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { postLedgerAdjustment, cancelAttributionShare, validateAdjustment } from '@/worker/utils/ledger-correction'
import { getLedgerReceivable } from '@/worker/utils/ledger'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function d1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const st = {
        bind: (...a: unknown[]) => { args = a; return st },
        first: async () => (db.prepare(sql).get(...(args as never[])) ?? null),
        all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
        run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return st
    },
    batch: async (sts: Array<{ run: () => Promise<unknown> }>) => Promise.all(sts.map((s) => s.run())),
  } as unknown as D1Database
}

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL, amount INTEGER NOT NULL,
      debit_account TEXT NOT NULL, credit_account TEXT NOT NULL, fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE payouts (id INTEGER PRIMARY KEY, payee_type TEXT, payee_id TEXT, amount INTEGER, status TEXT, admin_memo TEXT);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT);
    CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY, influencer_id TEXT, order_id INTEGER, commission_amount INTEGER, status TEXT, paid_at TEXT, clawback_reason TEXT, source TEXT);
    CREATE TABLE influencer_balances (influencer_id TEXT PRIMARY KEY, pending_amount INTEGER, available_amount INTEGER, updated_at TEXT);`)
  const L = db.prepare('INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount) VALUES (?, ?, ?, ?, ?, ?)')
  L.run('group_buy_join', 'GB-3-1789611467065', 1000, 'user:3', 'seller:14', 50)
  L.run('voucher_used', 'voucher:2', 950, 'platform:escrow', 'merchant:14', 0)
  L.run('voucher_used', 'voucher:3', 7125, 'platform:escrow', 'merchant:14', 0)
  L.run('voucher_used', 'voucher:5', 7125, 'platform:escrow', 'merchant:14', 0)
  L.run('broker_share', 'GB-1791348953534-9301', 620, 'seller:26', 'influencer:3', 0)
  db.exec(`INSERT INTO payouts VALUES (1, 'store_owner', '14', 16150, 'pending', NULL), (2, 'store_owner', '14', 5000, 'approved', NULL);
    INSERT INTO orders VALUES (91, 'GB-1791348953534-9301');
    INSERT INTO influencer_attributions VALUES (1, '3', 91, 620, 'pending', NULL, NULL, 'broker_share');
    INSERT INTO influencer_balances VALUES ('3', 620, 0, NULL);`)
  return { db, D: d1(db) }
}

const fix950 = { debitAccount: 'seller:14', creditAccount: 'platform:escrow', amount: 950, reason: '이중 적립 정정 — 같은 구매가 두 번 적힘', key: 'store14-dup-950', adminId: 10 }

describe('① 이중 적립 950원 정정', () => {
  it('원장 순액과 지급 대기 행이 함께 15,200원이 된다', async () => {
    const { db, D } = fixture()
    expect(await getLedgerReceivable(D, 'seller:14')).toBe(16150)
    const r = await postLedgerAdjustment(D, { ...fix950, payoutId: 1 })
    expect(r).toEqual({ ok: true, duplicate: false, payoutAmount: 15200 })
    expect(await getLedgerReceivable(D, 'seller:14')).toBe(15200)
    expect((db.prepare('SELECT admin_memo FROM payouts WHERE id = 1').get() as { admin_memo: string }).admin_memo).toContain('store14-dup-950')
  })
  it('같은 키를 다시 보내면 원장도 지급 행도 그대로다', async () => {
    const { db, D } = fixture()
    await postLedgerAdjustment(D, { ...fix950, payoutId: 1 })
    expect(await postLedgerAdjustment(D, { ...fix950, payoutId: 1 })).toEqual({ ok: true, duplicate: true })
    expect(await getLedgerReceivable(D, 'seller:14')).toBe(15200)
    expect((db.prepare('SELECT amount FROM payouts WHERE id = 1').get() as { amount: number }).amount).toBe(15200)
    expect((db.prepare("SELECT COUNT(*) n FROM ledger_entries WHERE event_type = 'admin_adjustment'").get() as { n: number }).n).toBe(1)
  })
})

describe('② 중개사 몫 620원 취소', () => {
  it('잔액·원장 둘 다 0, 두 번째는 거부', async () => {
    const { db, D } = fixture()
    const r = await cancelAttributionShare(D, { attributionId: 1, reason: '운영사 자기 거래 — 받으면 안 되는 몫' })
    expect(r).toEqual({ ok: true, amount: 620, ledgerReversed: true })
    expect((db.prepare("SELECT pending_amount p FROM influencer_balances WHERE influencer_id = '3'").get() as { p: number }).p).toBe(0)
    expect(await getLedgerReceivable(D, 'seller:26')).toBe(0)
    expect(await getLedgerReceivable(D, 'influencer:3')).toBe(0)
    const again = await cancelAttributionShare(D, { attributionId: 1, reason: '운영사 자기 거래 — 받으면 안 되는 몫' })
    expect(again.ok).toBe(false)
  })
})

describe('③ 안전장치', () => {
  it('원장 기록이 실패하면 지급 행도 원래대로 되돌린다', async () => {
    const { db, D } = fixture()
    db.exec('DROP TABLE ledger_entries; CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY, event_type TEXT, reference_id TEXT, amount INTEGER, debit_account TEXT, credit_account TEXT)')
    const r = await postLedgerAdjustment(D, { ...fix950, key: 'k-fail', payoutId: 1 })
    expect(r).toMatchObject({ ok: false, code: 'LEDGER_WRITE_FAILED' })
    expect((db.prepare('SELECT amount FROM payouts WHERE id = 1').get() as { amount: number }).amount).toBe(16150)
  })
  it('승인된 지급 행은 못 줄인다', async () => {
    const { D } = fixture()
    const r = await postLedgerAdjustment(D, { ...fix950, key: 'k-approved', payoutId: 2 })
    expect(r).toMatchObject({ ok: false, code: 'PAYOUT_NOT_PENDING' })
    expect(await getLedgerReceivable(D, 'seller:14')).toBe(16150)
  })
  it('지급 대상이 아닌 계정에서 빼려 하면 거부', async () => {
    const { D } = fixture()
    expect(await postLedgerAdjustment(D, { ...fix950, debitAccount: 'seller:26', key: 'k-mismatch', payoutId: 1 })).toMatchObject({ ok: false, code: 'PAYOUT_PAYEE_MISMATCH' })
  })
  it('지급 행 금액보다 크게 줄이려 하면 거부(원장도 안 바뀜)', async () => {
    const { D } = fixture()
    expect(await postLedgerAdjustment(D, { ...fix950, amount: 20000, key: 'k-big', payoutId: 1 })).toMatchObject({ ok: false, code: 'PAYOUT_CLAIM_FAILED' })
    expect(await getLedgerReceivable(D, 'seller:14')).toBe(16150)
  })
  it('계정·금액·사유·키 검사', () => {
    expect(validateAdjustment({ ...fix950, debitAccount: "seller:14' OR 1" })).toMatchObject({ ok: false, code: 'BAD_ACCOUNT' })
    expect(validateAdjustment({ ...fix950, creditAccount: 'seller:14' })).toMatchObject({ ok: false, code: 'SAME_ACCOUNT' })
    expect(validateAdjustment({ ...fix950, amount: 0 })).toMatchObject({ ok: false, code: 'BAD_AMOUNT' })
    expect(validateAdjustment({ ...fix950, amount: 1.5 })).toMatchObject({ ok: false, code: 'BAD_AMOUNT' })
    expect(validateAdjustment({ ...fix950, amount: 2_000_000 })).toMatchObject({ ok: false, code: 'BAD_AMOUNT' })
    expect(validateAdjustment({ ...fix950, reason: '' })).toMatchObject({ ok: false, code: 'NO_REASON' })
    expect(validateAdjustment({ ...fix950, key: 'a b' })).toMatchObject({ ok: false, code: 'BAD_KEY' })
    expect(validateAdjustment(fix950)).toEqual({ ok: true })
  })
})
