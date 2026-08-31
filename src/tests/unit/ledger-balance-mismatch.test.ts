/**
 * 💸 **원장 정합 검사가 실제 데이터로 맞는 답을 내는가** (2026-08-31 신설)
 *
 * ## 무엇이 있었나
 *
 * `/admin/errors` 에 `Ledger mismatch (5): user_points_balance_mismatch: 5` 가 매일 떴다.
 * 파 보니 **숫자가 틀렸다.** `point_transactions` 에는 규약이 두 개 섞여 있는데 검사는 하나만 알았다:
 *
 * | | `amount` | `points_amount` |
 * |---|---|---|
 * | 레거시(~2026-06) | 충전은 **원화 결제액**(10,000), 그 외는 부호 없는 크기 | 딜 수량(8,500) |
 * | 모던(`point-ledger.ts`) | **부호 있는 딜 델타** | 안 씀(NULL) |
 *
 * 2026-07-27 판은 `amount` 를 우선했다 — 모던 기록자 코드만 읽고 정했기 때문이다.
 * 그런데 **라이브 18행이 전부 레거시**였다: 충전은 건당 1,500 부풀고, 차감(`donate`)은 양수라
 * 빼야 할 것을 더했다. 유저 3 의 `−82,480` 이 그 산물이다.
 *
 * ⚠️ 이 시험이 못 막는 것: 라이브에 **세 번째 규약**이 생기는 경우. 그건 사람이 데이터를 봐야 한다.
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
import { findBalanceMismatches, classifyMismatch } from '@/worker/utils/ledger-integrity-checks'

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
  raw(`CREATE TABLE user_points (user_id TEXT PRIMARY KEY, balance INTEGER)`)
  raw(`CREATE TABLE point_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT,
        amount INTEGER, points_amount INTEGER, description TEXT)`)
  return { prepare: (sql: string) => wrap(sql), __raw: raw } as unknown as D1Database
}
const exec = (DB: D1Database, sql: string) => (DB as unknown as { __raw: (s: string) => void }).__raw(sql)

describe('💸 원장 정합 — 두 규약을 모두 옳게 센다', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('🔴 레거시 충전: 딜(points_amount)로 세지 원화(amount)로 세지 않는다', () => {
    // 라이브 실측 모양: 10,000원 결제 → 8,500딜 적립.
    exec(DB, `INSERT INTO user_points VALUES ('u1', 8500)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('u1','charge',10000,8500)`)
    return findBalanceMismatches(DB).then(({ total }) => {
      // amount(10,000)로 세면 8,500 ≠ 10,000 이라 오탐이 난다.
      expect(total, '충전을 원화로 세고 있다 — 건당 1,500씩 부풀린다').toBe(0)
    })
  })

  it('🔴 레거시 차감(donate): 양수로 저장돼 있어도 빼야 한다', () => {
    // 8,500 충전 후 100 후원 → 잔액 8,400.
    exec(DB, `INSERT INTO user_points VALUES ('u1', 8400)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('u1','charge',10000,8500)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('u1','donate',100,100)`)
    return findBalanceMismatches(DB).then(({ total }) => {
      expect(total, 'donate 를 더하고 있다 — 부호가 뒤집혔다').toBe(0)
    })
  })

  it('모던 규약: amount 가 이미 부호를 갖는다 (points_amount 없음)', () => {
    exec(DB, `INSERT INTO user_points VALUES ('u2', 700)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('u2','invite_reward',1000)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('u2','usage',-300)`)
    return findBalanceMismatches(DB).then(({ total }) => expect(total).toBe(0))
  })

  it('두 규약이 한 유저에 섞여 있어도 합이 맞는다', () => {
    // 레거시 8,500 충전 − 100 후원 = 8,400, 이후 모던 +600 / −900 → 8,100
    exec(DB, `INSERT INTO user_points VALUES ('u3', 8100)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('u3','charge',10000,8500)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('u3','donate',100,100)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('u3','referral_bonus',600)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount) VALUES ('u3','usage',-900)`)
    return findBalanceMismatches(DB).then(({ total }) => expect(total).toBe(0))
  })

  it('🔴 진짜 불일치는 여전히 잡는다 (검사를 무디게 만들지 않았다)', async () => {
    // ① 기록 0 · 잔액만 있음  ② 적립이 잔액에 안 반영
    exec(DB, `INSERT INTO user_points VALUES ('seed', 3000)`)
    exec(DB, `INSERT INTO user_points VALUES ('lost', 1200)`)
    exec(DB, `INSERT INTO point_transactions (user_id,type,amount,points_amount) VALUES ('lost','charge',10000,8500)`)
    const { total, rows } = await findBalanceMismatches(DB)
    expect(total).toBe(2)
    const seed = rows.find(r => r.user_id === 'seed')!
    const lost = rows.find(r => r.user_id === 'lost')!
    expect(seed.computed).toBe(0)
    expect(classifyMismatch(seed)).toContain('거래 기록 0')
    expect(lost.diff).toBe(1200 - 8500)
    expect(classifyMismatch(lost)).toContain('사용자 손해 방향')
  })

  it('차이가 큰 순으로 준다 — 사람이 위에서부터 본다', async () => {
    exec(DB, `INSERT INTO user_points VALUES ('small', 50)`)
    exec(DB, `INSERT INTO user_points VALUES ('big', 90000)`)
    const { rows } = await findBalanceMismatches(DB)
    expect(rows[0].user_id).toBe('big')
  })
})
