/**
 * 💸 지급 한 주기를 끝까지 — 에이전시 몫(유어딜 지급 켬) · 인플루언서 현금 지급 · 매장 주간 지급 (2026-11-25 대표
 * *"공구서비스는 안봐도 되고, 나머지 빠짐없이 모두 해줘야지."*)
 *
 * `voucher-full-flow-2026-11-25.test.ts` 가 안 돌린 세 구간이다. 같은 시험 환경(실제 라우트·cron + 라이브 구조 DB + 가짜 카드사).
 *   ① 에이전시가 매장 대신 올린 일반 이용권이 팔리고 → 몫이 붙고 → 신청 → 어드민 지급, 그리고 그 뒤 환불
 *   ② 인플루언서 소개비를 현금으로(3.3% 떼고) 지급
 *   ③ 매장 지급: 생성 → 승인 → 송금 완료 → 다음 주에 같은 돈이 또 잡히지 않는다
 *
 * 못 보는 것: 실제 송금(사람이 은행에서 한다) · 진짜 카드사 · `agency_share_payout_enabled` 는 라이브에서 꺼져 있다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { writeFileSync } from 'node:fs'
import { sign } from 'hono/jwt'
import { d1, openLiveSchema, insert, q, q1, userToken, sellerToken, makeCtx, stubOutbound, makeReport, SECRET } from '../helpers/live-d1'
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes'
import { sellerSettlementsRoutes } from '@/features/seller/api/seller-settlements.routes'
import { groupBuyRoutes } from '@/features/group-buy/api/group-buy.routes'
import { sellerMarketingRoutes, influencerSettlementRoutes, adminPayoutRoutes } from '@/features/group-buy/api/marketing.routes'
import { adminPayoutsRoutes } from '@/features/admin/api/admin-payouts.routes'
import { agencyStoresRoutes } from '@/features/agency-console/api/agency-stores.routes'
import { agencyAdminRoutes } from '@/features/agency-console/api/agency-admin.routes'
import { adminTaxRoutes } from '@/features/admin/api/admin-tax.routes'
import { storeAgencyInviteRoutes } from '@/features/seller/api/store-agency-invite.routes'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { storeSeatGuard } from '@/worker/utils/store-seat-guard'
import { handleExpiredVoucherRefunds } from '@/worker/cron/auto-settlement'
import { handlePayoutsGenerate } from '@/worker/cron/payouts-generate'
import { handleInfluencerPayout } from '@/worker/cron/influencer-payout'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { PLATFORM_OPERATOR_AGENCY_IDS } from '@/worker/utils/ledger-commission-policy'

const OUT = process.env.PAYOUT_REPORT || ''

describe('지급 한 주기 — 에이전시 몫 · 인플루언서 현금 · 매장 주간 지급 (로컬 시험 환경)', () => {
  it('판매 → 몫 적립 → 신청 → 지급 → 그 뒤 환불', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const R = makeReport(OUT || undefined)
    const out = stubOutbound()
    const env = { DB, JWT_SECRET: SECRET, DATA_ENCRYPTION_KEY: 'test-kek-0123456789abcdef', TOSS_SECRET_KEY: 'test_sk_local', TOSS_CLIENT_KEY: 'test_ck_local', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>

    const app = new Hono()
    app.use('/api/*', storeSeatGuard())
    app.route('/api/seller', sellerOrdersRoutes)
    app.route('/api/seller', sellerSettlementsRoutes)
    app.route('/api/group-buy', groupBuyRoutes)
    app.route('/api/vouchers', groupBuyRoutes)
    app.route('/api/seller-marketing', sellerMarketingRoutes)
    app.route('/api/influencer-settlement', influencerSettlementRoutes)
    app.route('/api/admin-payouts', adminPayoutRoutes)
    app.route('/api', adminPayoutsRoutes)
    app.route('/api/admin', agencyAdminRoutes)
    app.route('/api', adminTaxRoutes)
    app.route('/api/agency-console', agencyStoresRoutes)
    app.route('/api/store-agency-invite', storeAgencyInviteRoutes)

    const call = async (method: string, path: string, token: string | null, body?: unknown, extra: Record<string, string> = {}) => {
      const { ctx, drain } = makeCtx()
      raw.exec('DELETE FROM rate_limit_attempts')
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 payoutcycle', ...extra }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
      await drain()
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 300) } }
      return { status: res.status, json, text, data: (json.data ?? {}) as Record<string, unknown> }
    }
    const fail = (r: { status: number; json: Record<string, unknown> }) => `${r.status} ${JSON.stringify(r.json).slice(0, 380)}`
    const won = (n: number) => `${Number(n).toLocaleString('ko-KR')}원`

    const SETTINGS: Record<string, string> = {
      fee_channel_rates_enabled: 'true', platform_fee_pct_direct: '10', platform_fee_pct_brokered: '5', commission_rate_meal_voucher: '5',
      payout_requires_voucher_use: 'true', settlement_skip_ledgered: 'true', refund_window_days: '7',
      influencer_deal_bonus_pct: '0', influencer_payout_min: '100000', user_referral_bonus_pct: '0',
      agency_share_payout_enabled: 'true',
    }
    for (const [k, v] of Object.entries(SETTINGS)) insert(raw, 'platform_settings', { key: k, value: v })

    const BUYER = insert(raw, 'users', { name: '시험손님', email: 'buyer@example.test', phone: '01012345678' })
    const INFL = insert(raw, 'users', { name: '시험소개', email: 'infl@example.test', handle: 'testinfl' })
    const OWNER_USER = insert(raw, 'users', { name: '시험사장', email: 'owner@example.test' })
    const SELLER = insert(raw, 'sellers', {
      username: 'test-store', password_hash: '', name: '시험사장', email: 'owner@example.test', business_name: '시험식당', status: 'approved', seller_type: 'store_owner',
      bank_name: '국민', bank_account: '111-22-333333', account_holder: '시험사장', is_verified: 1,
    })
    await setSellerMeta(DB, SELLER, { store_channel: 'direct' })
    insert(raw, 'seller_operators', { seller_id: SELLER, user_id: OWNER_USER, role: 'owner' })
    const bTok = await userToken(BUYER), iTok = await userToken(INFL), sTok = await sellerToken(SELLER)
    const now = () => Math.floor(Date.now() / 1000)
    const adminTok = async (role: string) => {
      const id = insert(raw, 'admins', { username: `adm-${role}`, email: `${role}@example.test`, password_hash: 'x', name: role, role })
      return sign({ type: 'admin', sub: String(id), admin_id: id, userId: id, role, iat: now(), exp: now() + 3600 }, SECRET)
    }
    const financeTok = await adminTok('finance')
    const viewerTok = await adminTok('viewer')

    const productBody = (name: string, price: number) => ({
      name, description: '시험', price, original_price: price * 2, image_url: 'https://example.test/a.jpg', images: '[]',
      category: 'meal_voucher', product_type: 'featured', stock: 100, restaurant_name: '시험식당', restaurant_address: '서울 마포구 시험로 1', restaurant_phone: '02-123-4567',
      restaurant_lat: 37.55, restaurant_lng: 126.92, group_buy_target: 0, external_booking_url: null, region_si: '서울', region_gu: '마포구', max_per_person: 20, group_buy_tiers: null,
    })
    let payN = 0
    const voucherByOrder = (orderId: number) => q<{ id: number; code: string; status: string; applied_price: number; refund_status: string | null }>(raw, 'SELECT id, code, status, applied_price, refund_status FROM vouchers WHERE order_id = ?', orderId)
    const buyCard = async (label: string, pid: number, ref?: string) => {
      const init = await call('POST', `/api/group-buy/join/${pid}`, bTok, { quantity: 1, payment_method: 'toss', ...(ref ? { ref } : {}) })
      if (init.status !== 200) { R.check(`${label}: 결제 준비`, false, fail(init)); return null }
      const d = (init.data as { orderId?: string }).orderId ? init.data as { orderId: string; amount: number } : (init.json as unknown as { orderId: string; amount: number })
      const paymentKey = `pk_p_${++payN}`
      const conf = await call('POST', '/api/group-buy/confirm-toss', bTok, { paymentKey, orderId: d.orderId, amount: d.amount, productId: pid, qty: 1, ...(ref ? { ref } : {}) })
      const order = q1<{ id: number; order_number: string; total_amount: number; commission_rate: number | null }>(raw, 'SELECT id, order_number, total_amount, commission_rate FROM orders WHERE payment_key = ?', paymentKey)
      R.check(`${label}: 카드 결제 확정 (${won(Number(d.amount))})`, conf.status === 200 && !!order, fail(conf))
      return order ? { orderId: order.id, paymentKey, order, v: voucherByOrder(order.id)[0] } : null
    }
    const useVoucher = async (code: string) => call('POST', `/api/group-buy/${code}/use-by-seller`, sTok)
    const ledger = () => q<{ event_type: string; reference_id: string; amount: number; debit_account: string; credit_account: string }>(raw, 'SELECT event_type, reference_id, amount, debit_account, credit_account FROM ledger_entries ORDER BY id')
    const acctNet = (acct: string) => ledger().reduce((n, l) => n + (l.credit_account === acct ? l.amount : 0) - (l.debit_account === acct ? l.amount : 0), 0)

    // ════════ 1. 에이전시 연결 · 대신 등록 ════════
    R.section('1. 에이전시 — 매장 연결(수수료 10%) · 이용권 대신 등록')
    await ensureAgencyConsoleTables(DB)
    // 번호 1 은 유어딜 운영사 에이전시(직접 10% · 몫 없음 — `PLATFORM_OPERATOR_AGENCY_IDS`)라 시험 에이전시는 그 뒤 번호로 만든다.
    for (const id of PLATFORM_OPERATOR_AGENCY_IDS) insert(raw, 'agency_accounts', { id, name: `운영사-${id}`, kind: 'business', status: 'active' })
    const AGENCY = insert(raw, 'agency_accounts', { name: '시험에이전시', kind: 'individual', status: 'active' })
    const STAFF = insert(raw, 'agency_staff', { agency_id: AGENCY, email: 'agency@example.test', name: '시험담당', role: 'admin', is_owner: 1, status: 'active', tokens_valid_after: 0 })
    const aTok = (await issueAgencyStaffToken(SECRET, { id: STAFF, agency_id: AGENCY })).token
    const ownerCookie = `ur_session=${await sign({ sub: String(OWNER_USER), name: '시험사장', email: 'owner@example.test', type: 'user', isDbId: true, iat: now(), exp: now() + 3600 }, SECRET)}`
    await call('POST', '/api/agency-console/store-invite/share', aTok, { pct: 10, budget_pct: 20 })
    const mk = await call('POST', '/api/agency-console/store-invite', aTok)
    const invToken = String((mk.json.invite as { url?: string } | undefined)?.url || '').split('/').pop() || ''
    const acc = await call('POST', '/api/store-agency-invite/accept', null, { token: invToken, seller_ids: [SELLER], share_pct: 10, budget_pct: 20 }, { Cookie: ownerCookie })
    const link = q1<{ status: string }>(raw, 'SELECT status FROM agency_store_links WHERE agency_id = ? AND seller_id = ?', AGENCY, SELLER)
    R.check('사장님이 영입 링크 수락 → 연결(active)', acc.status === 200 && link?.status === 'active', `${fail(acc)} ${JSON.stringify(link)}`)
    const chAfter = q1<{ value: string }>(raw, "SELECT value FROM seller_meta WHERE seller_id = ? AND key = 'store_channel'", SELLER)?.value
    R.note(`에이전시 연결 뒤 매장의 수수료 구분: ${chAfter} (직접 10% / 중개 5%)`)
    const seat = await call('POST', `/api/agency-console/stores/${SELLER}/seat`, aTok)
    const seatTok = String((seat.data as { seller_token?: string }).seller_token || '')
    const ap = await call('POST', '/api/seller/products', seatTok, productBody('에이전시가 올린 식사 이용권', 60000))
    const APID = Number((ap.data as { id?: number }).id)
    R.check('에이전시 자리로 일반 이용권 등록', (ap.status === 201 || ap.status === 200) && APID > 0, fail(ap))
    const period = q1<{ agency_id: number; ended_at: string | null }>(raw, 'SELECT agency_id, ended_at FROM agency_product_periods WHERE product_id = ?', APID)
    R.check('그 이용권의 "맡은 기간" 이 열린다(몫 귀속의 근거)', Number(period?.agency_id) === AGENCY && period?.ended_at === null, JSON.stringify(period))
    const op = await call('POST', '/api/seller/products', sTok, productBody('사장님이 직접 올린 이용권', 60000))
    const OPID = Number((op.data as { id?: number }).id)

    // ════════ 2. 판매 → 몫 적립 ════════
    R.section('2. 판매 — 에이전시 몫 적립(설정 켬)')
    const g1 = await buyCard('G1(에이전시 이용권 · 쓸 것)', APID)
    const g2 = await buyCard('G2(에이전시 이용권 · 안 쓰고 기한 넘길 것)', APID)
    const g3 = await buyCard('G3(에이전시 이용권 · 쓸 것)', APID)
    const o1 = await buyCard('O1(사장님이 직접 올린 이용권)', OPID)
    const credits = () => q<{ id: number; order_id: number; amount: number; status: string; share_pct: number; payout_id: number | null }>(raw, 'SELECT id, order_id, amount, status, share_pct, payout_id FROM agency_share_credits ORDER BY id')
    if (g1 && g2 && g3 && o1) {
      R.note(`주문에 적힌 수수료율: 에이전시 이용권 ${g1.order.commission_rate}% · 사장님 직접 이용권 ${o1.order.commission_rate}%`)
      R.check('에이전시가 맡은 이용권 3건에만 몫 6,000원(10%)씩 붙는다 — 사장님이 직접 올린 것은 안 붙는다',
        credits().length === 3 && credits().every((c) => c.amount === 6000 && c.status === 'pending' && [g1.orderId, g2.orderId, g3.orderId].includes(c.order_id)), JSON.stringify(credits()))
      const agl = ledger().filter((l) => l.event_type === 'agency_share')
      R.check('몫은 매장 몫에서 나간다(원장: 매장 → 에이전시) — 유어딜 수입 계정은 안 움직인다',
        agl.length === 3 && agl.every((l) => l.debit_account === `seller:${SELLER}` && l.credit_account === `agencyacct:${AGENCY}` && l.amount === 6000), JSON.stringify(agl))
      const dup = await call('POST', '/api/group-buy/confirm-toss', bTok, { paymentKey: g1.paymentKey, orderId: g1.order.order_number, amount: 60000, productId: APID, qty: 1 })
      R.check('같은 결제를 한 번 더 확정해도 몫은 한 번만', credits().length === 3, fail(dup))
    }

    // ════════ 3. 사용 · 성숙 · 신청 ════════
    R.section('3. 사용 → 7일 뒤 → 에이전시 지급 신청')
    if (g1 && g2 && g3 && o1) {
      const u1 = await useVoucher(g1.v.code)
      const u2 = await useVoucher(g3.v.code)
      const u3 = await useVoucher(o1.v.code)
      R.check('G1 · G3 · O1 사용 처리 (G2 는 안 씀)', u1.status === 200 && u2.status === 200 && u3.status === 200, `${fail(u1)} ${fail(u2)} ${fail(u3)}`)
      const before = await call('GET', '/api/agency-console/payouts', aTok)
      R.note(`에이전시 정산 화면(7일 전): ${JSON.stringify(before.json.balance)}`)
      const early = await call('POST', '/api/agency-console/payouts/request', aTok)
      R.check('7일(환불 기간)이 지나기 전에는 신청할 수 없다', early.status === 400, fail(early))
      raw.exec("UPDATE agency_share_credits SET available_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')")
      const bal = await call('GET', '/api/agency-console/payouts', aTok)
      const b = bal.json.balance as { pending: number; available: number } | null
      R.note(`에이전시 정산 화면(7일 뒤): ${JSON.stringify(bal.json.balance)}`)
      R.check('7일 뒤 지급 가능 금액 = **쓴 이용권의 몫만** 12,000원 · 안 쓴 G2 의 몫 6,000원은 대기 (종전: 안 쓴 것까지 18,000원이 지급 가능)', b?.available === 12000 && b?.pending === 6000, JSON.stringify(b))
      const req = await call('POST', '/api/agency-console/payouts/request', aTok)
      const rq = req.json as { payoutId?: number; gross?: number; withholding?: number; net?: number; taxMode?: string }
      R.check('지급 신청: 12,000원 · 개인 에이전시라 3.3%(396원) 떼고 11,604원', req.status === 200 && rq.gross === 12000 && rq.withholding === 396 && rq.net === 11604 && rq.taxMode === 'withholding_3_3', fail(req))
      const req2 = await call('POST', '/api/agency-console/payouts/request', aTok)
      R.check('처리 중인 신청이 있으면 또 신청할 수 없다', req2.status === 400, fail(req2))

      // ════════ 4. 어드민 지급 ════════
      R.section('4. 어드민 — 에이전시 지급 처리')
      const lst = await call('GET', '/api/admin/agency-payouts', financeTok)
      R.note(`어드민 에이전시 지급 목록: ${lst.status} ${JSON.stringify(lst.json).slice(0, 320)}`)
      const vPaid = await call('POST', `/api/admin/agency-payouts/${rq.payoutId}/paid`, viewerTok, {})
      R.check('조회 전용(viewer) 어드민은 지급 완료를 못 누른다', vPaid.status === 403, fail(vPaid))
      const paid = await call('POST', `/api/admin/agency-payouts/${rq.payoutId}/paid`, financeTok, { memo: '시험 송금' })
      const pr = q1<{ status: string; net_amount: number }>(raw, 'SELECT status, net_amount FROM agency_share_payouts WHERE id = ?', rq.payoutId)
      R.check('정산 담당이 송금 완료 처리 → 신청과 묶인 몫(G1·G3)이 paid · G2 의 몫은 그대로 대기', paid.status === 200 && pr?.status === 'paid' && credits().filter((c) => c.status === 'paid').length === 2 && credits().find((c) => c.order_id === g2.orderId)?.status === 'pending', `${fail(paid)} ${JSON.stringify(pr)} ${JSON.stringify(credits())}`)
      const paid2 = await call('POST', `/api/admin/agency-payouts/${rq.payoutId}/paid`, financeTok, {})
      R.check('같은 지급을 두 번 눌러도 한 번만', paid2.status >= 400, fail(paid2))
      const kstMonth = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)
      const acctCsv = await call('GET', `/api/admin/tax/monthly-accounting?month=${kstMonth}`, financeTok)
      const whtLine = acctCsv.text.split('\r\n').find((l) => l.includes('원천징수 총계')) || ''
      R.check('월별 회계 자료의 원천징수 합계에 에이전시 지급의 396원이 들어간다(종전: 빠짐)', whtLine.includes('"396"'), `${acctCsv.status} ${whtLine}`)

      // ════════ 5. 지급 뒤 환불 ════════
      R.section('5. 지급된 뒤 — 안 쓴 이용권(G2)이 기한 만료로 환불될 때')
      raw.prepare("UPDATE vouchers SET expires_at = datetime('now', '-2 days') WHERE id = ?").run(g2.v.id)
      await handleExpiredVoucherRefunds(env as never)
      const v2 = voucherByOrder(g2.orderId)[0]
      const cancels = out.toss.filter((t) => t.kind === 'cancel' && t.paymentKey === g2.paymentKey)
      R.check('G2: 기한 만료 → 손님에게 카드 60,000원 전액 환불', v2.refund_status === 'refunded' && cancels.length === 1, `${JSON.stringify(v2)} ${JSON.stringify(cancels)}`)
      const c2 = credits().find((c) => c.order_id === g2.orderId)
      R.check('G2 의 에이전시 몫 6,000원은 지급 전이라 회수된다(원장 역전 1건)', c2?.status === 'clawed_back' && c2.amount === 0 && ledger().filter((l) => l.event_type === 'agency_share_reversal' && l.amount === 6000).length === 1, `${JSON.stringify(c2)} · 역전 ${ledger().filter((l) => l.event_type === 'agency_share_reversal').length}건`)
      R.note(`원장 순액 — 매장(seller) ${acctNet(`seller:${SELLER}`)} · 매장(merchant) ${acctNet(`merchant:${SELLER}`)} · 에이전시 ${acctNet(`agencyacct:${AGENCY}`)} · 유어딜 수입 ${acctNet('platform:revenue')} · 보관금 ${acctNet('platform:escrow')}`)
      // 실제 돈: 손님 180,000 결제 − 60,000 환불 = 120,000 이 유어딜 통장에 있다. 나갈 돈 = 매장 지급 + 에이전시 지급(이미 12,000 신청분).
      raw.exec("UPDATE ledger_entries SET created_at = datetime('now', '-20 days')")
      const gen = await handlePayoutsGenerate(env as never)
      const storePayout = q1<{ id: number; amount: number; status: string }>(raw, "SELECT id, amount, status FROM payouts WHERE payee_type IN ('store_owner','seller') AND payee_id = ?", String(SELLER))
      R.note(`주간 지급 생성: ${JSON.stringify(gen).slice(0, 200)} → 매장 지급 ${JSON.stringify(storePayout)}`)
      const merchantIn = ledger().filter((l) => l.credit_account === `merchant:${SELLER}`).reduce((n, l) => n + l.amount, 0)
      R.check('환불된 G2 의 에이전시 몫은 매장이 물지 않는다 — 매장 지급 150,000원 = 번 돈 162,000 − 쓴 이용권의 몫 12,000', !!storePayout && merchantIn === 162000 && storePayout.amount === 150000,
        `매장 지급 ${storePayout?.amount} · 번 돈 ${merchantIn}`)
      R.check('돈이 맞는다: 손님 결제 240,000 − 환불 60,000 = 매장 150,000 + 에이전시 12,000 + 유어딜 18,000', acctNet('platform:revenue') === 18000 && acctNet('platform:escrow') === 0, `유어딜 수입 ${acctNet('platform:revenue')} · 보관금 ${acctNet('platform:escrow')}`)

      // ════════ 6. 매장 지급 한 주기 ════════
      R.section('6. 매장 주간 지급 — 승인 → 송금 완료 → 다음 주')
      if (storePayout) {
        const appr = await call('PATCH', `/api/admin/payouts/${storePayout.id}/approve`, financeTok, {})
        R.check('정산 담당 승인', appr.status === 200, fail(appr))
        const sent = await call('PATCH', `/api/admin/payouts/${storePayout.id}/sent`, financeTok, { transaction_id: 'BANK-CYCLE-1' })
        const st = q1<{ status: string }>(raw, 'SELECT status FROM payouts WHERE id = ?', storePayout.id)?.status
        R.check('송금 완료 기록', sent.status === 200 && st === 'sent', `${fail(sent)} ${st}`)
        const sv = await call('GET', '/api/seller/payouts', sTok)
        R.note(`사장님 정산 화면(송금 뒤): ${JSON.stringify(sv.data).slice(0, 320)}`)
        const before2 = q<{ id: number }>(raw, 'SELECT id FROM payouts').length
        const gen2 = await handlePayoutsGenerate(env as never)
        const after2 = q<{ id: number; amount: number; status: string }>(raw, 'SELECT id, amount, status FROM payouts ORDER BY id')
        R.check('다음 실행에서 같은 돈이 또 지급 대상으로 잡히지 않는다', after2.length === before2, `${JSON.stringify(gen2).slice(0, 160)} ${JSON.stringify(after2)}`)
      }
    }

    // ════════ 7. 인플루언서 현금 지급 ════════
    R.section('7. 인플루언서 — 소개비 현금 지급(3.3%)')
    const prop = await call('POST', '/api/seller-marketing/deals/propose', sTok, { influencer_id: String(INFL), commission_pct: 10 })
    const dealId = Number((prop.data as { id?: number }).id ?? q1<{ id: number }>(raw, 'SELECT id FROM seller_influencer_deals ORDER BY id DESC LIMIT 1')?.id)
    await call('POST', `/api/influencer-settlement/deals/${dealId}/respond`, iTok, { action: 'accept' })
    const i1 = await buyCard('I1(소개 링크로 구매 60,000원)', OPID, String(INFL))
    if (i1) {
      await useVoucher(i1.v.code)
      raw.exec("UPDATE influencer_attributions SET available_at = datetime('now', '-2 days')")
      await handleInfluencerPayout(env as never).catch((e: unknown) => R.note(`성숙 cron 예외: ${String(e).slice(0, 160)}`))
      const bal = () => q1<{ available_amount: number; payout_method: string | null; bank_account: string | null; total_paid_out: number | null }>(raw, 'SELECT available_amount, payout_method, bank_account, total_paid_out FROM influencer_balances WHERE influencer_id = ?', String(INFL))
      R.check('소개비 6,000원이 지급 가능으로', bal()?.available_amount === 6000, JSON.stringify(bal()))
      const lst = await call('GET', '/api/admin-payouts/payouts', financeTok)
      const inList = ((lst.data as { list?: Array<{ influencer_id: string }> }).list || []).some((x) => String(x.influencer_id) === String(INFL))
      R.check('현금 최소 100,000원 미만이라 어드민 지급 목록에는 안 뜬다', lst.status === 200 && !inList, fail(lst))
      R.note(`이 인플루언서의 수령 설정: 방식 ${bal()?.payout_method ?? '(없음)'} · 계좌 ${bal()?.bank_account ? '있음' : '없음'}`)
      const noMethod = await call('POST', '/api/admin-payouts/payouts/process', financeTok, { influencer_id: String(INFL) })
      R.check('지급 방식을 안 보내면 처리하지 않는다(종전: 현금으로 처리)', noMethod.status === 400 && bal()?.available_amount === 6000, `${fail(noMethod)} ${JSON.stringify(bal())}`)
      const noAcct = await call('POST', '/api/admin-payouts/payouts/process', financeTok, { influencer_id: String(INFL), method: 'cash' })
      R.check('받을 계좌가 없으면 현금 지급 완료로 처리할 수 없다 — 잔액이 그대로다(종전: 0 으로 밀림)', noAcct.status === 409 && noAcct.json.code === 'PAYOUT_NO_ACCOUNT' && bal()?.available_amount === 6000, `${fail(noAcct)} ${JSON.stringify(bal())}`)
      const taxType = q1<{ tax_type: string | null }>(raw, 'SELECT tax_type FROM influencer_balances WHERE influencer_id = ?', String(INFL))?.tax_type
      R.check('설정한 적 없는 인플루언서의 세금 종류는 사업소득(3.3%)으로 잡힌다(종전: 표 기본값 기타소득 8.8%)', taxType === 'business_income', String(taxType))
      const setAcct = await call('PUT', '/api/influencer-settlement/me', iTok, { bank_name: '국민', bank_account: '123-45-678901', account_holder: '시험소개', payout_method: 'cash' })
      R.check('인플루언서가 받을 계좌 등록', setAcct.status === 200, fail(setAcct))
      // 🪪 2026-11-25 — 사업자번호 없는 개인은 주민등록번호(간이지급명세서)가 있어야 현금으로 보낸다.
      const noTaxId = await call('POST', '/api/admin-payouts/payouts/process', financeTok, { influencer_id: String(INFL), method: 'cash' })
      R.check('주민등록번호가 없으면 현금 지급 완료로 처리할 수 없다 — 잔액이 그대로다', noTaxId.status === 409 && noTaxId.json.code === 'PAYOUT_NO_TAX_ID' && bal()?.available_amount === 6000, `${fail(noTaxId)} ${JSON.stringify(bal())}`)
      const setTax = await call('PUT', '/api/influencer-settlement/tax-id', iTok, { legal_name: '시험소개', rrn: '900101-1234567' })
      R.check('인플루언서가 주민등록번호 등록(암호화 저장)', setTax.status === 200 && !JSON.stringify(q1(raw, 'SELECT rrn_enc FROM payee_tax_ids')).includes('1234567'), fail(setTax))
      const pay = await call('POST', '/api/admin-payouts/payouts/process', financeTok, { influencer_id: String(INFL), method: 'cash' })
      const cash = pay.json.cash as { gross: number; withholding: number; net: number } | undefined
      R.check('현금 지급: 6,000원에서 3.3%(198원) 떼고 5,802원을 보내라고 알려준다', pay.status === 200 && cash?.gross === 6000 && cash.withholding === 198 && cash.net === 5802 && bal()?.available_amount === 0, `${fail(pay)} ${JSON.stringify(bal())}`)
      const wlog = q<{ withholding_amount: number; net_amount: number }>(raw, 'SELECT withholding_amount, net_amount FROM influencer_withholding_log')
      R.check('뗀 세금이 원천징수 장부에 남는다', wlog.length === 1 && wlog[0].withholding_amount === 198 && wlog[0].net_amount === 5802, JSON.stringify(wlog))
      const again = await call('POST', '/api/admin-payouts/payouts/process', financeTok, { influencer_id: String(INFL), method: 'cash' })
      R.check('같은 지급을 두 번 눌러도 한 번만', again.status >= 400 && wlog.length === 1, fail(again))
    }

    if (OUT) writeFileSync(OUT, R.lines.join('\n') + '\n')
    out.restore()
    expect(R.lines.filter((l) => l.startsWith('- ✅')).length, '확인 항목이 줄었다 — 흐름이 중간에 끊겼다').toBeGreaterThanOrEqual(30)
    expect(R.fails, R.fails.join('\n')).toEqual([])
  }, 120_000)
})
