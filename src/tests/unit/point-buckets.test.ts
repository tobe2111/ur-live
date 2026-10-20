import { describe, it, expect } from 'vitest'
import {
  computeFreeRestorePortion,
  refundDealPoints,
  creditFreePoints,
  PAID_BALANCE_SQL,
} from '@/worker/utils/point-buckets'
import { adjustUserPoints } from '@/worker/utils/point-ledger'
import type { D1Database } from '@cloudflare/workers-types'

/**
 * 💸 2026-07-05 딜 유상/무상 버킷 불변식:
 *  1. 차감은 항상 free 우선 — adjustUserPoints 차감 UPDATE 에 free_balance MAX(0,…) 절 포함,
 *     원장 free_delta = -min(freeBefore, |delta|).
 *  2. 무상 적립(bucket:'free' / creditFreePoints)은 free_balance 동시 증가 + free_delta=+amount.
 *  3. 환불 복원은 원장 역산 — computeFreeRestorePortion = min(refund, 무상차감누계-무상복원누계), 음수 불가.
 *  4. 원장 없음/ref 없음 → freePortion 0 (paid 복원 — 무상 세탁 방지 방향).
 */

interface Captured {
  sql: string
  params: unknown[]
}

function makeDb(opts: {
  freeBefore?: number
  spent?: number
  restored?: number
}) {
  const captured: Captured[] = []
  const db = {
    prepare(sql: string) {
      let params: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { params = a; return stmt },
        async first() {
          captured.push({ sql, params })
          if (sql.includes('AS fb')) return { fb: opts.freeBefore ?? 0 }
          if (sql.includes('AS spent')) return { spent: opts.spent ?? 0, restored: opts.restored ?? 0 }
          if (sql.includes('SELECT balance')) return { balance: 0 }
          return null
        },
        async run() {
          captured.push({ sql, params })
          return { meta: { changes: 1 } }
        },
        async all() { return { results: [] } },
      }
      return stmt
    },
    async batch() { return [] },
  }
  return { db: db as unknown as D1Database, captured }
}

describe('computeFreeRestorePortion — 무상 복원분 역산', () => {
  it('무상차감 3000 · 기복원 1000 · 환불 5000 → 2000 (outstanding 클램프)', async () => {
    const { db } = makeDb({ spent: 3000, restored: 1000 })
    expect(await computeFreeRestorePortion(db, 'ORD-1', 5000, 'u1')).toBe(2000)
  })
  it('환불액이 outstanding 보다 작으면 환불액으로 클램프', async () => {
    const { db } = makeDb({ spent: 3000, restored: 0 })
    expect(await computeFreeRestorePortion(db, 'ORD-1', 500, 'u1')).toBe(500)
  })
  it('ref 없음 → 0 (paid 복원 — 무상 세탁 방지)', async () => {
    const { db } = makeDb({ spent: 9999 })
    expect(await computeFreeRestorePortion(db, null, 5000, 'u1')).toBe(0)
    expect(await computeFreeRestorePortion(db, [null, undefined], 5000, 'u1')).toBe(0)
  })
  it('복원 누계가 차감 누계 초과(드리프트)여도 음수 불가', async () => {
    const { db } = makeDb({ spent: 100, restored: 500 })
    expect(await computeFreeRestorePortion(db, 'ORD-1', 1000, 'u1')).toBe(0)
  })
})

describe('refundDealPoints — 버킷 대칭 복원', () => {
  it('무상차감 이력 있으면 balance 전액 + free 는 무상분만 복원 + 원장 free_delta 기록', async () => {
    const { db, captured } = makeDb({ spent: 3000, restored: 0 })
    const res = await refundDealPoints(db, { userId: 'u1', amount: 5000, ref: 'ORD-1', description: 't' })
    expect(res.ok).toBe(true)
    expect(res.freePortion).toBe(3000)
    const upsert = captured.find(c => c.sql.includes('ON CONFLICT(user_id)'))
    expect(upsert).toBeTruthy()
    // bind: (uid, amount, freePortion)
    expect(upsert!.params[1]).toBe(5000)
    expect(upsert!.params[2]).toBe(3000)
    const tx = captured.find(c => c.sql.includes('INSERT INTO point_transactions'))
    expect(tx).toBeTruthy()
    expect(tx!.params[tx!.params.length - 1]).toBe(3000) // free_delta
  })
  it('금액 0/음수 → no-op false', async () => {
    const { db } = makeDb({})
    expect((await refundDealPoints(db, { userId: 'u1', amount: 0 })).ok).toBe(false)
    expect((await refundDealPoints(db, { userId: 'u1', amount: -10 })).ok).toBe(false)
  })
})

describe('creditFreePoints — 무상 적립', () => {
  it('free_balance 동시 증가 + 원장 free_delta=+amount', async () => {
    const { db, captured } = makeDb({})
    const ok = await creditFreePoints(db, { userId: 'u1', amount: 2000, type: 'visit_reward', description: 'r' })
    expect(ok).toBe(true)
    const upsert = captured.find(c => c.sql.includes('free_balance') && c.sql.includes('ON CONFLICT'))
    expect(upsert).toBeTruthy()
    expect(upsert!.params[1]).toBe(2000) // balance
    expect(upsert!.params[2]).toBe(2000) // free_balance
    const tx = captured.find(c => c.sql.includes('INSERT INTO point_transactions'))
    expect(tx!.params[tx!.params.length - 1]).toBe(2000) // free_delta
  })
})

describe('adjustUserPoints — 차감은 항상 free 우선', () => {
  it('guardBalance 차감: free 절 포함 + 원장 free_delta = -min(freeBefore, abs)', async () => {
    const { db, captured } = makeDb({ freeBefore: 300 })
    const res = await adjustUserPoints(db, { userId: 'u1', delta: -500, type: 'usage', guardBalance: true })
    expect(res.ok).toBe(true)
    const upd = captured.find(c => c.sql.includes('balance = balance - ?') && c.sql.includes('free_balance = MAX(0'))
    expect(upd).toBeTruthy()
    const tx = captured.find(c => c.sql.includes('INSERT INTO point_transactions'))
    expect(tx!.params[tx!.params.length - 1]).toBe(-300) // free_delta = -min(300, 500)
  })
  it("bucket:'free' 적립: free UPSERT + free_delta=+delta", async () => {
    const { db, captured } = makeDb({})
    const res = await adjustUserPoints(db, { userId: 'u1', delta: 1000, type: 'invite_reward', bucket: 'free' })
    expect(res.ok).toBe(true)
    const upsert = captured.find(c => c.sql.includes('free_balance') && c.sql.includes('ON CONFLICT'))
    expect(upsert).toBeTruthy()
    const tx = captured.find(c => c.sql.includes('INSERT INTO point_transactions'))
    expect(tx!.params[tx!.params.length - 1]).toBe(1000)
  })
  it('기본(paid) 적립: free_balance 무변경', async () => {
    const { db, captured } = makeDb({})
    const res = await adjustUserPoints(db, { userId: 'u1', delta: 1000, type: 'charge' })
    expect(res.ok).toBe(true)
    const upsert = captured.find(c => c.sql.includes('ON CONFLICT') && !c.sql.includes('ALTER'))
    expect(upsert!.sql.includes('free_balance = COALESCE(free_balance, 0) + excluded')).toBe(false)
    const tx = captured.find(c => c.sql.includes('INSERT INTO point_transactions'))
    expect(tx!.params[tx!.params.length - 1]).toBe(0)
  })
})

describe('PAID_BALANCE_SQL — 출금 유상 한도 식', () => {
  it('balance - COALESCE(free_balance,0) 형태', () => {
    expect(PAID_BALANCE_SQL).toContain('balance - COALESCE(free_balance, 0)')
  })
})
