import { describe, it, expect } from 'vitest'
import { donationsRoutes } from '@/features/donations/api/donations.routes'

/**
 * 🛡️ 2026-06-01 돈 라우트 안전망 (2) — 후원(donation) 결제. Toss confirm 으로 돈이 들어오는 경로.
 *   🧨 2026-10-11 도매몰 철거: '도매 주문(B2B)' 계약 블록 제거(라우트가 함께 삭제됐다).
 *   계약(핸들러 존재) + 결제/주문 엔드포인트 미인증 401(DB 접근 전).
 */

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_BEFORE_AUTH') } },
} as unknown as Parameters<typeof donationsRoutes.request>[2] // 🧨 2026-10-11: 종전엔 wholesaleRoutes 기준 — 그 라우트가 철거됐다

function mounted(app: { routes: { method: string; path: string }[] }): Set<string> {
  return new Set(app.routes.map((r) => `${r.method} ${r.path}`))
}

describe('donations(후원) 라우트 계약 + 인증', () => {
  const EXPECTED = ['GET /stream/:streamId', 'POST /confirm', 'POST /init']
  it('엔드포인트 전부 마운트', () => {
    expect(EXPECTED.filter((r) => !mounted(donationsRoutes as never).has(r))).toEqual([])
  })
  it('후원 init/confirm 은 미인증 401(DB 접근 전)', async () => {
    for (const path of ['/init', '/confirm']) {
      const res = await donationsRoutes.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, env)
      expect(res.status, `POST ${path}`).toBe(401)
    }
  })
})
