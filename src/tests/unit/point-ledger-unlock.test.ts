/**
 * 🔓 **원장 테이블의 옛 CHECK 제약** — 이 레포에서 가장 오래 조용히 살아 있던 고장 (2026-08-31)
 *
 * 라이브 `point_transactions` 는 아직 `CHECK (type IN ('charge','donate','refund'))` 를 갖고 있다.
 * 코드는 `signup_bonus`·`referral_bonus`·`invite_reward`… 를 쓰는데 전부 거부되고,
 * 원장 기록은 fail-soft 라 **잔액만 움직이고 기록은 사라진다.** 에러도 알림도 없다.
 *
 * 🩸 그리고 이 고장은 **이미 진단돼 있었다** — `migrations/0253_…`(2026-05-17)이 같은 원인·같은
 * 처방을 적어 뒀지만 라이브에 적용된 적이 없다. 그래서 실제로 도는 경로로 옮겨 온다.
 *
 * ⚠️ 이 시험이 못 막는 것: D1 의 `ALTER TABLE … DROP COLUMN` 실제 동작(여기선 node:sqlite 다).
 *   그래서 코드가 **전후를 스스로 대조**하도록 만들었고, 그 대조를 여기서 검사한다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    prepare: (sql: string) => {
      run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }
      get: (...a: never[]) => unknown
      all: (...a: never[]) => unknown[]
    }
  }
}
import { hasLegacyTypeCheck, unlockPointLedgerTypes } from '@/worker/utils/point-ledger-unlock'

/** 라이브 스키마를 그대로 옮긴 것 — CHECK 3종 + `points_amount NOT NULL DEFAULT 0`. */
const LIVE_SCHEMA = `CREATE TABLE point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund')),
  amount INTEGER NOT NULL,
  points_amount INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  order_id TEXT,
  free_delta INTEGER DEFAULT 0)`

function makeD1(schema: string): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  db.prepare(schema).run()
  return { prepare: (sql: string) => wrap(sql), __db: db } as unknown as D1Database
}
const raw = (DB: D1Database, sql: string) =>
  (DB as unknown as { __db: { prepare: (s: string) => { run: () => void } } }).__db.prepare(sql).run()
const one = <T,>(DB: D1Database, sql: string): T =>
  (DB as unknown as { __db: { prepare: (s: string) => { get: () => unknown } } }).__db.prepare(sql).get() as T

function seed(DB: D1Database) {
  raw(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('3','charge',10000,8500)`)
  raw(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('3','donate',100,100)`)
  raw(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('3','refund',50,50)`)
}

describe('🔓 원장 CHECK 제약', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1(LIVE_SCHEMA); seed(DB) })

  it('🔴 제약이 살아 있으면 감지한다', async () => {
    expect(await hasLegacyTypeCheck(DB)).toBe(true)
  })

  it('🔴 제약이 있으면 새 타입 기록이 **실제로 거부된다** (이 시험의 전제)', () => {
    expect(() => raw(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('3','signup_bonus',3000)`))
      .toThrow()
  })

  it('🔴 dry-run 은 제약을 건드리지 않는다', async () => {
    const r = await unlockPointLedgerTypes(DB, false)
    expect(r.had_check).toBe(true)
    expect(r.applied).toBe(false)
    expect(await hasLegacyTypeCheck(DB), '제약이 풀렸다 — dry-run 이 아니다').toBe(true)
  })

  it('🔴 apply 하면 제약이 풀리고 **타입·행수가 그대로다**', async () => {
    const r = await unlockPointLedgerTypes(DB, true)
    expect(r.applied).toBe(true)
    expect(r.verified, `전후 대조 실패: ${JSON.stringify(r)}`).toBe(true)
    expect(r.rows_after).toBe(r.rows_before)
    expect(r.types_after).toEqual(r.types_before)
    // 타입이 전부 'charge' 로 뭉개지는 것이 이 절차의 유일한 실패 모양이다 — 안 뭉개졌는지 직접 본다.
    expect(one<{ n: number }>(DB, `SELECT COUNT(*) n FROM point_transactions WHERE type='donate'`).n).toBe(1)
    expect(await hasLegacyTypeCheck(DB)).toBe(false)
  })

  it('🔴 풀린 뒤에는 새 타입이 실제로 기록된다 (이게 목적이다)', async () => {
    await unlockPointLedgerTypes(DB, true)
    raw(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('32','signup_bonus',3000)`)
    raw(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('24','orphan_merge',50)`)
    expect(one<{ n: number }>(DB, `SELECT COUNT(*) n FROM point_transactions WHERE type IN ('signup_bonus','orphan_merge')`).n).toBe(2)
  })

  it('멱등 — 이미 풀려 있으면 아무것도 안 한다', async () => {
    await unlockPointLedgerTypes(DB, true)
    const again = await unlockPointLedgerTypes(DB, true)
    expect(again.had_check).toBe(false)
    expect(again.applied).toBe(false)
  })
})

describe('🔢 판별식 — `points_amount` 는 NULL 이 아니라 0 이다', () => {
  /**
   * 라이브 컬럼은 `NOT NULL DEFAULT 0`. 모던 기록자는 그 컬럼을 안 쓰므로 **0** 으로 저장된다.
   * `IS NOT NULL` 로 가르면 모던 행이 전부 레거시로 몰려 0 으로 집계되고 **적립이 사라진다.**
   * 지금은 모던 행이 라이브에 0건이라 안 드러나지만, 위 제약이 풀리는 순간 터진다.
   */
  it('🔴 모던 행(points_amount=0)은 amount 로 세어야 한다', async () => {
    const DB = makeD1(LIVE_SCHEMA.replace(/ CHECK \(type IN [^)]*\)\)/, ''))
    raw(DB, `CREATE TABLE user_points (user_id TEXT PRIMARY KEY, balance INTEGER)`)
    raw(DB, `INSERT INTO user_points VALUES ('u1', 700)`)
    // 모던 규약: points_amount 미지정 → DEFAULT 0. amount 가 부호 있는 델타.
    raw(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('u1','invite_reward',1000)`)
    raw(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('u1','usage',-300)`)
    const { findBalanceMismatches } = await import('@/worker/utils/ledger-integrity-checks')
    const { total } = await findBalanceMismatches(DB)
    expect(total, 'points_amount=0 을 레거시로 오분류해 적립이 통째로 사라졌다').toBe(0)
  })
})
