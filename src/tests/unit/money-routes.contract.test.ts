import { describe, it, expect } from 'vitest'
import { referralTreeRoutes } from '@/features/referral/api/referral-tree.routes'
import { agencySettlementsRoutes } from '@/features/agency/api/agency-settlements.routes'
import { adminSettlementsRoutes } from '@/features/admin/api/admin-settlements.routes'

/**
 * 🛡️ 2026-06-01 돈 라우트 안전망 — 정산/지급/추천 commission 라우트 계약 + 인증.
 *
 * 대상(테스트 0개였음):
 *   - referral-tree: 추천 commission 적립(calculate-commission) + 출금 승인/거부(돈 out)
 *   - agency-settlements: 에이전시 정산 청구
 *   - admin-settlements: 어드민 정산 실행/완료/원천징수 (돈 out)
 *
 * 막는 회귀: 핸들러 소실(계약) + 인증 게이트 누락으로 무권한자가 출금승인·정산실행 트리거.
 * 네트워크/DB 없이(env.DB.prepare→throw) 실행.
 */

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_BEFORE_AUTH') } },
} as unknown as Parameters<typeof referralTreeRoutes.request>[2]

function mounted(app: { routes: { method: string; path: string }[] }): Set<string> {
  return new Set(app.routes.map((r) => `${r.method} ${r.path}`))
}

describe('referral-tree (commission/출금) 계약 + 인증', () => {
  const EXPECTED = [
    'GET /admin/withdrawals', 'GET /my-commissions', 'GET /my-network', 'GET /stats',
    'GET /withdrawals', 'PATCH /admin/withdrawals/:id/approve', 'PATCH /admin/withdrawals/:id/reject',
    'POST /calculate-commission', 'POST /register', 'POST /withdrawals',
  ]
  it('엔드포인트 전부 마운트', () => {
    const m = mounted(referralTreeRoutes as never)
    expect(EXPECTED.filter((r) => !m.has(r))).toEqual([])
  })
  it('출금/승인/거부/적립은 무권한 요청 거절(401/403)', async () => {
    const cases: [string, string][] = [
      ['POST', '/withdrawals'], ['PATCH', '/admin/withdrawals/1/approve'],
      ['PATCH', '/admin/withdrawals/1/reject'], ['POST', '/calculate-commission'],
    ]
    for (const [method, path] of cases) {
      const res = await referralTreeRoutes.request(path, { method, headers: { 'content-type': 'application/json' }, body: '{}' }, env)
      expect([401, 403], `${method} ${path} 무권한 거절`).toContain(res.status)
    }
  })
})

describe('agency-settlements 계약 + 인증', () => {
  const EXPECTED = [
    'GET /settlement-invoices', 'GET /settlement-invoices/:id', 'GET /settlements', 'POST /settlements/request',
  ]
  it('엔드포인트 전부 마운트', () => {
    const m = mounted(agencySettlementsRoutes as never)
    expect(EXPECTED.filter((r) => !m.has(r))).toEqual([])
  })
  it('정산 청구는 무권한 요청 401', async () => {
    const res = await agencySettlementsRoutes.request('/settlements/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, env)
    expect(res.status).toBe(401)
  })
})

describe('admin-settlements 계약 (인증은 부모 마운트 requireAdmin)', () => {
  // ⚠️ admin-settlements 의 인증은 index.ts 마운트 시 requireAdmin 미들웨어로 적용됨(sub-app 자체엔 없음).
  //   따라서 sub-app 단독 인증 테스트 불가 — 계약(핸들러 존재)만 고정.
  const EXPECTED = [
    'GET /settlement/export-csv', 'GET /settlement/records', 'GET /settlement/stats',
    'GET /tax-withholding/export', 'GET /tax-withholding/summary',
    'PATCH /settlement/:id/status', 'POST /settlement/batch-complete', 'POST /settlement/execute',
  ]
  it('엔드포인트 전부 마운트 (정산 실행/완료/원천징수)', () => {
    const m = mounted(adminSettlementsRoutes as never)
    expect(EXPECTED.filter((r) => !m.has(r))).toEqual([])
  })
})
