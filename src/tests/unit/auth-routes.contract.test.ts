import { describe, it, expect } from 'vitest'
import { authTokenRoutes } from '@/worker/routes/auth-token.routes'
import { twofaRoutes } from '@/worker/routes/twofa.routes'
import { supplierAuthRoutes } from '@/features/supply/api/supplier-auth.routes'
import { sellerPinRoutes } from '@/features/seller/api/seller-pin.routes'
import { agencyPinRoutes } from '@/features/agency/api/agency-pin.routes'
import { sellerKakaoLinkRoutes } from '@/features/seller/api/seller-kakao-link.routes'
import { agencyKakaoLinkRoutes } from '@/features/agency/api/agency-kakao-link.routes'

/**
 * 🛡️ 2026-06-01 인증/세션 라우트 안전망 — 돈 다음으로 사고 시 손실 큰 영역(계정 탈취).
 *
 * 핵심 보호:
 *   - 2FA setup/verify/disable 이 **미인증에서 거절**(401) → 2FA 우회/타인 계정에 2FA 설정 차단
 *   - PIN step-up(set/verify/request-kakao-stepup) 미인증 거절 → 결제 PIN 우회 차단
 *   - 카카오 계정 연결/해제 미인증 거절 → **계정 takeover**(타인 카카오 강제 연결) 차단
 *   - 토큰 발급(auth-token) 입력 검증 + 미인증 거절
 *   - 공급사 로그인 rate-limit/검증
 * 네트워크/DB 없이(env.DB.prepare→throw) — auth 가 DB 접근보다 먼저임도 함께 검증.
 */

const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_BEFORE_AUTH') } },
} as unknown as Parameters<typeof twofaRoutes.request>[2]

function mounted(app: { routes: { method: string; path: string }[] }): Set<string> {
  return new Set(app.routes.map((r) => `${r.method} ${r.path}`))
}
async function status(app: { request: typeof twofaRoutes.request }, method: string, path: string) {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' }, env)
  return res.status
}
// 미인증 거절 = 401(인증 필요) 또는 429(브루트포스 방지 rate-limit 선행). 둘 다 "무권한 차단".
function expectRejected(s: number, label: string) {
  expect([401, 403, 429], `${label} 무권한 거절(401/403/429)`).toContain(s)
}

describe('2FA 라우트 — 미인증 거절(2FA 우회 차단)', () => {
  it('5개 엔드포인트 전부 마운트', () => {
    const EXPECTED = ['GET /status', 'POST /check', 'POST /disable', 'POST /setup', 'POST /verify']
    expect(EXPECTED.filter((r) => !mounted(twofaRoutes as never).has(r))).toEqual([])
  })
  it('setup/verify/disable/check/status 전부 미인증 거절(401/429)', async () => {
    for (const [m, p] of [['GET', '/status'], ['POST', '/check'], ['POST', '/disable'], ['POST', '/setup'], ['POST', '/verify']] as [string, string][]) {
      expectRejected(await status(twofaRoutes, m, p), `${m} ${p}`)
    }
  })
})

describe('PIN step-up 라우트 — 미인증 거절', () => {
  for (const [name, app] of [['seller', sellerPinRoutes], ['agency', agencyPinRoutes]] as const) {
    it(`${name}: set-pin/verify-pin/request-kakao-stepup 미인증 거절`, async () => {
      for (const p of ['/set-pin', '/verify-pin', '/request-kakao-stepup']) {
        expectRejected(await status(app as never, 'POST', p), `${name} POST ${p}`)
      }
    })
  }
})

describe('카카오 계정 연결/해제 — 미인증 거절(계정 takeover 차단)', () => {
  for (const [name, app] of [['seller', sellerKakaoLinkRoutes], ['agency', agencyKakaoLinkRoutes]] as const) {
    it(`${name}: link-kakao/unlink-kakao 미인증 거절`, async () => {
      expectRejected(await status(app as never, 'POST', '/link-kakao'), `${name} link`)
      expectRejected(await status(app as never, 'POST', '/unlink-kakao'), `${name} unlink`)
    })
  }
})

describe('auth-token / supplier-auth — 토큰발급·로그인 가드', () => {
  it('auth-token: token-info 미인증 401, id-token 빈입력 거절(>=400)', async () => {
    expect(await status(authTokenRoutes as never, 'GET', '/token-info')).toBe(401)
    expect(await status(authTokenRoutes as never, 'POST', '/id-token')).toBeGreaterThanOrEqual(400)
  })
  it('supplier-auth: login/register 무자격 요청 거절(4xx)', async () => {
    for (const p of ['/login', '/register']) {
      const s = await status(supplierAuthRoutes as never, 'POST', p)
      expect(s, `POST ${p}`).toBeGreaterThanOrEqual(400)
      expect(s, `POST ${p} not 5xx`).toBeLessThan(500)
    }
  })
})
