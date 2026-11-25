/**
 * 🛒💸 쇼핑 주문의 환불 구멍 — 지금 닿을 수 있는 것 (2026-11-25 대표 *"이어서 다 고쳐줘."*)
 *
 * 쇼핑 길의 새 주문은 서버에서 닫혀 있다(`shopping-rail-closed-2026-11-25`). 그래도 **옛 주문**은 환불·반품이 되므로
 * 그 길의 구멍은 살아 있다. 라이브(2026-11-25) 옛 쇼핑 주문: 결제 완료 2건 · 배송 완료 19건 · 섞어 결제한 주문 0건.
 *
 *  ① 손님이 **금액을 정해** 일부만 환불받는 길 둘을 닫는다. 그 길로는 주문이 결제 완료로 남아 99% 를 돌려받고도
 *     상품이 전부 배송되고, 옛 정산 화면은 주문 금액 전액을 매장에 줄 돈으로 셌다. 손님은 전액만 무른다.
 *  ② 손님 환불 길에도 "선물한 이용권" 검사를 건다(취소 길에만 있었다).
 *  ③ 반품 환불: 돈이 움직이기 **전에** 이미 환불된 주문인지 보고, 남은 금액을 넘지 않게 하고, 반품 건을 선점한다.
 *     종전엔 딜 환급이 선점보다 먼저라 같은 딜이 두 번 나갔다(셀러가 먼저 환불한 주문의 반품 처리).
 *  ④ 어드민 딜 화면의 "후원" 숫자는 딜 사용 전체다(이용권·교환권 구매 포함) — 이름을 "사용" 으로.
 *
 * 실제 라우트를 라이브 구조 DB 위에서 돌린다. 카드사는 가짜.
 * 못 보는 것(닫힌 길이라 지금은 닿지 않는다 — 쇼핑을 다시 열기 전에 고칠 것, 인계 표 D1·D2·D4·D7~D12·D15):
 *   섞어 결제한 주문의 환불 계산 · 주문 생성 때 딜 묶어 두기 · 미결제 취소의 재고 복원 · 결제 중 취소 · 옛 정산 상태값.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, SECRET } from '../helpers/live-d1'
import { readCode } from '../helpers/source-text'
import { ordersRouter } from '@/worker/routes/order.routes'
import { returnsRoutes } from '@/features/returns/api/returns.routes'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { PARTIAL_SELF_REFUND_BLOCKED } from '@/worker/utils/order-self-refund'

async function setup() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  const out = stubOutbound()
  const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', TOSS_CLIENT_KEY: 'test_ck_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
  const app = new Hono()
  app.use('/api/*', storeSeatGuard())
  app.route('/api/orders', ordersRouter)
  app.route('/api/returns', returnsRoutes)
  const call = async (method: string, path: string, token: string | null, body?: unknown) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 shoprefund' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
    await drain()
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 300) } }
    return { status: res.status, json }
  }
  const BUYER = insert(raw, 'users', { name: '시험손님', email: 'buyer@example.test', phone: '01012345678' })
  const SELLER = insert(raw, 'sellers', { username: 'shop-store', password_hash: '', name: '시험사장', email: 'owner@example.test', business_name: '시험상점', status: 'approved', seller_type: 'store_owner' })
  insert(raw, 'user_points', { user_id: String(BUYER), balance: 0 })
  const balance = () => Number(q1<{ b: number }>(raw, 'SELECT balance b FROM user_points WHERE user_id = ?', String(BUYER))?.b ?? 0)
  const tossCancels = () => out.toss.filter((t) => t.kind === 'cancel')
  return { raw, call, out, BUYER, SELLER, balance, tossCancels, bTok: await userToken(BUYER), sTok: await sellerToken(SELLER) }
}

describe('① 손님은 전액만 무른다 — 금액을 정한 부분 환불은 닫혔다', () => {
  it('POST /api/orders/refund 에 일부 금액: 400 · 카드 취소 호출 없음 · 장부 그대로', async () => {
    const s = await setup()
    const oid = insert(s.raw, 'orders', { order_number: 'ORDER-PR-1', user_id: String(s.BUYER), seller_id: s.SELLER, status: 'PAID', total_amount: 100000, toss_payment_key: 'pk_1', payment_status: 'approved' })
    const r = await s.call('POST', '/api/orders/refund', s.bTok, { order_id: String(oid), reason: '일부만 환불', refund_amount: 99000 })
    s.out.restore()
    expect([r.status, r.json.code], JSON.stringify(r.json).slice(0, 300)).toEqual([400, 'PARTIAL_NOT_ALLOWED'])
    expect(r.json.error).toBe(PARTIAL_SELF_REFUND_BLOCKED)
    expect(s.tossCancels(), '카드사에 부분 취소를 보냈다').toEqual([])
    expect(q1<{ s: string; r: number | null }>(s.raw, 'SELECT status s, refunded_amount r FROM orders WHERE id = ?', oid)).toMatchObject({ s: 'PAID' })
    expect(Number(q1<{ r: number | null }>(s.raw, 'SELECT refunded_amount r FROM orders WHERE id = ?', oid)?.r ?? 0)).toBe(0)
  })

  it('POST /api/orders/:id/cancel 에 일부 금액: 400 · 카드 취소 호출 없음', async () => {
    const s = await setup()
    const oid = insert(s.raw, 'orders', { order_number: 'ORDER-PC-1', user_id: String(s.BUYER), seller_id: s.SELLER, status: 'PAID', total_amount: 100000, toss_payment_key: 'pk_2', payment_status: 'approved' })
    const r = await s.call('POST', `/api/orders/${oid}/cancel`, s.bTok, { reason: '일부만', cancel_amount: 99000 })
    s.out.restore()
    expect([r.status, r.json.code], JSON.stringify(r.json).slice(0, 300)).toEqual([400, 'PARTIAL_NOT_ALLOWED'])
    expect(s.tossCancels()).toEqual([])
    expect(q1<{ s: string }>(s.raw, 'SELECT status s FROM orders WHERE id = ?', oid)?.s).toBe('PAID')
  })

  it('금액을 안 적은 전액 환불은 종전대로 된다', async () => {
    const s = await setup()
    const oid = insert(s.raw, 'orders', { order_number: 'ORDER-FR-1', user_id: String(s.BUYER), seller_id: s.SELLER, status: 'PAID', total_amount: 20000, toss_payment_key: 'pk_3', payment_status: 'approved' })
    const r = await s.call('POST', '/api/orders/refund', s.bTok, { order_id: String(oid), reason: '전액 환불' })
    s.out.restore()
    expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBe(200)
    expect(s.tossCancels().length).toBe(1)
    expect(q1<{ s: string }>(s.raw, 'SELECT status s FROM orders WHERE id = ?', oid)?.s).toBe('REFUNDED')
  })

  it('② 손님 환불 길에도 선물한 이용권 검사가 있다(취소 길과 같게)', () => {
    const src = readCode('src/worker/routes/order.routes.ts')
    const i = src.indexOf("voucherOrderSelfCancelBlock(c.env.DB, Number(order.id), { cancelAmount: body.refund_amount })")
    expect(i).toBeGreaterThan(0)
    const line = src.slice(i, src.indexOf('\n', i))
    expect(line).toContain('orderHasGiftedVoucher(c.env.DB, String(order.id))')
    expect(line).toContain('orderHasPendingGift(c.env.DB, String(order.id))')
  })
})

describe('③ 반품 환불 — 돈이 움직이기 전에 확인하고 선점한다', () => {
  const dealOrder = (s: Awaited<ReturnType<typeof setup>>, v: Record<string, unknown> = {}) =>
    insert(s.raw, 'orders', { order_number: `ORDER-RT-${Math.random().toString(36).slice(2, 7)}`, user_id: String(s.BUYER), seller_id: s.SELLER, status: 'DELIVERED', total_amount: 10000, payment_method: 'deal_points', ...v })
  const returnRow = async (s: Awaited<ReturnType<typeof setup>>, oid: number, amount: number) => {
    await s.call('GET', '/api/returns/my', s.bTok) // 반품 표를 만든다
    return insert(s.raw, 'returns', { order_id: oid, order_number: `R-${oid}`, user_id: String(s.BUYER), seller_id: s.SELLER, status: 'inspected', reason: '단순 변심', refund_amount: amount })
  }

  it('정상: 딜로 결제한 주문의 반품 환불은 딜을 한 번 돌려주고, 장부에 적는다', async () => {
    const s = await setup()
    const oid = dealOrder(s)
    const rid = await returnRow(s, oid, 10000)
    const r = await s.call('PUT', `/api/returns/${rid}/refund`, s.sTok)
    s.out.restore()
    expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBe(200)
    expect(s.balance()).toBe(10000)
    expect(q1<{ s: string; r: number }>(s.raw, 'SELECT status s, refunded_amount r FROM orders WHERE id = ?', oid)).toMatchObject({ s: 'REFUNDED', r: 10000 })
    expect(q1<{ s: string }>(s.raw, 'SELECT status s FROM returns WHERE id = ?', rid)?.s).toBe('refunded')
  })

  it('셀러가 이미 환불한 주문의 반품을 처리해도 딜이 또 나가지 않는다(종전: 한 번 더 나갔다)', async () => {
    const s = await setup()
    const oid = dealOrder(s, { status: 'REFUNDED', refunded_amount: 10000 })
    const rid = await returnRow(s, oid, 10000)
    const r = await s.call('PUT', `/api/returns/${rid}/refund`, s.sTok)
    s.out.restore()
    expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBe(200)
    expect(s.balance(), '이미 환불된 주문에 딜을 또 돌려줬다').toBe(0)
    expect(q1<{ s: string }>(s.raw, 'SELECT status s FROM returns WHERE id = ?', rid)?.s).toBe('refunded')
  })

  it('남은 금액(총액 − 이미 환불)을 넘는 반품 환불은 거절한다', async () => {
    const s = await setup()
    const oid = dealOrder(s, { refunded_amount: 6000 })
    const rid = await returnRow(s, oid, 10000)
    const r = await s.call('PUT', `/api/returns/${rid}/refund`, s.sTok)
    s.out.restore()
    expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBe(400)
    expect(s.balance()).toBe(0)
    expect(q1<{ s: string }>(s.raw, 'SELECT status s FROM returns WHERE id = ?', rid)?.s, '거절했는데 반품 건이 닫혔다').toBe('inspected')
  })

  it('같은 반품을 두 번 처리해도 딜은 한 번만 나간다', async () => {
    const s = await setup()
    const oid = dealOrder(s)
    const rid = await returnRow(s, oid, 10000)
    await s.call('PUT', `/api/returns/${rid}/refund`, s.sTok)
    const again = await s.call('PUT', `/api/returns/${rid}/refund`, s.sTok)
    s.out.restore()
    expect(again.status).not.toBe(500)
    expect(s.balance()).toBe(10000)
  })

  it('순서: 반품 건 선점이 딜 환급·카드 취소보다 먼저다 · 카드 취소가 실패하면 선점을 되돌린다', () => {
    const src = readCode('src/features/returns/api/returns.routes.ts')
    const claim = src.indexOf("const claimed = await DB.prepare(`UPDATE returns SET status = 'refunded'")
    const deal = src.indexOf('await refundDealPoints(DB, {', claim)
    const toss = src.indexOf('const cancelResult = await tossCancelPayment(', claim)
    expect(claim).toBeGreaterThan(0)
    expect(deal, '딜 환급이 선점보다 먼저다').toBeGreaterThan(claim)
    expect(toss, '카드 취소가 선점보다 먼저다').toBeGreaterThan(claim)
    expect(src).toContain("if (!cancelResult.success) { await DB.prepare(`UPDATE returns SET status = 'inspected', refunded_at = NULL WHERE id = ? AND status = 'refunded'`)")
  })
})

describe('④ 어드민 딜 화면 — 숫자의 이름', () => {
  it('"후원" 이 아니라 "사용" 이라고 부른다(딜 사용 전체다)', () => {
    const page = readCode('src/pages/AdminDealMonitorPage.tsx')
    expect(page).toContain('sub={`사용 ${fmt(s?.donations.total_donated)}딜`}')
    expect(page).not.toContain("defaultValue: '총 후원액'")
    expect(page).not.toContain("defaultValue: '후원액순'")
  })
})
