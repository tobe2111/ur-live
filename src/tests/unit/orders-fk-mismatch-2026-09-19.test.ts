/**
 * 🧨 **결제가 통째로 멎어 있던 이유** — 죽은 테이블의 깨진 외래키 (2026-09-19)
 *
 * 대표 신고: *"결제가 안됐대"* · *"정작 토스페이먼츠에서는 결제가 찍혀있어"*.
 *
 * `payments`/`tax_invoices` 가 **없는 컬럼** `orders(order_no)` 를 참조했다(진짜 이름 `order_number`).
 * SQLite 는 그런 외래키를 malformed 로 보고 **부모/자식 양쪽 DML 을 거부**한다.
 * ⇒ 두 결제 경로가 공통으로 쓰는 `INSERT INTO orders ... RETURNING id` 가 전부 실패했고,
 *   둘 다 실패를 삼키고 자동 환불해서 **로그 한 줄 안 남았다**(라이브: orders 마지막 행 2026-06-26,
 *   vouchers 전체 1행). 토스에는 승인만 찍혔다.
 *
 * ## 왜 문자열이 아니라 실제 SQLite 로 재느냐
 * 이 고장의 핵심은 **"CREATE TABLE 은 성공한다"** 는 것이다 — 만들 때는 부모를 안 보고,
 * 나중에 DML 에서만 터진다. 그리고 *어떤 문장 형태*가 터지는지가 사건의 전부였다:
 * 평범한 INSERT 는 통과하고 `RETURNING` 과 `DELETE` 만 실패한다. 소스를 읽어선 알 수 없다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - 라이브 DB 드리프트 자체(레포에 없는 DDL). 그건 정비 레인이 맡는다.
 *   - D1 과 node:sqlite 의 미세한 버전 차이.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { ensureOrdersForeignKeysSane } from '@/worker/utils/ensure-orders-fk-sane'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** 라이브와 같은 모양: orders(order_number UNIQUE) + 없는 컬럼을 가리키는 자식 둘. */
function broken(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
  )`)
  db.exec(`CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_no) ON DELETE CASCADE
  )`)
  db.exec(`CREATE INDEX idx_payments_order_id ON payments(order_id)`)
  db.exec(`CREATE TABLE tax_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL,
    FOREIGN KEY (order_no) REFERENCES orders(order_no)
  )`)
  return db
}

function d1(db: Db) {
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
  })
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (stmts: Array<{ run(): Promise<unknown> }>) => {
      const out = []
      for (const s of stmts) out.push(await s.run())
      return out
    },
  } as unknown as D1Database
}

const insertOrder = (db: Db, n: string) =>
  db.prepare(`INSERT INTO orders (order_number, user_id, total_amount, status) VALUES (?, 1, 1000, 'PAID') RETURNING id`).get(n)

describe('orders 외래키 mismatch — 결제 전면 차단', () => {
  it('깨진 채로는 INSERT…RETURNING 이 실패한다 (사고 재현)', () => {
    const db = broken()
    expect(() => insertOrder(db, 'A1')).toThrow(/foreign key mismatch/i)
  })

  it('깨진 채로는 DELETE FROM orders 도 실패한다', () => {
    const db = broken()
    expect(() => db.prepare("DELETE FROM orders WHERE order_number = 'x'").run()).toThrow(/foreign key mismatch/i)
  })

  it('⚠️ 평범한 INSERT 는 통과한다 — 그래서 아무도 못 봤다', () => {
    const db = broken()
    expect(() => db.prepare(`INSERT INTO orders (order_number, user_id, total_amount, status) VALUES ('B1',1,10,'PAID')`).run())
      .not.toThrow()
  })

  it('수리하면 INSERT…RETURNING 과 DELETE 가 되살아난다', async () => {
    const db = broken()
    const res = await ensureOrdersForeignKeysSane(d1(db), true)
    expect(res.failed).toEqual([])
    expect(res.repaired.sort()).toEqual(['payments', 'tax_invoices'])
    expect(insertOrder(db, 'A2')).toMatchObject({ id: expect.any(Number) })
    expect(() => db.prepare("DELETE FROM orders WHERE order_number = 'A2'").run()).not.toThrow()
  })

  it('수리는 컬럼·인덱스·행을 보존하고 부모만 order_number 로 바꾼다', async () => {
    const db = broken()
    // 깨진 상태에선 payments 에 INSERT 자체가 안 된다(그게 이 버그다) → 외래키를 잠시 끄고 심는다.
    //   "수리 이전부터 있던 행"을 재현하는 것이 목적이다.
    db.exec('PRAGMA foreign_keys = OFF')
    db.prepare("INSERT INTO orders (order_number,user_id,total_amount,status) VALUES ('K1',1,10,'PAID')").run()
    db.prepare("INSERT INTO payments (order_id, amount) VALUES ('K1', 10)").run()
    db.exec('PRAGMA foreign_keys = ON')
    await ensureOrdersForeignKeysSane(d1(db), true)
    const fk = db.prepare("PRAGMA foreign_key_list('payments')").all() as Array<{ to: string; on_delete: string }>
    expect(fk[0].to).toBe('order_number')
    expect(fk[0].on_delete).toBe('CASCADE')            // ON DELETE 절 보존
    expect((db.prepare("SELECT COUNT(*) c FROM pragma_table_info('payments')").get() as { c: number }).c).toBe(3)
    expect((db.prepare("SELECT COUNT(*) c FROM payments").get() as { c: number }).c).toBe(1)  // 행 보존
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='payments' AND name='idx_payments_order_id'").all()).toHaveLength(1)
  })

  it('멀쩡한 스키마에선 아무것도 안 한다 (멱등)', async () => {
    const db = broken()
    await ensureOrdersForeignKeysSane(d1(db), true)
    const again = await ensureOrdersForeignKeysSane(d1(db), true)
    expect(again.repaired).toEqual([])
    expect(again.failed).toEqual([])
  })

  it('두 결제 경로가 과금 전에 수리를 호출한다 (배선)', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8'))
    // 호출이 2곳(/join · /confirm-toss) 살아 있어야 한다 — import 만 남아도 통과하면 안 되므로 호출 형태로 앵커.
    const calls = src.match(/await\s+ensureOrdersForeignKeysSane\(DB\)/g) || []
    expect(calls.length).toBe(2)
    // confirm-toss 는 **토스 승인보다 먼저** 고쳐야 한다(뒤면 이미 청구된 돈을 되돌리는 경로가 된다).
    const repairAt = src.lastIndexOf('ensureOrdersForeignKeysSane(DB)')
    const confirmAt = src.indexOf('confirmTossPayment({')
    expect(repairAt).toBeGreaterThan(0)
    expect(confirmAt).toBeGreaterThan(repairAt)
  })

  it('정비 레인(repair-schema)에도 등록돼 있다', () => {
    const src = stripComments(readFileSync('src/worker/routes/repair-schema.routes.ts', 'utf8'))
    expect(src).toMatch(/ensureOrdersForeignKeysSane\(DB,\s*true\)/)
  })
})
