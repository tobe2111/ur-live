/**
 * 🏦 계좌 없이 만들어진 지급 건은 매장이 계좌를 등록하면 그대로 나갈 수 있다 (2026-11-25 대표 *"끝까지 다 고쳐줘"*)
 *
 * 주간 생성은 계좌가 없는 매장에도 지급 건을 만든다. 그 행에는 만들 때의 빈 계좌가 박히고 고치는 코드가 없어서,
 * 사장님이 계좌를 등록해도 승인은 통과 · 송금 기록은 영영 `PAYOUT_NO_ACCOUNT` 였다(취소 후 다음 주 재생성뿐).
 * 계좌 안내 알림은 "등록하면 다음 정산일에 보내 드려요" 라고 말하고 있었다. 실제 라우트로 본다.
 *
 * 함께 본다: 토스 지급대행이 이미 돈을 보낸 뒤의 기록(`moneyAlreadyOut`)은 계좌 검사에 막히지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { d1, openLiveSchema, insert, q1, makeCtx, SECRET } from '../helpers/live-d1'
import { adminPayoutsRoutes } from '@/features/admin/api/admin-payouts.routes'
import { markPayoutSent } from '@/worker/utils/payout-sent'

const now = () => Math.floor(Date.now() / 1000)

async function setup() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  const env = { DB, JWT_SECRET: SECRET, ENVIRONMENT: 'development' } as Record<string, unknown>
  const app = new Hono()
  app.route('/api', adminPayoutsRoutes)
  const adminId = insert(raw, 'admins', { username: 'fin', email: 'fin@example.test', password_hash: 'x', name: 'fin', role: 'finance' })
  const tok = await sign({ type: 'admin', sub: String(adminId), admin_id: adminId, userId: adminId, role: 'finance', iat: now(), exp: now() + 3600 }, SECRET)
  const call = async (method: string, path: string, body?: unknown) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const res = await app.request(path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 noacct' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx)
    await drain()
    const text = await res.text()
    let data: unknown = text
    try { data = JSON.parse(text) } catch { /* csv */ }
    return { status: res.status, data: data as { success?: boolean; code?: string; data?: Record<string, unknown> }, text }
  }
  // 계좌 없는 매장 + 받을 돈 12,000 + 계좌 없이 만들어진 지급 건
  const seller = insert(raw, 'sellers', { username: 'noacct', email: 'n@example.test', business_name: '계좌없는매장', status: 'approved', is_verified: 1 })
  raw.prepare("UPDATE sellers SET bank_name = NULL, bank_account = NULL, account_holder = NULL WHERE id = ?").run(seller)
  insert(raw, 'ledger_entries', { event_type: 'voucher_used', reference_id: `v-${seller}`, amount: 12_000, fee_amount: 0, debit_account: 'platform:escrow', credit_account: `merchant:${seller}` })
  const payout = insert(raw, 'payouts', { payee_type: 'store_owner', payee_id: String(seller), amount: 12_000, status: 'pending', period_start: '2026-11-09', period_end: '2026-11-15' })
  raw.prepare('UPDATE payouts SET bank_name = NULL, account_number = NULL, account_holder = NULL WHERE id = ?').run(payout)
  const row = () => q1<{ status: string; bank_name: string | null; account_number: string | null; account_holder: string | null }>(raw, 'SELECT status, bank_name, account_number, account_holder FROM payouts WHERE id = ?', payout)!
  const registerAccount = () => raw.prepare("UPDATE sellers SET bank_name = '국민', bank_account = '111-22-333333', account_holder = '시험', is_verified = 1 WHERE id = ?").run(seller)
  return { raw, DB, call, seller, payout, row, registerAccount }
}

describe('계좌 없이 만들어진 지급 건', () => {
  it('계좌가 없는 동안에는 승인되지 않는다 (건별 · 일괄) — 승인해도 보낼 수 없는 건이다', async () => {
    const t = await setup()
    const one = await t.call('PATCH', `/api/admin/payouts/${t.payout}/approve`, {})
    expect([one.status, one.data.code]).toEqual([409, 'PAYOUT_NO_ACCOUNT'])
    const bulk = await t.call('PATCH', '/api/admin/payouts/bulk-approve', { ids: [t.payout] })
    expect((bulk.data.data?.blocked as Array<{ code: string }>).map((b) => b.code)).toEqual(['PAYOUT_NO_ACCOUNT'])
    expect(t.row().status).toBe('pending')
  })

  it('매장이 계좌를 등록하면 그 건이 지금 계좌로 채워져 승인 → 송금 완료까지 간다 (취소·재생성 없이)', async () => {
    const t = await setup()
    t.registerAccount()
    const ok = await t.call('PATCH', `/api/admin/payouts/${t.payout}/approve`, {})
    expect(ok.status).toBe(200)
    expect(t.row()).toEqual({ status: 'approved', bank_name: '국민', account_number: '111-22-333333', account_holder: '시험' })
    const sent = await t.call('PATCH', `/api/admin/payouts/${t.payout}/sent`, { transaction_id: 'BANK-9' })
    expect([sent.status, t.row().status]).toEqual([200, 'sent'])
  })

  it('이체 파일도 계좌를 채운 뒤 싣는다', async () => {
    const t = await setup()
    const before = await t.call('GET', '/api/admin/payouts/transfer-csv?status=pending')
    expect(before.text).not.toContain(`유어딜정산-${t.payout}`)
    t.registerAccount()
    const after = await t.call('GET', '/api/admin/payouts/transfer-csv?status=pending')
    expect(after.text).toContain(`유어딜정산-${t.payout}`)
    expect(after.text).toContain('111-22-333333')
  })

  it('계좌를 바꾼 뒤 재확인 전이면 채우지 않는다', async () => {
    const t = await setup()
    t.raw.prepare("UPDATE sellers SET bank_name = '국민', bank_account = '999-00-000000', account_holder = '시험', is_verified = 0 WHERE id = ?").run(t.seller)
    const r = await t.call('PATCH', `/api/admin/payouts/${t.payout}/approve`, {})
    expect([r.status, r.data.code, t.row().account_number]).toEqual([409, 'PAYOUT_NO_ACCOUNT', null])
  })

  it('토스가 이미 보낸 돈의 기록은 계좌 검사에 막히지 않는다', async () => {
    const t = await setup()
    t.raw.prepare("UPDATE payouts SET status = 'approved' WHERE id = ?").run(t.payout)
    const blocked = await markPayoutSent(t.DB, t.payout, 'manual-1')
    expect([blocked.ok, blocked.code]).toEqual([false, 'PAYOUT_NO_ACCOUNT'])
    const done = await markPayoutSent(t.DB, t.payout, 'toss:abc', '토스 지급대행 완료', { moneyAlreadyOut: true })
    expect([done.ok, t.row().status]).toEqual([true, 'sent'])
  })
})
