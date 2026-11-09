/**
 * 🔐 2026-11-09 보안 전수조사 7차 — 로그인 없이 데이터를 바꾸거나 외부를 부르는 경로(대표 *"계속 개선"*).
 *
 * ## ⚠️ 못 보는 것
 * - Stripe 는 라이브에 키가 없어 꺼져 있다(503). 이 시험은 *켜졌을 때* 주문번호를 손님이 못 정하게만 고정한다 —
 *   결제 금액과 주문 금액 대조는 없다(Stripe 를 켜려면 그 대조부터 만들 것).
 * - 유어샵 카드 클릭 비콘(`/api/curator/:handle/p/:id/click`)은 일부러 제한을 안 걸었다(통계 전용 · D1 기반 제한이 쓰기를 두 배로 만든다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'

describe('① Stripe — 손님이 주문번호를 실어 주문 상태를 바꾸지 못한다', () => {
  const code = readCode('src/worker/routes/stripe.routes.ts')
  it('create-intent 가 order_number 메타를 버린다 + 횟수 제한', () => {
    expect(code).toMatch(/if \(\/\^order_\?number\$\/i\.test\(key\)\) continue;/)
    expect(code).toMatch(/stripeRouter\.post\('\/create-intent', rateLimit\(/)
  })
  it('실패 이벤트는 PENDING 주문만 FAILED 로', () => {
    expect(code).toMatch(/status = 'FAILED'[^"]*WHERE order_number = \? AND status = 'PENDING'/)
  })
})

describe('② 이메일 발송 API 는 관리자 전용(열린 중계 차단)', () => {
  it('requireAdmin', () => {
    expect(readCode('src/features/notifications/api/email.routes.ts')).toMatch(/emailRoutes\.use\('\*', requireAdmin\(\)\)/)
  })
})

describe('③ 로그인 없는 기록 경로에 횟수 제한', () => {
  it('추천 클릭 · CSP 보고', () => {
    expect(readCode('src/features/ledger/api/ledger.routes.ts')).toMatch(/post\('\/referral\/click', rateLimit\(/)
    expect(readCode('src/worker/routes/public-utility.routes.ts')).toMatch(/post\('\/api\/csp-report', rateLimit\(/)
  })
})
