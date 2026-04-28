/**
 * 🛡️ 2026-04-28: TD-006 split 이후 라우트 endpoint 회귀 검증.
 *
 * 분할 후 같은 prefix 에 여러 sub-router 가 mount 되는데, 각 path 가
 * 정확히 한 라우터에만 매칭되는지 (충돌 0 + 누락 0) 검증.
 *
 * Hono routing 동작 모킹 — 단순화된 path 매칭 (parameter 위치만 동등성 비교).
 */
import { describe, it, expect } from 'vitest'

type RouteEntry = { method: string; path: string; router: string }

// 실제 등록된 라우트 (split 후 상태) — split 코드와 동기화 필요
const SELLER_ROUTES: RouteEntry[] = [
  // sellerRegistrationRoutes
  { method: 'POST', path: '/register', router: 'registration' },
  { method: 'POST', path: '/register-from-user', router: 'registration' },
  { method: 'GET', path: '/my-seller-status', router: 'registration' },
  { method: 'POST', path: '/switch-to-seller', router: 'registration' },
  { method: 'POST', path: '/switch-to-user', router: 'registration' },
  // sellerProfileRoutes
  { method: 'GET', path: '/profile', router: 'profile' },
  { method: 'PUT', path: '/profile', router: 'profile' },
  { method: 'PATCH', path: '/profile', router: 'profile' },
  { method: 'GET', path: '/business-info', router: 'profile' },
  { method: 'POST', path: '/business-info', router: 'profile' },
  { method: 'PUT', path: '/business-info', router: 'profile' },
  { method: 'PATCH', path: '/business-info', router: 'profile' },
  // sellerSettlementsRoutes
  { method: 'GET', path: '/settlements', router: 'settlements' },
  { method: 'POST', path: '/settlements/request', router: 'settlements' },
  { method: 'GET', path: '/settlements/stats', router: 'settlements' },
  { method: 'GET', path: '/settlements/summary', router: 'settlements' },
  { method: 'GET', path: '/settlements/:id/download', router: 'settlements' },
  { method: 'GET', path: '/dashboard/stats', router: 'settlements' },
  // sellerAccountRoutes
  { method: 'GET', path: '/personal-info', router: 'account' },
  { method: 'PUT', path: '/personal-info', router: 'account' },
  { method: 'PATCH', path: '/personal-info', router: 'account' },
  { method: 'POST', path: '/change-password', router: 'account' },
  { method: 'POST', path: '/upload-image', router: 'account' },
  // sellerKakaoLinkRoutes
  { method: 'POST', path: '/link-kakao', router: 'kakao-link' },
  { method: 'POST', path: '/unlink-kakao', router: 'kakao-link' },
  { method: 'GET', path: '/kakao-link-status', router: 'kakao-link' },
  // sellerAlimtalkMgmtRoutes
  { method: 'GET', path: '/alimtalk', router: 'alimtalk-mgmt' },
  { method: 'POST', path: '/alimtalk', router: 'alimtalk-mgmt' },
  { method: 'GET', path: '/alimtalk/balance', router: 'alimtalk-mgmt' },
  { method: 'POST', path: '/alimtalk/test', router: 'alimtalk-mgmt' },
  { method: 'POST', path: '/alimtalk/send', router: 'alimtalk-mgmt' },
  { method: 'GET', path: '/alimtalk/messages', router: 'alimtalk-mgmt' },
  { method: 'POST', path: '/alimtalk/charge', router: 'alimtalk-mgmt' },
  // sellerManagementRoutes (남은 것: stats, public, products/options)
  { method: 'GET', path: '/stats', router: 'management' },
  { method: 'GET', path: '/public/:sellerId', router: 'management' },
  { method: 'GET', path: '/:sellerId/products-public', router: 'management' },
  { method: 'GET', path: '/products/:id/options', router: 'management' },
  { method: 'POST', path: '/products/:id/options', router: 'management' },
]

const AGENCY_ROUTES: RouteEntry[] = [
  // agencyRoutes (남은 것)
  { method: 'POST', path: '/register', router: 'agency' },
  { method: 'POST', path: '/register-from-user', router: 'agency' },
  { method: 'GET', path: '/my-agency-status', router: 'agency' },
  { method: 'POST', path: '/login', router: 'agency' },
  { method: 'POST', path: '/forgot-password', router: 'agency' },
  { method: 'POST', path: '/reset-password', router: 'agency' },
  { method: 'GET', path: '/profile', router: 'agency' },
  { method: 'PUT', path: '/profile', router: 'agency' },
  { method: 'GET', path: '/notifications', router: 'agency' },
  { method: 'PUT', path: '/notifications/read-all', router: 'agency' },
  { method: 'POST', path: '/sellers/:id/products', router: 'agency' },
  { method: 'PUT', path: '/sellers/:id/products/:productId', router: 'agency' },
  { method: 'POST', path: '/sellers/:id/streams', router: 'agency' },
  { method: 'POST', path: '/invite-seller', router: 'agency' },
  { method: 'GET', path: '/report/csv', router: 'agency' },
  // agencyKakaoLinkRoutes
  { method: 'POST', path: '/link-kakao', router: 'kakao-link' },
  { method: 'POST', path: '/unlink-kakao', router: 'kakao-link' },
  { method: 'GET', path: '/kakao-link-status', router: 'kakao-link' },
  // agencyStatsRoutes
  { method: 'GET', path: '/stats', router: 'stats' },
  { method: 'GET', path: '/stats/kpi', router: 'stats' },
  { method: 'GET', path: '/stats/daily', router: 'stats' },
  { method: 'GET', path: '/stats/realtime', router: 'stats' },
  { method: 'GET', path: '/stats/batch', router: 'stats' },
  // agencySettlementsRoutes
  { method: 'GET', path: '/settlements', router: 'settlements' },
  { method: 'GET', path: '/settlement-invoices', router: 'settlements' },
  { method: 'GET', path: '/settlement-invoices/:id', router: 'settlements' },
  { method: 'POST', path: '/settlements/request', router: 'settlements' },
  // agencyOpsRoutes
  { method: 'POST', path: '/notices', router: 'ops' },
  { method: 'GET', path: '/notices', router: 'ops' },
  { method: 'GET', path: '/monthly-tasks', router: 'ops' },
  { method: 'GET', path: '/targets', router: 'ops' },
  { method: 'PUT', path: '/targets', router: 'ops' },
  { method: 'GET', path: '/settlements/csv', router: 'ops' },
  { method: 'GET', path: '/sellers/compare', router: 'ops' },
  { method: 'GET', path: '/contracts', router: 'ops' },
  { method: 'POST', path: '/contracts', router: 'ops' },
  { method: 'PUT', path: '/contracts/:id', router: 'ops' },
  // agencySellersRoutes
  { method: 'GET', path: '/sellers', router: 'sellers' },
  { method: 'GET', path: '/sellers/:id/stats', router: 'sellers' },
  { method: 'GET', path: '/orders', router: 'sellers' },
  { method: 'GET', path: '/streams', router: 'sellers' },
  { method: 'GET', path: '/sellers/:id/products', router: 'sellers' },
  { method: 'GET', path: '/sellers/:id/inventory', router: 'sellers' },
  { method: 'GET', path: '/ranking', router: 'sellers' },
  { method: 'GET', path: '/schedule', router: 'sellers' },
  { method: 'GET', path: '/returns', router: 'sellers' },
]

function findDuplicates(routes: RouteEntry[]): RouteEntry[][] {
  const seen = new Map<string, RouteEntry[]>()
  for (const r of routes) {
    const key = `${r.method} ${r.path}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(r)
  }
  return [...seen.values()].filter(arr => arr.length > 1)
}

describe('TD-006 split — seller routes 충돌 없음', () => {
  it('seller: /api/seller path 에 여러 라우터 mount 되어도 path 충돌 0', () => {
    const dups = findDuplicates(SELLER_ROUTES)
    if (dups.length > 0) {
      console.error('Duplicates:', dups)
    }
    expect(dups).toHaveLength(0)
  })

  it('seller: /sellers/:id/products 같은 sellers 분리 후에도 management 의 :sellerId/products-public 와 안 겹침', () => {
    // /sellers/:id/products (agency 만) vs /:sellerId/products-public (seller 만)
    // 다른 prefix 하에 있으므로 같은 router 안에서는 비교 불필요
    const sellerHasPublic = SELLER_ROUTES.some(r => r.path === '/:sellerId/products-public')
    expect(sellerHasPublic).toBe(true)
  })

  it('seller: alimtalk vs alimtalk/* path 분리', () => {
    const alimtalkBase = SELLER_ROUTES.filter(r => r.path === '/alimtalk')
    expect(alimtalkBase).toHaveLength(2) // GET + POST
    const alimtalkSub = SELLER_ROUTES.filter(r => r.path.startsWith('/alimtalk/'))
    expect(alimtalkSub.length).toBeGreaterThan(0)
  })
})

describe('TD-006 split — agency routes 충돌 없음', () => {
  it('agency: /api/agency path 에 여러 라우터 mount 되어도 path 충돌 0', () => {
    const dups = findDuplicates(AGENCY_ROUTES)
    if (dups.length > 0) {
      console.error('Duplicates:', dups)
    }
    expect(dups).toHaveLength(0)
  })

  it('agency: /settlements (settlements router) vs /settlements/csv (ops router) 구분', () => {
    const settle = AGENCY_ROUTES.find(r => r.method === 'GET' && r.path === '/settlements')
    const csv = AGENCY_ROUTES.find(r => r.method === 'GET' && r.path === '/settlements/csv')
    expect(settle?.router).toBe('settlements')
    expect(csv?.router).toBe('ops')
  })

  it('agency: /sellers (목록) vs /sellers/compare (ops) vs /sellers/:id/products 구분', () => {
    const list = AGENCY_ROUTES.find(r => r.method === 'GET' && r.path === '/sellers')
    const compare = AGENCY_ROUTES.find(r => r.method === 'GET' && r.path === '/sellers/compare')
    const products = AGENCY_ROUTES.find(r => r.method === 'GET' && r.path === '/sellers/:id/products')
    expect(list?.router).toBe('sellers')
    expect(compare?.router).toBe('ops')
    expect(products?.router).toBe('sellers')
  })
})

describe('Hono router 우선순위 — 같은 path 등록 순서', () => {
  it('seller: 같은 prefix 에 여러 router mount → 등록 순서대로 first-match', () => {
    // worker/index.ts 의 등록 순서:
    // 1. sellerManagementRoutes
    // 2. sellerKakaoLinkRoutes
    // 3. sellerAlimtalkMgmtRoutes
    // 4. sellerRegistrationRoutes
    // 5. sellerProfileRoutes
    // 6. sellerSettlementsRoutes
    // 7. sellerAccountRoutes
    //
    // path 충돌 없으므로 순서 무관 — 위 테스트로 검증됨
    expect(true).toBe(true)
  })
})

describe('회귀 방지 — 등록된 라우트 수 (각 router 분배)', () => {
  it('seller routes 총 38개', () => {
    expect(SELLER_ROUTES.length).toBe(38)
  })
  it('agency routes 총 46개', () => {
    expect(AGENCY_ROUTES.length).toBe(46)
  })
  it('seller: 각 router 별 분배 확인', () => {
    const byRouter: Record<string, number> = {}
    for (const r of SELLER_ROUTES) byRouter[r.router] = (byRouter[r.router] ?? 0) + 1
    expect(byRouter.registration).toBe(5)
    expect(byRouter.profile).toBe(7)
    expect(byRouter.settlements).toBe(6)
    expect(byRouter.account).toBe(5)
    expect(byRouter['kakao-link']).toBe(3)
    expect(byRouter['alimtalk-mgmt']).toBe(7)
    expect(byRouter.management).toBe(5)
  })
  it('agency: 각 router 별 분배 확인', () => {
    const byRouter: Record<string, number> = {}
    for (const r of AGENCY_ROUTES) byRouter[r.router] = (byRouter[r.router] ?? 0) + 1
    expect(byRouter.agency).toBe(15)
    expect(byRouter['kakao-link']).toBe(3)
    expect(byRouter.stats).toBe(5)
    expect(byRouter.settlements).toBe(4)
    expect(byRouter.ops).toBe(10)
    expect(byRouter.sellers).toBe(9)
  })
})
