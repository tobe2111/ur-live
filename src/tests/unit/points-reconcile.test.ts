/**
 * 🩹 **딜 잔액 정합 수리** — 실제 SQLite 로 돌린다 (2026-08-31 대표 "모두 진행하자")
 *
 * 원장 정합 검사는 감지만 하고 고치지 않는다(옳다 — 잔액은 돈이다). 그래서 알림이 매일 뜨는데
 * 고칠 손이 없었다. 이 도구가 그 손이고, **돈을 만지므로** 다음을 시험으로 못 박는다:
 *
 *   · 기본 dry-run — `apply` 없이는 **한 줄도 안 쓴다**
 *   · 병합은 총액 보존 — 100 + 50 → 150, 고아 행은 사라진다
 *   · 멱등 — 두 번 돌려도 이중적립 0
 *   · 보정은 **잔액을 안 바꾼다** — 원장에 설명만 더한다
 *
 * ⚠️ 못 막는 것: 라이브 D1 의 실제 동시성(여기서는 단일 스레드다). 실행은 사람이 dry-run 을
 *   본 뒤에 누른다.
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
import { findOrphanBalances, mergeOrphanBalances, reconcileLegacyBalances } from '@/worker/utils/points-reconcile'

function makeD1(): D1Database {
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
  const raw = (sql: string) => db.prepare(sql).run()
  raw(`CREATE TABLE users (id INTEGER PRIMARY KEY, firebase_uid TEXT, kakao_id TEXT, name TEXT)`)
  raw(`CREATE TABLE user_points (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0,
        free_balance INTEGER DEFAULT 0, total_charged INTEGER DEFAULT 0, updated_at TEXT)`)
  raw(`CREATE TABLE point_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT,
        amount INTEGER, points_amount INTEGER, balance_after INTEGER, description TEXT,
        order_id TEXT, free_delta INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`)
  return { prepare: (sql: string) => wrap(sql), __raw: raw, __db: db } as unknown as D1Database
}
const exec = (DB: D1Database, sql: string) => (DB as unknown as { __raw: (s: string) => void }).__raw(sql)
const one = <T,>(DB: D1Database, sql: string): T =>
  (DB as unknown as { __db: { prepare: (s: string) => { get: () => unknown } } }).__db.prepare(sql).get() as T

/** 라이브에서 실제로 발견된 모양: 유저 24(디스크프리)가 두 행으로 쪼개져 있다. */
function seedOrphan(DB: D1Database) {
  exec(DB, `INSERT INTO users VALUES (24, 'kakao_4791707822', '4791707822', '디스크프리')`)
  exec(DB, `INSERT INTO user_points (user_id, balance) VALUES ('24', 100)`)
  exec(DB, `INSERT INTO user_points (user_id, balance) VALUES ('kakao_4791707822', 50)`)
}

describe('🩹 고아 잔액 병합', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1(); seedOrphan(DB) })

  it('같은 사람의 쪼개진 행을 찾는다', async () => {
    const found = await findOrphanBalances(DB)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ orphan_id: 'kakao_4791707822', target_id: '24', balance: 50 })
  })

  it('🔴 dry-run 은 한 줄도 안 쓴다', async () => {
    const r = await mergeOrphanBalances(DB, false)
    expect(r.applied).toBe(false)
    expect(r.found).toHaveLength(1)
    expect(one<{ n: number }>(DB, `SELECT COUNT(*) n FROM user_points`).n, '고아 행이 지워졌다').toBe(2)
    expect(one<{ b: number }>(DB, `SELECT balance b FROM user_points WHERE user_id='24'`).b, '잔액이 움직였다').toBe(100)
  })

  it('🔴 apply 하면 총액이 보존된 채 한 행으로 합쳐진다', async () => {
    const r = await mergeOrphanBalances(DB, true)
    expect(r.results[0].outcome).toBe('merged')
    expect(one<{ b: number }>(DB, `SELECT balance b FROM user_points WHERE user_id='24'`).b).toBe(150)
    expect(one<{ n: number }>(DB, `SELECT COUNT(*) n FROM user_points WHERE user_id='kakao_4791707822'`).n).toBe(0)
    // 원장에 흔적이 남는다 — 잔액이 왜 늘었는지 설명이 없으면 다음 검사가 또 잡는다.
    const tx = one<{ n: number; d: string }>(DB,
      `SELECT COUNT(*) n, MAX(description) d FROM point_transactions WHERE type='orphan_merge'`)
    expect(tx.n).toBe(1)
    expect(tx.d, '어느 행을 합쳤는지 안 적었다 — 멱등 키이기도 하다').toContain('kakao_4791707822')
  })

  it('🔴 두 번 돌려도 이중적립이 없다 (멱등)', async () => {
    await mergeOrphanBalances(DB, true)
    // 고아 행이 되살아난 상황을 가정해도(재시도·부분 실패) 원장 dedup 이 막는다.
    exec(DB, `INSERT INTO user_points (user_id, balance) VALUES ('kakao_4791707822', 50)`)
    const r2 = await mergeOrphanBalances(DB, true)
    expect(r2.results[0].outcome).toBe('already')
    expect(one<{ b: number }>(DB, `SELECT balance b FROM user_points WHERE user_id='24'`).b,
      '두 번째 실행이 또 적립했다').toBe(150)
  })
})

describe('🩹 레거시 정합 보정', () => {
  let DB: D1Database
  beforeEach(() => {
    DB = makeD1()
    // 원장 없이 잔액만 있는 유저(라이브의 32·33 모양).
    exec(DB, `INSERT INTO user_points (user_id, balance) VALUES ('32', 3000)`)
  })

  it('🔴 dry-run 은 아무것도 안 쓴다', async () => {
    const r = await reconcileLegacyBalances(DB, false)
    expect(r.applied).toBe(false)
    expect(r.found).toHaveLength(1)
    expect(one<{ n: number }>(DB, `SELECT COUNT(*) n FROM point_transactions`).n).toBe(0)
  })

  it('🔴 보정은 **잔액을 바꾸지 않는다** — 원장에 설명만 더한다', async () => {
    await reconcileLegacyBalances(DB, true)
    expect(one<{ b: number }>(DB, `SELECT balance b FROM user_points WHERE user_id='32'`).b,
      '보정이 잔액을 건드렸다 — 이건 감사 기록이지 지급이 아니다').toBe(3000)
    const tx = one<{ a: number; d: string }>(DB,
      `SELECT amount a, description d FROM point_transactions WHERE type='legacy_reconcile'`)
    expect(tx.a).toBe(3000)
    expect(tx.d, '덮은 원래 숫자를 안 적었다').toContain('3000')
  })

  it('보정 후에는 불일치가 사라진다 (알림이 다시 의미를 갖는다)', async () => {
    await reconcileLegacyBalances(DB, true)
    const { findBalanceMismatches } = await import('@/worker/utils/ledger-integrity-checks')
    const { total } = await findBalanceMismatches(DB)
    expect(total).toBe(0)
  })

  it('두 번 돌려도 보정행이 하나뿐이다 (멱등)', async () => {
    await reconcileLegacyBalances(DB, true)
    await reconcileLegacyBalances(DB, true)
    expect(one<{ n: number }>(DB, `SELECT COUNT(*) n FROM point_transactions WHERE type='legacy_reconcile'`).n).toBe(1)
  })
})
