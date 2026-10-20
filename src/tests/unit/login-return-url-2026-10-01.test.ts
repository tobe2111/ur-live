/**
 * 🔑 2026-10-01 — 로그인하면 보던 링크로 **안 돌아오던** 것 (대표 신고)
 *
 * 대표: *"로그인이 안된 상태에서 해당 링크를 보고, 로그인을 하면 그 링크로 돌아가야 하는데
 * 메인페이지로 돌아가고 있어."*
 *
 * ## 무엇이 틀렸나 — 쓰는 사람만 있고 읽는 사람이 없었다
 *
 * 로그인 벽을 치는 화면들은 `localStorage.loginReturnUrl` 에 돌아갈 곳을 적어 두고 `/login` 으로
 * 보낸다(실측 **9개 파일**). 그런데 `LoginPage` 는 그 키를 **한 번도 읽지 않았다.**
 * 게다가 그때 `'/'` 가 `?redirect=/` 로 실려 나가 카카오 콜백의 `safeInternalPath(state, stored)`
 * 에서 **저장된 값을 이겼다** — 그래서 화면이 적어 둔 주소는 어느 경로로도 쓰이지 못했다.
 *
 * 에러도 로그도 없고 화면은 멀쩡히 홈을 보여 준다. 이 레포가 반복해 만난 **조용한 부재**다.
 *
 * ⚠️ 이 파일이 **못** 보는 것: 실제 브라우저의 카카오 왕복(서버 `/auth/kakao/start` → 콜백),
 *   `safeInternalPath` 자체의 판정(그건 `safe-internal-path` 시험의 몫), 그리고 화면이 **어느 시점에**
 *   값을 적는지. 여기서는 **고르기 로직과 배선**만 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveLoginReturnUrl, clearLoginReturnUrl, LOGIN_RETURN_KEY } from '@/utils/login-return'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
const LOGIN = stripComments(read('pages/LoginPage.tsx'))

function mkStore() {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    removeItem: vi.fn((k: string) => { delete store[k] }),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', mkStore())
  vi.stubGlobal('sessionStorage', mkStore())
})

describe('① 고르기 — 화면이 적어 둔 곳으로 돌아간다', () => {
  it('🩸 쿼리도 세션도 없을 때 `localStorage.loginReturnUrl` 로 돌아간다 (이 결함의 본체)', () => {
    localStorage.setItem(LOGIN_RETURN_KEY, '/pass/2916')
    expect(resolveLoginReturnUrl(null)).toBe('/pass/2916')
  })

  it('쿼리가 가장 세다', () => {
    sessionStorage.setItem('returnUrl', '/b')
    localStorage.setItem(LOGIN_RETURN_KEY, '/c')
    expect(resolveLoginReturnUrl('/a')).toBe('/a')
  })

  it('쿼리가 없으면 세션이 localStorage 보다 세다', () => {
    sessionStorage.setItem('returnUrl', '/b')
    localStorage.setItem(LOGIN_RETURN_KEY, '/c')
    expect(resolveLoginReturnUrl(null)).toBe('/b')
  })

  it("앞 후보가 '/' 로 떨어지면 다음 후보를 본다 — '/' 가 저장값을 이기면 안 된다", () => {
    // 종전 결함의 마지막 고리: LoginPage 가 '/' 를 만들어 콜백 state 로 보내 저장값을 눌렀다.
    localStorage.setItem(LOGIN_RETURN_KEY, '/pass/2916')
    expect(resolveLoginReturnUrl('/')).toBe('/pass/2916')
    expect(resolveLoginReturnUrl('https://evil.example/x')).toBe('/pass/2916')
  })

  it('아무것도 없으면 홈', () => {
    expect(resolveLoginReturnUrl(null)).toBe('/')
  })
})

describe('② 안전 — safeInternalPath 규칙을 그대로 받는다', () => {
  it.each([
    ['https://evil.example/x', '외부 URL'],
    ['//evil.example/x', 'protocol-relative'],
    ['/login', '자기참조'],
    ['/auth/kakao/callback', '인증 경로'],
  ])('%s 는 복귀 주소가 되지 않는다 (%s)', (bad) => {
    localStorage.setItem(LOGIN_RETURN_KEY, bad)
    expect(resolveLoginReturnUrl(null)).toBe('/')
  })

  it('저장소가 막혀 있어도(private mode) 던지지 않는다', () => {
    // ⚠️ `clear` 는 공용 setup 의 afterEach 가 부른다 — 빠뜨리면 **단언이 아니라 뒷정리**에서 깨진다.
    const blocked = () => { throw new Error('blocked') }
    const stub = { getItem: blocked, setItem: blocked, removeItem: blocked, clear: () => {} }
    vi.stubGlobal('localStorage', stub)
    vi.stubGlobal('sessionStorage', stub)
    expect(resolveLoginReturnUrl(null)).toBe('/')
    expect(() => clearLoginReturnUrl()).not.toThrow()
  })

  it('복귀 뒤에는 지운다 — 남으면 다음 로그인이 옛 주소로 간다', () => {
    localStorage.setItem(LOGIN_RETURN_KEY, '/pass/2916')
    sessionStorage.setItem('returnUrl', '/pass/2916')
    clearLoginReturnUrl()
    expect(resolveLoginReturnUrl(null)).toBe('/')
  })
})

describe('③ 배선 — LoginPage 가 실제로 이 SSOT 를 쓴다', () => {
  it('🔴 마운트 시 복귀 주소를 SSOT 로 고른다', () => {
    expect(LOGIN).toMatch(/returnUrlRef\.current = resolveLoginReturnUrl\(searchParams\.get\('returnUrl'\)\)/)
  })

  it('🔴 카카오로 보낼 때도 **같은** SSOT 로 고른다', () => {
    expect(LOGIN).toMatch(/const currentReturnUrl = resolveLoginReturnUrl\(searchParams\.get\('returnUrl'\)\)/)
  })

  it('옛 수동 체인(쿼리||세션||"/")이 되살아나지 않는다', () => {
    expect(LOGIN).not.toMatch(/sessionStorage\.getItem\('returnUrl'\)\s*\n?\s*\|\|\s*'\/'/)
    expect(LOGIN).not.toMatch(/searchParams\.get\('returnUrl'\)\s*\|\|\s*sessionStorage/)
  })

  it('복귀 후 지운다 (두 경로 모두 — 자동 리다이렉트 · 이메일 로그인)', () => {
    expect((LOGIN.match(/clearLoginReturnUrl\(\)/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('④ writer 들이 같은 키를 쓴다 — 갈리면 또 조용히 헛돈다', () => {
  const WRITERS = [
    'pages/GroupBuyDetailPage.tsx',
    'pages/ProductDetailPage.tsx',
    'pages/VoucherDetailPage.tsx',
    'pages/WishlistPage.tsx',
    'pages/CouponClaimPage.tsx',
    'components/WishlistButton.tsx',
    'pages/group-buy/deal-join-error.ts',
    'lib/api.ts',
  ]

  it.each(WRITERS)('%s 는 loginReturnUrl 에 적는다', (f) => {
    expect(stripComments(read(f))).toContain(LOGIN_RETURN_KEY)
  })

  it('SSOT 상수가 그 키와 같다 (이름이 갈리면 reader 가 못 읽는다)', () => {
    expect(LOGIN_RETURN_KEY).toBe('loginReturnUrl')
  })

  it('writer 가 8곳 미만이면 목록이 낡은 것 — 통과가 아니라 고장', () => {
    expect(WRITERS.length).toBeGreaterThanOrEqual(8)
  })
})
