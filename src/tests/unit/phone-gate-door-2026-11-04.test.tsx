/**
 * 📞🚪 2026-11-04 대표 *"사람들이 대부분 처음 진입하는걸텐데 … 데이터가 느릴 때 많이 느리던데"* —
 * 번호 필수 창의 코드(공용 부품 봉투 `app-components` 109KB)는 **서버가 `phone_required` 라고 할 때만** 받는다.
 * 지키는 것: ① 문지기는 창을 lazy 로만 받는다(정적 import 금지 — 그러면 엔트리에 실린다) ② 필요 없으면 아무것도 안 그린다
 *   ③ "필요 없음" 표시는 **그 사람(user_id)** 에게만 — 다른 사람이 로그인하면 무효 ④ 문지기는 엔트리 쪽(`src/lib/`)에 산다.
 * ⚠️ 못 보는 것: 실제 청크 배치(빌드 산출물은 CI `surface-budgets` 가 본다).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { stripComments } from '../helpers/source-text'

const profile = vi.fn()
vi.mock('@/hooks/queries/useUserProfile', () => ({ useUserProfile: () => profile() }))
import PhoneGateDoor, { phoneOkForCurrentUser, PHONE_OK_KEY } from '@/lib/phone-gate-door'

beforeEach(() => { localStorage.clear(); profile.mockReset() })

describe('번호 창 문지기', () => {
  it('① 창은 lazy 로만 — 정적 import 가 없다', () => {
    const src = stripComments(readFileSync('src/lib/phone-gate-door.tsx', 'utf8'))
    expect(src).toContain("lazy(() => import('@/components/onboarding/PhoneRequiredGate'))")
    expect(src).not.toMatch(/^import [^\n]*PhoneRequiredGate/m)
  })

  it('② 필요 없으면 아무것도 안 그리고, 이 사람에게 표시를 남긴다', () => {
    localStorage.setItem('user_id', '3')
    profile.mockReturnValue({ data: { phone_required: false } })
    const { container } = render(<PhoneGateDoor />)
    expect(container.innerHTML).toBe('')
    expect(localStorage.getItem(PHONE_OK_KEY)).toBe('3')
    expect(phoneOkForCurrentUser(localStorage)).toBe(true)
  })

  it('③ 다른 사람이 로그인하면 앞사람 표시는 무효', () => {
    localStorage.setItem(PHONE_OK_KEY, '3')
    localStorage.setItem('user_id', '30')
    expect(phoneOkForCurrentUser(localStorage)).toBe(false)
    localStorage.removeItem('user_id')
    expect(phoneOkForCurrentUser(localStorage)).toBe(false)
  })

  it('④ App 은 표시가 있으면 문지기조차 안 세운다', () => {
    const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
    expect(app).toContain("import PhoneGateDoor, { phoneOkForCurrentUser } from './lib/phone-gate-door'")
    expect(app).toMatch(/!localStorage\.getItem\('user_phone'\) && !phoneOkForCurrentUser\(localStorage\)/)
  })

  it('⑤ 푸시 설정 부품도 알림 권한이 이미 허용된 사람에게만 세운다(그 밖엔 아무 일도 안 하는 부품이다)', () => {
    const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
    expect(app).toMatch(/push: \(\(\) => \{ try \{ return typeof Notification !== 'undefined' && Notification\.permission === 'granted'/)
    const comp = stripComments(readFileSync('src/components/PushNotificationSetup.tsx', 'utf8'))
    expect(comp, '부품이 granted 아닐 때도 무언가 하게 바뀌면 이 문지기를 다시 볼 것').toMatch(/if \(Notification\.permission !== 'granted'\) return/)
  })
})
