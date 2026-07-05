import { describe, it, expect } from 'vitest'
import { nextRefreshDelayMs, shouldRescheduleAfterAttempt } from '@/hooks/useTokenAutoRefresh'

/**
 * 🛡️ 2026-07-04 실사고 회귀 방지: /admin 무한로딩·렉·"응답 없는 페이지"·콘솔 무에러.
 *
 * 원인: useTokenAutoRefresh 의 schedule() 이 갱신 시점(exp-5분)이 지난 토큰에서
 *   `refreshIfNeeded().then(schedule)` 로 **무조건 재귀** — refreshIfNeeded 는 만료 토큰이면
 *   네트워크 없이 즉시 resolve 하는 no-op → setTimeout 없는 마이크로태스크 무한재귀 →
 *   메인스레드 100% 영구 정지. localStorage 에 만료 dashboard 토큰(admin/seller/agency)이
 *   남아 있기만 하면 해당 페이지(App.tsx 는 전 페이지에서 seller/agency 호출) 전체가 얼었음.
 *
 * 🔒 핵심 불변식: "갱신 시도 후, 토큰이 여전히 과거 목표시각이면 절대 재스케줄하지 않는다."
 *    이게 깨지면 = 만료 토큰 무한루프 = 사건 재발. CI 가 여기서 차단.
 */

const MIN5 = 5 * 60 * 1000 // REFRESH_BEFORE_EXPIRY_MS 와 동일 (만료 5분 전 갱신)
const NOW = 1_800_000_000_000

function jwtWithExp(expMs: number): string {
  const b64u = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ type: 'admin', exp: Math.floor(expMs / 1000) })}.sig`
}

describe('token-auto-refresh · nextRefreshDelayMs', () => {
  it('🔒 만료된 토큰(exp 과거) → null (즉시-재귀 금지 신호)', () => {
    expect(nextRefreshDelayMs(NOW - 3_600_000, NOW)).toBeNull()
  })

  it('🔒 갱신 시점(exp-5분)이 지난 토큰 → null', () => {
    expect(nextRefreshDelayMs(NOW + MIN5 - 1, NOW)).toBeNull()
    expect(nextRefreshDelayMs(NOW + MIN5, NOW)).toBeNull() // 경계: 정확히 5분 전
  })

  it('미래 목표시각 → 양수 delay (setTimeout 경유 — 이벤트루프 양보)', () => {
    expect(nextRefreshDelayMs(NOW + MIN5 + 1, NOW)).toBe(1)
    expect(nextRefreshDelayMs(NOW + 3_600_000, NOW)).toBe(3_600_000 - MIN5)
  })

  it('32-bit setTimeout 한계 클램프 (초장수명 토큰)', () => {
    expect(nextRefreshDelayMs(NOW + 100 * 24 * 3_600_000, NOW)).toBe(2147483000)
  })
})

describe('token-auto-refresh · shouldRescheduleAfterAttempt (🔒 무한루프 차단 게이트)', () => {
  it('🔒 갱신 실패로 만료 토큰 그대로 → false (여기가 true 면 마이크로태스크 무한루프 재발)', () => {
    expect(shouldRescheduleAfterAttempt(jwtWithExp(NOW - 3_600_000), NOW)).toBe(false)
  })

  it('🔒 토큰 삭제됨(로그아웃) → false', () => {
    expect(shouldRescheduleAfterAttempt(null, NOW)).toBe(false)
  })

  it('🔒 비 JWT/디코드 불가 토큰 → false (관대 통과로 루프 만들지 않기)', () => {
    expect(shouldRescheduleAfterAttempt('not-a-jwt', NOW)).toBe(false)
    expect(shouldRescheduleAfterAttempt('a.@@@@.c', NOW)).toBe(false)
  })

  it('갱신 성공으로 미래 exp 토큰 획득 → true (정상 재스케줄)', () => {
    expect(shouldRescheduleAfterAttempt(jwtWithExp(NOW + 3_600_000), NOW)).toBe(true)
  })

  it('🔒 갱신했지만 새 토큰도 5분 내 만료(비정상 서버) → false (루프 대신 중단)', () => {
    expect(shouldRescheduleAfterAttempt(jwtWithExp(NOW + MIN5 - 1000), NOW)).toBe(false)
  })
})
