/**
 * 💸 지급이 받을 돈보다 크면 어느 길로도 나가지 않는다 (2026-11-25 대표 *"그래서 찾은 에러들은?"*)
 *
 * 지급 대상(`payouts`)은 만들어진 시점의 금액이다. 그 뒤 환불로 매장의 받을 돈(원장 순액)이 줄면
 * 그 지급은 초과 지급이 된다. 건별 승인에는 2026-07-01 부터 이걸 막는 검사가 있었는데,
 * **일괄 승인**과 **승인 없이 바로 '송금 완료'**, **이체 파일(대기 건)** 세 길은 그 검사를 지나지 않았다.
 * 실제 라우트를 라이브 구조 DB 위에서 돌려 세 길이 모두 막히는지 본다.
 *
 * 이 시험이 못 막는 것: 토스 지급대행이 실제로 돈을 보낸 뒤의 기록(`syncTossPayout`)은 이 검사를 건너뛴다.
 * 돈이 이미 나간 사실을 적지 않으면 더 위험하기 때문이다(그 길은 요청 전에 승인을 거친다).
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { d1, openLiveSchema, insert, q1, makeCtx, SECRET } from '../helpers/live-d1'
import { adminPayoutsRoutes } from '@/features/admin/api/admin-payouts.routes'

const now = () => Math.floor(Date.now() / 1000)

async function setup() {
  const raw = openLiveSchema()
  const env = { DB: d1(raw), JWT_SECRET: SECRET, ENVIRONMENT: 'development' } as Record<string, unknown>
  const app = new Hono()
  app.route('/api', adminPayoutsRoutes)
  const adminId = insert(raw, 'admins', { username: 'fin', email: 'fin@example.test', password_hash: 'x', name: 'fin', role: 'finance' })
  const tok = await sign({ type: 'admin', sub: String(adminId), admin_id: adminId, userId: adminId, role: 'finance', iat: now(), exp: now() + 3600 }, SECRET)
  const call = async (method: string, path: string, body?: unknown) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const res = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 payoutguard' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx)
    await drain()
    const text = await res.text()
    let data: unknown = text
    try { data = JSON.parse(text) } catch { /* csv */ }
    return { status: res.status, data: data as { success?: boolean; code?: string; data?: Record<string, unknown> }, text, headers: res.headers }
  }
  /** 매장 하나: 받을 돈 `credit`, 그 금액의 대기 지급, 그 뒤 환불 `refund`. */
  const store = (credit: number, refund: number) => {
    const seller = insert(raw, 'sellers', {
      username: `s${Math.random().toString(36).slice(2, 8)}`, email: `${Math.random().toString(36).slice(2, 8)}@example.test`,
      business_name: '시험매장', status: 'approved', bank_name: '국민', bank_account: '111-22-333333', account_holder: '시험', is_verified: 1,
    })
    insert(raw, 'ledger_entries', { event_type: 'voucher_used', reference_id: `v-${seller}`, amount: credit, fee_amount: 0, debit_account: 'platform:escrow', credit_account: `merchant:${seller}` })
    const payout = insert(raw, 'payouts', {
      payee_type: 'store_owner', payee_id: String(seller), amount: credit, status: 'pending',
      bank_name: '국민', account_number: '111-22-333333', account_holder: '시험', period_start: '2026-11-09', period_end: '2026-11-15',
    })
    if (refund > 0) insert(raw, 'ledger_entries', { event_type: 'voucher_refund', reference_id: `r-${seller}`, amount: refund, fee_amount: 0, debit_account: `merchant:${seller}`, credit_account: 'platform:escrow' })
    return { seller, payout }
  }
  const status = (id: number) => q1<{ status: string }>(raw, 'SELECT status FROM payouts WHERE id = ?', id)?.status
  return { raw, call, store, status }
}

describe('지급 금액이 받을 돈을 넘으면 — 승인 · 송금 완료 · 이체 파일 어느 길도 통과시키지 않는다', () => {
  it('건별 승인은 막는다 (종전부터)', async () => {
    const { call, store, status } = await setup()
    const { payout } = store(10_000, 4_000)
    const r = await call('PATCH', `/api/admin/payouts/${payout}/approve`, {})
    expect(r.status).toBe(409)
    expect(r.data.code).toBe('PAYOUT_EXCEEDS_RECEIVABLE')
    expect(status(payout)).toBe('pending')
  })

  it('같은 매장의 다른 지급이 이미 승인돼 있으면 그만큼을 뺀 나머지까지만 승인된다 (건별 · 일괄)', async () => {
    const { raw, call, store, status } = await setup()
    const a = store(10_000, 0)
    raw.prepare("UPDATE payouts SET amount = 6000, status = 'approved' WHERE id = ?").run(a.payout)
    const second = insert(raw, 'payouts', {
      payee_type: 'store_owner', payee_id: String(a.seller), amount: 6000, status: 'pending',
      bank_name: '국민', account_number: '111-22-333333', account_holder: '시험', period_start: '2026-11-16', period_end: '2026-11-22',
    })
    const one = await call('PATCH', `/api/admin/payouts/${second}/approve`, {})
    expect([one.status, one.data.code]).toEqual([409, 'PAYOUT_EXCEEDS_RECEIVABLE'])
    const bulk = await call('PATCH', '/api/admin/payouts/bulk-approve', { ids: [second] })
    expect(bulk.data.data?.approved).toBe(0)
    expect(status(second)).toBe('pending')
    raw.prepare('UPDATE payouts SET amount = 4000 WHERE id = ?').run(second)
    const ok = await call('PATCH', `/api/admin/payouts/${second}/approve`, {})
    expect(ok.status).toBe(200)
    expect(status(second)).toBe('approved')
  })

  it('일괄 승인도 막는다 — 막힌 건은 blocked 로 돌려준다', async () => {
    const { call, store, status } = await setup()
    const over = store(10_000, 4_000)
    const fine = store(8_000, 0)
    const r = await call('PATCH', '/api/admin/payouts/bulk-approve', { ids: [over.payout, fine.payout] })
    expect(r.status).toBe(200)
    expect(status(over.payout)).toBe('pending')
    expect(status(fine.payout)).toBe('approved')
    const blocked = (r.data.data?.blocked ?? []) as Array<{ id: number; code: string }>
    expect(blocked.map((b) => [b.id, b.code])).toEqual([[over.payout, 'PAYOUT_EXCEEDS_RECEIVABLE']])
    expect(r.data.data?.approved).toBe(1)
  })

  it("승인을 안 거친 건을 바로 '송금 완료' 로 적을 수 없다 (단건 · 일괄)", async () => {
    const { call, store, status } = await setup()
    const over = store(10_000, 4_000)
    const one = await call('PATCH', `/api/admin/payouts/${over.payout}/sent`, { transaction_id: 'BANK-1' })
    expect(one.status).toBe(409)
    expect(one.data.code).toBe('PAYOUT_EXCEEDS_RECEIVABLE')
    expect(status(over.payout)).toBe('pending')
    const bulk = await call('PATCH', '/api/admin/payouts/bulk-sent', { ids: [over.payout], transaction_id: 'BANK-2' })
    expect(bulk.data.data?.sent).toBe(0)
    expect(status(over.payout)).toBe('pending')
  })

  it('받을 돈 안의 지급은 종전대로 통과한다 (대기 → 송금 완료 간편 경로 유지)', async () => {
    const { call, store, status } = await setup()
    const fine = store(8_000, 0)
    const r = await call('PATCH', `/api/admin/payouts/${fine.payout}/sent`, { transaction_id: 'BANK-3' })
    expect(r.status).toBe(200)
    expect(status(fine.payout)).toBe('sent')
  })

  it('은행 이체 파일에 초과 건을 싣지 않는다 — 파일에 실리면 은행이 그대로 보낸다', async () => {
    const { call, store } = await setup()
    const over = store(10_000, 4_000)
    const fine = store(8_000, 0)
    const r = await call('GET', '/api/admin/payouts/transfer-csv?status=pending')
    expect(r.status).toBe(200)
    expect(r.text).toContain(`유어딜정산-${fine.payout}`)
    expect(r.text).not.toContain(`유어딜정산-${over.payout}`)
    expect(r.headers.get('X-Blocked-Count')).toBe('1')
  })
})
