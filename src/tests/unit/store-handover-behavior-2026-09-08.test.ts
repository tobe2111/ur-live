/**
 * 💰 **손바뀜 마감 — 텍스트가 아니라 실제로 돌려서 판정한다** (2026-09-08)
 *
 * ## 왜 이 시험이 따로 있나
 * 짝인 `store-handover-money-2026-09-07.test.ts` 는 **배선**을 본다(소스에 그 줄이 있는가).
 * 그건 "코드가 사라지는 것"은 막지만 **"코드가 틀린 것"은 못 막는다.** 그리고 이 변경의 핵심 주장은
 * 배선이 아니라 **인과**다:
 *
 *   > 마감 payout 을 만들면 → 손바뀜 잔액이 0 이 되어 → 자물쇠가 열린다.
 *
 * 그 사슬이 실제로 이어지는지는 **DB 를 놓고 돌려 봐야** 안다. 라이브에는 이걸 확인할 대상이
 * 없다(실측 2026-09-08: 매장 1개·`linked_user_id` 전부 NULL·payouts 0건) — 그래서 여기서 만든다.
 *
 * ## ⚠️ 못 막는 것
 * - D1 과 node:sqlite 의 차이(플래너·`INSERT OR IGNORE` 세부·동시성).
 * - 실제 송금. `payouts` 행은 지시서일 뿐이고 돈은 어드민이 보낸다.
 * - HTTP 층(권한·2FA·감사로그). 그건 짝 시험이 소스로 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { getLedgerReceivable, getUnsettledBalance } from '@/worker/utils/ledger'
import { checkStoreHandover } from '@/worker/utils/store-handover-guard'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** D1 을 흉내내는 최소 어댑터 — 실제 함수를 **고치지 않고** 태우려고 있다. */
function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
        run: async () => {
          const r = db.prepare(sql).run(...(binds as never[]))
          return { meta: { changes: Number(r.changes) } }
        },
      }
      return self
    },
  } as unknown as D1Database
}

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL,
    amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL,
    fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT NOT NULL, payee_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount > 0), period_start TEXT NOT NULL, period_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', account_number TEXT, account_holder TEXT, admin_memo TEXT,
    kind TEXT, payee_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')))`)
  db.exec(`CREATE UNIQUE INDEX idx_payouts_period_unique ON payouts(payee_type, payee_id, period_start, period_end)`)
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, bank_account TEXT, business_name TEXT)`)
  return db
}

const credit = (db: Db, acct: string, amount: number, fee = 0) =>
  db.prepare(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
              VALUES ('sale','r',?,'user:9',?,?)`).run(amount, acct, fee)

/** 마감 창구가 하는 일 그대로 — 지금 계좌를 행에 **스냅샷**해서 배정한다. */
const closeout = (db: Db, sellerId: number, amount: number, day: string) => {
  const s = db.prepare('SELECT bank_account, business_name, linked_user_id FROM sellers WHERE id = ?').get(sellerId) as
    { bank_account: string | null; business_name: string | null; linked_user_id: number | null }
  db.prepare(`INSERT OR IGNORE INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, account_number, account_holder, kind, payee_user_id)
              VALUES ('seller', ?, ?, ?, ?, 'pending', ?, ?, 'handover_closeout', ?)`)
    .run(String(sellerId), amount, day, day, s.bank_account, s.business_name, s.linked_user_id)
}

describe('💰 마감 → 잔액 0 → 손바뀜 열림 (인과 사슬을 실제로 돌린다)', () => {
  it('잔액이 남으면 막고, 마감하면 열린다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 50_000, 2_500)      // net 47,500
    const DB = d1(db)

    expect(await getLedgerReceivable(DB, 'seller:7')).toBe(47_500)

    // ① 주인을 바꾸려 하면 막힌다
    const before = await checkStoreHandover(DB, 7, 200)
    expect(before.blocked, '잔액이 남았는데 손바뀜이 열렸다').toBe(true)
    expect(before.receivable).toBe(47_500)
    expect(before.prevUserId).toBe(100)

    // ② 마감 — 이전 주인 계좌를 행에 박는다
    closeout(db, 7, 47_500, '2026-09-08')
    const row = db.prepare('SELECT * FROM payouts').get() as Record<string, unknown>
    expect(row.account_number, '이전 주인 계좌가 행에 안 박혔다').toBe('중개사은행 110-1')
    expect(row.status).toBe('pending')

    // ③ 이제 열린다 — 이게 이 변경의 핵심 주장이다
    const after = await checkStoreHandover(DB, 7, 200)
    expect(after.blocked, '마감했는데도 손바뀜이 안 열린다(막다른 길)').toBe(false)

    // ④ 원장 자체는 안 줄었다 — 그래서 순수 원장으로 판정하면 영원히 막힌다
    expect(await getLedgerReceivable(DB, 'seller:7')).toBe(47_500)
    expect(await getUnsettledBalance(DB, 'seller:7')).toBe(0)
  })

  it('마감한 돈은 새 주인 계좌로 안 간다 — 주인이 바뀌어도 행은 안 변한다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 30_000)
    closeout(db, 7, 30_000, '2026-09-08')

    // 손바뀜: 주인도 계좌도 새 사람 것으로 바뀐다
    db.prepare(`UPDATE sellers SET linked_user_id = 200, bank_account = '사장님은행 220-2', business_name = '사장님' WHERE id = 7`).run()

    const row = db.prepare('SELECT account_number, account_holder FROM payouts').get() as Record<string, unknown>
    expect(row.account_number, '마감 행이 새 주인 계좌로 바뀌었다').toBe('중개사은행 110-1')
    expect(row.account_holder).toBe('중개사')
  })

  it('손바뀜 뒤 새로 번 돈은 새 주인 몫이다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 30_000)
    closeout(db, 7, 30_000, '2026-09-08')
    db.prepare(`UPDATE sellers SET linked_user_id = 200, bank_account = '사장님은행 220-2' WHERE id = 7`).run()

    credit(db, 'seller:7', 12_000)             // 손바뀜 이후 매출
    // 이전 몫은 이미 배정됐으므로 미배정 잔액은 새 매출뿐이다.
    expect(await getUnsettledBalance(d1(db), 'seller:7')).toBe(12_000)
  })

  it('최초 연결·같은 사람은 막지 않는다 (손바뀜이 아니다)', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, NULL, '무주공산')`).run()
    credit(db, 'seller:7', 90_000)
    const DB = d1(db)
    expect((await checkStoreHandover(DB, 7, 200)).blocked, '최초 연결을 막으면 정상 가입이 죽는다').toBe(false)

    db.prepare('UPDATE sellers SET linked_user_id = 200 WHERE id = 7').run()
    expect((await checkStoreHandover(DB, 7, 200)).blocked, '같은 사람인데 막혔다').toBe(false)
  })

  it('빚진 매장(음수)도 막는다 — 그대로 넘기면 새 주인이 떠안는다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    db.prepare(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account)
                VALUES ('refund','r', 5000, 'seller:7', 'user:9')`).run()
    const r = await checkStoreHandover(d1(db), 7, 200)
    expect(r.blocked).toBe(true)
    expect(r.receivable).toBe(-5000)
    expect(r.reason, '음수일 때 "정산되지 않은 금액" 이라고 하면 방향이 거꾸로다').toMatch(/플랫폼에 정산할/)
  })

  it('주간 집계가 마감분을 다시 안 잡는다 (payouts-generate 공식 그대로)', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 40_000)
    closeout(db, 7, 40_000, '2026-09-08')

    // payouts-generate 의 공식: 전기간 원장 − 전기간 payout(pending/approved/sent)
    const total = (db.prepare(`SELECT COALESCE(SUM(net),0) t FROM (
        SELECT amount - COALESCE(fee_amount,0) net FROM ledger_entries WHERE credit_account = 'seller:7'
        UNION ALL SELECT -amount FROM ledger_entries WHERE debit_account = 'seller:7')`).get() as { t: number }).t
    const paid = (db.prepare(`SELECT COALESCE(SUM(amount),0) t FROM payouts
        WHERE payee_type='seller' AND payee_id='7' AND status IN ('pending','approved','sent')`).get() as { t: number }).t
    expect(total - paid, '마감분이 새 주인 몫으로 다시 잡힌다(이중 지급)').toBe(0)
  })

  it('같은 날 두 번 마감해도 이중 배정이 안 된다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 20_000)
    closeout(db, 7, 20_000, '2026-09-08')
    closeout(db, 7, 20_000, '2026-09-08')   // UNIQUE(payee,period) 가 두 번째를 무시한다
    const n = (db.prepare('SELECT COUNT(*) c FROM payouts').get() as { c: number }).c
    expect(n).toBe(1)
  })
})

/**
 * 🔒 **취소로 되살아나는 구멍** — 대표 2026-09-08 "모두 해줘".
 *
 * 집계(`payouts-generate`)는 `cancelled`/`failed` 를 안 뺀다. 그래서 마감 행을 취소하면 금액이
 * 원장으로 되살아나고, 주인이 이미 바뀌었다면 **새 주인**에게 간다. 라우트가 그 조건을 어떻게
 * 판정하는지를 여기서 같은 SQL 로 돌려 본다.
 *
 * ⚠️ 못 막는 것: HTTP 층(권한·2FA·감사로그·confirm_release 파싱)은 짝 시험이 소스로 고정한다.
 */
describe('🔒 마감 행 취소 — 주인이 바뀐 뒤면 확인을 받는다', () => {
  /** 라우트의 판정 그대로: 마감 행이고 · 주인이 기록된 사람과 다르면 → 확인 필요. */
  const needsConfirm = (db: Db, payoutId: number) => {
    const row = db.prepare('SELECT kind, payee_type, payee_id, payee_user_id FROM payouts WHERE id = ?').get(payoutId) as
      { kind: string | null; payee_type: string; payee_id: string; payee_user_id: number | null }
    if (row.kind !== 'handover_closeout' || !row.payee_user_id || row.payee_type !== 'seller') return false
    const now = db.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1').get(row.payee_id) as
      { linked_user_id: number | null } | undefined
    return !!now && Number(now.linked_user_id) !== Number(row.payee_user_id)
  }

  it('마감 행에 kind 와 "누구 것이었는지" 가 박힌다', () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 30_000)
    closeout(db, 7, 30_000, '2026-09-08')
    const row = db.prepare('SELECT kind, payee_user_id FROM payouts').get() as Record<string, unknown>
    expect(row.kind, 'kind 가 없으면 취소 게이트가 이 행을 못 알아본다').toBe('handover_closeout')
    expect(row.payee_user_id, '누구 것이었는지 없으면 주인이 바뀌었는지 판정할 수 없다').toBe(100)
  })

  it('손바뀜 전 취소는 그냥 된다 (아무것도 안 샌다)', () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 30_000)
    closeout(db, 7, 30_000, '2026-09-08')
    expect(needsConfirm(db, 1), '주인이 그대로인데 막으면 금액 오타를 못 고친다(막다른 길)').toBe(false)
  })

  it('손바뀜 뒤 취소는 확인을 받는다', () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 30_000)
    closeout(db, 7, 30_000, '2026-09-08')
    db.prepare('UPDATE sellers SET linked_user_id = 200 WHERE id = 7').run()
    expect(needsConfirm(db, 1), '주인이 바뀐 뒤 조용히 취소되면 그 돈이 새 주인에게 간다').toBe(true)
  })

  it('취소하면 실제로 잔액이 되살아난다 — 그래서 확인이 필요하다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '중개사은행 110-1', '중개사')`).run()
    credit(db, 'seller:7', 30_000)
    closeout(db, 7, 30_000, '2026-09-08')
    expect(await getUnsettledBalance(d1(db), 'seller:7')).toBe(0)

    db.prepare(`UPDATE payouts SET status = 'cancelled' WHERE id = 1`).run()
    // 되살아난다 — 이게 구멍의 실체다(집계가 cancelled 를 안 뺀다).
    expect(await getUnsettledBalance(d1(db), 'seller:7')).toBe(30_000)
  })

  it('마감이 아닌 일반 payout 은 게이트에 안 걸린다', () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 200, '사장님은행 220-2', '사장님')`).run()
    db.prepare(`INSERT INTO payouts (payee_type, payee_id, amount, period_start, period_end, status)
                VALUES ('seller','7',10000,'2026-09-01','2026-09-07','pending')`).run()
    expect(needsConfirm(db, 1), '주간 정산까지 막으면 평상시 운영이 죽는다').toBe(false)
  })
})
