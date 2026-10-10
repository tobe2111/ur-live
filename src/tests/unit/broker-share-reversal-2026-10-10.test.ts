/**
 * 💸 **환불해도 중개사 몫·인플루언서 커미션의 원장 차감이 매장에 남았다** (2026-10-10 감사 — 머니 룰 #2)
 *
 * ■ 무엇이 깨져 있었나
 *   `creditBrokerShare` 는 원장에 `broker_share : seller:N → influencer:{uid}` 를 쓰고, 인플루언서 추천은
 *   `influencer_commission : seller:N → influencer:{id}` 를 쓴다. 환불 때 `clawbackVoucherCommission` 은
 *   attribution·잔액만 회수하고 이 원장 줄은 그대로 둬서, 정산 집계(seller:N 을 매장으로 접는다)에서
 *   **매장이 환불된 주문의 몫을 영구 부담**했다.
 *   그리고 주문 단위 환불(`refundOrderFully`·이용권 일부 환불)은 이용권만 무효화하고 커미션 회수를
 *   **아예 부르지 않았다**(바우처 단위 경로만 불렀다). 어드민 강제 환불·폐업 환불은 `voucher_id` 로
 *   attribution 을 찾았는데 그 칸은 늘 NULL 이라 0건을 회수했다.
 *
 * ■ 어떻게 재나 — 실제 creditBrokerShare → 실제 환불 경로(clawbackVoucherSettlementOnRefund)를 sqlite 에
 *
 * ■ 못 보는 것
 *   - 이미 지급(paid)된 몫의 회수 정책(별건) · Toss 실환불(staging S-BROKER 몫)
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { creditBrokerShare, saveBrokerTerms } from '@/worker/utils/broker-share'
import { clawbackVoucherSettlementOnRefund } from '@/worker/utils/voucher-settlement-clawback'
import { clawbackVoucherCommission } from '@/features/group-buy/api/voucher-clawback'
import { reverseAttributionLedgerShares, ledgerEventForAttributionSource } from '@/worker/utils/attribution-ledger-reversal'
import { grantOperator } from '@/worker/utils/seller-operators'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = db.prepare(sql).run(...(binds as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    }
    return self
  }
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, name TEXT, business_name TEXT, status TEXT DEFAULT 'approved', linked_user_id INTEGER);
    CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, description TEXT, updated_at TEXT);
    CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY AUTOINCREMENT, influencer_id TEXT NOT NULL, order_id INTEGER,
      voucher_id INTEGER, product_id INTEGER, seller_id INTEGER, commission_amount INTEGER NOT NULL, status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')), available_at DATETIME, paid_at DATETIME, clawback_reason TEXT, source TEXT);
    CREATE TABLE influencer_balances (influencer_id TEXT PRIMARY KEY, pending_amount INTEGER DEFAULT 0, available_amount INTEGER DEFAULT 0,
      total_paid_out INTEGER DEFAULT 0, updated_at TEXT);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT);
    CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL,
      amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL, fee_amount INTEGER DEFAULT 0, fee_account TEXT,
      metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, price INTEGER);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, status TEXT, settlement_id INTEGER, applied_price INTEGER);
    INSERT INTO sellers (id, name, business_name) VALUES (1, '홍대돈까스', '홍대돈까스');
    INSERT INTO platform_settings (key, value) VALUES ('broker_share_enabled', 'true');
    INSERT INTO orders (id, order_number) VALUES (501, 'GB-1');
    INSERT INTO products (id, seller_id, price) VALUES (7, 1, 5000);
    INSERT INTO vouchers (id, order_id, product_id, status, applied_price) VALUES (11, 501, 7, 'unused', 5000), (12, 501, 7, 'unused', 5000);
  `)
  return { db, DB: d1(db) }
}

// ⚠️ `ensureLedgerTable` 은 모듈 수준으로 한 번만 DDL 을 돈다 — 테이블은 시험이 직접 만든다.
/** 원장에서 계정 하나의 순 잔액(credit − debit). */
const net = (db: Db, acct: string) => {
  const r = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN credit_account = ? THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN debit_account = ? THEN amount ELSE 0 END), 0) AS n FROM ledger_entries`).get(acct, acct) as { n: number }
  return Number(r.n)
}

async function sellAndCredit(DB: D1Database) {
  await saveBrokerTerms(DB, 1, { brokerUserId: 100, sharePct: 10, capPct: null })
  await grantOperator(DB, 1, 100, 100, 'operator')
  const r = await creditBrokerShare(DB, { sellerId: 1, orderId: 501, orderNumber: 'GB-1', productId: 7, totalAmount: 10000, refundWindowDays: 7 })
  expect(r.credited).toBe(1000)
}

describe('① 주문 단위 환불이 중개사 몫을 원장까지 되돌린다', () => {
  it('두 장을 차례로 환불하면 매장·중개사 원장이 0 으로 돌아온다', async () => {
    const { db, DB } = fresh()
    await sellAndCredit(DB)
    expect(net(db, 'seller:1')).toBe(-1000)
    await clawbackVoucherSettlementOnRefund(DB, 501, 'test', [11])
    expect(net(db, 'seller:1')).toBe(-500)
    await clawbackVoucherSettlementOnRefund(DB, 501, 'test', [12])
    expect(net(db, 'seller:1')).toBe(0)
    expect(net(db, 'influencer:100')).toBe(0)
    const a = db.prepare(`SELECT status, commission_amount FROM influencer_attributions WHERE source='broker_share'`).get()
    expect(a).toEqual({ status: 'clawed_back', commission_amount: 0 })
    expect(db.prepare(`SELECT pending_amount FROM influencer_balances WHERE influencer_id='100'`).get()).toEqual({ pending_amount: 0 })
  })
  it('같은 환불을 다시 불러도 아무것도 바뀌지 않는다 (이중 역전 0)', async () => {
    const { db, DB } = fresh()
    await sellAndCredit(DB)
    await clawbackVoucherSettlementOnRefund(DB, 501, 'test')
    const before = db.prepare(`SELECT COUNT(*) n FROM ledger_entries`).get()
    await clawbackVoucherSettlementOnRefund(DB, 501, 'test')
    await clawbackVoucherSettlementOnRefund(DB, 501, 'test', [11, 12])
    expect(db.prepare(`SELECT COUNT(*) n FROM ledger_entries`).get()).toEqual(before)
    expect(net(db, 'seller:1')).toBe(0)
  })
  it('역전 함수를 직접 두 번 불러도 원본보다 많이 되돌리지 않는다', async () => {
    const { db, DB } = fresh()
    await sellAndCredit(DB)
    const attrId = (db.prepare(`SELECT id FROM influencer_attributions`).get() as { id: number }).id
    const shares = [{ attributionId: attrId, influencerId: '100', source: 'broker_share', share: 1000 }]
    expect((await reverseAttributionLedgerShares(DB, { orderId: 501, voucherId: 11, reason: 't', shares })).reversed).toBe(1)
    expect((await reverseAttributionLedgerShares(DB, { orderId: 501, voucherId: 11, reason: 't', shares })).reversed).toBe(0)
    expect((await reverseAttributionLedgerShares(DB, { orderId: 501, voucherId: 12, reason: 't', shares })).reversed).toBe(0)
    expect(net(db, 'seller:1')).toBe(0)
  })
})

describe('② 바우처 단위 경로(셀프 취소·만료 cron)도 같은 SSOT 로 원장을 되돌린다', () => {
  it('clawbackVoucherCommission — 인플루언서 추천 커미션(source 없음)도 대칭', async () => {
    const { db, DB } = fresh()
    db.exec(`
      INSERT INTO influencer_attributions (influencer_id, order_id, product_id, seller_id, commission_amount, status) VALUES ('200', 501, 7, 1, 600, 'pending');
      INSERT INTO influencer_balances (influencer_id, pending_amount) VALUES ('200', 600);
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account) VALUES ('influencer_commission', 'GB-1', 600, 'seller:1', 'influencer:200');
      UPDATE vouchers SET status = 'refunded' WHERE id = 11;
    `)
    await clawbackVoucherCommission(DB, 11, 'self_cancel')
    expect(net(db, 'seller:1')).toBe(-300)
    db.exec(`UPDATE vouchers SET status = 'refunded' WHERE id = 12`)
    await clawbackVoucherCommission(DB, 12, 'self_cancel')
    expect(net(db, 'seller:1')).toBe(0)
    expect(net(db, 'influencer:200')).toBe(0)
  })
  it('모르는 source 의 attribution 은 원장을 건드리지 않는다', () => {
    expect(ledgerEventForAttributionSource('broker_share')).toBe('broker_share')
    expect(ledgerEventForAttributionSource(null)).toBe('influencer_commission')
    expect(ledgerEventForAttributionSource('store_intro')).toBeNull()
  })
})

describe('④ 좌석을 회수당한 중개사는 더 적립받지 못한다', () => {
  it('좌석이 없으면 0 · 회수(revoked_at)되면 0 · 다시 부여되면 적립', async () => {
    const { db, DB } = fresh()
    await saveBrokerTerms(DB, 1, { brokerUserId: 100, sharePct: 10, capPct: null })
    const p = { sellerId: 1, orderId: 501, orderNumber: 'GB-1', productId: 7, totalAmount: 10000, refundWindowDays: 7 }
    expect((await creditBrokerShare(DB, p)).credited).toBe(0)
    await grantOperator(DB, 1, 100, 100, 'operator')
    const { revokeOperator } = await import('@/worker/utils/seller-operators')
    await revokeOperator(DB, 1, 100)
    expect((await creditBrokerShare(DB, p)).credited).toBe(0)
    expect(db.prepare(`SELECT COUNT(*) n FROM influencer_attributions`).get()).toEqual({ n: 0 })
    expect(db.prepare(`SELECT COUNT(*) n FROM ledger_entries`).get()).toEqual({ n: 0 })
    await grantOperator(DB, 1, 100, 100, 'operator')
    expect((await creditBrokerShare(DB, p)).credited).toBe(1000)
  })
  it('배선 — 적립 전에 좌석을 묻는다', () => {
    const s = stripComments(readFileSync('src/worker/utils/broker-share.ts', 'utf8'))
    const seat = s.indexOf('await canOperateStore(DB, terms.brokerUserId, p.sellerId)')
    expect(seat).toBeGreaterThan(0)
    expect(s.indexOf('INSERT OR IGNORE INTO influencer_attributions')).toBeGreaterThan(seat)
    expect(s.slice(seat, seat + 200)).toMatch(/if \(!seat\.ok\) return \{ credited: 0/)
  })
})

describe('③ 배선', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('바우처 회수 SSOT 가 원장 역전을 부른다', () => {
    expect(src('src/features/group-buy/api/voucher-clawback.ts'))
      .toMatch(/await reverseAttributionLedgerShares\(DB, \{ orderId, voucherId, reason, shares: ledgerShares \}\)/)
  })
  it('주문 단위 환불이 전이 성공(changes>0) 뒤에 커미션 회수를 부른다 (네 갈래 전부)', () => {
    const s = src('src/worker/utils/voucher-settlement-clawback.ts')
    expect((s.match(/changes\)?\s*\{?[^\n]*await clawbackCommissionFor\(DB, v\.id, reason\)/g) || []).length).toBe(4)
  })
  it('어드민 강제 환불·폐업 환불이 voucher_id 인라인 대신 SSOT 를 부른다', () => {
    const s = src('src/features/group-buy/api/group-buy-admin.routes.ts')
    expect(s).toMatch(/await clawbackVoucherCommission\(DB, v\.id, 'seller_closure'\)/)
    expect(s).toMatch(/await clawbackVoucherCommission\(DB, v\.id, 'admin_force_refund'\)/)
    expect(s).not.toMatch(/FROM influencer_attributions\s+WHERE voucher_id = \?/)
  })
})
