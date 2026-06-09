import { describe, it, expect } from 'vitest'
import { deductDeposit, compensateDepositOrderOnce, loadDepositBalance, hasDepositRefundTxn } from '@/features/supply/api/wholesale-deposit-core'

/**
 * 🏦 2026-06-09 예치금 머니 코어 — 차감 CAS + 멱등 보상환불 불변식 고정 (테스트 0개였음, 실제 돈).
 *   코드리뷰 #1(무음손실)·#2(이중차감) 수정의 핵심: 차감은 balance>=amt 일 때만, 보상환불은
 *   wholesale_orders.refunded_amount CAS 로 1회만(동시/재시도/cron 어디서든 이중환불 불가).
 *   stateful mock D1: SQL substring → in-memory balances/orders/txns 상태 변이(조건부 UPDATE 의미 충실 재현).
 */
function makeDB(initial: { balances?: Record<number, number>; orders?: Record<number, { refunded_amount: number; status: string }> } = {}) {
  const balances = new Map<number, number>(Object.entries(initial.balances ?? {}).map(([k, v]) => [Number(k), v as number]))
  const orders = new Map<number, { refunded_amount: number; status: string }>(
    Object.entries(initial.orders ?? {}).map(([k, v]) => [Number(k), { ...(v as { refunded_amount: number; status: string }) }]),
  )
  const txns: { type: string; amount: number; ref_id: string | null }[] = []

  const run = (sql: string, a: unknown[]) => {
    if (sql.includes('INSERT OR IGNORE INTO wholesale_deposits')) {
      const sid = Number(a[0]); if (!balances.has(sid)) balances.set(sid, 0); return { meta: { changes: 1 } }
    }
    if (sql.includes('SET balance = balance - ?')) {
      const amt = Number(a[0]); const sid = Number(a[1]); const min = Number(a[2]); const cur = balances.get(sid) ?? 0
      if (cur >= min) { balances.set(sid, cur - amt); return { meta: { changes: 1 } } }
      return { meta: { changes: 0 } }
    }
    if (sql.includes('SET balance = balance + ?')) {
      const amt = Number(a[0]); const sid = Number(a[1]); balances.set(sid, (balances.get(sid) ?? 0) + amt); return { meta: { changes: 1 } }
    }
    if (sql.includes('UPDATE wholesale_orders SET refunded_amount')) {
      const amt = Number(a[0]); const id = Number(a[1]); const o = orders.get(id)
      if (o && (o.refunded_amount ?? 0) === 0 && o.status !== 'REFUNDED' && o.status !== 'PAID') {
        o.refunded_amount = amt; o.status = 'FAILED'; return { meta: { changes: 1 } }
      }
      return { meta: { changes: 0 } }
    }
    if (sql.includes('INSERT INTO wholesale_deposit_txns')) {
      txns.push({ type: String(a[1]), amount: Number(a[2]), ref_id: (a[4] ?? null) as string | null }); return { meta: { last_row_id: 1 } }
    }
    return { meta: { changes: 0 } }
  }
  const first = (sql: string, a: unknown[]) => {
    if (sql.includes('SELECT balance FROM wholesale_deposits')) return { balance: balances.get(Number(a[0])) ?? 0 }
    if (sql.includes("type = 'refund' AND ref_id")) {
      const ref = String(a[0]); return txns.some((t) => t.type === 'refund' && t.ref_id === ref) ? { x: 1 } : null
    }
    return null
  }
  const db = {
    prepare(sql: string) {
      const make = (a: unknown[]) => ({ run: async () => run(sql, a), first: async () => first(sql, a), all: async () => ({ results: [] }) })
      return { ...make([]), bind: (...a: unknown[]) => make(a) }
    },
  }
  return { db: db as never, balances, orders, txns }
}

describe('wholesale-deposit-core — deductDeposit (원자 차감 CAS)', () => {
  it('잔액 충분 → 차감 + balanceAfter 정확', async () => {
    const { db, balances } = makeDB({ balances: { 9: 10000 } })
    const r = await deductDeposit(db, 9, 3000)
    expect(r).toEqual({ ok: true, balanceAfter: 7000 })
    expect(balances.get(9)).toBe(7000)
  })

  it('잔액 부족 → ok:false + 현재 잔액, 차감 안 함(음수 불가)', async () => {
    const { db, balances } = makeDB({ balances: { 9: 2000 } })
    const r = await deductDeposit(db, 9, 3000)
    expect(r).toEqual({ ok: false, balance: 2000 })
    expect(balances.get(9)).toBe(2000)
  })

  it('잔액 == 주문액 경계 → 차감 후 0', async () => {
    const { db, balances } = makeDB({ balances: { 9: 5000 } })
    expect(await deductDeposit(db, 9, 5000)).toEqual({ ok: true, balanceAfter: 0 })
    expect(balances.get(9)).toBe(0)
  })

  it('행 없음(잔액 0) → 부족 처리', async () => {
    const { db } = makeDB()
    expect(await deductDeposit(db, 9, 1000)).toEqual({ ok: false, balance: 0 })
  })

  it('0/음수 금액 방어', async () => {
    const { db } = makeDB({ balances: { 9: 1000 } })
    expect((await deductDeposit(db, 9, 0)).ok).toBe(false)
    expect((await deductDeposit(db, 9, -100)).ok).toBe(false)
  })
})

describe('wholesale-deposit-core — compensateDepositOrderOnce (멱등 보상환불, 코드리뷰 #1·#2)', () => {
  it('미완료 주문 1회 환불 → 잔액 복원 + FAILED + refund 원장', async () => {
    const { db, balances, orders, txns } = makeDB({ balances: { 9: 0 }, orders: { 42: { refunded_amount: 0, status: 'PENDING' } } })
    expect(await compensateDepositOrderOnce(db, 42, 9, 5000, 'm')).toBe(true)
    expect(balances.get(9)).toBe(5000)
    expect(orders.get(42)).toEqual({ refunded_amount: 5000, status: 'FAILED' })
    expect(txns.find((t) => t.type === 'refund' && t.ref_id === '42')?.amount).toBe(5000)
  })

  it('이중호출(동시/재시도/cron) → 2번째는 no-op, 이중환불 불가', async () => {
    const { db, balances } = makeDB({ balances: { 9: 0 }, orders: { 42: { refunded_amount: 0, status: 'PENDING' } } })
    expect(await compensateDepositOrderOnce(db, 42, 9, 5000, 'm')).toBe(true)
    expect(await compensateDepositOrderOnce(db, 42, 9, 5000, 'm')).toBe(false)
    expect(balances.get(9)).toBe(5000) // 한 번만 환불됨
  })

  it('이미 PAID/REFUNDED 주문은 이 경로로 환불 안 함', async () => {
    const paid = makeDB({ balances: { 9: 0 }, orders: { 42: { refunded_amount: 0, status: 'PAID' } } })
    expect(await compensateDepositOrderOnce(paid.db, 42, 9, 5000, 'm')).toBe(false)
    expect(paid.balances.get(9)).toBe(0)
  })

  it('환불 후 hasDepositRefundTxn → true (멱등 가드 마커)', async () => {
    const { db } = makeDB({ balances: { 9: 0 }, orders: { 42: { refunded_amount: 0, status: 'PENDING' } } })
    await compensateDepositOrderOnce(db, 42, 9, 5000, 'm')
    expect(await hasDepositRefundTxn(db, 42)).toBe(true)
    expect(await loadDepositBalance(db, 9)).toBe(5000)
  })
})
