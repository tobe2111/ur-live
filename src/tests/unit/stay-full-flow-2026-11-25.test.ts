/**
 * 🏨 숙박 전체 흐름을 세 입장에서 끝까지 돌린다 (2026-11-25 대표 지시).
 *
 * 실제 라우트·cron 을 라이브와 같은 구조의 DB 위에서 부른다(카드사만 가짜 — `helpers/live-d1.ts`).
 * 이 시험을 처음 돌렸을 때 나온 결함 — 전부 이 PR 에서 고쳤고, 되돌리면 여기서 빨간불이 난다:
 *   ① 먼저 판매 숙박권은 **살 수 없었다** — 예약 표의 날짜 칸이 NOT NULL 인데 NULL 을 넣었다(500)
 *   ② 숙소 주문에 결제 수단이 안 적혔다(환불·정산이 결제 수단을 본다) · 기간이 지난 숙소 이용권은 환불이 아니라
 *      **이용한 것으로 닫는다**(대표 2026-11-25 "숙소는 시간 지나면 … 사용 완료") — 날짜 예약 · 먼저 산 숙박권 둘 다
 *   ③ 숙소 주문을 '주문 취소' 로 돌리면 취소 규정 없이 **전액 환불**(예약은 확정인 채) · 50% 환불 뒤 나머지도 환불
 *   ④ 숙소 취소 환불액이 주문 장부에 안 적혔다 · 기한 지난 숙박권을 손님이 취소하면 '취소됨' 으로 닫혀 사장님 정산에서 빠졌다
 *   ⑤ 에이전시가 숙박을 올리면 상품만 생기고 숙소 정보·객실 저장이 막혀 **객실 없는 숙박권**이 남았다
 *
 * 못 막는 것: 진짜 카드사 응답(부분 취소 한도 · 지연) · 화면 · 실제 cron 시각. 시간에 기대는 판정(임박 취소 환불율)은
 * 응답이 돌려준 남은 시간으로 기대값을 계산한다 — 하루 중 언제 돌려도 같다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { writeFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, makeReport, SECRET } from '../helpers/live-d1'
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes'
import { sellerStaysRoutes } from '@/features/seller/api/seller-stays.routes'
import { staysPublicRoutes } from '@/features/group-buy/api/stays-public.routes'
import { groupBuyRoutes } from '@/features/group-buy/api/group-buy.routes'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { kstToday, addDays } from '@/features/group-buy/api/stay-voucher-unify'
import { handleExpiredVoucherRefunds, handleAutoSettlement } from '@/worker/cron/auto-settlement'
import { handleStayNoShows } from '@/worker/cron/stay-no-show'
import { handlePayoutsGenerate } from '@/worker/cron/payouts-generate'
import { sellerSettlementsRoutes } from '@/features/seller/api/seller-settlements.routes'
import { ordersRouter } from '@/worker/routes/order.routes'
import { agencyStoresRoutes } from '@/features/agency-console/api/agency-stores.routes'
import { storeAgencyInviteRoutes } from '@/features/seller/api/store-agency-invite.routes'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { sign } from 'hono/jwt'

const OUT = process.env.STAY_REPORT || '' // 돌린 기록을 파일로도 받고 싶을 때

describe('숙박 전체 흐름 — 사장님 · 유저 · 에이전시 (로컬 시험 환경)', () => {
  it('사장님 · 유저 · 에이전시', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const R = makeReport()
    const out = stubOutbound()
    const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>

    const app = new Hono()
    app.use('/api/*', storeSeatGuard())
    app.route('/api/seller', sellerStaysRoutes)
    app.route('/api/seller', sellerOrdersRoutes)
    app.route('/api/seller', sellerSettlementsRoutes)
    app.route('/api/group-buy', groupBuyRoutes)
    app.route('/api/vouchers', groupBuyRoutes)
    app.route('/api/group-buy', staysPublicRoutes)
    app.route('/api/orders', ordersRouter)
    app.route('/api/agency-console', agencyStoresRoutes)
    app.route('/api/store-agency-invite', storeAgencyInviteRoutes)

    const call = async (method: string, path: string, token: string | null, body?: unknown, cookie?: string) => {
      const { ctx, drain } = makeCtx()
      raw.exec('DELETE FROM rate_limit_attempts') // 시험은 한 손님이 몰아서 누른다 — 요청 수 제한은 따로 본다
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 stayflow' }
      if (token) headers.Authorization = `Bearer ${token}`
      if (cookie) headers.Cookie = cookie
      const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
      await drain()
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 300) } }
      return { status: res.status, json, data: (json.data ?? {}) as Record<string, unknown> }
    }
    const fail = (r: { status: number; json: Record<string, unknown> }) => `${r.status} ${JSON.stringify(r.json).slice(0, 400)}`

    // ── 라이브와 같은 설정값(2026-11-25 실측) ──
    for (const [k, v] of [['fee_channel_rates_enabled', 'true'], ['payout_requires_voucher_use', 'true'], ['settlement_skip_ledgered', 'true']]) insert(raw, 'platform_settings', { key: k, value: v })
    // ── 씨앗: 손님, 사장님(유저 + 승인된 매장) ──
    const USER = insert(raw, 'users', { name: '시험손님', email: 'guest@example.test' })
    const OWNER_USER = insert(raw, 'users', { name: '시험사장', email: 'owner@example.test' })
    const SELLER = insert(raw, 'sellers', {
      username: 'test-pension', password_hash: 'x', name: '시험사장', email: 'owner@example.test', business_name: '시험펜션',
      status: 'approved', seller_type: 'store_owner', linked_user_id: OWNER_USER,
    })
    const uTok = await userToken(USER)
    const sTok = await sellerToken(SELLER)

    // ════════ 1. 사장님: 숙소 등록 ════════
    R.section('1. 사장님 — 숙소 등록 (등록 화면이 보내는 순서 그대로)')
    const productBody = (name: string) => ({
      name, description: '시험용 숙소', price: 80000, original_price: 100000, image_url: 'https://example.test/a.jpg', images: '[]',
      category: 'stay_voucher', product_type: 'featured', stock: 100, restaurant_name: '시험펜션', restaurant_address: '강원 강릉시 시험로 1',
      restaurant_phone: '033-123-4567', restaurant_lat: 37.75, restaurant_lng: 128.87, group_buy_target: 0, external_booking_url: null,
      region_si: '강원', region_gu: '강릉시', max_per_person: 5, group_buy_tiers: null,
    })
    const mkStay = async (label: string, name: string, info: Record<string, unknown>) => {
      const p = await call('POST', '/api/seller/products', sTok, productBody(name))
      R.check(`${label}: 상품 만들기`, p.status === 201 || p.status === 200, fail(p))
      const id = Number((p.data as { id?: number }).id)
      const i = await call('POST', `/api/seller/stays/${id}/info`, sTok, { property_type: 'pension', check_in_time: '15:00', check_out_time: '11:00', total_rooms: 2, address: '강원 강릉시 시험로 1', region_sido: '강원', region_sigungu: '강릉시', ...info })
      R.check(`${label}: 숙소 정보 저장`, i.status === 200, fail(i))
      const r = await call('POST', `/api/seller/stays/${id}/rooms`, sTok, { name: '오션뷰', display_order: 0, base_guests: 2, max_guests: 2, base_price_weekday: 80000, base_price_weekend: 120000, total_inventory: 2 })
      R.check(`${label}: 객실 추가`, r.status === 200 || r.status === 201, fail(r))
      return { id, roomId: Number((r.data as { room_id?: number }).room_id) }
    }
    const noValidity = await call('POST', '/api/seller/products', sTok, productBody('유효기간 없는 숙박권'))
    const nvId = Number((noValidity.data as { id?: number }).id)
    const nv = await call('POST', `/api/seller/stays/${nvId}/info`, sTok, { property_type: 'pension', sale_mode: 'voucher' })
    R.check('먼저 판매인데 유효기간을 안 고르면 저장이 막힌다', nv.status === 400, fail(nv))

    const A = await mkStay('먼저 판매 숙소', '시험펜션 숙박권', { sale_mode: 'voucher', voucher_validity_days: 180, house_rules: '12/24~25 이용 불가' })
    const B = await mkStay('날짜 지정 숙소', '시험펜션 날짜예약', { sale_mode: 'date', cancellation_policy: 'standard' })
    const infoA = q1<{ sale_mode: string; voucher_validity_days: number; house_rules: string }>(raw, 'SELECT sale_mode, voucher_validity_days, house_rules FROM product_stay_info WHERE product_id = ?', A.id)
    R.check('먼저 판매 숙소가 voucher · 180일 · 이용 안내로 저장됐다', infoA?.sale_mode === 'voucher' && infoA?.voucher_validity_days === 180 && infoA?.house_rules === '12/24~25 이용 불가', JSON.stringify(infoA))
    const prodA = q1<Record<string, unknown>>(raw, 'SELECT id, seller_id, category, status, is_active, group_buy_status, price FROM products WHERE id = ?', A.id)
    R.note(`상품 행: ${JSON.stringify(prodA)}`)

    // ════════ 2. 유저: 구매 ════════
    const today = kstToday()
    const tossBefore = () => out.toss.length
    const ledgerFor = (voucherId: number) => q<{ event_type: string; amount: number; debit_account: string; credit_account: string }>(raw,
      "SELECT event_type, amount, debit_account, credit_account FROM ledger_entries WHERE reference_id = ? ORDER BY id", `voucher:${voucherId}`)
    const voucherOf = (bookingId: number) => q1<{ id: number; code: string; status: string; expires_at: string | null; applied_price: number; refund_status: string | null }>(raw,
      'SELECT id, code, status, expires_at, applied_price, refund_status FROM vouchers WHERE stay_booking_id = ?', bookingId)
    const bookingOf = (id: number) => q1<{ status: string; total_amount: number; sale_mode: string; voucher_expires_at: string | null; voucher_used_at: string | null; refund_amount: number | null; check_in_code: string | null }>(raw,
      'SELECT status, total_amount, sale_mode, voucher_expires_at, voucher_used_at, refund_amount, check_in_code FROM stay_bookings WHERE id = ?', id)
    const orderOf = (id: number) => q1<{ status: string; payment_status: string; total_amount: number; refunded_amount: number | null; payment_key: string | null }>(raw,
      'SELECT status, payment_status, total_amount, refunded_amount, payment_key FROM orders WHERE id = ?', id)

    let payN = 0
    /** 예약 만들기 → 카드 결제 확정까지. */
    const buy = async (label: string, body: Record<string, unknown>) => {
      const c = await call('POST', '/api/group-buy/stays/bookings/create', uTok, { guest_name: '시험손님', guest_phone: '010-1234-5678', guest_count: 2, ...body })
      if (c.status !== 200) { R.check(`${label}: 예약 만들기`, false, fail(c)); return null }
      const bookingId = Number(c.data.booking_id), orderId = Number(c.data.order_id), total = Number(c.data.total_amount)
      const paymentKey = `pk_test_${++payN}`
      const f = await call('POST', '/api/group-buy/stays/bookings/confirm', uTok, { paymentKey, orderId, amount: total })
      R.check(`${label}: 예약 만들기 + 결제 확정 (${total.toLocaleString('ko-KR')}원)`, f.status === 200, fail(f))
      return { bookingId, orderId, total, paymentKey, confirm: f }
    }

    R.section('2. 유저 — 먼저 판매 숙박권 구매')
    const noAuth = await call('POST', '/api/group-buy/stays/bookings/create', null, { product_id: A.id, room_id: A.roomId, sale_mode: 'voucher', guest_name: 'x', guest_phone: '010' })
    R.check('로그인 없이는 예약할 수 없다', noAuth.status === 401, fail(noAuth))
    const wrongMode = await call('POST', '/api/group-buy/stays/bookings/create', uTok, { product_id: A.id, room_id: A.roomId, sale_mode: 'date', check_in_date: addDays(today, 3), check_out_date: addDays(today, 4), guest_name: '시험손님', guest_phone: '010-1234-5678' })
    R.check('먼저 판매 숙소를 날짜 지정으로는 살 수 없다', wrongMode.status >= 400, fail(wrongMode))

    const a1 = await buy('숙박권 A1(평일권 1박)', { product_id: A.id, room_id: A.roomId, sale_mode: 'voucher', voucher_type: 'weekday', voucher_nights: 1 })
    const a2 = await buy('숙박권 A2(주말권 1박)', { product_id: A.id, room_id: A.roomId, sale_mode: 'voucher', voucher_type: 'weekend', voucher_nights: 1 })
    const a3 = await buy('숙박권 A3(평일권 2박)', { product_id: A.id, room_id: A.roomId, sale_mode: 'voucher', voucher_type: 'weekday', voucher_nights: 2 })
    if (a1 && a2 && a3) {
      R.check('금액: 평일 80,000 · 주말 120,000 · 평일 2박 160,000', a1.total === 80000 && a2.total === 120000 && a3.total === 160000, `${a1.total}/${a2.total}/${a3.total}`)
      const b = bookingOf(a1.bookingId), o = orderOf(a1.orderId), v = voucherOf(a1.bookingId)
      R.check('결제 뒤 예약 confirmed · 주문 PAID/approved', b?.status === 'confirmed' && o?.status === 'PAID' && o?.payment_status === 'approved', JSON.stringify({ b: b?.status, o }))
      const days = b?.voucher_expires_at ? Math.round((Date.parse(b.voucher_expires_at.replace(' ', 'T') + 'Z') - Date.now()) / 86400000) : null
      R.check('유효기간이 결제일 + 180일', days === 180, `voucher_expires_at=${b?.voucher_expires_at} (${days}일)`)
      R.check('지갑 이용권 1장 발급 · 금액 = 결제액 · 만료 = 예약 만료', !!v && v.status === 'unused' && v.applied_price === a1.total && v.expires_at === b?.voucher_expires_at, JSON.stringify(v))
      R.check('카드사 승인 요청 금액 = 주문 금액', out.toss.filter((t) => t.kind === 'confirm' && t.paymentKey === a1.paymentKey)[0]?.amount === a1.total)
      const dup = await call('POST', '/api/group-buy/stays/bookings/confirm', uTok, { paymentKey: a1.paymentKey, orderId: a1.orderId, amount: a1.total })
      const vCount = q1<{ n: number }>(raw, 'SELECT COUNT(*) n FROM vouchers WHERE stay_booking_id = ?', a1.bookingId)?.n
      R.check('결제 확정을 두 번 보내도 이용권은 1장', dup.status === 200 && vCount === 1, `${dup.status} vouchers=${vCount}`)
      const tamper = await call('POST', '/api/group-buy/stays/bookings/create', uTok, { product_id: A.id, room_id: A.roomId, sale_mode: 'voucher', voucher_type: 'weekday', voucher_nights: 1, guest_name: '시험손님', guest_phone: '010-1234-5678' })
      const t2 = await call('POST', '/api/group-buy/stays/bookings/confirm', uTok, { paymentKey: 'pk_tamper', orderId: Number(tamper.data.order_id), amount: 100 })
      R.check('금액을 바꿔 결제 확정하면 거절', t2.status >= 400 && !out.toss.some((t) => t.paymentKey === 'pk_tamper'), fail(t2))
    }

    R.section('3. 유저 — 날짜 지정 예약')
    const tonight = { check_in_date: today, check_out_date: addDays(today, 1) }
    const b1 = await buy('날짜 B1(오늘 1박)', { product_id: B.id, room_id: B.roomId, sale_mode: 'date', ...tonight })
    const b2 = await buy('날짜 B2(오늘 1박)', { product_id: B.id, room_id: B.roomId, sale_mode: 'date', ...tonight })
    const cal = q1<{ available_count: number }>(raw, 'SELECT available_count FROM product_stay_calendar WHERE room_id = ? AND stay_date = ?', B.roomId, today)
    R.check('객실 2개 중 2개 팔려 오늘 남은 방 0', cal?.available_count === 0, JSON.stringify(cal))
    const over = await call('POST', '/api/group-buy/stays/bookings/create', uTok, { product_id: B.id, room_id: B.roomId, sale_mode: 'date', ...tonight, guest_name: '시험손님', guest_phone: '010-1234-5678' })
    R.check('만실인 날은 세 번째 예약이 막힌다', over.status >= 400, fail(over))
    const b3 = await buy('날짜 B3(내일 1박 — 노쇼 시험용)', { product_id: B.id, room_id: B.roomId, sale_mode: 'date', check_in_date: addDays(today, 1), check_out_date: addDays(today, 2) })
    const b4 = await buy('날짜 B4(10일 뒤 1박 — 취소 시험용)', { product_id: B.id, room_id: B.roomId, sale_mode: 'date', check_in_date: addDays(today, 10), check_out_date: addDays(today, 11) })
    if (b1) {
      const v = voucherOf(b1.bookingId)
      R.check('날짜 예약 이용권의 만료 = 체크아웃 날 밤(한국)', v?.expires_at === `${addDays(today, 1)} 14:59:59`, String(v?.expires_at))
    }

    R.section('4. 유저 — 내 화면')
    const mine = await call('GET', '/api/group-buy/stays/my-bookings', uTok)
    const list = (Array.isArray(mine.json.data) ? mine.json.data : (mine.data as { bookings?: unknown[] }).bookings || []) as Array<Record<string, unknown>>
    R.check('내 숙소 예약 목록에 결제한 예약이 뜬다', mine.status === 200 && list.length >= 7, `${mine.status} ${list.length}건`)
    const first = list.find((x) => Number(x.id) === a1?.bookingId)
    R.check('먼저 판매 예약에 매장 전화번호가 실려 온다(전화·문자 버튼용)', first?.store_phone === '033-123-4567', JSON.stringify({ store_phone: first?.store_phone, sale_mode: first?.sale_mode }))
    const wallet = await call('GET', '/api/vouchers/my', uTok)
    const wl = ((wallet.data as { vouchers?: unknown[] }).vouchers || (Array.isArray(wallet.json.data) ? wallet.json.data : [])) as Array<Record<string, unknown>>
    R.check('지갑(내 이용권)에 숙소 이용권이 뜨고 숙소 표시가 실려 온다', wallet.status === 200 && wl.some((x) => Number(x.stay_booking_id) === a1?.bookingId), `${wallet.status} ${wl.length}장 keys=${Object.keys(wallet.json.data || {}).join(',').slice(0, 80)}`)

    // ════════ 5. 사장님: 예약 보기 · 사용 처리 ════════
    R.section('5. 사장님 — 예약 목록 · 사용 처리')
    const sb = await call('GET', '/api/seller/stays-bookings', sTok)
    const sbl = (Array.isArray(sb.json.data) ? sb.json.data : (sb.data as { bookings?: unknown[] }).bookings || []) as Array<Record<string, unknown>>
    R.check('사장님 예약 목록에 결제된 예약이 전부 뜬다', sb.status === 200 && sbl.filter((x) => x.status === 'confirmed').length === 7, `${sb.status} ${sbl.length}건 (확정 ${sbl.filter((x) => x.status === 'confirmed').length})`)
    const other = insert(raw, 'sellers', { username: 'other-store', password_hash: 'x', name: '남의가게', email: 'other@example.test', business_name: '남의가게', status: 'approved', seller_type: 'store_owner' })
    const oTok = await sellerToken(other)

    if (a1) {
      const v = voucherOf(a1.bookingId)!
      const steal = await call('PATCH', `/api/seller/stays/bookings/${a1.bookingId}/use-voucher`, oTok, { check_in_date: today, check_out_date: addDays(today, 1) })
      R.check('다른 매장 사장님은 내 예약을 사용 처리할 수 없다', steal.status >= 400 && voucherOf(a1.bookingId)?.status === 'unused', fail(steal))
      const stealScan = await call('POST', `/api/group-buy/${v.code}/use-by-seller`, oTok)
      R.check('다른 매장 사장님은 내 이용권을 스캔해도 못 쓴다', stealScan.status >= 400 && voucherOf(a1.bookingId)?.status === 'unused', fail(stealScan))
      const use = await call('PATCH', `/api/seller/stays/bookings/${a1.bookingId}/use-voucher`, sTok, { check_in_date: addDays(today, 5), check_out_date: addDays(today, 6) })
      R.check('숙박권 A1: 사장님 [사용 처리] 성공', use.status === 200, fail(use))
      const b = bookingOf(a1.bookingId), v2 = voucherOf(a1.bookingId), led = ledgerFor(v.id)
      R.check('A1: 예약 checked_out · 이용권 used', b?.status === 'checked_out' && !!b.voucher_used_at && v2?.status === 'used', JSON.stringify({ b: b?.status, v: v2?.status }))
      const sum = led.reduce((n, l) => n + l.amount, 0)
      R.check('A1: 정산 원장이 결제액만큼 정확히 나뉜다', led.length >= 2 && sum === a1.total, JSON.stringify(led))
      R.note(`A1 원장: ${led.map((l) => `${l.credit_account} ${l.amount.toLocaleString('ko-KR')}원`).join(' / ')}`)
      const again = await call('PATCH', `/api/seller/stays/bookings/${a1.bookingId}/use-voucher`, sTok, { check_in_date: addDays(today, 5), check_out_date: addDays(today, 6) })
      R.check('A1: 두 번 사용 처리 안 됨 · 원장도 늘지 않음', again.status >= 400 && ledgerFor(v.id).length === led.length, fail(again))
      const cancelUsed = await call('PATCH', `/api/group-buy/stays/bookings/${a1.bookingId}/cancel`, uTok, { reason: '사용 뒤 취소 시도' })
      R.check('A1: 사용한 뒤에는 손님이 취소·환불할 수 없다', cancelUsed.status >= 400 && !out.toss.some((t) => t.kind === 'cancel' && t.paymentKey === a1.paymentKey), fail(cancelUsed))
    }

    if (b1 && b2) {
      const v1 = voucherOf(b1.bookingId)!
      const scan = await call('POST', `/api/group-buy/${v1.code}/use-by-seller`, sTok)
      R.check('날짜 B1: 사장님 QR 스캔으로 체크인', scan.status === 200, fail(scan))
      const led1 = ledgerFor(v1.id)
      R.check('B1: 예약 checked_in · 이용권 used · 원장 합 = 결제액', bookingOf(b1.bookingId)?.status === 'checked_in' && voucherOf(b1.bookingId)?.status === 'used' && led1.reduce((n, l) => n + l.amount, 0) === b1.total, JSON.stringify({ b: bookingOf(b1.bookingId)?.status, led: led1 }))
      const rescan = await call('POST', `/api/group-buy/${v1.code}/use-by-seller`, sTok)
      R.check('B1: 같은 QR 을 다시 스캔하면 거절', rescan.status >= 400 && ledgerFor(v1.id).length === led1.length, fail(rescan))
      const ci = await call('PATCH', `/api/seller/stays/bookings/${b2.bookingId}/check-in`, sTok)
      const v2 = voucherOf(b2.bookingId)!
      R.check('날짜 B2: 사장님 [체크인] 버튼 → 이용권도 사용 처리 · 원장 기록', ci.status === 200 && bookingOf(b2.bookingId)?.status === 'checked_in' && v2.status === 'used' && ledgerFor(v2.id).reduce((n, l) => n + l.amount, 0) === b2.total, `${fail(ci)} v=${v2.status} led=${JSON.stringify(ledgerFor(v2.id))}`)
    }
    if (b3) {
      const v3 = voucherOf(b3.bookingId)!
      const early = await call('POST', `/api/group-buy/${v3.code}/use-by-seller`, sTok)
      R.check('날짜 B3: 체크인 날 전에는 스캔해도 못 쓴다', early.status >= 400 && voucherOf(b3.bookingId)?.status === 'unused', fail(early))
    }

    // ════════ 6. 유저: 취소·환불 ════════
    R.section('6. 유저 — 취소 · 환불')
    if (a2) {
      const before = tossBefore()
      const c = await call('PATCH', `/api/group-buy/stays/bookings/${a2.bookingId}/cancel`, uTok, { reason: '일정 변경' })
      const cancels = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      R.check('숙박권 A2: 쓰기 전 취소 → 전액 환불', c.status === 200 && Number(c.data.refund_amount) === a2.total && cancels.length === 1 && cancels[0].paymentKey === a2.paymentKey, `${fail(c)} toss=${JSON.stringify(cancels)}`)
      R.check('A2: 예약 refunded · 이용권 refunded(다시 못 씀)', bookingOf(a2.bookingId)?.status === 'refunded' && voucherOf(a2.bookingId)?.status === 'refunded', JSON.stringify({ b: bookingOf(a2.bookingId), v: voucherOf(a2.bookingId)?.status, o: orderOf(a2.orderId) }))
      const twice = await call('PATCH', `/api/group-buy/stays/bookings/${a2.bookingId}/cancel`, uTok, {})
      R.check('A2: 두 번 취소해도 환불은 한 번', twice.status >= 400 && out.toss.filter((t) => t.kind === 'cancel' && t.paymentKey === a2.paymentKey).length === 1, fail(twice))
      const useRefunded = await call('PATCH', `/api/seller/stays/bookings/${a2.bookingId}/use-voucher`, sTok, { check_in_date: today, check_out_date: addDays(today, 1) })
      R.check('A2: 환불된 숙박권은 사장님도 사용 처리할 수 없다', useRefunded.status >= 400, fail(useRefunded))
    }
    if (b4) {
      const calBefore = q1<{ available_count: number }>(raw, 'SELECT available_count FROM product_stay_calendar WHERE room_id = ? AND stay_date = ?', B.roomId, addDays(today, 10))?.available_count
      const before = tossBefore()
      const c = await call('PATCH', `/api/group-buy/stays/bookings/${b4.bookingId}/cancel`, uTok, { reason: '10일 전 취소' })
      const calAfter = q1<{ available_count: number }>(raw, 'SELECT available_count FROM product_stay_calendar WHERE room_id = ? AND stay_date = ?', B.roomId, addDays(today, 10))?.available_count
      const cancels = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      R.check('날짜 B4: 체크인 48시간 전 취소 → 100% 환불 · 방이 다시 풀린다', c.status === 200 && Number(c.data.refund_amount) === b4.total && cancels.length === 1 && calBefore === 1 && calAfter === 2, `${fail(c)} cal ${calBefore}→${calAfter} toss=${JSON.stringify(cancels)}`)
    }

    // 취소된 숙소 주문을 '주문 취소' 로 또 환불할 수 있나
    if (a2) {
      const before = tossBefore()
      const oc = await call('POST', `/api/orders/${a2.orderId}/cancel`, uTok, { reason: '주문 화면에서 다시 취소' })
      const extra = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      R.check('A2: 이미 전액 환불된 숙소 주문을 주문 화면에서 다시 취소해도 카드사 환불이 또 나가지 않는다', extra.length === 0, `${fail(oc)} toss=${JSON.stringify(extra)} order=${JSON.stringify(orderOf(a2.orderId))}`)
    }
    const b5 = await buy('날짜 B5(내일 1박 — 임박 취소 시험용)', { product_id: B.id, room_id: B.roomId, sale_mode: 'date', check_in_date: addDays(today, 1), check_out_date: addDays(today, 2) })
    if (b5) {
      const before = tossBefore()
      const c = await call('PATCH', `/api/group-buy/stays/bookings/${b5.bookingId}/cancel`, uTok, { reason: '임박 취소' })
      const cancels = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      const hrs = Number(c.data.hours_until_check_in)
      const expectRate = hrs >= 48 ? 1 : hrs >= 24 ? 0.5 : 0
      R.check(`날짜 B5: 체크인 ${hrs}시간 전 취소 → 정책대로 ${expectRate * 100}% 환불`, c.status === 200 && Number(c.data.refund_rate) === expectRate && (expectRate === 0 ? cancels.length === 0 : cancels.length === 1 && (cancels[0].amount === b5.total * expectRate || (expectRate === 1 && cancels[0].amount === null))), `${fail(c)} toss=${JSON.stringify(cancels)}`)
      const o5 = orderOf(b5.orderId)
      R.check('B5: 환불한 금액이 주문 장부(refunded_amount)에 적힌다', o5?.refunded_amount === Math.floor(b5.total * expectRate), JSON.stringify(o5))
      const before2 = tossBefore()
      const oc = await call('POST', `/api/orders/${b5.orderId}/cancel`, uTok, { reason: '나머지도 환불 시도' })
      const extra = out.toss.slice(before2).filter((t) => t.kind === 'cancel')
      R.check('B5: 일부만 환불된 숙소 주문을 주문 화면에서 취소해 나머지를 더 받을 수 없다', extra.length === 0, `${fail(oc)} toss=${JSON.stringify(extra)}`)
    }
    if (b3) {
      const before = tossBefore()
      const oc = await call('POST', `/api/orders/${b3.orderId}/cancel`, uTok, { reason: '숙소 취소 대신 주문 취소' })
      const extra = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      R.check('B3: 숙소 주문은 주문 화면의 취소로 정책을 건너뛰어 전액 환불받을 수 없다', extra.length === 0 && bookingOf(b3.bookingId)?.status === 'confirmed', `${fail(oc)} toss=${JSON.stringify(extra)} booking=${bookingOf(b3.bookingId)?.status}`)
    }

    // ════════ 7. 기간이 지난 뒤 (새벽 자동 처리) ════════
    R.section('7. 기간이 지난 뒤 — 새벽 자동 처리 (시험에서는 만료 시각을 과거로 돌린다)')
    const past = "datetime('now', '-2 hours')"
    if (a3 && b3) {
      const va = voucherOf(a3.bookingId)!, vb = voucherOf(b3.bookingId)!
      raw.exec(`UPDATE vouchers SET expires_at = ${past} WHERE id IN (${va.id}, ${vb.id})`)
      raw.exec(`UPDATE stay_bookings SET voucher_expires_at = ${past} WHERE id = ${a3.bookingId}`)
      const early = await call('PATCH', `/api/group-buy/stays/bookings/${a3.bookingId}/cancel`, uTok, { reason: '기한 지난 뒤 취소' })
      R.check('A3: 기한이 지난 숙박권은 취소·환불을 받지 않는다(이용권·예약 그대로)', early.status === 400 && early.json.code === 'STAY_VOUCHER_EXPIRED' && voucherOf(a3.bookingId)?.status !== 'refunded' && bookingOf(a3.bookingId)?.status === 'confirmed', fail(early))
      const before = tossBefore()
      await handleExpiredVoucherRefunds(env as never) // 만료 환불을 먼저 돌려도 숙소는 건드리지 않아야 한다
      R.check('만료 환불(일반 이용권용)은 숙소 이용권을 건드리지 않는다', out.toss.length === before && !voucherOf(a3.bookingId)?.refund_status && !voucherOf(b3.bookingId)?.refund_status, JSON.stringify({ a: voucherOf(a3.bookingId), b: voucherOf(b3.bookingId) }))
      const ns = await handleStayNoShows(env as never)
      const cancels = out.toss.slice(before).filter((t) => t.kind === 'cancel')
      const vb2 = voucherOf(b3.bookingId)!, va2 = voucherOf(a3.bookingId)!
      R.check('날짜 B3(안 옴): 환불 0원 · 이용한 것으로 마감(used) · 예약 no_show', vb2.status === 'used' && bookingOf(b3.bookingId)?.status === 'no_show' && !cancels.some((t) => t.paymentKey === b3.paymentKey), JSON.stringify({ closed: ns.closed, v: vb2, b: bookingOf(b3.bookingId)?.status }))
      const ledB = ledgerFor(vb.id)
      R.check('B3: 사장님 정산 원장에 결제액이 들어간다', ledB.reduce((n, l) => n + l.amount, 0) === b3.total && ledB.some((l) => l.credit_account === `merchant:${SELLER}`), JSON.stringify(ledB))
      R.check('숙박권 A3(유효기간 지남·미사용): 환불 0원 · 이용한 것으로 마감(used) · 예약 no_show', ns.closed === 2 && va2.status === 'used' && bookingOf(a3.bookingId)?.status === 'no_show' && !cancels.some((t) => t.paymentKey === a3.paymentKey), JSON.stringify({ closed: ns.closed, v: va2, b: bookingOf(a3.bookingId)?.status, cancels }))
      const ledA = ledgerFor(va.id)
      R.check('A3: 사장님 정산 원장에 결제액이 들어간다 · 주문은 환불 표시 없음', ledA.reduce((n, l) => n + l.amount, 0) === a3.total && ledA.some((l) => l.credit_account === `merchant:${SELLER}`) && orderOf(a3.orderId)?.refunded_amount === 0 && orderOf(a3.orderId)?.status === 'PAID', JSON.stringify({ ledA, o: orderOf(a3.orderId) }))
      const noti = q<{ title: string }>(raw, "SELECT title FROM user_notifications WHERE user_id = ? AND type = 'stay_no_show' ORDER BY id", String(USER))
      R.check('손님에게 앱 안 알림 — 날짜 예약 1건 · 숙박권 1건', noti.length === 2 && noti.some((n) => n.title.includes('숙박권 유효기간')) && noti.some((n) => n.title.includes('숙소 예약 기간')), JSON.stringify(noti))
      const again = tossBefore()
      const ns2 = await handleStayNoShows(env as never)
      await handleExpiredVoucherRefunds(env as never)
      R.check('새벽 처리를 한 번 더 돌려도 마감·환불이 반복되지 않는다', ns2.closed === 0 && out.toss.length === again && ledgerFor(vb.id).length === ledB.length && ledgerFor(va.id).length === ledA.length)
      const lateCancel = await call('PATCH', `/api/group-buy/stays/bookings/${a3.bookingId}/cancel`, uTok, {})
      R.check('A3: 마감된 뒤 손님이 취소를 눌러도 환불이 나가지 않는다', lateCancel.status >= 400 && out.toss.length === again, fail(lateCancel))
    }

    // ════════ 8. 정산 ════════
    R.section('8. 정산 — 사장님이 받을 돈')
    const led = q<{ credit_account: string; total: number }>(raw, "SELECT credit_account, SUM(amount) total FROM ledger_entries WHERE event_type = 'voucher_used' GROUP BY credit_account ORDER BY credit_account")
    R.note(`원장 합계: ${led.map((l) => `${l.credit_account} ${Number(l.total).toLocaleString('ko-KR')}원`).join(' / ')}`)
    const usedTotal = (a1?.total || 0) + (b1?.total || 0) + (b2?.total || 0) + (b3?.total || 0) + (a3?.total || 0)
    const ledSum = led.reduce((n, l) => n + Number(l.total), 0)
    R.check(`원장 총액 = 이용 처리된 5건(사용 3 · 기간 경과 2)의 결제액 합(${usedTotal.toLocaleString('ko-KR')}원)`, ledSum === usedTotal, `원장 ${ledSum}`)
    const merchant = Number(led.find((l) => l.credit_account === `merchant:${SELLER}`)?.total || 0)
    const platform = Number(led.find((l) => l.credit_account === 'platform:revenue')?.total || 0)
    R.note(`사장님 몫 ${merchant.toLocaleString('ko-KR')}원 · 유어딜 수수료 ${platform.toLocaleString('ko-KR')}원 (${usedTotal ? (platform / usedTotal * 100).toFixed(1) : '-'}%)`)
    const pay0 = await call('GET', '/api/seller/payouts', sTok)
    R.note(`사장님 정산 화면(지금): ${JSON.stringify(pay0.data).slice(0, 300)}`)
    const g0 = await handlePayoutsGenerate(env as never)
    const p0 = q<{ amount: number }>(raw, 'SELECT amount FROM payouts')
    R.check('보류 기간(기본 14일) 안에는 지급 대상이 만들어지지 않는다', p0.length === 0, `${JSON.stringify(g0)} payouts=${JSON.stringify(p0)}`)
    raw.exec("UPDATE ledger_entries SET created_at = datetime('now', '-20 days')")
    const g1 = await handlePayoutsGenerate(env as never)
    const p1 = q<Record<string, unknown>>(raw, 'SELECT payee_type, payee_id, amount, status, bank_name, account_number FROM payouts')
    R.check('보류 기간이 지나면 주간 지급 대상이 사장님 몫만큼 만들어진다', p1.length === 1 && Number(p1[0].amount) === merchant, `${JSON.stringify(g1)} payouts=${JSON.stringify(p1)}`)
    const g2 = await handlePayoutsGenerate(env as never)
    R.check('지급 대상 생성을 두 번 돌려도 한 건', q(raw, 'SELECT id FROM payouts').length === p1.length, JSON.stringify(g2))
    const pay1 = await call('GET', '/api/seller/payouts', sTok)
    R.note(`사장님 정산 화면(지급 대상 생성 뒤): ${JSON.stringify(pay1.data).slice(0, 300)}`)
    raw.exec("UPDATE vouchers SET used_at = datetime('now', '-20 days') WHERE status = 'used'")
    await handleAutoSettlement(env as never).catch((e: unknown) => R.note(`옛 정산 레일(auto-settlement) 예외: ${String(e).slice(0, 200)}`))
    const rs = q<Record<string, unknown>>(raw, 'SELECT * FROM restaurant_settlements')
    R.check('옛 정산 레일이 같은 매출을 한 번 더 잡지 않는다(이중 지급 없음)', rs.length === 0, JSON.stringify(rs).slice(0, 300))

    // ════════ 9. 에이전시 ════════
    R.section('9. 에이전시 — 매장 연결')
    await ensureAgencyConsoleTables(DB)
    const AGENCY = insert(raw, 'agency_accounts', { name: '시험에이전시', kind: 'business', business_number: '1234567890', status: 'active' })
    const STAFF = insert(raw, 'agency_staff', { agency_id: AGENCY, email: 'agency@example.test', name: '시험담당', role: 'admin', is_owner: 1, status: 'active', tokens_valid_after: 0 })
    const aTok = (await issueAgencyStaffToken(SECRET, { id: STAFF, agency_id: AGENCY })).token
    const nowS = Math.floor(Date.now() / 1000)
    const ownerCookie = `ur_session=${await sign({ sub: String(OWNER_USER), name: '시험사장', email: 'owner@example.test', type: 'user', isDbId: true, iat: nowS, exp: nowS + 3600 }, SECRET)}`

    const share = await call('POST', '/api/agency-console/store-invite/share', aTok, { pct: 5, budget_pct: 10 })
    R.check('에이전시: 수수료 5% · 마케팅 상한 10% 저장(어제 고친 화면)', share.status === 200, fail(share))
    const mk = await call('POST', '/api/agency-console/store-invite', aTok)
    const inv = await call('GET', '/api/agency-console/store-invite', aTok)
    const url = String((mk.json.invite as { url?: string } | undefined)?.url || (inv.json.invite as { url?: string } | undefined)?.url || '')
    const invToken = url.split('/').pop() || ''
    R.check('에이전시: 매장 영입 링크 만들기', mk.status === 200 && /^[0-9a-f]{64}$/.test(invToken), `${fail(mk)} url=${url}`)
    const open = await call('GET', `/api/store-agency-invite/${invToken}`, null)
    R.check('사장님: 영입 링크를 열면 에이전시 이름·수수료가 보인다', open.status === 200 && JSON.stringify(open.json).includes('시험에이전시') && JSON.stringify(open.json).includes('"sharePct":5'), fail(open))
    const acc = await call('POST', '/api/store-agency-invite/accept', null, { token: invToken, seller_ids: [SELLER], share_pct: 5, budget_pct: 10 }, ownerCookie)
    const link = q1<{ id: number; status: string }>(raw, 'SELECT id, status FROM agency_store_links WHERE agency_id = ? AND seller_id = ?', AGENCY, SELLER)
    R.check('사장님: 수락 → 매장이 에이전시에 연결(active)', acc.status === 200 && link?.status === 'active', `${fail(acc)} link=${JSON.stringify(link)}`)
    const term = q1<{ pct: number }>(raw, 'SELECT pct FROM agency_share_terms WHERE agency_id = ? AND seller_id = ? ORDER BY id DESC LIMIT 1', AGENCY, SELLER)
    R.check('수락한 수수료 5% 가 약정으로 기록된다', Number(term?.pct) === 5, JSON.stringify(term))
    const stranger = await call('POST', '/api/store-agency-invite/accept', null, { token: invToken, seller_ids: [other], share_pct: 5, budget_pct: 10 }, ownerCookie)
    R.check('남의 매장을 내 이름으로 맡길 수는 없다', q1(raw, 'SELECT id FROM agency_store_links WHERE agency_id = ? AND seller_id = ?', AGENCY, other) === null, fail(stranger))

    R.section('10. 에이전시 — 매장 대신 숙박 등록 · 매출 보기')
    const seat = await call('POST', `/api/agency-console/stores/${SELLER}/seat`, aTok)
    const seatTok = String((seat.data as { seller_token?: string }).seller_token || '')
    R.check('에이전시: 연결된 매장의 대시보드 자리(대행 토큰) 받기', seat.status === 200 && seatTok.length > 20, fail(seat))
    const cp = await call('POST', '/api/seller/products', seatTok, productBody('에이전시가 올린 숙박권'))
    const cId = Number((cp.data as { id?: number }).id)
    R.check('에이전시 자리로 상품 만들기', cp.status === 201 || cp.status === 200, fail(cp))
    const ci2 = await call('POST', `/api/seller/stays/${cId}/info`, seatTok, { property_type: 'pension', check_in_time: '15:00', check_out_time: '11:00', total_rooms: 1, sale_mode: 'voucher', voucher_validity_days: 90 })
    R.check('에이전시 자리로 숙소 정보(판매 방식·유효기간) 저장', ci2.status === 200, fail(ci2))
    const cr = await call('POST', `/api/seller/stays/${cId}/rooms`, seatTok, { name: '스탠다드', display_order: 0, base_guests: 2, max_guests: 2, base_price_weekday: 60000, base_price_weekend: 90000, total_inventory: 1 })
    R.check('에이전시 자리로 객실 추가', cr.status === 200 || cr.status === 201, fail(cr))
    const orphan = q1<{ n: number }>(raw, 'SELECT COUNT(*) n FROM product_stay_rooms WHERE product_id = ?', cId)?.n
    R.note(`에이전시가 만든 상품 ${cId}: 객실 ${orphan}개 · 숙소 정보 ${q1(raw, 'SELECT product_id FROM product_stay_info WHERE product_id = ?', cId) ? '있음' : '없음'} · 에이전시 표식 ${q1(raw, 'SELECT agency_id FROM agency_products WHERE product_id = ?', cId) ? '있음' : '없음'}`)
    const seatList = await call('GET', '/api/seller/stays-bookings', seatTok)
    R.check('에이전시 자리로는 손님 예약 목록(연락처)을 볼 수 없다', seatList.status === 403, fail(seatList))
    const seatUse = a3 ? await call('PATCH', `/api/seller/stays/bookings/${a3.bookingId}/use-voucher`, seatTok, { check_in_date: today, check_out_date: addDays(today, 1) }) : null
    if (seatUse) R.check('에이전시 자리로는 사용 처리를 할 수 없다', seatUse.status === 403, fail(seatUse))
    const seatOther = await call('POST', `/api/seller/stays/${A.id}/rooms`, seatTok, { name: '끼워넣기', base_price_weekday: 1, base_price_weekend: 1 })
    R.check('에이전시 자리로 사장님이 직접 올린 숙소는 건드릴 수 없다', seatOther.status >= 400 && q1<{ n: number }>(raw, 'SELECT COUNT(*) n FROM product_stay_rooms WHERE product_id = ?', A.id)?.n === 1, fail(seatOther))

    // 에이전시가 만든 상품이 팔리게: 사장님이 숙소 정보·객실을 채운다(에이전시 자리로 못 했을 때)
    let cRoom = Number((cr.data as { room_id?: number }).room_id)
    if (!(ci2.status === 200)) await call('POST', `/api/seller/stays/${cId}/info`, sTok, { property_type: 'pension', sale_mode: 'voucher', voucher_validity_days: 90 })
    if (!cRoom) cRoom = Number(((await call('POST', `/api/seller/stays/${cId}/rooms`, sTok, { name: '스탠다드', display_order: 0, base_guests: 2, max_guests: 2, base_price_weekday: 60000, base_price_weekend: 90000, total_inventory: 1 })).data as { room_id?: number }).room_id)
    const c1 = await buy('에이전시 상품 C1(평일권 1박)', { product_id: cId, room_id: cRoom, sale_mode: 'voucher', voucher_type: 'weekday', voucher_nights: 1 })
    if (c1) {
      const use = await call('PATCH', `/api/seller/stays/bookings/${c1.bookingId}/use-voucher`, sTok, { check_in_date: addDays(today, 2), check_out_date: addDays(today, 3) })
      const v = voucherOf(c1.bookingId)!
      const led = ledgerFor(v.id)
      R.check('C1: 사장님 사용 처리 → 원장 기록', use.status === 200 && led.reduce((n, l) => n + l.amount, 0) === c1.total, `${fail(use)} ${JSON.stringify(led)}`)
      R.note(`C1 원장: ${led.map((l) => `${l.credit_account} ${l.amount.toLocaleString('ko-KR')}원`).join(' / ')}`)
      const agencyLedger = q<Record<string, unknown>>(raw, "SELECT event_type, amount, debit_account, credit_account FROM ledger_entries WHERE credit_account LIKE 'agency%' OR debit_account LIKE 'agency%'")
      R.note(`에이전시 계정으로 움직인 원장: ${JSON.stringify(agencyLedger)}`)
      const sales = await call('GET', `/api/agency-console/stores/${SELLER}/sales`, aTok)
      R.note(`에이전시 매출 화면: ${sales.status} ${JSON.stringify(sales.data).slice(0, 500)}`)
      const sd = sales.data as { summary?: { sold?: number; revenue?: number; used?: number }; share?: { pct?: number; amount?: number } }
      R.check('에이전시 매출 화면: 자기가 올린 숙박권 1건 60,000원 · 몫 5% = 3,000원(표시)', sd.summary?.sold === 1 && sd.summary?.revenue === 60000 && sd.share?.pct === 5 && sd.share?.amount === 3000, JSON.stringify(sd))
      R.check('에이전시 몫은 표시만 — 원장에서 에이전시로 돈이 자동으로 움직이지 않는다(설정 꺼짐)', agencyLedger.length === 0, JSON.stringify(agencyLedger))
      const stores = await call('GET', '/api/agency-console/stores', aTok)
      R.note(`에이전시 매장 목록: ${stores.status} ${JSON.stringify(stores.json).slice(0, 400)}`)
    }

    // 결과 파일
    if (OUT) writeFileSync(OUT, R.lines.join('\n') + '\n')
    out.restore()
    expect(R.lines.filter((l) => l.startsWith('- ✅')).length, '확인 항목이 줄었다 — 흐름이 중간에 끊겼다').toBeGreaterThanOrEqual(80)
    expect(R.fails, R.fails.join('\n')).toEqual([])
  }, 120000)
})
