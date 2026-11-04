/**
 * 📞 가입 시 휴대폰 번호 필수 (2026-11-04 대표 지시 · 확정: 새 가입자만 / 예약 안내 필수 + 소식 알림 선택).
 *
 * ① 판정 — 새 가입자(기준 시각 이후)이고 번호가 없을 때만 필수. 기존 회원·번호 있는 회원은 아니다.
 * ② 서버 — `/api/auth/me` 두 분기 모두 `phone_required` 를 내린다 · 프로필 저장은 숫자만 · 소식 동의는 `marketing` 으로 기록.
 * ③ 창 — 필수일 때만 뜨고, 닫기 단추가 없고, 소식 체크는 기본 꺼짐, 법적 고지 화면에선 안 뜬다.
 * ④ 마운트 — App 이 로그인한 소비자에게만 붙인다.
 *
 * ⚠️ 못 보는 것: 실제 D1 의 created_at 형식(라이브 확인 필요) · 카카오 가입 직후 실제 흐름.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { isPhoneRequired, PHONE_REQUIRED_SINCE } from '@/shared/phone-required'

let profile: Record<string, unknown> | null = null
vi.mock('@/hooks/queries/useUserProfile', () => ({
  useUserProfile: () => ({ data: profile }),
  useInvalidateUserProfile: () => () => {},
}))
vi.mock('@/lib/api', () => ({ default: { patch: vi.fn(async () => ({ data: { success: true } })) } }))

import PhoneRequiredGate from '@/components/onboarding/PhoneRequiredGate'

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><PhoneRequiredGate /></MemoryRouter>)

describe('① 판정', () => {
  it('기준 시각 이후 가입 + 번호 없음 → 필수', () => {
    expect(isPhoneRequired(null, '2026-11-05 10:00:00')).toBe(true)
    expect(isPhoneRequired('', PHONE_REQUIRED_SINCE)).toBe(true)
    expect(isPhoneRequired(null, '2026-11-05T10:00:00Z')).toBe(true)
  })
  it('기존 회원(기준 이전)·번호 있음·가입일 모름 → 필수 아님', () => {
    expect(isPhoneRequired(null, '2026-10-01 10:00:00')).toBe(false)
    expect(isPhoneRequired('01012345678', '2026-11-05 10:00:00')).toBe(false)
    expect(isPhoneRequired(null, null)).toBe(false)
  })
})

describe('② 서버', () => {
  const src = readFileSync('src/worker/routes/auth.routes.ts', 'utf8')
  it('/me 두 분기 모두 phone_required 를 내린다', () => {
    expect(src.match(/phone_required: isPhoneRequired\(/g)?.length).toBe(2)
    expect(src).toMatch(/SELECT phone, created_at FROM users WHERE id = \?/)
  })
  it('번호는 숫자만 저장, 소식 동의는 marketing 으로 기록', () => {
    expect(src).toMatch(/body\.phone\.replace\(\/\[-\\s\]\/g, ''\)/)
    expect(src).toMatch(/if \(typeof body\.marketing_agreed === 'boolean'\) await recordTermsAgreements\(db, 'user', id, \[\{ doc_type: 'marketing', agreed: body\.marketing_agreed \}\]\)/)
  })
})

describe('③ 창', () => {
  beforeEach(() => { cleanup(); profile = null })
  it('필수일 때만 뜬다', () => {
    profile = { id: '1', phone_required: false }
    at('/').unmount()
    expect(document.querySelector('[data-phone-gate]')).toBeNull()
    profile = { id: '1', phone_required: true }
    at('/')
    expect(document.querySelector('[data-phone-gate]')).not.toBeNull()
  })
  it('닫기 단추가 없고, 소식 체크는 기본 꺼짐, 확인은 번호 전엔 못 누른다', () => {
    profile = { id: '1', phone_required: true }
    at('/')
    const buttons = Array.from(document.querySelectorAll('[data-phone-gate] button'))
    expect(buttons.length).toBe(1)
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true)
    const box = document.querySelector('[data-phone-gate] input[type="checkbox"]') as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByText(/\[선택\]/)).toBeTruthy()
  })
  it('개인정보처리방침·약관·로그인·대시보드에서는 안 뜬다', () => {
    profile = { id: '1', phone_required: true }
    for (const p of ['/privacy', '/terms', '/login', '/auth/kakao/callback', '/seller/orders', '/admin']) {
      const r = at(p)
      expect(document.querySelector('[data-phone-gate]'), p).toBeNull()
      r.unmount()
    }
  })
})

describe('④ 마운트', () => {
  it('App 이 로그인한 소비자에게만 붙인다', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).toMatch(/\{shellNeed\.phone && <Suspense fallback=\{null\}><PhoneRequiredGate \/><\/Suspense>\}/)
    expect(app).toMatch(/phone: \(\(\) => \{ try \{ return !!\(localStorage\.getItem\('user_id'\) \|\| localStorage\.getItem\('session_login'\)\)/)
  })
  it('가입 직후 환영 창(쿠폰·관심 분야·알림톡)은 없다 — 2026-11-04 대표: 환영 쿠폰 없음 · 관심 분야 불필요 · 알림톡 토글은 저장 안 됨', () => {
    const app = readFileSync('src/App.tsx', 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(app).not.toMatch(/OnboardingTrigger|WelcomeOnboardingModal/)
  })
})
