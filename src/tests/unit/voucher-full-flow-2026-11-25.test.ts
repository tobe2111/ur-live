/**
 * 🎟️ 이용권·교환권 전체 흐름을 다섯 입장에서 끝까지 돌린다 (2026-11-25 대표
 * *"에이전시 전체플로우, 인플루언서 전체 플로우, 매장 사장님 전체 플로우, 일반 유저 전체플로우 … 어드민 대시보드 플로우까지. 정산까지."*).
 *
 * 숙박 흐름 시험(`stay-full-flow-2026-11-25.test.ts`)과 같은 시험 환경이다 — 실제 라우트·cron + 라이브 구조 DB + 가짜 카드사.
 * 여기서는 **지금 일어나는 일을 기록**한다. 고쳐야 할 것으로 드러난 항목은 `KNOWN` 에 이름을 적어 두고(되돌려 보면 빨간불),
 * 고친 뒤 그 줄을 지운다 — 조용히 통과시키지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { writeFileSync } from 'node:fs'
import { sign } from 'hono/jwt'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, makeReport, SECRET } from '../helpers/live-d1'
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes'
import { sellerSettlementsRoutes } from '@/features/seller/api/seller-settlements.routes'
import { sellerStoresRoutes } from '@/features/seller/api/seller-stores.routes'
import { sellerProfileRoutes } from '@/features/seller/api/seller-profile.routes'
import { sellerPinRoutes } from '@/features/seller/api/seller-pin.routes'
import { sellerOperatorsRoutes } from '@/features/seller/api/seller-operators.routes'
import { groupBuyRoutes } from '@/features/group-buy/api/group-buy.routes'
import { sellerMarketingRoutes, influencerSettlementRoutes, adminPayoutRoutes } from '@/features/group-buy/api/marketing.routes'
import { adminPayoutsRoutes } from '@/features/admin/api/admin-payouts.routes'
import { ordersRouter } from '@/worker/routes/order.routes'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { handleExpiredVoucherRefunds, handleAutoSettlement } from '@/worker/cron/auto-settlement'
import { handlePayoutsGenerate } from '@/worker/cron/payouts-generate'
import { setSellerMeta } from '@/worker/utils/seller-meta'

const OUT = process.env.VOUCHER_REPORT || ''

describe('이용권·교환권 전체 흐름 — 유저 · 사장님 · 인플루언서 · 어드민 (로컬 시험 환경)', () => {
  it('구매 → 사용 → 소개비 → 정산 → 지급', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const R = makeReport(OUT || undefined)
    const out = stubOutbound()
    const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', TOSS_CLIENT_KEY: 'test_ck_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>

    const app = new Hono()
    app.use('/api/*', storeSeatGuard())
    app.route('/api/seller', sellerOrdersRoutes)
    app.route('/api/seller', sellerSettlementsRoutes)
    app.route('/api/seller', sellerStoresRoutes)
    app.route('/api/seller', sellerProfileRoutes)
    app.route('/api/seller', sellerPinRoutes)
    app.route('/api/seller', sellerOperatorsRoutes)
    app.route('/api/group-buy', groupBuyRoutes)
    app.route('/api/vouchers', groupBuyRoutes)
    app.route('/api/seller-marketing', sellerMarketingRoutes)
    app.route('/api/influencer-settlement', influencerSettlementRoutes)
    app.route('/api/admin-payouts', adminPayoutRoutes)
    app.route('/api', adminPayoutsRoutes)
    app.route('/api/orders', ordersRouter)

    const call = async (method: string, path: string, token: string | null, body?: unknown, extra: Record<string, string> = {}) => {
      const { ctx, drain } = makeCtx()
      raw.exec('DELETE FROM rate_limit_attempts')
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 voucherflow', ...extra }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
      await drain()
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 300) } }
      return { status: res.status, json, data: (json.data ?? {}) as Record<string, unknown> }
    }
    const fail = (r: { status: number; json: Record<string, unknown> }) => `${r.status} ${JSON.stringify(r.json).slice(0, 380)}`
    const won = (n: number) => `${Number(n).toLocaleString('ko-KR')}원`

    // ── 라이브와 같은 설정값(2026-11-25 실측) ──
    const SETTINGS: Record<string, string> = {
      fee_channel_rates_enabled: 'true', platform_fee_pct_direct: '10', platform_fee_pct_brokered: '5', commission_rate_meal_voucher: '5',
      payout_requires_voucher_use: 'true', settlement_skip_ledgered: 'true', refund_window_days: '7',
      voucher_deal_payment_enabled: 'true', voucher_partial_deal_enabled: 'true', voucher_cart_enabled: 'true',
      influencer_deal_bonus_pct: '0', influencer_payout_min: '100000', user_referral_bonus_pct: '0',
    }
    for (const [k, v] of Object.entries(SETTINGS)) insert(raw, 'platform_settings', { key: k, value: v })

    // ── 씨앗 ──
    const BUYER = insert(raw, 'users', { name: '시험손님', email: 'buyer@example.test', phone: '01012345678' })
    const INFL = insert(raw, 'users', { name: '시험소개', email: 'infl@example.test', handle: 'testinfl' })
    const OWNER_USER = insert(raw, 'users', { name: '시험사장', email: 'owner@example.test' })
    const SELLER = insert(raw, 'sellers', { username: 'test-store', password_hash: '', name: '시험사장', email: 'owner@example.test', business_name: '시험식당', status: 'approved', seller_type: 'store_owner' })
    await setSellerMeta(DB, SELLER, { store_channel: 'direct' })
    insert(raw, 'seller_operators', { seller_id: SELLER, user_id: OWNER_USER, role: 'owner' })
    const bTok = await userToken(BUYER), iTok = await userToken(INFL), sTok = await sellerToken(SELLER)
    const now = () => Math.floor(Date.now() / 1000)
    const adminTok = async (role: string) => {
      const id = insert(raw, 'admins', { username: `adm-${role}`, email: `${role}@example.test`, password_hash: 'x', name: role, role })
      return sign({ type: 'admin', sub: String(id), admin_id: id, userId: id, role, iat: now(), exp: now() + 3600 }, SECRET)
    }

    // ════════ 1. 사장님: 이용권 등록 ════════
    R.section('1. 사장님 — 이용권 등록 (직접 입점 매장)')
    const reg = await call('POST', '/api/seller/products', sTok, {
      name: '시험식당 식사 이용권', description: '시험', price: 10000, original_price: 15000, image_url: 'https://example.test/a.jpg', images: '[]',
      category: 'meal_voucher', product_type: 'featured', stock: 100, restaurant_name: '시험식당', restaurant_address: '서울 마포구 시험로 1', restaurant_phone: '02-123-4567',
      restaurant_lat: 37.55, restaurant_lng: 126.92, group_buy_target: 0, external_booking_url: null, region_si: '서울', region_gu: '마포구', max_per_person: 20, group_buy_tiers: null,
    })
    const PID = Number((reg.data as { id?: number }).id)
    R.check('이용권 등록', reg.status === 201 && PID > 0, fail(reg))

    // ════════ 2. 인플루언서: 소개 계약 ════════
    R.section('2. 인플루언서 — 매장과 소개 계약(소개비 10%)')
    const prop = await call('POST', '/api/seller-marketing/deals/propose', sTok, { influencer_id: String(INFL), commission_pct: 10 })
    const dealId = Number((prop.data as { id?: number }).id ?? (prop.json as { id?: number; deal_id?: number }).deal_id ?? q1<{ id: number }>(raw, 'SELECT id FROM seller_influencer_deals ORDER BY id DESC LIMIT 1')?.id)
    R.check('사장님이 소개비 10% 제안', prop.status === 200 && dealId > 0, fail(prop))
    const acc = await call('POST', `/api/influencer-settlement/deals/${dealId}/respond`, iTok, { action: 'accept' })
    const deal = q1<{ status: string; commission_pct: number }>(raw, 'SELECT status, commission_pct FROM seller_influencer_deals WHERE id = ?', dealId)
    R.check('인플루언서가 수락 → 계약 active', acc.status === 200 && deal?.status === 'active' && Number(deal.commission_pct) === 10, `${fail(acc)} ${JSON.stringify(deal)}`)
    const stores = await call('GET', '/api/influencer-settlement/my-stores', iTok)
    R.note(`인플루언서의 소개 매장 목록: ${stores.status} ${JSON.stringify(stores.json).slice(0, 260)}`)

    // ════════ 3. 유저: 카드 구매 ════════
    R.section('3. 유저 — 이용권 카드 구매')
    let payN = 0
    const voucherByOrder = (orderId: number) => q<{ id: number; code: string; status: string; applied_price: number; refund_status: string | null; expires_at: string | null }>(raw, 'SELECT id, code, status, applied_price, refund_status, expires_at FROM vouchers WHERE order_id = ?', orderId)
    const buyCard = async (label: string, ref?: string) => {
      const init = await call('POST', `/api/group-buy/join/${PID}`, bTok, { quantity: 1, payment_method: 'toss', ...(ref ? { ref } : {}) })
      if (init.status !== 200) { R.check(`${label}: 결제 준비`, false, fail(init)); return null }
      const d = (init.data as { orderId?: string; amount?: number }).orderId ? init.data as { orderId: string; amount: number } : (init.json as { orderId: string; amount: number })
      const paymentKey = `pk_v_${++payN}`
      const conf = await call('POST', '/api/group-buy/confirm-toss', bTok, { paymentKey, orderId: d.orderId, amount: d.amount, productId: PID, qty: 1, ...(ref ? { ref } : {}) })
      const order = q1<{ id: number; total_amount: number; commission_rate: number | null; seller_amount: number | null; payment_method: string | null }>(raw, 'SELECT id, total_amount, commission_rate, seller_amount, payment_method FROM orders WHERE payment_key = ?', paymentKey)
      R.check(`${label}: 카드 결제 확정 (${won(Number(d.amount))})`, conf.status === 200 && !!order, fail(conf))
      return order ? { orderId: order.id, paymentKey, amount: Number(d.amount), order, v: voucherByOrder(order.id)[0] } : null
    }
    const v1 = await buyCard('V1(소개 링크로 구매)', String(INFL))
    const v2 = await buyCard('V2(그냥 구매)')
    const v3 = await buyCard('V3(바로 취소할 것)')
    const v4 = await buyCard('V4(안 쓰고 기한 넘길 것)')
    if (v1 && v2) {
      R.check('주문에 수수료율 10%(직접 입점)와 결제 수단이 적힌다', Number(v1.order.commission_rate) === 10 && v1.order.payment_method === 'toss', JSON.stringify(v1.order))
      R.check('이용권 1장씩 발급 · 금액 = 결제액', v1.v?.status === 'unused' && v1.v.applied_price === 10000 && v2.v?.status === 'unused', JSON.stringify(v1.v))
      const items = q1<{ n: number }>(raw, 'SELECT COUNT(*) n FROM order_items WHERE order_id = ?', v1.orderId)?.n
      R.check('주문 줄(order_items)이 생긴다 — 대시보드 "오늘 매출" 이 이걸 센다', items === 1, `order_items=${items}`)
      const attr = q<{ influencer_id: string; commission_amount: number; status: string; order_id: number }>(raw, 'SELECT influencer_id, commission_amount, status, order_id FROM influencer_attributions')
      R.check('소개 링크 구매에만 소개비 1,000원(10%)이 대기 상태로 잡힌다', attr.length === 1 && Number(attr[0].commission_amount) === 1000 && attr[0].status === 'pending' && String(attr[0].influencer_id) === String(INFL), JSON.stringify(attr))
      const led = q<{ event_type: string; amount: number; debit_account: string; credit_account: string }>(raw, "SELECT event_type, amount, debit_account, credit_account FROM ledger_entries WHERE event_type = 'influencer_commission'")
      R.check('소개비는 매장 몫에서 나간다(원장: 매장 → 인플루언서)', led.length === 1 && led[0].debit_account === `seller:${SELLER}` && led[0].credit_account === `influencer:${INFL}` && led[0].amount === 1000, JSON.stringify(led))
      const self = await call('POST', `/api/group-buy/join/${PID}`, iTok, { quantity: 1, payment_method: 'toss', ref: String(INFL) })
      R.note(`인플루언서가 자기 링크로 직접 사기: ${self.status} (자기 소개는 적립되지 않아야 한다 — 결제 준비 응답만)`)
    }

    // ════════ 4. 사장님: 사용 처리 ════════
    R.section('4. 사장님 — QR 사용 처리 · 원장')
    const ledgerOf = (vid: number) => q<{ amount: number; credit_account: string }>(raw, "SELECT amount, credit_account FROM ledger_entries WHERE reference_id = ? AND event_type = 'voucher_used' ORDER BY id", `voucher:${vid}`)
    for (const [name, v] of [['V1', v1], ['V2', v2]] as const) {
      if (!v?.v) continue
      const use = await call('POST', `/api/group-buy/${v.v.code}/use-by-seller`, sTok)
      const led = ledgerOf(v.v.id)
      R.check(`${name}: 스캔 사용 → 매장 9,000원 · 유어딜 1,000원(10%)`, use.status === 200 && led.find((l) => l.credit_account === `merchant:${SELLER}`)?.amount === 9000 && led.find((l) => l.credit_account === 'platform:revenue')?.amount === 1000, `${fail(use)} ${JSON.stringify(led)}`)
    }

    // ════════ 5. 유저: 취소 · 만료 ════════
    R.section('5. 유저 — 취소 · 기한 만료')
    if (v3?.v) {
      const before = out.toss.length
      const c = await call('POST', `/api/group-buy/voucher/${v3.v.code}/cancel`, bTok, {})
      const cancels = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      const o = q1<{ status: string; refunded_amount: number }>(raw, 'SELECT status, refunded_amount FROM orders WHERE id = ?', v3.orderId)
      R.check('V3: 7일 안 · 미사용 셀프 취소 → 카드 전액 환불 · 주문 장부 기록', c.status === 200 && cancels.length === 1 && voucherByOrder(v3.orderId)[0].status === 'refunded' && o?.refunded_amount === 10000, `${fail(c)} toss=${JSON.stringify(cancels)} o=${JSON.stringify(o)}`)
      const again = await call('POST', `/api/orders/${v3.orderId}/cancel`, bTok, { reason: '또 취소' })
      R.check('V3: 같은 주문을 주문 화면에서 또 취소해도 환불이 더 나가지 않는다', out.toss.filter((t) => t.kind === 'cancel' && t.paymentKey === v3.paymentKey).length === 1, fail(again))
    }
    if (v1?.v) {
      const c = await call('POST', `/api/group-buy/voucher/${v1.v.code}/cancel`, bTok, {})
      R.check('V1: 사용한 이용권은 취소할 수 없다', c.status >= 400, fail(c))
    }
    if (v4?.v) {
      raw.exec(`UPDATE vouchers SET expires_at = datetime('now', '-1 hours') WHERE id = ${v4.v.id}`)
      const before = out.toss.length
      await handleExpiredVoucherRefunds(env as never)
      const cancels = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      const vv = voucherByOrder(v4.orderId)[0]
      R.check('V4: 기한이 지난 미사용 이용권 → 카드 전액 자동 환불(일반 이용권 규칙)', vv.refund_status === 'refunded' && cancels.length === 1 && cancels[0].paymentKey === v4.paymentKey, `${JSON.stringify(vv)} toss=${JSON.stringify(cancels)}`)
    }

    // ════════ 6. 인플루언서: 소개비 받기 ════════
    R.section('6. 인플루언서 — 소개비 성숙 · 지급')
    const { handleInfluencerPayout } = await import('@/worker/cron/influencer-payout') as unknown as { handleInfluencerPayout?: (e: unknown) => Promise<unknown> }
    const runMature = async () => { if (handleInfluencerPayout) await handleInfluencerPayout(env).catch((e: unknown) => R.note(`성숙 cron 예외: ${String(e).slice(0, 160)}`)) }
    const attrRow = () => q1<{ status: string; available_at: string; commission_amount: number }>(raw, 'SELECT status, available_at, commission_amount FROM influencer_attributions ORDER BY id LIMIT 1')
    const bal = () => q1<{ pending_amount: number; available_amount: number; total_paid_out: number | null }>(raw, 'SELECT pending_amount, available_amount, total_paid_out FROM influencer_balances WHERE influencer_id = ?', String(INFL))
    await runMature()
    R.check('환불 기간(7일) 안에는 소개비가 대기 상태 그대로', attrRow()?.status === 'pending', JSON.stringify({ a: attrRow(), b: bal() }))
    R.note(`소개비 지급 가능 시각이 저장된 모양: ${attrRow()?.available_at}`)
    raw.exec("UPDATE influencer_attributions SET available_at = datetime('now', '-2 days')")
    await runMature()
    R.check('7일이 지나고 이용권이 사용됐으면 소개비가 지급 가능으로 바뀐다', attrRow()?.status === 'available' && bal()?.available_amount === 1000, JSON.stringify({ a: attrRow(), b: bal() }))
    const me = await call('GET', '/api/influencer-settlement/me', iTok)
    R.note(`인플루언서 정산 화면: ${me.status} ${JSON.stringify(me.data).slice(0, 300)}`)
    const superTok = await adminTok('super_admin')
    const viewerTok = await adminTok('viewer')
    const adminRoleTok = await adminTok('admin')
    const financeTok = await adminTok('finance')
    const list = await call('GET', '/api/admin-payouts/payouts', superTok)
    R.note(`어드민 인플루언서 지급 목록(현금 최소 100,000원): ${list.status} ${JSON.stringify(list.json).slice(0, 300)}`)
    const pay = await call('POST', '/api/admin-payouts/payouts/process', superTok, { influencer_id: String(INFL), method: 'deal' })
    const pts = q1<{ balance: number; free_balance: number | null }>(raw, 'SELECT balance, free_balance FROM user_points WHERE user_id = ?', String(INFL))
    R.check('어드민이 딜로 지급 → 인플루언서 딜 1,000 · 지급 가능 잔액 0', pay.status === 200 && Number(pts?.balance) === 1000 && bal()?.available_amount === 0, `${fail(pay)} pts=${JSON.stringify(pts)} bal=${JSON.stringify(bal())}`)
    const pay2 = await call('POST', '/api/admin-payouts/payouts/process', superTok, { influencer_id: String(INFL), method: 'deal' })
    R.check('같은 지급을 두 번 눌러도 한 번만 나간다', pay2.status >= 400 && Number(q1<{ balance: number }>(raw, 'SELECT balance FROM user_points WHERE user_id = ?', String(INFL))?.balance) === 1000, fail(pay2))

    // ════════ 7. 정산: 사장님이 받을 돈 · 어드민 지급 ════════
    R.section('7. 정산 — 사장님이 받을 돈 · 어드민 지급 처리')
    const sums = q<{ acct: string; credit: number; debit: number }>(raw, `SELECT acct, SUM(credit) credit, SUM(debit) debit FROM (
        SELECT credit_account acct, amount credit, 0 debit FROM ledger_entries UNION ALL SELECT debit_account acct, 0 credit, amount debit FROM ledger_entries) GROUP BY acct ORDER BY acct`)
    R.note(`원장 계정별 합계: ${sums.map((s) => `${s.acct} +${s.credit}/-${s.debit}`).join(' · ')}`)
    for (const l of q<{ event_type: string; reference_id: string; amount: number; debit_account: string; credit_account: string }>(raw, 'SELECT event_type, reference_id, amount, debit_account, credit_account FROM ledger_entries ORDER BY id')) R.note(`  원장: ${l.event_type} ${l.reference_id} ${l.amount} ${l.debit_account} → ${l.credit_account}`)
    const pay0 = await call('GET', '/api/seller/payouts', sTok)
    R.note(`사장님 정산 화면: ${JSON.stringify(pay0.data).slice(0, 220)}`)
    raw.exec("UPDATE ledger_entries SET created_at = datetime('now', '-20 days')")
    const gen = await handlePayoutsGenerate(env as never)
    const payouts = () => q<{ id: number; payee_type: string; payee_id: string; amount: number; status: string }>(raw, 'SELECT id, payee_type, payee_id, amount, status FROM payouts ORDER BY id')
    const storePayout = payouts().find((p) => p.payee_type === 'store_owner' || p.payee_type === 'seller')
    R.check('보류 14일 뒤 주간 지급 대상: 매장 17,000원 (사용 2건 18,000 − 소개비 1,000)', !!storePayout && storePayout.amount === 17000, `${JSON.stringify(gen)} ${JSON.stringify(payouts())}`)
    if (storePayout) {
      const PID2 = storePayout.id
      const vAppr = await call('PATCH', `/api/admin/payouts/${PID2}/approve`, viewerTok, {})
      R.check('조회 전용(viewer) 어드민은 지급 승인을 못 한다', vAppr.status === 403, fail(vAppr))
      const aAppr = await call('PATCH', `/api/admin/payouts/${PID2}/approve`, adminRoleTok, {})
      R.note(`역할이 'admin' 인 어드민의 지급 승인: ${fail(aAppr)}`)
      const noBank = await call('PATCH', `/api/admin/payouts/${PID2}/approve`, financeTok, {})
      R.note(`계좌가 없는 매장의 지급 승인(finance): ${fail(noBank)}`)
      const sentPending = await call('PATCH', `/api/admin/payouts/${PID2}/sent`, financeTok, { transaction_id: 'BANK-TEST-1' })
      R.note(`승인 전(pending) 지급을 바로 '송금 완료' 로: ${fail(sentPending)} → 상태 ${payouts().find((p) => p.id === PID2)?.status}`)
    }
    await handleAutoSettlement(env as never).catch(() => undefined)
    R.check('옛 정산 레일이 같은 매출을 한 번 더 잡지 않는다', q(raw, 'SELECT id FROM restaurant_settlements').length === 0)

    // ════════ 8. 사장님: 계좌 · 수수료 채널 ════════
    R.section('8. 사장님 — 정산 계좌 등록 · 수수료 구분')
    const ownerCookie = `ur_session=${await sign({ sub: String(OWNER_USER), name: '시험사장', email: 'owner@example.test', type: 'user', isDbId: true, iat: now(), exp: now() + 3600 }, SECRET)}`
    const seat = await call('POST', `/api/seller/stores/${SELLER}/token`, null, {}, { Cookie: ownerCookie })
    const seatTok = String((seat.data as { seller_token?: string }).seller_token || '')
    R.check('사장님(카카오 유저)이 매장 자리 토큰을 받는다', seat.status === 200 && seatTok.length > 20, fail(seat))
    const noPin = await call('PUT', '/api/seller/profile', seatTok, { bank_name: '국민', bank_account: '123456789012', account_holder: '시험사장' })
    R.check('PIN 없이는 계좌를 바꿀 수 없다', noPin.status === 412 && noPin.json.code === 'PIN_REQUIRED', fail(noPin))
    const stranger = await call('POST', '/api/seller/set-pin', sTok, { pin: '654321' })
    R.check('누구인지 실리지 않은 토큰으로는 첫 PIN 을 만들 수 없다', stranger.status === 400 && stranger.json.code === 'PASSWORD_REQUIRED', fail(stranger))
    const pin = await call('POST', '/api/seller/set-pin', seatTok, { pin: '123456' })
    R.check('비밀번호 없는 매장도 소유자 자리로 첫 PIN 을 만들 수 있다(종전: 영영 못 만들었다)', pin.status === 200, fail(pin))
    const pinAgain = await call('POST', '/api/seller/set-pin', seatTok, { pin: '999999' })
    R.check('이미 PIN 이 있으면 같은 길로 덮어쓸 수 없다', pinAgain.status >= 400, fail(pinAgain))
    const { ctx: vctx } = makeCtx()
    const vres = await app.request('/api/seller/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seatTok}`, 'CF-Connecting-IP': '203.0.113.9' }, body: JSON.stringify({ pin: '123456' }) }, env, vctx)
    const pinCookie = (vres.headers.get('set-cookie') || '').split(';')[0]
    const bank = await call('PUT', '/api/seller/profile', seatTok, { bank_name: '국민', bank_account: '123456789012', account_holder: '시험사장' }, { Cookie: pinCookie })
    const acct = q1<{ bank_name: string | null; bank_account: string | null }>(raw, 'SELECT bank_name, bank_account FROM sellers WHERE id = ?', SELLER)
    R.check('PIN 확인 뒤 정산 계좌가 저장된다', vres.status === 200 && bank.status === 200 && !!acct?.bank_account, `verify=${vres.status} ${fail(bank)} ${JSON.stringify(acct)}`)
    const ch = await call('POST', `/api/seller/stores/${SELLER}/channel`, null, { channel: 'brokered' }, { Cookie: ownerCookie })
    const chNow = q1<{ value: string }>(raw, "SELECT value FROM seller_meta WHERE seller_id = ? AND key = 'store_channel'", SELLER)?.value
    R.check('사장님이 스스로 수수료 구분을 직접(10%) → 중개(5%)로 바꿀 수 없다', ch.status === 409 && chNow === 'direct', `${fail(ch)} 지금 값 ${chNow}`)

    // ════════ 9. 교환권(기프티콘) ════════
    R.section('9. 유저 — 교환권(기프티콘) 딜 구매 · 발송 뒤 환불 차단')
    const KT = insert(raw, 'products', { name: '시험 아메리카노 교환권', price: 4500, seller_id: SELLER, category: '커피/음료', is_active: 1, status: 'ACTIVE', stock: 100, deal_only: 1, group_buy_status: 'active', kt_alpha_gift_code: 'G0000TEST', auto_voucher_send: 1, voucher_expiry: 90 })
    for (const [k, v] of [['kt_alpha_user_id', 'testuser'], ['kt_alpha_callback_no', '0212345678']]) insert(raw, 'platform_settings', { key: k, value: v })
    Object.assign(env, { KT_ALPHA_AUTH_CODE: 'x', KT_ALPHA_TOKEN_KEY: 'x', KT_ALPHA_AUTH_TOKEN: 'x' })
    insert(raw, 'user_points', { user_id: String(BUYER), balance: 10000, free_balance: 10000 })
    const points = () => Number(q1<{ balance: number }>(raw, 'SELECT balance FROM user_points WHERE user_id = ?', String(BUYER))?.balance)
    const buyKt = async (key: string) => {
      const r = await call('POST', `/api/group-buy/join/${KT}`, bTok, { quantity: 1, payment_method: 'deal', idempotency_key: key })
      const o = q1<{ id: number }>(raw, "SELECT id FROM orders WHERE user_id = ? AND payment_method = 'deal_points' ORDER BY id DESC LIMIT 1", BUYER)
      return { r, orderId: Number(o?.id), v: o ? voucherByOrder(o.id)[0] : undefined }
    }
    const k1 = await buyKt('kt-test-1')
    const vo = q<{ status: string; coupon_code: string | null }>(raw, 'SELECT status, coupon_code FROM voucher_orders')
    R.check('교환권 딜 구매: 4,500딜 차감 · 기프티콘 발송됨', k1.r.status === 200 && points() === 5500 && vo.length === 1 && vo[0].status === 'sent', `${fail(k1.r)} 잔액 ${points()} 발송 ${JSON.stringify(vo)}`)
    R.note(`발송 뒤에도 내부 이용권 행은 '${k1.v?.status}' 로 남는다 — 그래서 환불 판정은 발송 기록을 본다`)
    const link = q1<{ external_order_id: string }>(raw, 'SELECT external_order_id FROM voucher_orders ORDER BY id LIMIT 1')?.external_order_id
    R.check('발송 기록이 우리 주문과 이어진 채 남는다(카드사 주문번호로 덮이지 않는다)', !!link && link.startsWith(`u${k1.orderId}-`), String(link))
    const wallet = await call('GET', '/api/vouchers/my', bTok)
    const wl = ((wallet.data as { vouchers?: unknown[] }).vouchers || (Array.isArray(wallet.json.data) ? wallet.json.data : [])) as Array<Record<string, unknown>>
    R.check('손님 지갑에 발송된 기프티콘이 보인다', wl.some((x) => x.source === 'kt_alpha'), `${wallet.status} ${JSON.stringify(wl.map((x) => ({ source: x.source, status: x.status }))).slice(0, 200)}`)
    if (k1.v) {
      const c = await call('POST', `/api/group-buy/voucher/${k1.v.code}/cancel`, bTok, {})
      R.check('발송된 교환권은 셀프 취소로 딜을 돌려받을 수 없다(종전: 4,500딜 환불)', c.status === 400 && c.json.code === 'KT_DELIVERED' && points() === 5500, `${fail(c)} 잔액 ${points()}`)
      const oc = await call('POST', `/api/orders/${k1.orderId}/cancel`, bTok, { reason: '주문 취소로 시도' })
      R.check('주문 화면의 취소로도 안 된다', oc.status >= 400 && points() === 5500, `${fail(oc)} 잔액 ${points()}`)
      raw.exec(`UPDATE vouchers SET expires_at = datetime('now', '-1 hours') WHERE id = ${k1.v.id}`)
      await handleExpiredVoucherRefunds(env as never)
      R.check('유효기간이 지나도 만료 환불이 딜을 돌려주지 않는다(종전: 자동 환불)', points() === 5500 && !voucherByOrder(k1.orderId)[0].refund_status, `잔액 ${points()} ${JSON.stringify(voucherByOrder(k1.orderId)[0])}`)
    }
    // 발송이 실패한 교환권은 손님이 받은 것이 없다 → 환불된다
    const k2 = await buyKt('kt-test-2')
    raw.exec(`UPDATE voucher_orders SET status = 'failed' WHERE external_order_id LIKE 'u${k2.orderId}-%'`)
    if (k2.v) {
      const c = await call('POST', `/api/group-buy/voucher/${k2.v.code}/cancel`, bTok, {})
      R.check('발송이 실패한 교환권은 취소하면 딜이 돌아온다', c.status === 200 && points() === 5500, `${fail(c)} 잔액 ${points()}`)
    }

    if (OUT) writeFileSync(OUT, R.lines.join('\n') + '\n')
    out.restore()
    expect(R.lines.filter((l) => l.startsWith('- ✅')).length, '확인 항목이 줄었다 — 흐름이 중간에 끊겼다').toBeGreaterThanOrEqual(35)
    expect(R.fails, R.fails.join('\n')).toEqual([])
  }, 120000)
})
