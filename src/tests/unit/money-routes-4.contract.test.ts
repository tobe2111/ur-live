import { describe, it, expect } from 'vitest'
import { ordersRouter } from '@/worker/routes/order.routes'
import { disputesRoutes } from '@/worker/routes/disputes.routes'
import { sellerAdSlotsRoutes } from '@/features/seller/api/seller-ad-slots.routes'

/**
 * 🛡️ 2026-06-01 돈 라우트 안전망 (4) — 주문 생명주기 / 분쟁 / 광고슬롯 입찰.
 *   order(/refund·/:id/cancel = 돈 out), disputes(admin approve/reject = 환불 결정),
 *   ad-slots(입찰 = 돈). 테스트 0개였음. 계약 + 미인증 401(DB 접근 전).
 */

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_BEFORE_AUTH') } },
} as unknown as Parameters<typeof ordersRouter.request>[2]

function mounted(app: { routes: { method: string; path: string }[] }): Set<string> {
  return new Set(app.routes.map((r) => `${r.method} ${r.path}`))
}
async function status(app: { request: typeof ordersRouter.request }, method: string, path: string) {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: '{}' }, env)
  return res.status
}

describe('order(주문 생명주기) 계약 + 인증', () => {
  const EXPECTED = ['GET /', 'GET /:id', 'POST /', 'POST /:id/cancel', 'POST /refund']
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(ordersRouter as never).has(r))).toEqual([])
  })
  it('환불/취소(돈 out)는 미인증 401', async () => {
    expect(await status(ordersRouter, 'POST', '/refund'), 'POST /refund').toBe(401)
    expect(await status(ordersRouter, 'POST', '/1/cancel'), 'POST /:id/cancel').toBe(401)
  })
})

describe('disputes(분쟁) 계약 + 인증', () => {
  const EXPECTED = [
    'GET /admin/list', 'GET /agency-overview', 'GET /agency/pending', 'GET /seller/pending',
    'POST /admin/:id/approve', 'POST /admin/:id/reject', 'POST /submit',
  ]
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(disputesRoutes as never).has(r))).toEqual([])
  })
  it('분쟁 승인/거부(환불 결정)는 미인증 401', async () => {
    expect(await status(disputesRoutes, 'POST', '/admin/1/approve'), 'approve').toBe(401)
    expect(await status(disputesRoutes, 'POST', '/admin/1/reject'), 'reject').toBe(401)
  })
})

describe('seller-ad-slots(광고슬롯 입찰) 계약 + 인증', () => {
  const EXPECTED = ['GET /ad-slots', 'GET /ad-slots/my-bids', 'POST /ad-slots/:id/bid', 'POST /ad-slots/:id/cancel-bid']
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(sellerAdSlotsRoutes as never).has(r))).toEqual([])
  })
  it('입찰/입찰취소(돈)는 미인증 401', async () => {
    expect(await status(sellerAdSlotsRoutes, 'POST', '/ad-slots/1/bid'), 'bid').toBe(401)
    expect(await status(sellerAdSlotsRoutes, 'POST', '/ad-slots/1/cancel-bid'), 'cancel-bid').toBe(401)
  })
})
