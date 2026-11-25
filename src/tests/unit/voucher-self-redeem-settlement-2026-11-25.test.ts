/**
 * 🎟️ 손님이 매장 확인코드로 직접 사용 처리한 이용권도 매장 정산에 잡힌다 (2026-11-25 대표 *"끝까지 다 고쳐줘"*)
 *
 * 사용 처리 길이 넷이다(직원 스캔 · PIN · 일부 사용 · **손님 셀프 사용**). 앞의 셋은 사용 순간 정산 원장
 * (보관금 → 매장 · 유어딜)을 적는데 셀프 사용만 안 적었다 ⇒ 주간 지급(원장 기준)에서 그 매출이 빠졌다.
 * 매장 확인코드 방식은 설정 안 한 매장의 **기본값**이다. 실제 라우트를 카드 결제부터 돌려 원장을 본다.
 *
 * 함께 본다: 사용을 되돌리면(셀프 사용 60초 취소) 정산 줄도 뒤집히고, 다시 쓰면 새로 적힌다.
 * 못 막는 것: 열린 분쟁(`voucher_disputes`)이 14일 넘게 안 닫히면 그 사이 지급 대상에 들어갈 수 있다(재활성 때 뒤집힌다).
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, SECRET } from '../helpers/live-d1'
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes'
import { groupBuyRoutes } from '@/features/group-buy/api/group-buy.routes'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { getLedgerReceivable, recordRefundLedger, reverseVoucherUsedLedger, recordVoucherUsedLedger } from '@/worker/utils/ledger'

async function buyOne(mode: 'store_code') {
  const raw = openLiveSchema()
  const DB = d1(raw)
  stubOutbound()
  const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', TOSS_CLIENT_KEY: 'test_ck_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
  const app = new Hono()
  app.use('/api/*', storeSeatGuard())
  app.route('/api/seller', sellerOrdersRoutes)
  app.route('/api/group-buy', groupBuyRoutes)
  const call = async (method: string, path: string, token: string, body?: unknown) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const res = await app.request(path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 selfredeem' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx)
    await drain()
    const json = await res.json().catch(() => ({})) as Record<string, unknown>
    return { status: res.status, json, data: (json.data ?? json) as Record<string, unknown> }
  }
  const BUYER = insert(raw, 'users', { name: '시험손님', email: 'buyer@example.test', phone: '01012345678' })
  const SELLER = insert(raw, 'sellers', { username: 'sr-store', password_hash: '', name: '시험사장', email: 'o@example.test', business_name: '시험식당', status: 'approved', seller_type: 'store_owner' })
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
  const conf = await call('POST', '/api/group-buy/confirm-toss', bTok, { paymentKey: 'pk_self_1', orderId: d.orderId, amount: d.amount, productId: PID, qty: 1 })
  const voucher = q1<{ id: number; code: string }>(raw, 'SELECT id, code FROM vouchers ORDER BY id DESC LIMIT 1')
  const { upsertRedemptionSettings } = await import('@/worker/utils/redemption-settings') as unknown as { upsertRedemptionSettings?: (DB: D1Database, sellerId: number, mode: string, code: string | null) => Promise<unknown> }
  if (upsertRedemptionSettings) await upsertRedemptionSettings(DB, SELLER, mode, '482913')
  if (!q1(raw, 'SELECT seller_id FROM seller_redemption_settings WHERE seller_id = ?', SELLER)) insert(raw, 'seller_redemption_settings', { seller_id: SELLER, mode, store_code: '482913' })
  else raw.prepare('UPDATE seller_redemption_settings SET mode = ?, store_code = ? WHERE seller_id = ?').run(mode, '482913', SELLER)
  const status = () => q1<{ status: string }>(raw, 'SELECT status FROM vouchers WHERE id = ?', voucher!.id)?.status
  return { raw, DB, call, bTok, sTok, BUYER, SELLER, voucher: voucher!, status, setupOk: reg.status === 201 && conf.status === 200 && !!voucher }
}

const escrow = (raw: Parameters<typeof q1>[0]) => q1<{ bal: number }>(raw,
  "SELECT COALESCE(SUM(CASE WHEN credit_account = 'platform:escrow' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN debit_account = 'platform:escrow' THEN amount ELSE 0 END), 0) AS bal FROM ledger_entries")?.bal

describe('손님 셀프 사용 — 정산 원장', () => {
  it('매장 확인코드로 셀프 사용: 매장 9,000 · 유어딜 1,000 이 적힌다 (종전: 줄 없음 → 주간 지급에서 빠짐)', async () => {
    const t = await buyOne('store_code')
    expect(t.setupOk).toBe(true)
    const wrong = await t.call('POST', `/api/group-buy/vouchers/${t.voucher.code}/self-redeem`, t.bTok, { store_code: '000000' })
    expect(wrong.status).toBe(403)
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(0)
    const r = await t.call('POST', `/api/group-buy/vouchers/${t.voucher.code}/self-redeem`, t.bTok, { store_code: '482913' })
    expect([r.status, r.json.success, t.status()]).toEqual([200, true, 'used'])
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(9000)
    expect(q(t.raw, "SELECT amount FROM ledger_entries WHERE credit_account = 'platform:revenue'").map((x) => (x as { amount: number }).amount)).toEqual([1000])
    expect(escrow(t.raw)).toBe(0)
    // 같은 요청을 한 번 더(멱등 반환) — 정산이 두 번 적히지 않는다.
    await t.call('POST', `/api/group-buy/vouchers/${t.voucher.code}/self-redeem`, t.bTok, { store_code: '482913' })
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(9000)
  })

  it('사용을 되돌리면 정산 줄이 뒤집히고, 다시 쓰면 새로 적힌다 (분쟁 재활성 · 셀프 취소가 부르는 함수)', async () => {
    const t = await buyOne('store_code')
    expect(t.setupOk).toBe(true)
    const r = await t.call('POST', `/api/group-buy/vouchers/${t.voucher.code}/self-redeem`, t.bTok, { store_code: '482913' })
    expect([r.status, t.status()]).toEqual([200, 'used'])
    // 손님 셀프 취소는 지금 어느 매장에서도 열리지 않는다(매장 방식에서 '자유 셀프' 가 빠졌다) — 되돌림은 분쟁 처리에서 일어난다.
    const c = await t.call('POST', `/api/group-buy/vouchers/${t.voucher.code}/cancel-redeem`, t.bTok, {})
    expect([c.status, t.status()]).toEqual([403, 'used'])
    t.raw.prepare("UPDATE vouchers SET status = 'unused', used_at = NULL WHERE id = ?").run(t.voucher.id)
    expect((await reverseVoucherUsedLedger(t.DB, t.voucher.id, '분쟁 — 재사용 복원')).reversed).toBe(2)
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(0)
    expect(escrow(t.raw)).toBe(10000) // 안 쓴 이용권 값은 다시 보관금에 있다
    const again = await t.call('POST', `/api/group-buy/vouchers/${t.voucher.code}/self-redeem`, t.bTok, { store_code: '482913' })
    expect([again.status, t.status()]).toEqual([200, 'used'])
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(9000)
    expect(escrow(t.raw)).toBe(0)
  })

  it('사용 → 되돌림 → 환불: 매장 0 · 구매자 10,000 · 보관금 0 (뒤집힌 사용분을 환불이 또 뒤집지 않는다)', async () => {
    const t = await buyOne('store_code')
    await recordVoucherUsedLedger(t.DB, { voucher_id: t.voucher.id, order_amount: 10000, merchant_id: t.SELLER })
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(9000)
    expect((await reverseVoucherUsedLedger(t.DB, t.voucher.id, '시험')).reversed).toBe(2)
    expect((await reverseVoucherUsedLedger(t.DB, t.voucher.id, '시험 — 두 번째')).reversed).toBe(0)
    await recordRefundLedger(t.DB, { voucher_id: t.voucher.id, reason: '시험 환불', amount: 10000 })
    expect(await getLedgerReceivable(t.DB, `seller:${t.SELLER}`)).toBe(0)
    expect(q(t.raw, "SELECT amount FROM ledger_entries WHERE credit_account = ? AND event_type = 'voucher_refund'", `user:${t.BUYER}`).map((x) => (x as { amount: number }).amount)).toEqual([10000])
    expect(escrow(t.raw)).toBe(0)
  })
})
