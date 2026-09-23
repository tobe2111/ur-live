/**
 * 🕙 정산 유보 — 가드 (2026-09-21 대표 "Q2는 10일로 하자" · 2026-09-23 단위 확정 "영업일 10일이야")
 *
 * 영업일 10일을 **역일 14일**로 근사한다(공휴일 테이블이 없다 — `payout-hold.ts` 머리말 참조).
 *
 * ## 이 시험이 지키는 것
 * 1. 적립 후 N일이 안 지난 credit 은 정산에 안 잡힌다(= 토스 입금 전에 우리 돈이 안 나간다).
 * 2. **debit(환불 역전)은 유보 무관 즉시** 반영된다 — 빼는 걸 미루면 과다지급이다.
 * 3. 🔴 **OR 우선순위** — credit WHERE 를 괄호로 감싸지 않으면 `A OR B OR C AND D` 가
 *    `A OR B OR (C AND D)` 로 묶여 유보가 마지막 LIKE 에만 걸리고 나머지 계정이 통째로 샌다.
 * 4. 유보 0 이면 종전과 결과가 같다(되돌리기 가능).
 * 5. 설정을 못 읽으면 유보를 **유지**한다(fail-closed) — 늦게 주는 실패는 회복되지만
 *    먼저 준 돈은 못 돌려받는다.
 *
 * ## ⚠️ 이 시험이 **못** 보는 것
 * - 실제 D1 의 `datetime('now')` 타임존(워커 런타임은 UTC, `ledger_entries.created_at` 도 UTC-naive라
 *   같은 기준이다). 여기선 node:sqlite 로 같은 규약을 재현할 뿐이다.
 * - 주간 배치 주기(월요일) 자체 — 그건 `scheduled.ts` 의 slot 이고 이 모듈 밖이다.
 * - 어드민 화면이 그 값을 **사람에게** 어떻게 보여 주는지.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import type { D1Database } from '@cloudflare/workers-types'
import { buildPayoutHoldSql, resolvePayoutHold, DEFAULT_PAYOUT_HOLD_DAYS } from '@/worker/utils/payout-hold'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
      }
      return self
    },
  } as unknown as D1Database
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 19).replace('T', ' ')

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  db.exec(`CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount INTEGER, fee_amount INTEGER DEFAULT 0,
    debit_account TEXT, credit_account TEXT, created_at DATETIME)`)
  return db
}

const credit = (db: Db, acct: string, amount: number, fee: number, ago: number) =>
  db.prepare(`INSERT INTO ledger_entries (amount, fee_amount, debit_account, credit_account, created_at)
              VALUES (?, ?, 'platform:escrow', ?, ?)`).run(amount, fee, acct, daysAgo(ago))

const debit = (db: Db, acct: string, amount: number, ago: number) =>
  db.prepare(`INSERT INTO ledger_entries (amount, fee_amount, debit_account, credit_account, created_at)
              VALUES (?, 0, ?, 'platform:refund', ?)`).run(amount, acct, daysAgo(ago))

/** `payouts-generate.ts` 와 **같은 모양**의 집계를 실행한다(괄호 포함/미포함을 고를 수 있다). */
function aggregate(db: Db, holdSql: string, paren = true): Map<string, number> {
  const open = paren ? '(' : ''
  const close = paren ? ')' : ''
  const rows = db.prepare(`
    SELECT account, SUM(net) as total FROM (
      SELECT credit_account AS account, amount - COALESCE(fee_amount, 0) AS net
        FROM ledger_entries
       WHERE ${open}credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%'${close}
         ${holdSql}
      UNION ALL
      SELECT debit_account AS account, -amount AS net
        FROM ledger_entries
       WHERE debit_account LIKE 'merchant:%' OR debit_account LIKE 'seller:%' OR debit_account LIKE 'agency:%' OR debit_account LIKE 'user:%'
    )
    GROUP BY account
  `).all() as Array<{ account: string; total: number }>
  return new Map(rows.map(r => [r.account, Number(r.total)]))
}

describe('정산 유보 — 집계 동작 (실제 SQLite)', () => {
  it('① 유보일이 안 지난 credit 은 안 잡히고, 지난 것만 잡힌다', () => {
    const db = fresh()
    credit(db, 'merchant:1', 10_000, 500, 20)   // 20일 전 — 익었다
    credit(db, 'merchant:1', 7_000, 350, 3)     // 3일 전 — 아직
    const { sql } = buildPayoutHoldSql(10)
    expect(aggregate(db, sql).get('merchant:1')).toBe(9_500)      // 20일치만
    expect(aggregate(db, '').get('merchant:1')).toBe(16_150)      // 유보 0 이면 전부
  })

  it('② debit(환불 역전)은 유보와 무관하게 즉시 빠진다', () => {
    const db = fresh()
    credit(db, 'merchant:1', 10_000, 500, 20)   // 익은 적립 9,500
    debit(db, 'merchant:1', 4_000, 0)           // 오늘 환불 — 즉시 차감돼야 한다
    const { sql } = buildPayoutHoldSql(10)
    expect(aggregate(db, sql).get('merchant:1')).toBe(5_500)
  })

  it('③ 🔴 괄호가 없으면 OR 우선순위 때문에 유보가 마지막 LIKE 에만 걸려 샌다', () => {
    const db = fresh()
    credit(db, 'merchant:1', 10_000, 0, 1)      // 어제 적립 — 유보 중이어야 한다
    const { sql } = buildPayoutHoldSql(10)
    expect(aggregate(db, sql, true).get('merchant:1')).toBeUndefined()   // 괄호 O → 안 샘
    expect(aggregate(db, sql, false).get('merchant:1')).toBe(10_000)     // 괄호 X → 샌다
  })

  it('④ 유보는 계정 종류를 가리지 않는다(seller·agency·user 전부)', () => {
    const db = fresh()
    for (const a of ['merchant:1', 'seller:2', 'agency:3', 'user:4']) credit(db, a, 10_000, 0, 1)
    const { sql } = buildPayoutHoldSql(10)
    expect(aggregate(db, sql).size).toBe(0)
  })
})

describe('정산 유보 — 설정 해석', () => {
  it('⑤ 기본값은 영업일 10일 = 역일 14일이고, 0 은 "유보 없음"으로 살아남는다(|| 함정)', () => {
    // 🔴 이 숫자가 곧 대표 확정값이다. 바뀌면 매장이 돈을 받는 날이 바뀐다.
    //    꼬박 2주여야 주말 4일이 빠져 그 안의 평일이 정확히 10일이 된다 — 13 도 15 도 아니다.
    expect(DEFAULT_PAYOUT_HOLD_DAYS).toBe(14)
    expect(DEFAULT_PAYOUT_HOLD_DAYS % 7).toBe(0)
    expect(buildPayoutHoldSql(14).days).toBe(14)
    const zero = buildPayoutHoldSql(0)
    expect(zero.days).toBe(0)
    expect(zero.enabled).toBe(false)
    expect(zero.sql).toBe('')
  })

  it('⑥ 이상한 값은 클램프되고, 숫자가 아니면 기본값', () => {
    expect(buildPayoutHoldSql(-5).days).toBe(0)
    expect(buildPayoutHoldSql(9999).days).toBe(365)
    expect(buildPayoutHoldSql(10.9).days).toBe(10)
    expect(buildPayoutHoldSql(NaN).days).toBe(DEFAULT_PAYOUT_HOLD_DAYS)
    expect(buildPayoutHoldSql('x' as unknown as number).days).toBe(DEFAULT_PAYOUT_HOLD_DAYS)
  })

  it('⑦ SQL 조각에 사용자 값이 그대로 박히지 않는다(정수만)', () => {
    expect(buildPayoutHoldSql(10).sql).toBe("AND created_at <= datetime('now', '-10 days')")
    expect(buildPayoutHoldSql("7'; DROP TABLE payouts--" as unknown as number).sql)
      .toBe(`AND created_at <= datetime('now', '-${DEFAULT_PAYOUT_HOLD_DAYS} days')`)
  })

  it('⑧ platform_settings 를 읽고, 없으면 기본값을 유지한다(fail-closed)', async () => {
    const empty = fresh()
    expect((await resolvePayoutHold(d1(empty))).days).toBe(14)     // 미설정 → 기본(영업일 10일) 유지

    const set7 = fresh()
    set7.prepare(`INSERT INTO platform_settings VALUES ('payout_hold_days','7')`).run()
    expect((await resolvePayoutHold(d1(set7))).days).toBe(7)       // 설정이 있으면 그 값

    const off = fresh()
    off.prepare(`INSERT INTO platform_settings VALUES ('payout_hold_days','0')`).run()
    const o = await resolvePayoutHold(d1(off))
    expect(o.days).toBe(0)
    expect(o.enabled).toBe(false)

    // 테이블 자체가 없어 쿼리가 터져도 유보를 풀지 않는다.
    const broken = new DatabaseSync(':memory:')
    expect((await resolvePayoutHold(d1(broken))).days).toBe(14)
  })
})

describe('정산 유보 — 배선', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))

  it('⑨ cron 이 유보를 해석해 credit WHERE 에만 적용한다 (괄호 포함)', () => {
    const s = src('src/worker/cron/payouts-generate.ts')
    expect(s).toMatch(/const hold = await resolvePayoutHold\(DB\)/)
    // credit 블록: 괄호로 감싼 LIKE 묶음 바로 뒤에 유보 조각이 온다.
    expect(s).toMatch(/WHERE \(credit_account LIKE[\s\S]*?\)\s*\n\s*\$\{hold\.sql\}/)
    // debit 블록에는 유보가 붙지 않는다(환불은 즉시).
    const debitBlock = s.slice(s.indexOf('debit_account AS account'))
    expect(debitBlock).not.toContain('${hold.sql}')
  })

  it('⑩ 어드민 정산대기 화면이 cron 과 같은 함수를 쓴다(값이 갈리면 없는 돈을 승인한다)', () => {
    const s = src('src/features/admin/api/admin-payouts.routes.ts')
    expect(s).toMatch(/const hold = await resolvePayoutHold\(DB\)/)
    expect(s).toMatch(/WITH cred AS \([\s\S]*?WHERE \(credit_account LIKE[\s\S]*?\)\s*\n\s*\$\{hold\.sql\}/)
    const debBlock = s.slice(s.indexOf('deb AS ('))
    expect(debBlock.slice(0, 400)).not.toContain('${hold.sql}')
    expect(s).toContain('hold_days: hold.days')
  })
})
