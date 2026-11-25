/**
 * 🔔 알림 — 가야 할 사람에게 안 가거나, 사실과 다른 말을 하던 것 (2026-11-25 대표 *"나머지 빠짐없이 모두 해줘야지."*)
 *
 *   ① 정산 송금 완료 알림톡이 매장 **대표번호(유선)** 로 가서 조용히 건너뛰어졌다. 일괄 완료는 아무에게도 안 알렸다.
 *   ② 어드민 알림 중 받는 사람이 `'all'` 로 적힌 것(인플루언서·에이전시 지급 대기, 인플루언서 분쟁)은 조회 조건에 안 걸려 아무도 못 봤다.
 *   ③ 만료 자동 환불의 카드 취소가 실패하면 로그 한 줄뿐이었다(손님은 환불을 못 받고 어드민도 모른다).
 *   ④ 문구: "매주 자동으로 정산돼요" · 교환권에 "매장에서 QR" · 숙소 이용권에 일반 만료 안내 · "바우처"·"공동구매 참여 영수증".
 * 실제 라우트·cron 을 라이브 구조 DB 위에서 돌린다. 알림톡 발송 함수만 가로채 누구에게 갔는지 본다.
 * 못 보는 것: 카카오 승인 목록(`alimtalk_approved_templates`)에 없는 템플릿은 여전히 안 나간다 — 라이브에 승인된 것은 7종이다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q, makeCtx, stubOutbound, SECRET } from '../helpers/live-d1'
import { stripComments } from '../helpers/source-text'

const sent: Array<{ phone: string; tpl: string; text: string }> = []
vi.mock('@/lib/system-alimtalk', () => ({
  sendSystemAlimtalk: async (_env: unknown, phone: string, tpl: string, text: string) => { sent.push({ phone, tpl, text }); return { ok: true } },
}))

import { notifyPayoutSent } from '@/worker/utils/payout-sent-notify'
import { adminPayoutsRoutes } from '@/features/admin/api/admin-payouts.routes'
import { dashboardNotificationsRoutes } from '@/features/notifications/api/dashboard-notifications.routes'
import { bankNudgeMessage } from '@/worker/utils/bank-missing'
import { handleExpiredVoucherRefunds } from '@/worker/cron/auto-settlement'
import { setSellerMeta } from '@/worker/utils/seller-meta'

const now = () => Math.floor(Date.now() / 1000)
const adminTok = (id: number, role: string) => sign({ type: 'admin', sub: String(id), admin_id: id, userId: id, role, iat: now(), exp: now() + 3600 }, SECRET)
beforeEach(() => { sent.length = 0 })

async function world() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  const env = { DB, JWT_SECRET: SECRET, TOSS_SECRET_KEY: 'test_sk_local', ENVIRONMENT: 'development' } as Record<string, unknown>
  let acctN = 0
  const store = async (managerPhone: string | null) => {
    const id = insert(raw, 'sellers', { username: `s${Math.random().toString(36).slice(2, 8)}`, email: `${Math.random().toString(36).slice(2, 8)}@example.test`, password_hash: '', name: '사장', business_name: '시험식당', status: 'approved', phone: '02-123-4567', bank_name: '국민', bank_account: `111-22-33333${++acctN}`, account_holder: '사장', is_verified: 1 })
    if (managerPhone) await setSellerMeta(DB, id, { manager_phone: managerPhone })
    return id
  }
  const bells = (sellerId: number) => q<{ type: string; title: string }>(raw, "SELECT type, title FROM dashboard_notifications WHERE recipient_type = 'seller' AND recipient_id = ?", String(sellerId))
  return { raw, DB, env, store, bells }
}

describe('① 정산 송금 완료 — 담당자 휴대폰으로, 번호가 없어도 알림함에는', () => {
  it('매장 대표번호가 유선이어도 담당자 휴대폰으로 알림톡이 간다 · 계좌는 끝 4자리만', async () => {
    const { DB, env, store, bells } = await world()
    const S = await store('010-9876-5432')
    const r = await notifyPayoutSent(env, DB, { payee_type: 'store_owner', payee_id: S, amount: 150000, bank_name: '국민', account_number: '111-22-333333' }, 'BANK-1')
    expect(r).toEqual({ alimtalk: true, bell: true })
    expect(sent).toHaveLength(1)
    expect(sent[0].phone).toBe('01098765432')
    expect(sent[0].tpl).toBe('payout_completed')
    expect(sent[0].text).toContain('150,000원')
    expect(sent[0].text).toContain('****3333')
    expect(sent[0].text).not.toContain('111-22')
    expect(bells(S).map((b) => b.type)).toEqual(['payout_sent'])
  })
  it('휴대폰이 없으면 유선 번호로 보내지 않는다 — 대신 사장님 알림함에 남는다', async () => {
    const { DB, env, store, bells } = await world()
    const S = await store(null)
    const r = await notifyPayoutSent(env, DB, { payee_type: 'store_owner', payee_id: S, amount: 20000, bank_name: '국민', account_number: '111-22-333333' }, 'BANK-2')
    expect(r).toEqual({ alimtalk: false, bell: true })
    expect(sent).toHaveLength(0)
    expect(bells(S)).toHaveLength(1)
  })
  it('일괄 송금 완료도 건마다 알린다(종전: 아무에게도 안 알렸다)', async () => {
    const { raw, DB, env, store, bells } = await world()
    const A = await store('01011112222'), B = await store('01033334444')
    const pay = (s: number, amount: number) => {
      insert(raw, 'ledger_entries', { event_type: 'voucher_used', reference_id: `v-${s}`, amount, fee_amount: 0, debit_account: 'platform:escrow', credit_account: `merchant:${s}` })
      return insert(raw, 'payouts', { payee_type: 'store_owner', payee_id: String(s), amount, status: 'approved', bank_name: '국민', account_number: String(q<{ bank_account: string }>(raw, 'SELECT bank_account FROM sellers WHERE id = ?', s)[0].bank_account), account_holder: '사장', period_start: '2026-11-09', period_end: '2026-11-15' })
    }
    const p1 = pay(A, 30000), p2 = pay(B, 40000)
    const fin = insert(raw, 'admins', { username: 'fin', email: 'fin@example.test', password_hash: 'x', name: 'fin', role: 'finance' })
    const app = new Hono(); app.route('/api', adminPayoutsRoutes)
    const { ctx, drain } = makeCtx()
    const res = await app.request('/api/admin/payouts/bulk-sent', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminTok(fin, 'finance')}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 notif' }, body: JSON.stringify({ ids: [p1, p2], transaction_id: 'FILE-7' }) }, env, ctx)
    await drain()
    const bodyText = await res.text()
    expect(res.status, bodyText).toBe(200)
    expect(sent.map((x) => x.phone).sort(), bodyText).toEqual(['01011112222', '01033334444'])
    expect(bells(A)).toHaveLength(1)
    expect(bells(B)).toHaveLength(1)
    void DB
  })
})

describe("② 어드민 알림 — 받는 사람이 'all' 로 적힌 것도 보인다", () => {
  it('인플루언서 지급 대기 알림이 어드민 목록에 뜬다', async () => {
    const { raw, env } = await world()
    const adm = insert(raw, 'admins', { username: 'sup', email: 'sup@example.test', password_hash: 'x', name: 'sup', role: 'super_admin' })
    insert(raw, 'dashboard_notifications', { recipient_type: 'admin', recipient_id: 'all', type: 'influencer_payout_pending', title: '인플루언서 지급 대기 3건', is_read: 0 })
    insert(raw, 'dashboard_notifications', { recipient_type: 'admin', recipient_id: '999', type: 'other_admin_only', title: '다른 어드민 것', is_read: 0 })
    const app = new Hono(); app.route('/api/dashboard-notifications', dashboardNotificationsRoutes)
    const { ctx, drain } = makeCtx()
    const res = await app.request('/api/dashboard-notifications?limit=30', { headers: { Authorization: `Bearer ${await adminTok(adm, 'super_admin')}`, 'User-Agent': 'Mozilla/5.0 notif' } }, env, ctx)
    await drain()
    const text = await res.text()
    expect(res.status, text.slice(0, 200)).toBe(200)
    expect(text).toContain('인플루언서 지급 대기 3건')
    expect(text).not.toContain('다른 어드민 것')
  })
})

describe('③ 만료 자동 환불 — 카드 취소가 실패하면 어드민이 안다', () => {
  it('실패 한 건이 어드민 알림(refund_failed)으로 올라간다', async () => {
    const { raw, env } = await world()
    const U = insert(raw, 'users', { name: '손님', email: 'u@example.test' })
    const S = insert(raw, 'sellers', { username: 'st', email: 'st@example.test', password_hash: '', name: '사장', business_name: '시험식당', status: 'approved' })
    const P = insert(raw, 'products', { seller_id: S, name: '시험 이용권', price: 10000, stock: 10, is_active: 1, category: 'meal_voucher', group_buy_status: 'active', deal_only: 0 })
    const O = insert(raw, 'orders', { order_number: 'GB-1-1', user_id: String(U), seller_id: S, status: 'PREPARING', total_amount: 10000, payment_method: 'toss', payment_key: 'pk_fail_1' })
    insert(raw, 'vouchers', { code: '111111', order_id: O, product_id: P, user_id: String(U), status: 'unused', applied_price: 10000, expires_at: '2026-01-01 00:00:00' })
    const out = stubOutbound()
    const inner = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (/tosspayments\.com\/v1\/payments\/.+\/cancel$/.test(url)) return new Response(JSON.stringify({ code: 'NOT_CANCELABLE_PAYMENT', message: '취소할 수 없는 결제' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      return inner(input as never, init)
    }) as typeof fetch
    await handleExpiredVoucherRefunds(env as never).catch(() => undefined)
    out.restore()
    const alerts = q<{ type: string; title: string; message: string }>(raw, "SELECT type, title, message FROM dashboard_notifications WHERE recipient_type = 'admin'")
    expect(alerts.map((a) => a.type), JSON.stringify(q(raw, 'SELECT status, refund_status FROM vouchers'))).toContain('refund_failed')
    expect(alerts.find((a) => a.type === 'refund_failed')?.message).toContain('10,000원')
  })
})

describe('④ 문구 — 지금 사실과 같은 말만', () => {
  it('계좌 등록 안내가 "매주 자동으로 정산" 을 약속하지 않는다', () => {
    const m = bankNudgeMessage({ seller_id: 1, waiting: 0 } as never)
    expect(m.message).not.toContain('매주 자동')
    expect(m.message).toContain('계좌')
  })
  it('카드로 산 교환권에는 "매장에서 QR" 알림톡을 보내지 않는다(딜 경로와 같은 조건)', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8'))
    expect(src.split(".deal_only) !== 1").length - 1).toBeGreaterThanOrEqual(2)
    expect(src).not.toMatch(/if \(userRow\?\.phone\) \{\s*await sendBuyerVoucherIssuedAlimtalk/)
  })
  it('일반 만료 알림 세 곳이 숙소 이용권을 뺀다 · 숙소 알림은 환불되지 않는다고 말한다', () => {
    const a = readFileSync('src/worker/cron/voucher-expire.ts', 'utf8')
    const b = readFileSync('src/worker/cron/scheduled-cleanup.ts', 'utf8')
    expect(a).toContain('v.stay_booking_id IS NULL')
    expect(b.split("AND v.stay_booking_id IS NULL AND (p.kt_alpha_gift_code IS NULL OR p.kt_alpha_gift_code = '')").length - 1).toBe(2)
    expect(readFileSync('src/worker/cron/stay-voucher-expire.ts', 'utf8')).toContain('환불되지 않습니다')
  })
  it('손님에게 가는 글에 "바우처"·"공동구매 참여 영수증"·"공구 참여 완료" 가 없다', () => {
    expect(stripComments(readFileSync('src/worker/cron/auto-settlement.ts', 'utf8'))).not.toMatch(/'바우처 만료 환불'|`바우처가 만료되어/)
    const gb = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
    expect(gb).not.toContain('공동구매 참여 영수증')
    expect(gb).not.toContain('공구 참여 완료')
  })
})
