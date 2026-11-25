/**
 * 🛒 쇼핑 주문 길은 화면만 숨겨져 있고 서버는 열려 있었다 (2026-11-25 대표 *"나머지 빠짐없이 모두 해줘야지."*)
 *
 * 쇼핑 탭은 2026-06-10 부터 숨김(`SHOPPING_TAB_HIDDEN`)인데 그 값을 보는 서버 코드가 없었다. 라이브(2026-11-25)엔 쇼핑 상품이
 * 0개라, 이 길로 살 수 있는 것은 **이용권·교환권뿐**이다 — 그런데 이 길은 이용권을 발급하지 않는다. 돈(또는 딜)만 나가고 받는 것이 없다.
 * 실제 라우트를 라이브 구조 DB 위에서 돌린다.
 *
 * 닫는 것은 **새 주문 둘**(`POST /api/orders` · `POST /api/points/pay`)뿐이다. 취소·환불·조회는 열어 둔다(옛 주문을 풀 수 있어야 한다).
 * 못 보는 것: 진짜 카드사 · 탭을 다시 열었을 때의 환불 구멍들(인계 `2026-11-25-remaining-flows-audit.md` 의 D1~D12 — 탭을 열기 전에 고칠 것).
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, SECRET } from '../helpers/live-d1'
import { ordersRouter } from '@/worker/routes/order.routes'
import { pointsRoutes } from '@/features/points/api/points.routes'
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'

async function setup() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  const out = stubOutbound()
  const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', TOSS_CLIENT_KEY: 'test_ck_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
  const app = new Hono()
  app.use('/api/*', storeSeatGuard())
  app.route('/api/orders', ordersRouter)
  app.route('/api/points', pointsRoutes)
  app.route('/api/seller', sellerOrdersRoutes)
  const call = async (method: string, path: string, token: string | null, body?: unknown) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 shoprail' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
    await drain()
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 300) } }
    return { status: res.status, json }
  }
  const BUYER = insert(raw, 'users', { name: '시험손님', email: 'buyer@example.test', phone: '01012345678' })
  const SELLER = insert(raw, 'sellers', { username: 'test-store', password_hash: '', name: '시험사장', email: 'owner@example.test', business_name: '시험식당', status: 'approved', seller_type: 'store_owner' })
  const VOUCHER = insert(raw, 'products', { seller_id: SELLER, name: '시험식당 식사 이용권', price: 10000, original_price: 15000, stock: 100, is_active: 1, category: 'meal_voucher', group_buy_status: 'active', deal_only: 0 })
  insert(raw, 'user_points', { user_id: String(BUYER), balance: 50000 })
  return { raw, call, out, BUYER, SELLER, VOUCHER, bTok: await userToken(BUYER), sTok: await sellerToken(SELLER) }
}
const shipping = { postal_code: '04000', address1: '서울 마포구 시험로 1', country: 'KR' }

describe('쇼핑 탭이 숨겨진 동안 — 새 쇼핑 주문은 서버에서도 닫힌다', () => {
  it('전제: 쇼핑 탭은 숨김이다 — 다시 열기 전에 환불 구멍부터 고칠 것', () => {
    expect(SHOPPING_TAB_HIDDEN, [
      '쇼핑 탭을 다시 열려면 먼저 docs/handoff/2026-11-25-remaining-flows-audit.md 의 쇼핑 주문 표(D1~D15)를 고칠 것.',
      '섞어 결제한 주문의 전액 환불에서 딜이 사라지고(D1) · 부분 환불 두 번이면 주문이 PAID 로 남고(D2) · 반품 환불이 딜을 두 번 돌려줄 수 있다(D5).',
      '그 뒤 이 시험의 닫힘 검사를 "이용권·교환권은 이 길로 못 산다" 로 바꾼다.',
    ].join('\n')).toBe(true)
  })

  it('카드 주문 만들기(POST /api/orders)로 이용권을 살 수 없다 — 주문이 생기지 않는다', async () => {
    const { raw, call, VOUCHER, SELLER, bTok } = await setup()
    const r = await call('POST', '/api/orders', bTok, {
      seller_id: String(SELLER), order_number: 'ORDER-T-1', idempotency_key: 'k-1',
      items: [{ product_id: String(VOUCHER), quantity: 1 }], shipping_address: shipping, shipping_name: '시험손님', shipping_phone: '01012345678',
    })
    expect([r.status, r.json.code], JSON.stringify(r.json).slice(0, 300)).toEqual([410, 'SHOPPING_CLOSED'])
    expect(q(raw, 'SELECT id FROM orders').length).toBe(0)
  })

  it('딜 결제(POST /api/points/pay)로 이용권을 살 수 없다 — 딜이 빠지지 않는다', async () => {
    const { raw, call, VOUCHER, BUYER, bTok } = await setup()
    const r = await call('POST', '/api/points/pay', bTok, {
      order_number: 'PAY-T-1', items: [{ product_id: VOUCHER, quantity: 1 }],
      shipping: { name: '시험손님', phone: '01012345678', postal_code: '04000', address1: '서울 마포구 시험로 1' },
    })
    expect([r.status, r.json.code], JSON.stringify(r.json).slice(0, 300)).toEqual([410, 'SHOPPING_CLOSED'])
    expect(q1<{ balance: number }>(raw, 'SELECT balance FROM user_points WHERE user_id = ?', String(BUYER))?.balance).toBe(50000)
    expect(q(raw, 'SELECT id FROM orders').length).toBe(0)
    expect(q(raw, 'SELECT id FROM vouchers').length).toBe(0)
  })

  it('옛 주문의 조회·취소 길은 그대로 열려 있다(닫는 것은 새 주문뿐)', async () => {
    const { raw, call, BUYER, SELLER, bTok } = await setup()
    const oid = insert(raw, 'orders', { order_number: 'ORDER-OLD-1', user_id: String(BUYER), seller_id: SELLER, status: 'PENDING', total_amount: 10000 })
    const get = await call('GET', `/api/orders/${oid}`, bTok)
    expect(get.status).toBe(200)
    const cancel = await call('POST', `/api/orders/${oid}/cancel`, bTok, { reason: '시험' })
    expect(cancel.status, JSON.stringify(cancel.json).slice(0, 300)).toBe(200)
    expect(q1<{ status: string }>(raw, 'SELECT status FROM orders WHERE id = ?', oid)?.status).toBe('CANCELLED')
  })
})

describe('사장님 화면에서 주문 상태 바꾸기 — 돈이 안 들어온 주문을 결제 완료로 만들 수 없다', () => {
  it('미결제(PENDING) 주문을 PAID 로 바꿀 수 없다', async () => {
    const { raw, call, BUYER, SELLER, sTok } = await setup()
    const oid = insert(raw, 'orders', { order_number: 'ORDER-P-1', user_id: String(BUYER), seller_id: SELLER, status: 'PENDING', total_amount: 10000 })
    const r = await call('PATCH', `/api/seller/orders/${oid}/status`, sTok, { status: 'PAID' })
    expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBeGreaterThanOrEqual(400)
    expect(q1<{ status: string }>(raw, 'SELECT status FROM orders WHERE id = ?', oid)?.status).toBe('PENDING')
  })
  it('환불·취소된 주문을 일괄 변경으로 DONE 으로 되살릴 수 없다', async () => {
    const { raw, call, BUYER, SELLER, sTok } = await setup()
    const a = insert(raw, 'orders', { order_number: 'ORDER-R-1', user_id: String(BUYER), seller_id: SELLER, status: 'REFUNDED', total_amount: 10000 })
    const b = insert(raw, 'orders', { order_number: 'ORDER-R-2', user_id: String(BUYER), seller_id: SELLER, status: 'CANCELLED', total_amount: 10000 })
    const r = await call('PATCH', '/api/seller/orders/bulk-status', sTok, { order_ids: [a, b], status: 'DONE' })
    const st = q<{ status: string }>(raw, 'SELECT status FROM orders ORDER BY id').map((x) => x.status)
    expect(st, `${r.status} ${JSON.stringify(r.json).slice(0, 300)}`).toEqual(['REFUNDED', 'CANCELLED'])
  })
})
