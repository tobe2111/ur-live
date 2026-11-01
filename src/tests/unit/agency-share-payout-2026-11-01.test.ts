/**
 * 💸 2026-11-01 에이전시 몫 유어딜 지급(결재 2026-10-11 3단계) — 실제 SQLite(node:sqlite)로 동작을 잰다.
 *
 * 지키는 것:
 *   ① 게이트 OFF = 표도 원장도 안 생긴다(종전과 byte-동일)
 *   ② 맡은 이용권만 · 판매 시각의 % · 주문당 1행(두 경로가 같은 주문을 두 번 확정해도 1행·원장 1건)
 *   ③ 에이전시 판매엔 옛 중개사 몫이 안 붙는다(매장 몫을 두 번 떼지 않는다)
 *   ④ 환불 = 이용권 비례 회수 + 원장 역전(같은 금액·반대 방향) · 같은 이용권 두 번 무르면 한 번만
 *   ⑤ 규칙 1 — 그 에이전시 직원의 소개 링크면 소개비 없음 · 남의 링크는 그대로
 *   ⑥ 정산 분기 — 사업자 공제 0 · 개인 3.3% · 성숙분만 신청 · 처리 중 신청은 하나 · 반려하면 다시 신청 가능
 *   ⑦ 옛 중개 매장 이전 — dry_run 은 아무것도 안 쓴다 · 실행은 멱등 · 스냅샷이 남는다
 *
 * ⚠️ 못 보는 것: D1 과 node:sqlite 의 차이 · 실제 결제 경로(staging S-AGENCYSHARE) · 송금 자체(어드민 손).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { setAgencyShare } from '@/features/agency-console/api/agency-share'
import { Hono } from 'hono'
import { migrateBrokerStores, registerAdminAgencyPayoutRoutes } from '@/features/agency-console/api/agency-payout.routes'
import {
  calcAgencyShareAmount, clawbackAgencyShare, creditAgencyShare, isOwnAgencyReferral, planAgencyPayout,
  readAgencyShareBalance, rejectAgencyPayout, requestAgencyPayout, markAgencyPayoutPaid,
} from '@/worker/utils/agency-share-payout'
import { creditBrokerShare } from '@/worker/utils/broker-share'
import { payoutCreditsSql } from '@/worker/utils/payout-account'

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

/** 매장 7 · 에이전시 1(직원 user 50) 이 이용권 31 을 맡음(10%) · 이용권 30 은 사장님 것. */
async function fresh(opts: { gate?: boolean; broker?: boolean; kind?: string } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  // 원장 표 — `ensureLedgerTable` 은 프로세스당 한 번만 DDL 을 돌리므로(모듈 플래그) 시험마다 직접 만든다.
  db.exec(`CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL,
    amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL, fee_amount INTEGER DEFAULT 0, fee_account TEXT,
    metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
  db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, is_active INTEGER DEFAULT 1)')
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
  db.exec(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT, updated_at TEXT, PRIMARY KEY (seller_id, key))`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER, user_id INTEGER, role TEXT, revoked_at TEXT)`)
  db.exec('CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, status TEXT)')
  db.exec(`CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY AUTOINCREMENT, influencer_id TEXT, order_id INTEGER, product_id INTEGER,
    seller_id INTEGER, commission_amount INTEGER, status TEXT, available_at TEXT, source TEXT, paid_at TEXT, voucher_id INTEGER, clawback_reason TEXT)`)
  db.exec(`CREATE TABLE influencer_balances (influencer_id TEXT PRIMARY KEY, pending_amount INTEGER DEFAULT 0, available_amount INTEGER DEFAULT 0, updated_at TEXT)`)
  db.exec("INSERT INTO products (id, seller_id) VALUES (30, 7), (31, 7)")
  db.exec("INSERT INTO users (id, name) VALUES (50, '직원'), (77, '중개사')")
  if (opts.gate !== false) db.exec("INSERT INTO platform_settings VALUES ('agency_share_payout_enabled', 'true')")
  if (opts.broker) db.exec("INSERT INTO platform_settings VALUES ('broker_share_enabled', 'true')")
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, kind, status) VALUES (1, '에이', '${opts.kind ?? 'business'}', 'active')`)
  db.exec("INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status, user_id) VALUES (6, 1, 'a@x.com', 'admin', 1, 'active', 50)")
  db.exec("INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (1, 7, 'active')")
  db.exec("INSERT INTO agency_products (product_id, seller_id, agency_id) VALUES (31, 7, 1)")
  db.exec("INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES (31, 7, 1, datetime('now', '-1 day'))")
  db.exec("INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, 10, datetime('now', '-1 day'))")
  return { db, DB }
}

const sale = (o: Partial<{ orderId: number; productId: number; total: number }> = {}) => ({
  sellerId: 7, orderId: o.orderId ?? 900, orderNumber: `GB-${o.orderId ?? 900}`, productId: o.productId ?? 31,
  totalAmount: o.total ?? 10_000, refundWindowDays: 7,
})
const ledger = (db: Db, ev: string) => db.prepare('SELECT * FROM ledger_entries WHERE event_type = ?').all(ev) as Array<Record<string, unknown>>

describe('① 게이트 OFF', () => {
  it('적립도 표도 원장도 없다', async () => {
    const { db, DB } = await fresh({ gate: false })
    const r = await creditAgencyShare(DB, sale())
    expect(r).toEqual({ credited: 0, agencyId: null, matched: false })
    const t = db.prepare("SELECT name FROM sqlite_master WHERE name = 'agency_share_credits'").get()
    expect(t).toBeUndefined()
    expect(await isOwnAgencyReferral(DB, 50, 7, 31)).toBe(false)
    const p = await requestAgencyPayout(DB, 1, 6)
    expect(p.ok).toBe(false)
  })
})

describe('② 적립', () => {
  it('맡은 이용권이면 10% 를 1행으로, 원장 seller → agency', async () => {
    const { db, DB } = await fresh()
    const r = await creditAgencyShare(DB, sale())
    expect(r).toMatchObject({ credited: 1000, agencyId: 1, matched: true })
    const rows = db.prepare('SELECT * FROM agency_share_credits').all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ agency_id: 1, seller_id: 7, amount: 1000, share_pct: 10, status: 'pending' })
    const l = ledger(db, 'agency_share')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ debit_account: 'seller:7', credit_account: 'agencyacct:1', amount: 1000 })
  })
  it('같은 주문을 두 번 확정해도(딜·카드 두 경로) 1행·원장 1건', async () => {
    const { db, DB } = await fresh()
    await creditAgencyShare(DB, sale())
    const again = await creditAgencyShare(DB, sale())
    expect(again.credited).toBe(0)
    expect(db.prepare('SELECT COUNT(*) n FROM agency_share_credits').get()).toEqual({ n: 1 })
    expect(ledger(db, 'agency_share')).toHaveLength(1)
  })
  it('사장님 이용권(맡은 기간 없음)엔 안 붙는다', async () => {
    const { DB } = await fresh()
    expect(await creditAgencyShare(DB, sale({ productId: 30 }))).toMatchObject({ credited: 0, matched: false })
  })
  it('사장님이 끊으면(맡김 ended) 다음 판매부터 안 붙는다', async () => {
    const { db, DB } = await fresh()
    db.exec("UPDATE agency_store_links SET status = 'ended'")
    expect((await creditAgencyShare(DB, sale())).matched).toBe(false)
  })
  it('판매 시각의 % — 미래 시각에 바꾼 % 는 지금 판매에 안 쓴다', async () => {
    const { db, DB } = await fresh()
    db.exec("INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, 50, datetime('now', '+1 day'))")
    expect((await creditAgencyShare(DB, sale())).credited).toBe(1000)
  })
  it('% 를 바꾸면 그 뒤 판매는 새 % (setAgencyShare 가 지금부터 적용)', async () => {
    const { DB } = await fresh()
    await setAgencyShare(DB, 7, 1, 20, null)
    expect((await creditAgencyShare(DB, sale({ orderId: 901 }))).credited).toBe(2000)
  })
  it('계산은 매장 몫 상한(90%)을 넘지 않는다 · 비정상 입력은 0', () => {
    expect(calcAgencyShareAmount(10_000, 99)).toBe(9000)
    expect(calcAgencyShareAmount(10_000, 0)).toBe(0)
    expect(calcAgencyShareAmount(Number.NaN, 10)).toBe(0)
    expect(calcAgencyShareAmount(-5, 10)).toBe(0)
    expect(calcAgencyShareAmount(999, 10)).toBe(99)
  })
})

describe('②-2 자동 정산이 이 몫을 두 번 내지 않는다', () => {
  it('주간 지급 집계(실제 SQL)에 agencyacct: 계정이 안 잡히고, 매장 몫은 그만큼 줄어든다', async () => {
    const { db, DB } = await fresh()
    db.exec("INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account) VALUES ('group_buy_join', 'GB-900', 9500, 'platform:escrow', 'seller:7')")
    await creditAgencyShare(DB, sale())
    const rows = db.prepare(payoutCreditsSql('')).all() as Array<{ account: string; total: number }>
    expect(rows.find((r) => r.account.startsWith('agencyacct'))).toBeUndefined()
    expect(rows.find((r) => r.account.startsWith('agency:'))).toBeUndefined()
    expect(rows.find((r) => r.account === 'seller:7')?.total).toBe(8500)
  })
})

describe('③ 옛 중개사 몫과 겹치지 않는다', () => {
  it('에이전시 판매면 broker_share 0 · 사장님 이용권은 종전대로 중개사 몫', async () => {
    const { db, DB } = await fresh({ broker: true })
    db.exec("INSERT INTO seller_meta VALUES (7, 'broker_user_id', '77', null), (7, 'broker_share_pct', '10', null)")
    db.exec("INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 77, 'operator')")
    await creditBrokerShare(DB, sale())
    expect(db.prepare("SELECT COUNT(*) n FROM influencer_attributions WHERE source = 'broker_share'").get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) n FROM agency_share_credits').get()).toEqual({ n: 1 })
    await creditBrokerShare(DB, sale({ orderId: 902, productId: 30 }))
    expect(db.prepare("SELECT COUNT(*) n FROM influencer_attributions WHERE source = 'broker_share'").get()).toEqual({ n: 1 })
  })
})

describe('④ 환불 회수', () => {
  it('2장 중 1장 환불 = 절반 회수 + 원장 역전 · 같은 장 두 번은 한 번만', async () => {
    const { db, DB } = await fresh()
    db.exec("INSERT INTO vouchers (id, order_id, status) VALUES (1, 900, 'refunded'), (2, 900, 'unused')")
    await creditAgencyShare(DB, sale())
    expect(await clawbackAgencyShare(DB, { orderId: 900, voucherId: 1, denom: 2, reason: 'refund' })).toBe(500)
    expect(db.prepare('SELECT amount, status FROM agency_share_credits').get()).toEqual({ amount: 500, status: 'pending' })
    const rev = ledger(db, 'agency_share_reversal')
    expect(rev).toHaveLength(1)
    expect(rev[0]).toMatchObject({ debit_account: 'agencyacct:1', credit_account: 'seller:7', amount: 500 })
    // 같은 장 다시 — 원장 UNIQUE 가 막는다(금액 CAS 가 통과해도 원장은 한 번).
    await clawbackAgencyShare(DB, { orderId: 900, voucherId: 1, denom: 1, reason: 'refund' })
    expect(ledger(db, 'agency_share_reversal')).toHaveLength(1)
  })
  it('전부 환불이면 clawed_back · 지급 신청에 묶인 몫은 건드리지 않는다', async () => {
    const { db, DB } = await fresh()
    await creditAgencyShare(DB, sale())
    db.exec("UPDATE agency_share_credits SET payout_id = 5, status = 'requested'")
    expect(await clawbackAgencyShare(DB, { orderId: 900, voucherId: 1, denom: 1, reason: 'refund' })).toBe(0)
    // 경합 창 — 읽은 직후 신청이 묶었다(상태는 아직 pending 으로 읽혔다). 갱신 CAS 가 막아야 한다.
    db.exec("UPDATE agency_share_credits SET status = 'pending'")
    expect(await clawbackAgencyShare(DB, { orderId: 900, voucherId: 1, denom: 1, reason: 'refund' })).toBe(0)
    expect(db.prepare('SELECT amount FROM agency_share_credits').get()).toEqual({ amount: 1000 })
    db.exec("UPDATE agency_share_credits SET payout_id = NULL, status = 'pending'")
    expect(await clawbackAgencyShare(DB, { orderId: 900, voucherId: 1, denom: 1, reason: 'refund' })).toBe(1000)
    expect(db.prepare('SELECT amount, status FROM agency_share_credits').get()).toEqual({ amount: 0, status: 'clawed_back' })
  })
  it('voucher-clawback 이 인플 attribution 조기 반환보다 먼저 부른다(소스)', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/voucher-clawback.ts', 'utf8'))
    const call = src.indexOf('clawbackAgencyShare(DB')
    const early = src.indexOf('if (attrs.length === 0) return 0')
    expect(call).toBeGreaterThan(0)
    expect(early).toBeGreaterThan(call)
  })
})

describe('⑤ 규칙 1 — 자기 링크엔 소개비 없음', () => {
  it('그 에이전시 직원 링크 = true · 남의 링크 · 사장님 이용권 = false', async () => {
    const { DB } = await fresh()
    expect(await isOwnAgencyReferral(DB, 50, 7, 31)).toBe(true)
    expect(await isOwnAgencyReferral(DB, '50', 7, 31)).toBe(true)
    expect(await isOwnAgencyReferral(DB, 51, 7, 31)).toBe(false)
    expect(await isOwnAgencyReferral(DB, 50, 7, 30)).toBe(false)
    expect(await isOwnAgencyReferral(DB, 'abc', 7, 31)).toBe(false)
  })
  it('두 결제 경로 모두 influencerActive 에 규칙 1을 건다(소스)', () => {
    for (const f of ['src/features/group-buy/api/group-buy.routes.ts', 'src/features/group-buy/api/helpers.ts']) {
      const src = stripComments(readFileSync(f, 'utf8'))
      expect(src).toMatch(/influencerActive = !blocked[^\n]*\n\s*&& !\(await isOwnAgencyReferral\(/)
    }
  })
})

describe('⑥ 정산 분기', () => {
  it('사업자 = 세금계산서·공제 0 · 개인 = 3.3%(원 미만 버림)', () => {
    expect(planAgencyPayout('business', 100_000)).toEqual({ taxMode: 'tax_invoice', gross: 100_000, withholding: 0, net: 100_000 })
    expect(planAgencyPayout('individual', 100_000)).toEqual({ taxMode: 'withholding_3_3', gross: 100_000, withholding: 3300, net: 96_700 })
    expect(planAgencyPayout('individual', 12_345).withholding).toBe(407)
    expect(planAgencyPayout(null, 1000).taxMode).toBe('tax_invoice')
  })
  it('신청은 성숙한 몫만 묶는다 — 아직 환불 창 안의 몫은 남는다', async () => {
    const { db, DB } = await fresh()
    await creditAgencyShare(DB, sale({ orderId: 910, total: 200_000 }))
    await creditAgencyShare(DB, sale({ orderId: 911, total: 50_000 }))
    db.exec("UPDATE agency_share_credits SET available_at = '2000-01-01T00:00:00.000Z' WHERE order_id = 910")
    const r = await requestAgencyPayout(DB, 1, 6)
    expect(r).toMatchObject({ ok: true, gross: 20_000 })
    expect(db.prepare('SELECT payout_id IS NULL AS free, status FROM agency_share_credits WHERE order_id = 911').get()).toEqual({ free: 1, status: 'pending' })
  })
  it('성숙분만 신청 · 처리 중엔 두 번째 신청 거절 · 반려하면 다시 · 지급 처리는 한 번', async () => {
    const { db, DB } = await fresh({ kind: 'individual' })
    await creditAgencyShare(DB, sale({ total: 200_000 }))
    expect((await requestAgencyPayout(DB, 1, 6)).ok).toBe(false) // 아직 성숙 전
    db.exec("UPDATE agency_share_credits SET available_at = '2000-01-01T00:00:00.000Z'")
    expect(await readAgencyShareBalance(DB, 1)).toMatchObject({ available: 20_000, pending: 0 })
    const r1 = await requestAgencyPayout(DB, 1, 6)
    expect(r1).toMatchObject({ ok: true, gross: 20_000, withholding: 660, net: 19_340, taxMode: 'withholding_3_3' })
    expect((await requestAgencyPayout(DB, 1, 6)).ok).toBe(false)
    if (!r1.ok) throw new Error('unreachable')
    expect(await rejectAgencyPayout(DB, r1.payoutId, 1)).toBe(true)
    const r2 = await requestAgencyPayout(DB, 1, 6)
    expect(r2.ok).toBe(true)
    if (!r2.ok) throw new Error('unreachable')
    expect(await markAgencyPayoutPaid(DB, r2.payoutId, 1)).toBe(true)
    expect(await markAgencyPayoutPaid(DB, r2.payoutId, 1)).toBe(false)
    expect(await readAgencyShareBalance(DB, 1)).toMatchObject({ paid: 20_000, available: 0, requested: 0 })
  })
})

describe('⑦ 옛 중개 매장 이전', () => {
  async function brokerFixture() {
    const f = await fresh()
    f.db.exec("DELETE FROM agency_staff; DELETE FROM agency_accounts; DELETE FROM agency_store_links; DELETE FROM agency_products; DELETE FROM agency_product_periods; DELETE FROM agency_share_terms")
    f.db.exec("INSERT INTO seller_meta VALUES (7, 'broker_user_id', '77', null), (7, 'broker_share_pct', '10', null)")
    f.db.exec("INSERT INTO seller_meta VALUES (8, 'broker_user_id', '77', null), (8, 'broker_share_pct', '2', null)")
    f.db.exec("INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 77, 'operator'), (8, 77, 'operator')")
    f.db.exec("INSERT INTO products (id, seller_id) VALUES (40, 8)")
    return f
  }
  it('dry_run 은 아무것도 안 쓴다', async () => {
    const { db, DB } = await brokerFixture()
    const r = await migrateBrokerStores(DB, { brokerUserId: 77, dryRun: true, agencyName: '', kind: 'individual', adminId: 1 })
    expect(r.ok && r.stores.map((s) => s.sellerId).sort()).toEqual([7, 8])
    expect(db.prepare('SELECT COUNT(*) n FROM agency_accounts').get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) n FROM agency_store_links').get()).toEqual({ n: 0 })
  })
  it('실행 = 에이전시 1 · 맡김 active · 이용권 전부 맡음 · % 이전 · 스냅샷 · 두 번 눌러도 같다', async () => {
    const { db, DB } = await brokerFixture()
    const run = () => migrateBrokerStores(DB, { brokerUserId: 77, dryRun: false, agencyName: '유어팀', kind: 'individual', adminId: 1 })
    const r = await run()
    expect(r).toMatchObject({ ok: true, created: true })
    await run()
    expect(db.prepare('SELECT COUNT(*) n FROM agency_accounts').get()).toEqual({ n: 1 })
    expect(db.prepare("SELECT COUNT(*) n FROM agency_store_links WHERE status = 'active'").get()).toEqual({ n: 2 })
    expect(db.prepare('SELECT COUNT(*) n FROM agency_product_periods WHERE ended_at IS NULL').get()).toEqual({ n: 3 })
    expect(db.prepare('SELECT seller_id, pct FROM agency_share_terms ORDER BY seller_id').all()).toEqual([{ seller_id: 7, pct: 10 }, { seller_id: 8, pct: 2 }])
    expect(db.prepare('SELECT COUNT(*) n FROM agency_migration_snapshots').get()).toEqual({ n: 2 })
    // 옛 좌석·메타는 지우지 않는다(롤백 근거) — 그래도 에이전시 판매엔 중개사 몫이 안 붙는다(③).
    expect(db.prepare('SELECT COUNT(*) n FROM seller_operators WHERE revoked_at IS NULL').get()).toEqual({ n: 2 })
    expect((await creditAgencyShare(DB, sale({ productId: 40 }))).credited).toBe(0) // 매장 8 엔 판매 없음 — 이용권 40 은 매장 8
    expect((await creditAgencyShare(DB, { ...sale({ orderId: 905, productId: 40 }), sellerId: 8 })).credited).toBe(200)
  })
  it('라우트는 본문에 dry_run:false 가 없으면 미리보기만 한다', async () => {
    const { db, DB } = await brokerFixture()
    const app = new Hono()
    registerAdminAgencyPayoutRoutes(app)
    const call = (body: unknown) => app.request('/agency-accounts/migrate-broker', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, { DB })
    const res = await call({ broker_user_id: 77, agency_name: '유어팀' })
    expect(((await res.json()) as { dryRun: boolean }).dryRun).toBe(true)
    expect(db.prepare('SELECT COUNT(*) n FROM agency_accounts').get()).toEqual({ n: 0 })
    await call({ broker_user_id: 77, agency_name: '유어팀', dry_run: false })
    expect(db.prepare('SELECT COUNT(*) n FROM agency_accounts').get()).toEqual({ n: 1 })
  })
  it('회수된 좌석의 매장은 옮기지 않는다', async () => {
    const { db, DB } = await brokerFixture()
    db.exec("UPDATE seller_operators SET revoked_at = datetime('now') WHERE seller_id = 8")
    const r = await migrateBrokerStores(DB, { brokerUserId: 77, dryRun: true, agencyName: '', kind: 'individual', adminId: 1 })
    expect(r.ok && r.stores.map((s) => s.sellerId)).toEqual([7])
  })
})
