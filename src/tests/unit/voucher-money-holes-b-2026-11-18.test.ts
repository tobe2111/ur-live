/**
 * 💸 2026-11-18 (대표 승인 4건) — 이용권 결제·취소·환불의 돈 구멍. 진짜 SQLite + 토스·딜 가짜로 돌린다.
 *  ① 결제수단을 빼고 /join 하면 공짜 발급 → 빈 값은 'deal'(딜 차감을 반드시 지난다)
 *  ② 주문 취소: 사용한 이용권 전액 환불 · 7일 지나도 취소 · 금액만 적어 딜만 받기 → 셀프는 장 단위 규칙
 *  ③ 딜 셀프 취소 뒤 주문 전체 취소로 이중 환불 → 돌려주기 전에 주문에 적는다
 *  ④ 매장 부분환불이 카드면 0원 → 토스 부분취소(4xx 면 원상복구, 5xx 면 재시도 큐)
 *  ⑤ 혼합결제 셀프 취소가 딜 몫을 안 돌려줌 → 나눠서 돌려준다
 *  ⑥ 날짜만 적힌 기한이 마지막 날 오전 9시에 끝남 → 그날 한국 23:59:59
 *  ⑦ 장바구니 딜 실패 시 첫 상품 재고 이중 복원 → qty 0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const toss = vi.fn()
const deal = vi.fn()
vi.mock('@/worker/utils/toss-refund', () => ({ tossCancelPayment: (...a: unknown[]) => toss(...a) }))
vi.mock('@/worker/utils/point-buckets', () => ({ refundDealPoints: (...a: unknown[]) => deal(...a) }))
vi.mock('../../worker/utils/toss-refund', () => ({ tossCancelPayment: (...a: unknown[]) => toss(...a) }))
vi.mock('../../worker/utils/point-buckets', () => ({ refundDealPoints: (...a: unknown[]) => deal(...a) }))
vi.mock('@/worker/utils/visit-reward', () => ({ reverseVisitRewardOnRefund: async () => null }))
vi.mock('@/worker/utils/toss-refund-alert', () => ({ alertTossRefundFailure: async () => null }))

import { voucherOrderSelfCancelBlock, bookVoucherRefundOnOrder } from '@/worker/utils/order-refund-guards'
import { refundSelfCancelledVoucher, refundStorePartialCard } from '@/features/group-buy/api/voucher-self-cancel-refund'
import { resolveVoucherExpiresAt, VOUCHER_DATE_ONLY_EXPIRY_FIX_SQL } from '@/shared/voucher-validity'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const R = (p: string) => fs.readFileSync(p, 'utf8')

function d1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const st = {
        bind: (...a: unknown[]) => { args = a; return st },
        first: async () => (db.prepare(sql).get(...(args as never[])) ?? null),
        all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
        run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return st
    },
  } as unknown as D1Database
}
function fx() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, total_amount INTEGER, refunded_amount INTEGER DEFAULT 0, deal_used INTEGER DEFAULT 0, status TEXT, payment_status TEXT, updated_at TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, status TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT);`)
  return { db, D: d1(db) }
}
beforeEach(() => { toss.mockReset(); deal.mockReset() })

describe('① 결제수단 없이 /join', () => {
  it('빈 값은 deal 로 본다', () => {
    expect(R('src/features/group-buy/api/group-buy.routes.ts')).toContain("const payment_method: 'deal' | 'toss' = body.payment_method ?? 'deal'")
  })
})

describe('② 이용권 주문 셀프 취소 규칙', () => {
  it('사용한 장이 있으면 전체 취소 불가 · 금액만은 불가 · 7일 지나면 불가 · 미사용·7일 안이면 통과', async () => {
    const { db, D } = fx()
    db.exec(`INSERT INTO orders (id, total_amount, status) VALUES (1, 20000, 'PAID'), (2, 10000, 'PAID'), (3, 10000, 'PAID'), (4, 5000, 'PAID');
      INSERT INTO vouchers (id, order_id, status) VALUES (11, 1, 'used'), (12, 1, 'unused'), (21, 2, 'unused');
      INSERT INTO vouchers (id, order_id, status, created_at) VALUES (31, 3, 'unused', datetime('now', '-8 days'));`)
    expect(await voucherOrderSelfCancelBlock(D, 1, {})).toMatchObject({ code: 'VOUCHER_USED' })
    expect(await voucherOrderSelfCancelBlock(D, 1, { cancelQty: 1 })).toBeNull()
    expect(await voucherOrderSelfCancelBlock(D, 2, { cancelAmount: 9999 })).toMatchObject({ code: 'VOUCHER_ORDER_BY_QTY' })
    expect(await voucherOrderSelfCancelBlock(D, 3, {})).toMatchObject({ code: 'WINDOW_EXPIRED' })
    expect(await voucherOrderSelfCancelBlock(D, 2, {})).toBeNull()
    expect(await voucherOrderSelfCancelBlock(D, 4, { cancelAmount: 100 })).toBeNull() // 이용권 없는 주문은 그대로
  })
  it('두 취소 길 모두 셀프에 규칙을 건다', () => {
    const s = R('src/worker/routes/order.routes.ts')
    expect(s).toContain("if (c.get('user').type !== 'admin') { const vb = await voucherOrderSelfCancelBlock(c.env.DB, Number(orderId), { cancelAmount, cancelQty: body.cancel_qty })")
    expect(s).toContain('const vb = await voucherOrderSelfCancelBlock(c.env.DB, Number(order.id), { cancelAmount: body.refund_amount })')
  })
})

describe('③ 딜 셀프 취소는 주문에 먼저 적는다', () => {
  it('적고 → 딜 환불 → 다 무르면 REFUNDED · 이미 다 환불된 주문이면 이용권을 되돌리고 멈춘다', async () => {
    const { db, D } = fx()
    db.exec(`INSERT INTO orders (id, order_number, total_amount, status) VALUES (1, 'GB-1', 10000, 'PAID'), (2, 'GB-2', 10000, 'PAID');
      UPDATE orders SET refunded_amount = 10000 WHERE id = 2;
      INSERT INTO vouchers (id, order_id, status) VALUES (11, 1, 'refunded'), (21, 2, 'refunded');`)
    const v = { id: 11, user_id: '3', order_id: 1, product_name: 'x', payment_method: 'deal_points', payment_key: null }
    expect(await refundSelfCancelledVoucher(D, {}, undefined, v, 10000)).toBe(true)
    expect(deal).toHaveBeenCalledTimes(1)
    expect(db.prepare('SELECT refunded_amount r, status s FROM orders WHERE id = 1').get()).toEqual({ r: 10000, s: 'REFUNDED' })
    expect(await refundSelfCancelledVoucher(D, {}, undefined, { ...v, id: 21, order_id: 2 }, 10000)).toBe(false)
    expect(deal).toHaveBeenCalledTimes(1)
    expect((db.prepare('SELECT status s FROM vouchers WHERE id = 21').get() as { s: string }).s).toBe('unused')
  })
  it('bookVoucherRefundOnOrder 는 총액을 넘겨 적지 않는다', async () => {
    const { db, D } = fx()
    db.exec(`INSERT INTO orders (id, total_amount, status) VALUES (1, 10000, 'PAID'); INSERT INTO vouchers (id, order_id, status) VALUES (11, 1, 'unused');`)
    expect(await bookVoucherRefundOnOrder(D, 1, 6000)).toBe(true)
    expect(await bookVoucherRefundOnOrder(D, 1, 6000)).toBe(false)
    expect(db.prepare('SELECT refunded_amount r, status s FROM orders WHERE id = 1').get()).toEqual({ r: 6000, s: 'PAID' })
  })
})

describe('⑤ 혼합결제 셀프 취소', () => {
  it('딜 3,000 + 카드 7,000 → 딜 3,000 은 딜로, 카드는 7,000 만 토스로', async () => {
    const { db, D } = fx()
    db.exec(`INSERT INTO orders (id, order_number, total_amount, deal_used, status) VALUES (1, 'GB-1', 10000, 3000, 'PAID'); INSERT INTO vouchers (id, order_id, status) VALUES (11, 1, 'refunded');`)
    toss.mockResolvedValue({ ok: true })
    await refundSelfCancelledVoucher(D, {}, undefined, { id: 11, user_id: '3', order_id: 1, product_name: 'x', payment_method: 'toss', payment_key: 'pk' }, 10000)
    expect(deal.mock.calls[0][1]).toMatchObject({ amount: 3000 })
    expect(toss.mock.calls[0][2]).toMatchObject({ amount: 7000 })
    expect((db.prepare('SELECT deal_used d FROM orders WHERE id = 1').get() as { d: number }).d).toBe(0)
  })
})

describe('④ 매장 부분환불 카드', () => {
  const base = { voucherId: 11, userId: '3', orderId: 1, paymentKey: 'pk', dealUsed: 0, orderTotal: 10000, orderNumber: 'GB-1', amount: 4000, productName: 'x' }
  it('카드면 토스 부분취소를 부른다', async () => {
    const { D } = fx(); toss.mockResolvedValue({ ok: true })
    expect(await refundStorePartialCard(D, {}, base)).toEqual({ ok: true, pending: false })
    expect(toss.mock.calls[0][2]).toMatchObject({ amount: 4000 })
  })
  it('4xx 거절이면 실패를 돌려준다(호출부가 원상복구) · 5xx 면 처리 중', async () => {
    const { D } = fx()
    toss.mockResolvedValue({ ok: false, http_status: 400, error_code: 'X' })
    expect((await refundStorePartialCard(D, {}, base)).ok).toBe(false)
    toss.mockResolvedValue({ ok: false, http_status: 503 })
    expect(await refundStorePartialCard(D, {}, base)).toEqual({ ok: true, pending: true })
  })
  it('라우트는 먼저 주문에 적고, 카드 실패면 장부·이용권을 되돌린다', () => {
    const s = R('src/features/group-buy/api/group-buy-voucher.routes.ts')
    expect(s).toContain('await bookVoucherRefundOnOrder(DB, order.id, refundAmount)')
    expect(s).toContain("if (!r.ok) { await DB.prepare('UPDATE orders SET refunded_amount = MAX(0, COALESCE(refunded_amount, 0) - ?) WHERE id = ?').bind(refundAmount, order.id).run(); await undoUse();")
  })
})

describe('⑥ 날짜만 적힌 기한', () => {
  const now = new Date('2026-11-18T03:00:00Z')
  it('새 발급: 날짜만이면 그날 한국 23:59:59(=14:59:59 UTC), 시각이 있으면 그대로', () => {
    expect(resolveVoucherExpiresAt('2026-12-31', now)).toBe('2026-12-31 14:59:59')
    expect(resolveVoucherExpiresAt('2026-12-31 10:00:00', now)).toBe('2026-12-31 10:00:00')
    expect(resolveVoucherExpiresAt('2026-12-31 14:59:59', now) < '2026-12-31 15:00:00').toBe(true)
  })
  it('이미 발급된 미사용 행을 고치는 SQL — 한 번만 붙는다', () => {
    const { db } = fx()
    db.exec(`INSERT INTO vouchers (id, status, expires_at) VALUES (1, 'unused', '2026-12-31'), (2, 'used', '2026-12-31'), (3, 'unused', '2026-12-31 10:00:00');`)
    db.exec(VOUCHER_DATE_ONLY_EXPIRY_FIX_SQL); db.exec(VOUCHER_DATE_ONLY_EXPIRY_FIX_SQL)
    expect(db.prepare('SELECT id, expires_at e FROM vouchers ORDER BY id').all()).toEqual([
      { id: 1, e: '2026-12-31 14:59:59' }, { id: 2, e: '2026-12-31' }, { id: 3, e: '2026-12-31 10:00:00' },
    ])
  })
})

describe('⑦ 장바구니 딜 실패 재고', () => {
  it('spendPartialDeal 에 수량 0 (재고는 rollbackStock 이 줄 단위로)', () => {
    expect(R('src/features/group-buy/api/cart-checkout.routes.ts')).toMatch(/productId: priced\.lines\[0\]!\.productId,\n(\s*\/\/.*\n)*\s*qty: 0,/)
  })
})
