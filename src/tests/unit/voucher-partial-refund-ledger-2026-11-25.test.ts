/**
 * 🎟️ 이용권을 일부만 쓰고 나머지를 돌려줄 때 매장이 쓴 만큼 받는다 (2026-11-25 대표 *"그래서 찾은 에러들은?"*)
 *
 * `POST /voucher/:code/partial-refund`(사장님·어드민 — 지금 부르는 화면은 없다)가 이용권을 '사용됨' 으로 닫으면서
 * ① 쓴 금액의 정산(보관금 → 매장 · 유어딜)을 **적지 않았고** ② 환불액을 매장 받을 돈에서 **뺐다**(`seller → user`).
 * 10,000원 이용권에서 6,000원을 쓰면 매장은 5,400원을 받아야 하는데 장부에는 −4,000원이 남았다.
 * 실제 라우트를 카드 결제부터 돌려 원장을 본다.
 *
 * 못 막는 것: 소개비(구매 때 매장 몫에서 나간 것)는 일부 환불에 비례해 되돌리지 않는다 — 장 단위 환불 규칙과 다른 축이다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, SECRET } from '../helpers/live-d1'
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes'
import { groupBuyRoutes } from '@/features/group-buy/api/group-buy.routes'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { getLedgerReceivable } from '@/worker/utils/ledger'

async function buyOne() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  const out = stubOutbound()
  const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', TOSS_CLIENT_KEY: 'test_ck_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
  const app = new Hono()
  app.use('/api/*', storeSeatGuard())
  app.route('/api/seller', sellerOrdersRoutes)
  app.route('/api/group-buy', groupBuyRoutes)
  const call = async (method: string, path: string, token: string, body?: unknown) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const res = await app.request(path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 partial' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx)
    await drain()
    const json = await res.json().catch(() => ({})) as Record<string, unknown>
    return { status: res.status, json, data: (json.data ?? json) as Record<string, unknown> }
  }
  const BUYER = insert(raw, 'users', { name: '시험손님', email: 'buyer@example.test', phone: '01012345678' })
  const SELLER = insert(raw, 'sellers', { username: 'p-store', password_hash: '', name: '시험사장', email: 'o@example.test', business_name: '시험식당', status: 'approved', seller_type: 'store_owner' })
  await setSellerMeta(DB, SELLER, { store_channel: 'direct' })
  for (const [k, v] of Object.entries({ fee_channel_rates_enabled: 'true', platform_fee_pct_direct: '10', platform_fee_pct_brokered: '5', refund_window_days: '7' })) insert(raw, 'platform_settings', { key: k, value: v })
  const bTok = await userToken(BUYER), sTok = await sellerToken(SELLER)
  const reg = await call('POST', '/api/seller/products', sTok, {
    name: '시험식당 식사 이용권', description: '시험', price: 10000, original_price: 15000, image_url: 'https://example.test/a.jpg', images: '[]',
    category: 'meal_voucher', product_type: 'featured', stock: 100, restaurant_name: '시험식당', restaurant_address: '서울 마포구 시험로 1', restaurant_phone: '02-123-4567',
    restaurant_lat: 37.55, restaurant_lng: 126.92, group_buy_target: 0, external_booking_url: null, region_si: '서울', region_gu: '마포구', max_per_person: 20, group_buy_tiers: null,
  })
  const PID = Number(reg.data.id)
  const init = await call('POST', `/api/group-buy/join/${PID}`, bTok, { quantity: 1, payment_method: 'toss' })
  const d = (init.data.orderId ? init.data : init.json) as { orderId: string; amount: number }
  const conf = await call('POST', '/api/group-buy/confirm-toss', bTok, { paymentKey: 'pk_partial_1', orderId: d.orderId, amount: d.amount, productId: PID, qty: 1 })
  const voucher = q1<{ id: number; code: string }>(raw, 'SELECT id, code FROM vouchers ORDER BY id DESC LIMIT 1')
  return { raw, DB, out, call, sTok, BUYER, SELLER, voucher: voucher!, setupOk: reg.status === 201 && conf.status === 200 && !!voucher }
}

const escrowBalance = (raw: Parameters<typeof q1>[0]) => q1<{ bal: number }>(raw,
  "SELECT COALESCE(SUM(CASE WHEN credit_account = 'platform:escrow' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN debit_account = 'platform:escrow' THEN amount ELSE 0 END), 0) AS bal FROM ledger_entries")?.bal

describe('이용권 일부 사용 + 나머지 환불 — 원장', () => {
  it('10,000원 중 6,000원 사용: 매장 5,400 · 유어딜 600 · 구매자 4,000 환불, 매장 받을 돈에서 빼지 않는다', async () => {
    const t = await buyOne()
    expect(t.setupOk).toBe(true)
    const r = await t.call('POST', `/api/group-buy/voucher/${t.voucher.code}/partial-refund`, t.sTok, { used_amount: 6000, refund_reason: '시험' })
    expect([r.status, r.json.success]).toEqual([200, true])
    expect(t.out.toss.filter((x) => x.kind === 'cancel').map((x) => x.amount)).toEqual([4000])
    const led = q<{ event_type: string; amount: number; debit_account: string; credit_account: string }>(t.raw,
      "SELECT event_type, amount, debit_account, credit_account FROM ledger_entries WHERE event_type != 'group_buy_join' ORDER BY id")
    const sum = (pred: (l: typeof led[number]) => boolean) => led.filter(pred).reduce((a, l) => a + l.amount, 0)
    expect(sum((l) => l.credit_account === `merchant:${t.SELLER}`)).toBe(5400)
    expect(sum((l) => l.credit_account === 'platform:revenue')).toBe(600)
    expect(sum((l) => l.credit_account === `user:${t.BUYER}` && l.debit_account === 'platform:escrow')).toBe(4000)
    expect(led.filter((l) => l.debit_account === `seller:${t.SELLER}` || l.debit_account === `merchant:${t.SELLER}`)).toEqual([])
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(5400)
    expect(escrowBalance(t.raw)).toBe(0)
  })

  it('전액 사용으로 닫아도 정산이 적힌다 (매장 9,000 · 유어딜 1,000)', async () => {
    const t = await buyOne()
    expect(t.setupOk).toBe(true)
    const r = await t.call('POST', `/api/group-buy/voucher/${t.voucher.code}/partial-refund`, t.sTok, { used_amount: 10000 })
    expect([r.status, r.json.success]).toEqual([200, true])
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(9000)
    expect(escrowBalance(t.raw)).toBe(0)
  })
})
