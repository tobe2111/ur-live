/**
 * 💸 2026-11-17 정산 묶기 — 100장 이상이어도 **이중 지급이 생기지 않는다** (결재 2026-11-17-traffic-surge-readiness 1번).
 *
 * 진짜 SQLite(node:sqlite) 위에 D1 모양 어댑터를 씌우고, D1 처럼 **한 문장 바인딩 100개 초과면 던진다.**
 * 지키는 것:
 *  1. 150장도 전부 한 정산행에 묶인다(종전 한 문장 UPDATE 는 여기서 던졌다).
 *  2. 묶기가 실패하면 정산행이 남지 않는다 — "행만 있고 표시는 없는" 상태 = 다음 회차 이중 지급.
 *  3. 일부가 이미 다른 정산에 묶여 있으면(불일치) 정산행을 지우고 내 표시를 푼다 — 남이 묶은 것은 안 건드린다.
 *  4. cron 이 한 문장 `IN (${placeholders})` 로 되돌아가지 않는다.
 *
 * 못 막는 것: 실제 D1 의 batch 원자성 자체(플랫폼 보장) · 라이브 Rail A 데이터(현재 정산행 0, 이용권 5장).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { claimVouchersForSettlement } from '@/worker/utils/settlement-claim'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** D1 의 바인딩 한도(100)와 batch 원자성을 흉내 낸 최소 어댑터. `failOn` 이 SQL 조각과 맞으면 그 문장이 던진다. */
function d1(db: Db, opts: { failOn?: string } = {}) {
  const stmt = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...a: unknown[]) => stmt(sql, a),
    exec() {
      if (args.length > 100) throw new Error('D1_ERROR: too many SQL variables')
      if (opts.failOn && sql.includes(opts.failOn)) throw new Error('D1_ERROR: injected')
      const r = db.prepare(sql).run(...(args as never[]))
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
    },
    async run() { return this.exec() },
  })
  return {
    prepare: (sql: string) => stmt(sql),
    async batch(list: ReturnType<typeof stmt>[]) {
      db.exec('BEGIN')
      try { const out = list.map((s) => s.exec()); db.exec('COMMIT'); return out } catch (e) { db.exec('ROLLBACK'); throw e }
    },
  } as unknown as D1Database
}

function fixture(n: number) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY, settlement_id INTEGER);
           CREATE TABLE restaurant_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT);`)
  for (let i = 1; i <= n; i++) db.prepare('INSERT INTO vouchers (id) VALUES (?)').run(i)
  const sid = Number(db.prepare("INSERT INTO restaurant_settlements (status) VALUES ('pending')").run().lastInsertRowid)
  const ids = Array.from({ length: n }, (_, i) => i + 1)
  const count = (sql: string, ...a: unknown[]) => Number((db.prepare(sql).get(...(a as never[])) as { n: number }).n)
  return { db, sid, ids, count }
}

describe('정산 묶기 — 이중 지급 방지', () => {
  it('150장도 전부 한 정산행에 묶인다', async () => {
    const { db, sid, ids, count } = fixture(150)
    await claimVouchersForSettlement(d1(db), sid, ids)
    expect(count('SELECT COUNT(*) n FROM vouchers WHERE settlement_id = ?', sid)).toBe(150)
    expect(count('SELECT COUNT(*) n FROM restaurant_settlements')).toBe(1)
  })

  it('반대 방향: 한 문장 UPDATE 였다면 150장에서 던진다(어댑터가 한도를 정말 본다)', async () => {
    const { db, sid, ids } = fixture(150)
    const marks = ids.map(() => '?').join(',')
    await expect(d1(db).prepare(`UPDATE vouchers SET settlement_id = ? WHERE id IN (${marks})`).bind(sid, ...ids).run()).rejects.toThrow(/too many/)
  })

  it('묶기가 실패하면 정산행이 남지 않고 표시도 안 붙는다', async () => {
    const { db, sid, ids, count } = fixture(150)
    await expect(claimVouchersForSettlement(d1(db, { failOn: 'SET settlement_id = ? WHERE id IN' }), sid, ids)).rejects.toThrow()
    expect(count('SELECT COUNT(*) n FROM restaurant_settlements')).toBe(0)
    expect(count('SELECT COUNT(*) n FROM vouchers WHERE settlement_id IS NOT NULL')).toBe(0)
  })

  it('일부가 이미 다른 정산에 묶였으면 내 정산행을 지우고 내 표시만 푼다', async () => {
    const { db, sid, ids, count } = fixture(10)
    db.prepare('UPDATE vouchers SET settlement_id = 999 WHERE id = 3').run()
    await expect(claimVouchersForSettlement(d1(db), sid, ids)).rejects.toThrow(/불일치/)
    expect(count('SELECT COUNT(*) n FROM restaurant_settlements')).toBe(0)
    expect(count('SELECT COUNT(*) n FROM vouchers WHERE settlement_id = ?', sid)).toBe(0)
    expect(count('SELECT COUNT(*) n FROM vouchers WHERE settlement_id = 999')).toBe(1)
  })

  it('cron 이 한 문장 IN(...) 묶기로 되돌아가지 않는다', () => {
    const src = fs.readFileSync('src/worker/cron/auto-settlement.ts', 'utf8')
    expect(src).toMatch(/claimVouchersForSettlement\(DB, Number\(result\.meta\.last_row_id\), voucherIds\)/)
    expect(src).not.toMatch(/UPDATE vouchers SET settlement_id = \? WHERE id IN \(\$\{placeholders\}\)/)
  })
})
