/**
 * 🔐 2026-11-09 보안 전수조사 5차 — 남은 작은 구멍 묶음(대표 *"더 개선 진행"*).
 * 1차 `security-hardening-2026-11-09` · 2차 `-2-` · 3차 `-3-` · 4차 `consumer-identity-guard`.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 셀러 로그인 응답 시간 차이(계정이 있을 때 비밀번호 해시를 도는 시간) — 순서만 고정한다.
 * - rateLimit 의 실제 KV 동작(RATE_LIMIT_KV 미등록이면 fail-open) — 배선만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'

describe('① 셀러 로그인 — 계정 상태는 비밀번호를 맞힌 뒤에만 알려 준다', () => {
  it('정지·승인대기 응답이 비밀번호 확인보다 뒤에 있다', () => {
    const code = readCode('src/features/auth/api/seller.routes.ts')
    const login = code.slice(code.indexOf("sellerRoutes.post('/login'"))
    const pw = login.indexOf('const { valid } = await verifyPassword(password, passwordHash)') // 없는 계정용 더미 해시 호출 말고 진짜 확인
    const suspended = login.indexOf("code: 'ACCOUNT_SUSPENDED'")
    const pending = login.indexOf("code: 'ACCOUNT_PENDING'")
    const clear = login.indexOf("clearFailures(DB, 'seller'")
    expect(pw).toBeGreaterThan(0)
    expect(suspended).toBeGreaterThan(pw)
    expect(pending).toBeGreaterThan(pw)
    // 상태가 막히는 계정은 실패 카운터를 비우지 않는다
    expect(clear).toBeGreaterThan(suspended)
    expect(clear).toBeGreaterThan(pending)
  })
})

describe('② 딜 금액은 정수만', () => {
  it('후원·충전 확인의 금액 검사가 isInteger', () => {
    const code = readCode('src/features/points/api/points.routes.ts')
    expect(code).toMatch(/!Number\.isInteger\(amount\) \|\| amount < 500 \|\| amount > 10_000_000/)
    expect(code).toMatch(/!Number\.isInteger\(amount\) \|\| amount < 1 \|\| amount > 100_000_000/)
  })
})

describe('③ 로그인 없는 프로모 코드 조회에 횟수 제한', () => {
  it('/preview/:code 에 rateLimit', () => {
    expect(readCode('src/features/promo/api/promo.routes.ts'))
      .toMatch(/promoRoutes\.get\('\/preview\/:code', rateLimit\(\{ action: 'promo_preview'/)
  })
})
