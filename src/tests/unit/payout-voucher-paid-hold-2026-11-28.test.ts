/**
 * 🏨🍽️ 이용권 사용분은 결제일 기준으로 익는다 (2026-11-28 결재 `2026-11-28-stay-next-day-payout` 안 2)
 *
 * 지킬 것: ① 미리 결제한 이용권(숙소·식당)은 **사용 다음 날**이면 정산 대상 ② 방금 결제한 이용권은 결제 후 7일까지 유보
 *  ③ 사용 당일은 유보 ④ 이용권이 아닌 적립은 종전 14일 ⑤ 이용권 행이 없으면 종전 14일(fail-closed)
 *  ⑥ 화면용 여집합(heldSql)과 집계가 정확히 나뉜다 ⑦ 상관 서브쿼리가 바깥 created_at 을 쓴다(한정자)
 * 실제 `payoutCreditsSql` 을 진짜 SQLite 에 돌린다.
 * 못 보는 것: 토스의 실제 입금일(공휴일 포함) — 7일은 근사다(설·추석엔 설정을 올린다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { buildPayoutHoldSql, DEFAULT_VOUCHER_PAID_HOLD_DAYS } from '@/worker/utils/payout-hold'
import { payoutCreditsSql } from '@/worker/utils/payout-account'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const ago = (d: number) => new Date(Date.now() - d * 86400_000).toISOString().slice(0, 19).replace('T', ' ')

function fresh(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, reference_id TEXT,
    amount INTEGER, fee_amount INTEGER DEFAULT 0, debit_account TEXT, credit_account TEXT, created_at DATETIME)`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY, created_at DATETIME)`)
  return db
}
const voucherUse = (db: Db, vid: number, paidAgo: number | null, usedAgo: number, amount = 10_000) => {
  if (paidAgo !== null) db.prepare('INSERT INTO vouchers (id, created_at) VALUES (?, ?)').run(vid, ago(paidAgo))
  db.prepare(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, created_at)
    VALUES ('voucher_used', ?, ?, 'platform:escrow', 'merchant:1', ?)`).run(`voucher:${vid}`, amount, ago(usedAgo))
}
const other = (db: Db, ev: string, ago_: number, amount = 5_000) =>
  db.prepare(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, created_at)
    VALUES (?, 'x:1', ?, 'platform:escrow', 'merchant:1', ?)`).run(ev, amount, ago(ago_))
const total = (db: Db, holdSql: string) => {
  const r = db.prepare(payoutCreditsSql(holdSql)).all() as Array<{ account: string; total: number }>
  return Number(r.find((x) => x.account.endsWith(':1'))?.total ?? 0)
}
const held = (db: Db, heldSql: string) =>
  Number((db.prepare(`SELECT COALESCE(SUM(amount),0) h FROM ledger_entries WHERE credit_account='merchant:1' ${heldSql}`).get() as { h: number }).h)

describe('이용권 결제일 기준 유보', () => {
  const H = buildPayoutHoldSql(14, DEFAULT_VOUCHER_PAID_HOLD_DAYS)

  it('① 10일 전 결제 · 어제(+1.5일) 사용 → 익는다(숙소: 체크인 다음 날)', () => {
    const db = fresh(); voucherUse(db, 1, 10, 1.5)
    expect(total(db, H.sql)).toBe(10_000)
  })
  it('② 3일 전 결제 · 2일 전 사용 → 결제 7일 전이라 유보(식당 당일 구매형)', () => {
    const db = fresh(); voucherUse(db, 1, 3, 2)
    expect(total(db, H.sql)).toBe(0)
  })
  it('③ 사용 당일은 유보', () => {
    const db = fresh(); voucherUse(db, 1, 30, 0.2)
    expect(total(db, H.sql)).toBe(0)
  })
  it('④ 이용권이 아닌 적립은 종전 14일', () => {
    const db = fresh(); other(db, 'group_buy_join', 10); other(db, 'group_buy_join', 20)
    expect(total(db, H.sql)).toBe(5_000)
  })
  it('⑤ 이용권 행이 없으면 종전 14일(fail-closed)', () => {
    const db = fresh(); voucherUse(db, 9, null, 3)
    expect(total(db, H.sql)).toBe(0)
    const db2 = fresh(); voucherUse(db2, 9, null, 20)
    expect(total(db2, H.sql)).toBe(10_000)
  })
  it('⑥ 화면용 여집합과 집계가 정확히 나뉜다', () => {
    const db = fresh(); voucherUse(db, 1, 10, 1.5); voucherUse(db, 2, 3, 2, 7_000); other(db, 'group_buy_join', 3, 2_000)
    expect(total(db, H.sql) + held(db, H.heldSql)).toBe(19_000)
    expect(held(db, H.heldSql)).toBe(9_000)
  })
  it('⑦ 한정자 — 서브쿼리 안에서도 바깥 적립 시각을 본다(사용 당일 적립은 결제가 오래돼도 유보)', () => {
    const db = fresh(); voucherUse(db, 1, 60, 0.1)
    expect(total(db, H.sql)).toBe(0)
  })
  it('⑧ 두 번째 인자가 없으면 종전 문장 그대로(호환)', () => {
    expect(buildPayoutHoldSql(10).sql).toBe("AND created_at <= datetime('now', '-10 days')")
    expect(buildPayoutHoldSql(0, 7).sql).toBe('')
  })
})
