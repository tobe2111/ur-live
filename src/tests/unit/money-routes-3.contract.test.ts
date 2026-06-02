import { describe, it, expect } from 'vitest'
import { staysPublicRoutes } from '@/features/group-buy/api/stays-public.routes'
import { giftsRoutes } from '@/features/gifts/api/gifts.routes'
import { distributorAdminRoutes } from '@/features/supply/api/distributor-admin.routes'
import { wholesaleSupplierRoutes } from '@/features/supply/api/wholesale-supplier.routes'

/**
 * 🛡️ 2026-06-01 돈 라우트 안전망 (3) — 숙소 예약 결제 / 선물 결제 / 유통 admin / 공급사.
 *   전부 Toss 결제 또는 환불(돈 out)을 다루는데 테스트 0개였음.
 *   계약(핸들러 존재) + 결제·환불 엔드포인트 미인증 401/400(DB 접근 전).
 */

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_BEFORE_AUTH') } },
} as unknown as Parameters<typeof giftsRoutes.request>[2]

function mounted(app: { routes: { method: string; path: string }[] }): Set<string> {
  return new Set(app.routes.map((r) => `${r.method} ${r.path}`))
}

async function rejects(app: { request: typeof giftsRoutes.request }, method: string, path: string) {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: '{}' }, env)
  return res.status
}

describe('stays-public(숙소 예약 결제) 계약 + 인증', () => {
  const EXPECTED = [
    'GET /stays/:productId', 'GET /stays/:productId/availability', 'GET /stays/:productId/reviews',
    'GET /stays/my-bookings', 'GET /stays/search', 'PATCH /stays/bookings/:id/cancel',
    'POST /stays/bookings/:id/review', 'POST /stays/bookings/confirm',
    'POST /stays/bookings/create', 'POST /stays/bookings/create-multi',
  ]
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(staysPublicRoutes as never).has(r))).toEqual([])
  })
  it('예약 생성/결제확정은 미인증 401(오버부킹 가드·돈 보호)', async () => {
    for (const p of ['/stays/bookings/confirm', '/stays/bookings/create', '/stays/bookings/create-multi']) {
      expect(await rejects(staysPublicRoutes, 'POST', p), `POST ${p}`).toBe(401)
    }
  })
})

describe('gifts(선물 결제) 계약 + 인증', () => {
  const EXPECTED = ['GET /claim/:token', 'GET /sent', 'POST /', 'POST /:id/confirm', 'POST /claim/:token']
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(giftsRoutes as never).has(r))).toEqual([])
  })
  it('선물 생성/결제확정은 미인증 401', async () => {
    expect(await rejects(giftsRoutes, 'POST', '/'), 'POST /').toBe(401)
    expect(await rejects(giftsRoutes, 'POST', '/1/confirm'), 'POST /:id/confirm').toBe(401)
  })
})

describe('distributor-admin(유통 admin) 계약 + 인증', () => {
  const EXPECTED = [
    'DELETE /proposals/:id', 'GET /distributors', 'GET /grades', 'GET /orders', 'GET /orders/:id',
    'GET /proposals', 'GET /tax-summary', 'PATCH /distributors/:id', 'POST /orders/:id/refund',
    'POST /proposals', 'PUT /grades/:grade',
  ]
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(distributorAdminRoutes as never).has(r))).toEqual([])
  })
  it('환불(돈 out)은 미인증 401', async () => {
    expect(await rejects(distributorAdminRoutes, 'POST', '/orders/1/refund')).toBe(401)
  })
})

describe('wholesale-supplier(공급사) 계약 + 인증', () => {
  const EXPECTED = ['GET /orders', 'POST /items/:id/ship', 'POST /orders/:id/refund']
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(wholesaleSupplierRoutes as never).has(r))).toEqual([])
  })
  it('발송/환불은 미인증 401', async () => {
    expect(await rejects(wholesaleSupplierRoutes, 'POST', '/orders/1/refund'), 'refund').toBe(401)
    expect(await rejects(wholesaleSupplierRoutes, 'POST', '/items/1/ship'), 'ship').toBe(401)
  })
})
