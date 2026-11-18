/**
 * 💸 2026-11-18 머니 경로 수리 4건 — 대표 승인(AskUserQuestion: "수수료를 구매 때 값으로 · 결제된 주문 자동취소 막기 ·
 *   만료 환불 때 주문·장부 정리 · 원천징수 기록·기본값"). ⚠️ 완료 판정은 staging 실결제(STAGING_CHECKLIST S-MONEY1118).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { purchaseRateSnapshot } from '@/worker/utils/ledger'
import { markOrderRefundedIfFull } from '@/worker/cron/mark-order-refunded'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const R = (p: string) => fs.readFileSync(p, 'utf8')
function d1(db: InstanceType<typeof DatabaseSync>) {
  return { prepare: (sql: string) => { let a: unknown[] = []; const st = { bind: (...x: unknown[]) => { a = x; return st }, first: async () => db.prepare(sql).get(...(a as never[])) ?? null }; return st } } as unknown as D1Database
}

describe('① 이용권 수수료는 구매 때 요율', () => {
  it('결제가 적은 요율을 쓰고, 안 적은(기본값만 있는) 주문은 채널로 넘긴다', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY, commission_rate REAL DEFAULT 10, seller_amount INT);
      CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INT);
      INSERT INTO orders VALUES (91, 5, 29450), (92, 10, NULL);
      INSERT INTO vouchers VALUES (1, 91), (2, 92), (3, 999);`)
    expect(await purchaseRateSnapshot(d1(db), 1)).toBeCloseTo(0.05)
    expect(await purchaseRateSnapshot(d1(db), 2), '결제가 안 적은 기본값 10% 는 믿지 않는다').toBeUndefined()
    expect(await purchaseRateSnapshot(d1(db), 3)).toBeUndefined()
  })
  it('원장은 스냅샷을 채널보다 먼저 본다', () => {
    const s = R('src/worker/utils/ledger.ts')
    expect(s.indexOf('platformRate = await purchaseRateSnapshot(DB, params.voucher_id)')).toBeGreaterThan(0)
    expect(s.indexOf('platformRate = await purchaseRateSnapshot(')).toBeLessThan(s.indexOf('platformRate = await channelPlatformRate('))
  })
})

describe('③ 만료 환불 뒤 주문 상태', () => {
  it('장부상 전액 환불일 때만 REFUNDED (한 장만 환불된 여러 장 주문은 그대로)', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT, total_amount INT, refunded_amount INT, updated_at TEXT);
      INSERT INTO orders VALUES (85, 'DELIVERED', 1800, 1800, NULL), (86, 'PAID', 3000, 1000, NULL);`)
    const D = { prepare: (sql: string) => { let a: unknown[] = []; const st = { bind: (...x: unknown[]) => { a = x; return st }, run: async () => db.prepare(sql).run(...(a as never[])) }; return st } } as unknown as D1Database
    await markOrderRefundedIfFull(D, 85); await markOrderRefundedIfFull(D, 86)
    expect(db.prepare('SELECT id, status FROM orders ORDER BY id').all()).toEqual([{ id: 85, status: 'REFUNDED' }, { id: 86, status: 'PAID' }])
  })
  it('딜·카드 두 갈래 모두 장부 기록 뒤 이 판정을 부르고, 카드 갈래의 무조건 REFUNDED 는 없다', () => {
    const s = R('src/worker/cron/auto-settlement.ts')
    expect(s.match(/await bookRefundOnOrder\(DB, voucher\.order_id, refundAmount, voucher\.id\);\n\s*await markOrderRefundedIfFull\(DB, voucher\.order_id\);/g)?.length).toBe(2)
    expect(s).not.toMatch(/UPDATE orders SET status = 'REFUNDED' WHERE id = \?"\)/)
  })
})

describe('② 결제 승인된 주문은 자동취소하지 않는다', () => {
  it('정리 cron 의 WHERE 가 payment_status 를 본다 — 진짜 SQLite', () => {
    const src = R('src/worker/cron/scheduled-cleanup.ts')
    const sql = /UPDATE orders\s+SET status = 'CANCELLED'[\s\S]*?(WHERE[\s\S]*?)RETURNING id/.exec(src)![1].replace(/--[^\n]*/g, '')
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT, payment_status TEXT, created_at TEXT, cancel_reason TEXT, updated_at TEXT);
      INSERT INTO orders VALUES (1,'PENDING',NULL,datetime('now','-2 days'),NULL,NULL),(2,'PENDING','approved',datetime('now','-2 days'),NULL,NULL),(3,'PENDING','pending',datetime('now','-1 hours'),NULL,NULL);`)
    db.exec(`UPDATE orders SET status = 'CANCELLED' ${sql}`)
    expect(db.prepare("SELECT id FROM orders WHERE status='CANCELLED'").all()).toEqual([{ id: 1 }])
  })
})

import { logInfluencerWithholding } from '@/worker/utils/influencer-withholding-log'
import { resolveWithholdingPct } from '@/shared/influencer-payout-math'
describe('④ 인플루언서 원천징수 기록·기본값', () => {
  it('지급 한 건이 별도 장부에 한 번만 남는다(KST 월)', async () => {
    const db = new DatabaseSync(':memory:')
    const D = { prepare: (sql: string) => { let a: unknown[] = []; const st = { bind: (...x: unknown[]) => { a = x; return st }, run: async () => { const r = db.prepare(sql).run(...(a as never[])); return { meta: { changes: Number(r.changes) } } } }; return st } } as unknown as D1Database
    const row = { influencerId: '3', gross: 100000, withholdingPct: 3.3, withholding: 3300, net: 96700, sourceId: 'influencer_cash:3:100000:1' }
    const at = new Date('2026-11-30T16:00:00Z') // KST 12-01 01:00
    expect(await logInfluencerWithholding(D, row, at)).toBe(true)
    expect(await logInfluencerWithholding(D, row, at), '같은 지급은 두 번 안 적는다').toBe(false)
    expect(db.prepare('SELECT payout_year y, payout_month m, withholding_amount w FROM influencer_withholding_log').all()).toEqual([{ y: 2026, m: 12, w: 3300 }])
  })
  it('지급 경로가 기록하고, 어드민 월 요약이 그 표를 더한다', () => {
    expect(R('src/features/group-buy/api/marketing/payouts.ts')).toMatch(/await logInfluencerWithholding\(DB, \{/)
    expect(R('src/features/admin/api/admin-tax.routes.ts')).toMatch(/FROM influencer_withholding_log WHERE payout_year = \? AND payout_month = \?/)
  })
  it('세금 종류가 비어 있으면 3.3%(SSOT 기본) · 새 행 기본값도 사업소득', () => {
    expect(resolveWithholdingPct(null, null)).toBeCloseTo(3.3)
    expect(R('src/features/group-buy/api/marketing.routes.ts')).toMatch(/body\.tax_type \|\| 'business_income'/)
    expect(R('src/worker/routes/repair-schema/column-repairs.ts')).not.toMatch(/tax_type TEXT DEFAULT 'other_income'/)
  })
})
