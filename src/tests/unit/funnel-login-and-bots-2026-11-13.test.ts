/**
 * 📈 퍼널 숫자를 믿을 수 있게 (2026-11-13 대표 *"응 해봐"* — 결제 0건 원인 찾기)
 *
 * ① '로그인 성공' 이 8월부터 0건이었다(벽 230 → 성공 0) — 계측이 안 쓰이는 `KakaoCallbackPage` 에만 있었다.
 *    실제 로그인은 서버 콜백 → `?login=success` → `auth-callback-bootstrap` 으로 끝난다. 거기서 표식을 남기고
 *    App 의 app_open 자리가 보낸다.
 * ② 유입·퍼널이 자동 브라우저(점검 스크립트·봇)를 사람으로 셌다 — 유입 251건이 전부 '새 방문자'.
 * ⚠️ 못 보는 것: navigator.webdriver 를 숨기는 봇 · 실제 카카오 로그인(라이브로만 판정)
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(() => Promise.resolve({})) } }))
import api from '@/lib/api'
import { trackFunnel } from '@/lib/funnel'
import { storeAffiliateRef } from '@/utils/affiliate-track'

const read = (p: string) => readFileSync(p, 'utf8')
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks() })

describe('① 로그인 성공 계측', () => {
  it('실제 로그인 경로가 표식을 남기고, App 이 그것을 로그인 성공으로 보낸다', () => {
    expect(read('src/utils/auth-callback-bootstrap.ts')).toContain("sessionStorage.setItem('ur_login_ok_pending', urlParams.get('new') === '1' ? 'new' : '1')")
    const app = read('src/App.tsx')
    expect(app).toMatch(/sessionStorage\.getItem\('ur_login_ok_pending'\)[^\n]*sessionStorage\.removeItem\('ur_login_ok_pending'\)[^\n]*trackFunnel\('login_succeeded'/)
  })
  it('표식은 세션 비우기(sessionStorage.clear) 뒤에 남는다', () => {
    const s = read('src/utils/auth-callback-bootstrap.ts')
    expect(s.indexOf("ur_login_ok_pending")).toBeGreaterThan(s.indexOf('sessionStorage.clear()'))
  })
})

describe('② 자동 브라우저는 세지 않는다', () => {
  it('퍼널 · 유입 모두', () => {
    const beacon = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    trackFunnel('login_wall_shown')
    storeAffiliateRef('777')
    expect(beacon).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalledWith('/api/acquisition/inflow', expect.anything())
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    trackFunnel('login_wall_shown')
    storeAffiliateRef('778')
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/acquisition/inflow', expect.objectContaining({ ref: '778' }))
  })
})
