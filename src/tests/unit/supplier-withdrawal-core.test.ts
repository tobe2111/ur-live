import { describe, it, expect } from 'vitest'
import { reserveForWithdrawal, releaseReservation, settleWithdrawalLedger, loadSpendable } from '@/features/supply/api/supplier-withdrawal-core'

/**
 * 🏦 2026-06-09 제조사 정산 출금 머니 코어 — 원자적 예약/복원/확정 불변식 고정 (실제 송금되는 돈).
 *   spendable = available - reserved. reserve 는 spendable>=amt 일 때만(초과/음수/동시중복 불가).
 *   release(반려) 는 reserved 복원, settle(송금완료) 는 reserved 해제 + available 순감.
 *   stateful mock D1: SQL substring → in-memory balances/settlements (조건부 UPDATE 의미 충실 재현).
 */
function makeDB(initial: Record<number, { available: number; reserved: number }> = {}) {
  const bal = new Map<number, { available: number; reserved: number }>(
    Object.entries(initial).map(([k, v]) => [Number(k), { ...v }]),
  )
  const settlements: { supplier_id: number; supply_amount: number; source: string }[] = []
  const row = (sid: number) => bal.get(sid) ?? { available: 0, reserved: 0 }

  const run = (sql: string, a: unknown[]) => {
    // settleWithdrawalLedger 의 UPDATE (reserved -= ? AND available -= ?)
    if (sql.includes('available_amount = MAX(0')) {
      const amtR = Number(a[0]); const amtA = Number(a[1]); const sid = Number(a[2]); const r = row(sid)
      r.reserved = Math.max(0, r.reserved - amtR); r.available = Math.max(0, r.available - amtA); bal.set(sid, r)
      return { meta: { changes: 1 } }
    }
    // reserveForWithdrawal CAS (reserved += ? WHERE spendable >= ?)
    if (sql.includes('reserved_amount = COALESCE(reserved_amount,0) + ?')) {
      const amt = Number(a[0]); const sid = Number(a[1]); const min = Number(a[2]); const r = row(sid)
      if ((r.available - r.reserved) >= min) { r.reserved += amt; bal.set(sid, r); return { meta: { changes: 1 } } }
      return { meta: { changes: 0 } }
    }
    // releaseReservation (reserved -= ?, available 안 건드림)
    if (sql.includes('reserved_amount = MAX(0')) {
      const amt = Number(a[0]); const sid = Number(a[1]); const r = row(sid)
      r.reserved = Math.max(0, r.reserved - amt); bal.set(sid, r); return { meta: { changes: 1 } }
    }
    if (sql.includes('INSERT INTO supplier_settlements')) {
      settlements.push({ supplier_id: Number(a[0]), supply_amount: Number(a[2]), source: 'withdrawal' }); return { meta: { changes: 1 } }
    }
    return { meta: { changes: 0 } }
  }
  const first = (sql: string, a: unknown[]) => {
    if (sql.includes('FROM supplier_balances')) { const r = row(Number(a[0])); return { available: r.available, reserved: r.reserved } }
    return null
  }
  const db = {
    prepare(sql: string) {
      const make = (a: unknown[]) => ({ run: async () => run(sql, a), first: async () => first(sql, a), all: async () => ({ results: [] }) })
      return { ...make([]), bind: (...a: unknown[]) => make(a) }
    },
  }
  return { db: db as never, bal, settlements }
}

describe('supplier-withdrawal-core — reserveForWithdrawal (원자 예약 CAS)', () => {
  it('spendable 충분 → 예약 + spendableAfter 정확', async () => {
    const { db, bal } = makeDB({ 9: { available: 10000, reserved: 0 } })
    expect(await reserveForWithdrawal(db, 9, 3000)).toEqual({ ok: true, spendableAfter: 7000 })
    expect(bal.get(9)).toEqual({ available: 10000, reserved: 3000 })
  })

  it('spendable 부족(available-reserved<amt) → ok:false, 예약 안 함', async () => {
    const { db, bal } = makeDB({ 9: { available: 5000, reserved: 3000 } }) // spendable 2000
    expect(await reserveForWithdrawal(db, 9, 3000)).toEqual({ ok: false, spendable: 2000 })
    expect(bal.get(9)!.reserved).toBe(3000)
  })

  it('동시 2건이 같은 잔액 초과인출 불가 (순차 시뮬)', async () => {
    const { db } = makeDB({ 9: { available: 5000, reserved: 0 } })
    expect((await reserveForWithdrawal(db, 9, 3000)).ok).toBe(true)  // reserved 3000, spendable 2000
    expect((await reserveForWithdrawal(db, 9, 3000)).ok).toBe(false) // 2000 < 3000 → 차단
  })

  it('0/음수 방어', async () => {
    const { db } = makeDB({ 9: { available: 5000, reserved: 0 } })
    expect((await reserveForWithdrawal(db, 9, 0)).ok).toBe(false)
    expect((await reserveForWithdrawal(db, 9, -100)).ok).toBe(false)
  })
})

describe('supplier-withdrawal-core — release(반려) / settle(송금완료)', () => {
  it('반려 → reserved 복원(available 불변, spendable 원복)', async () => {
    const { db, bal } = makeDB({ 9: { available: 10000, reserved: 3000 } })
    await releaseReservation(db, 9, 3000)
    expect(bal.get(9)).toEqual({ available: 10000, reserved: 0 })
    expect((await loadSpendable(db, 9)).spendable).toBe(10000)
  })

  it('송금완료 → reserved 해제 + available 순감 + 음수 settlement 원장', async () => {
    const { db, bal, settlements } = makeDB({ 9: { available: 10000, reserved: 3000 } })
    await settleWithdrawalLedger(db, 9, 42, 3000)
    expect(bal.get(9)).toEqual({ available: 7000, reserved: 0 })
    expect((await loadSpendable(db, 9)).spendable).toBe(7000)
    expect(settlements.find((s) => s.source === 'withdrawal')?.supply_amount).toBe(-3000)
  })

  it('예약→송금완료 후 spendable 은 예약 시점과 동일(이중차감 없음)', async () => {
    const { db } = makeDB({ 9: { available: 10000, reserved: 0 } })
    await reserveForWithdrawal(db, 9, 4000)                 // spendable 6000
    expect((await loadSpendable(db, 9)).spendable).toBe(6000)
    await settleWithdrawalLedger(db, 9, 7, 4000)            // available 6000, reserved 0
    expect((await loadSpendable(db, 9)).spendable).toBe(6000) // 동일
  })
})
