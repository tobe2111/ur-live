/**
 * `utils/auth.requireLogin()` 단위 테스트.
 *
 * auth path / 외부 URL / 위험 경로 진입 시 returnUrl 자기참조 차단 회귀.
 * safeInternalPath 헬퍼 통해 검증.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const localStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
    __store: store,
  }
})()

const sessionStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
  }
})()

beforeEach(() => {
  localStorageMock.clear()
  sessionStorageMock.clear()
  vi.stubGlobal('localStorage', localStorageMock)
  vi.stubGlobal('sessionStorage', sessionStorageMock)
  vi.stubGlobal('alert', vi.fn())
})

async function callRequireLogin(pathname: string, search = '') {
  vi.stubGlobal('window', { location: { pathname, search } })
  const navigate = vi.fn()
  const { requireLogin } = await import('@/utils/auth')
  requireLogin(navigate, '', false)
  return { navigate, navigateArg: navigate.mock.calls[0]?.[0] as string | undefined }
}

describe('requireLogin', () => {
  describe('안전 경로 — returnUrl 저장 + 전달', () => {
    it('/products/123 → returnUrl 저장 + /login?returnUrl 으로 navigate', async () => {
      const { navigateArg } = await callRequireLogin('/products/123')
      expect(navigateArg).toContain('/login?returnUrl=')
      expect(navigateArg).toContain(encodeURIComponent('/products/123'))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('loginReturnUrl', '/products/123')
    })

    it('쿼리 포함 path 도 정상', async () => {
      const { navigateArg } = await callRequireLogin('/checkout', '?step=2')
      expect(navigateArg).toContain(encodeURIComponent('/checkout?step=2'))
    })
  })

  describe('자기참조 / auth path — returnUrl 생략', () => {
    it.each([
      '/login',
      '/seller/login',
      '/admin/login',
      '/agency/login',
      '/auth/kakao/sync/callback',
      '/oauth/google/callback',
    ])('%s → returnUrl 없이 /login 으로만 navigate', async (path) => {
      const { navigateArg } = await callRequireLogin(path)
      expect(navigateArg).toBe('/login')
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('loginReturnUrl', expect.any(String))
    })
  })
})
