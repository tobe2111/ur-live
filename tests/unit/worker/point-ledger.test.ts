/**
 * 💸 2026-06-12 (4차 감사 D1): point-ledger 헬퍼 단위 테스트.
 *
 * 불변성:
 *  1. 적립(delta>0) = user_points UPSERT + point_transactions 장부 동시
 *  2. bumpTotalCharged 옵션이 total_charged bind 에 반영
 *  3. guardBalance 차감은 balance >= |delta| CAS — 부족 시 insufficient + 장부 0건
 *  4. 장부 INSERT 실패는 fail-soft (잔액 변경은 보존, ok:true)
 *  5. zeroOutUserPoints — 잔액 있으면 -잔액 장부, 0이면 장부 생략
 *  6. 입력 검증 — delta 0 / userId 누락 / 비유한 delta → invalid
 */
import { describe, it, expect } from 'vitest'
import {
  adjustUserPoints,
  recordPointTransaction,
  zeroOutUserPoints,
  pointCreditUpsertStatement,
} from '../../../src/worker/utils/point-ledger'

interface ExecLog { sql: string; args: unknown[] }

function makeFakeDB(opts: { balance?: number; guardChanges?: number; ledgerFails?: boolean } = {}) {
  const log: ExecLog[] = []
  const state = { balance: opts.balance ?? 0 }
  const db = {
    log,
    prepare(sql: string) {
      let bound: unknown[] = []
      const stmt = {
        bind(...args: unknown[]) { bound = args; return stmt },
        async run() {
          if (sql.includes('INSERT INTO point_transactions') && opts.ledgerFails) {
            throw new Error('CHECK constraint failed: type')
          }
          log.push({ sql, args: bound })
          if (sql.includes('UPDATE user_points SET balance = balance - ?')) {
            return { meta: { changes: opts.guardChanges ?? 1 } }
          }
          return { meta: { changes: 1 } }
        },
        async first() {
          log.push({ sql, args: bound })
          if (sql.includes('SELECT balance FROM user_points')) return { balance: state.balance }
          return null
        },
      }
      return stmt
    },
  }
  return db as unknown as D1Database & { log: ExecLog[] }
}

function ledgerInserts(db: { log: ExecLog[] }) {
  return db.log.filter((l) => l.sql.includes('INSERT INTO point_transactions'))
}
function upserts(db: { log: ExecLog[] }) {
  return db.log.filter((l) => l.sql.includes('INSERT INTO user_points'))
}

describe('point-ledger: adjustUserPoints', () => {
  it('적립 — UPSERT + 장부 동시 기록, balance_after 서브쿼리 bind 2회', async () => {
    const db = makeFakeDB()
    const r = await adjustUserPoints(db, {
      userId: 'u1', delta: 1000, type: 'invite_reward', description: '보상', orderId: 77,
    })
    expect(r.ok).toBe(true)
    const up = upserts(db)
    expect(up).toHaveLength(1)
    expect(up[0].args).toEqual(['u1', 1000, 0]) // bumpTotalCharged 미지정 → total_charged 0
    const led = ledgerInserts(db)
    expect(led).toHaveLength(1)
    // (user_id, type, amount, [subquery user_id], description, order_id)
    expect(led[0].args).toEqual(['u1', 'invite_reward', 1000, 'u1', '보상', '77'])
  })

  it('bumpTotalCharged — total_charged 도 delta 만큼', async () => {
    const db = makeFakeDB()
    await adjustUserPoints(db, { userId: 'u1', delta: 500, type: 'bootcamp_reward', bumpTotalCharged: true })
    expect(upserts(db)[0].args).toEqual(['u1', 500, 500])
  })

  it('guardBalance 차감 — 잔액 부족 시 insufficient + 장부 0건', async () => {
    const db = makeFakeDB({ guardChanges: 0 })
    const r = await adjustUserPoints(db, { userId: 'u1', delta: -300, type: 'usage', guardBalance: true })
    expect(r).toEqual({ ok: false, reason: 'insufficient' })
    expect(ledgerInserts(db)).toHaveLength(0)
  })

  it('guardBalance 차감 성공 — 음수 delta 장부 기록', async () => {
    const db = makeFakeDB({ guardChanges: 1, balance: 700 })
    const r = await adjustUserPoints(db, { userId: 'u1', delta: -300, type: 'usage', guardBalance: true })
    expect(r.ok).toBe(true)
    const led = ledgerInserts(db)
    expect(led).toHaveLength(1)
    expect(led[0].args[2]).toBe(-300)
  })

  it('장부 실패는 fail-soft — 잔액 변경은 보존되고 ok:true', async () => {
    const db = makeFakeDB({ ledgerFails: true })
    const r = await adjustUserPoints(db, { userId: 'u1', delta: 100, type: 'refund' })
    expect(r.ok).toBe(true)
    expect(upserts(db)).toHaveLength(1)
    expect(ledgerInserts(db)).toHaveLength(0)
  })

  it('입력 검증 — delta 0 / userId 누락 / NaN → invalid', async () => {
    const db = makeFakeDB()
    expect((await adjustUserPoints(db, { userId: 'u1', delta: 0, type: 't' })).ok).toBe(false)
    expect((await adjustUserPoints(db, { userId: '', delta: 100, type: 't' })).ok).toBe(false)
    expect((await adjustUserPoints(db, { userId: 'u1', delta: NaN, type: 't' })).ok).toBe(false)
    expect((await adjustUserPoints(db, { userId: 'u1', delta: 100, type: '' })).ok).toBe(false)
    expect(db.log.filter((l) => !l.sql.includes('CREATE'))).toHaveLength(0)
  })
})

describe('point-ledger: recordPointTransaction', () => {
  it('단독 장부 기록 — 실패 시 false (throw 안 함)', async () => {
    const ok = await recordPointTransaction(makeFakeDB(), { userId: 'u2', delta: 50, type: 'referral_bonus' })
    expect(ok).toBe(true)
    const fail = await recordPointTransaction(makeFakeDB({ ledgerFails: true }), { userId: 'u2', delta: 50, type: 'referral_bonus' })
    expect(fail).toBe(false)
  })
})

describe('point-ledger: pointCreditUpsertStatement', () => {
  it('batch 합류용 준비문 — bind (uid, amount, charged)', async () => {
    const db = makeFakeDB()
    const stmt = pointCreditUpsertStatement(db, { userId: 7, delta: 250, bumpTotalCharged: true })
    await (stmt as unknown as { run: () => Promise<unknown> }).run()
    expect(upserts(db)[0].args).toEqual(['7', 250, 250])
  })
})

describe('point-ledger: zeroOutUserPoints', () => {
  it('잔액 500 → balance=0 UPDATE + 장부 -500 (account_deleted)', async () => {
    const db = makeFakeDB({ balance: 500 })
    await zeroOutUserPoints(db, 'u3')
    expect(db.log.some((l) => l.sql.includes('SET balance = 0'))).toBe(true)
    const led = ledgerInserts(db)
    expect(led).toHaveLength(1)
    expect(led[0].args[1]).toBe('account_deleted')
    expect(led[0].args[2]).toBe(-500)
  })

  it('잔액 0 → 장부 생략', async () => {
    const db = makeFakeDB({ balance: 0 })
    await zeroOutUserPoints(db, 'u3')
    expect(ledgerInserts(db)).toHaveLength(0)
  })
})
