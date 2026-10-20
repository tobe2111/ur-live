import { describe, it, expect } from 'vitest'
import { returnsRoutes } from '@/features/returns/api/returns.routes'

/**
 * 🛡️ 2026-06-01 돈 라우트 안전망 — 반품/환불 라우트 계약 + 인증 가드.
 *
 * 배경: returns.routes 는 환불 시 **돈이 거꾸로 흐르는** 경로다 —
 *   재고 복원 + 공급사 적립 역전(reverseSupplierOnRefund) + 영입자 commission 역전
 *   (reverseInfluencerStoreIntroOnRefund). 테스트 0개였음.
 *
 * 이 테스트가 막는 회귀:
 *   (1) 핸들러 소실/파일 훼손 → 환불 API 사라짐(계약 테스트)
 *   (2) admin 게이트 누락 → 누구나 /refund·/approve 호출해 환불·역적립 트리거(인증 테스트)
 *       — 미인증 요청이 DB 접근 전 401 로 거절됨을 검증(env.DB.prepare→throw).
 */

const EXPECTED_ROUTES = [
  'GET /admin',
  'GET /my',
  'GET /seller',
  'POST /request',
  'PUT /:id/approve',
  'PUT /:id/inspect',
  'PUT /:id/refund',
  'PUT /:id/reject',
  'PUT /:id/shipping',
] as const

// 손실/우회 시 = 돈 사고인 핵심 (환불·역적립·승인)
const MONEY_CRITICAL: [string, string][] = [
  ['PUT', '/1/refund'],
  ['PUT', '/1/approve'],
  ['PUT', '/1/inspect'],
  ['PUT', '/1/reject'],
]

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_ACCESSED_BEFORE_AUTH') } },
} as unknown as Parameters<typeof returnsRoutes.request>[2]

function mounted(): Set<string> {
  const routes = (returnsRoutes as unknown as { routes: { method: string; path: string }[] }).routes
  return new Set(routes.map((r) => `${r.method} ${r.path}`))
}

describe('returns 라우트 계약 + 인증 안전망', () => {
  it('기대 엔드포인트가 모두 마운트되어 있다 (핸들러 소실 차단)', () => {
    const m = mounted()
    const missing = EXPECTED_ROUTES.filter((r) => !m.has(r))
    expect(missing, `사라진 라우트: ${missing.join(', ')}`).toEqual([])
  })

  it('돈-핵심(환불/승인/검수/거부)은 미인증 요청을 DB 접근 전 401 로 거절', async () => {
    for (const [method, path] of MONEY_CRITICAL) {
      const res = await returnsRoutes.request(
        path,
        { method, headers: { 'content-type': 'application/json' }, body: '{}' },
        env,
      )
      expect(res.status, `${method} ${path} 는 미인증 시 401 이어야 함(돈 역전 보호)`).toBe(401)
    }
  })

  it('전체 9개 엔드포인트가 미인증 요청을 401 로 거절', async () => {
    const all: [string, string][] = [
      ['POST', '/request'], ['GET', '/my'], ['PUT', '/1/shipping'], ['GET', '/admin'],
      ['GET', '/seller'], ['PUT', '/1/approve'], ['PUT', '/1/reject'], ['PUT', '/1/inspect'], ['PUT', '/1/refund'],
    ]
    for (const [method, path] of all) {
      const res = await returnsRoutes.request(
        path,
        { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' },
        env,
      )
      expect(res.status, `${method} ${path}`).toBe(401)
    }
  })
})
