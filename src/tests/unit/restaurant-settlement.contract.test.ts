import { describe, it, expect } from 'vitest'
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '@/features/settlement/api/restaurant-settlement.routes'

/**
 * 🛡️ 2026-06-03 매장 정산 라우트 안전망 (정산 완료/실패 = 돈 상태전이, 테스트 0개였음).
 *   admin 라우트는 부모 adminApp(requireAdmin) 에서 인증 → 여기선 계약(핸들러 존재)만.
 *   seller GET / 는 inline requireAuth → 미인증 401 검증.
 */

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_BEFORE_AUTH') } },
} as unknown as Parameters<typeof sellerSettlementRoutes.request>[2]

function mounted(app: { routes: { method: string; path: string }[] }): Set<string> {
  return new Set(app.routes.map((r) => `${r.method} ${r.path}`))
}

describe('restaurant-settlement(매장 정산) 계약', () => {
  it('admin 정산 엔드포인트 전부 마운트 (계산/완료/실패/조회)', () => {
    const EXPECTED = ['GET /list', 'GET /stats', 'PATCH /:id/complete', 'PATCH /:id/fail', 'POST /calculate']
    expect(EXPECTED.filter((r) => !mounted(restaurantSettlementRoutes as never).has(r))).toEqual([])
  })
  it('seller 정산 조회 GET / 마운트 + 미인증 401', async () => {
    expect(mounted(sellerSettlementRoutes as never).has('GET /')).toBe(true)
    const res = await sellerSettlementRoutes.request('/', { method: 'GET' }, env)
    expect(res.status).toBe(401)
  })
})
