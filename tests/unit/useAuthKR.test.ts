/**
 * 🧪 useAuthKR Zustand Store 단위 테스트
 *
 * 🛡️ 2026-05-01: Firebase 100% 제거 — useAuthKR 는 백엔드 JWT (/api/auth/login,
 *   /api/auth/register, /api/auth/forgot-password, /api/auth/logout) 를 사용.
 *   Firebase mock 불필요, fetch 만 mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useAuthKR,
  useAuthKRError,
  useAuthKRRole,
} from '@/shared/stores/useAuthKR'

// region — KR 강제 (initializeAuth 의 isKorea() 가드 통과)
vi.mock('@/shared/config/region', () => ({
  isKorea: vi.fn(() => true),
}))

// auth-store (api 토큰 캐시 동기화 — 옵션)
vi.mock('@/client/stores/auth.store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
      user: null,
      accessToken: null,
    })),
  },
}))

vi.mock('@/utils/auth', () => ({
  clearAuthData: vi.fn((type: string) => {
    if (type === 'user') {
      localStorage.removeItem('user_type')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_token')
      localStorage.removeItem('user_name')
    }
  }),
}))

vi.mock('@/lib/api', () => ({
  default: {},
  clearFirebaseTokenCache: vi.fn(),
}))

vi.mock('@/lib/react-query', () => ({
  getQueryClient: vi.fn(() => ({ clear: vi.fn() })),
}))

describe('useAuthKR Store (post Firebase removal — backend JWT)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    useAuthKR.setState({
      user: null,
      isLoading: false,
      error: null,
      isAuthReady: false,
      userRole: null,
      tokenCache: null,
    } as any)

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('✅ 초기 상태', () => {
    const { result } = renderHook(() => useAuthKR())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthReady).toBe(false)
  })

  it('✅ setUser', () => {
    const { result } = renderHook(() => useAuthKR())
    const mockUser = { uid: 'test-uid' } as any
    act(() => { result.current.setUser(mockUser) })
    expect(result.current.user).toEqual(mockUser)
  })

  it('✅ setLoading / setAuthReady', () => {
    const { result } = renderHook(() => useAuthKR())
    act(() => { result.current.setLoading(true) })
    expect(result.current.isLoading).toBe(true)
    act(() => { result.current.setAuthReady(true) })
    expect(result.current.isAuthReady).toBe(true)
  })

  it('✅ initializeAuth — KR 도메인이면 즉시 isAuthReady=true, Firebase SDK 로드 0', () => {
    const { result } = renderHook(() => useAuthKR())
    let cleanup: (() => void) | undefined
    act(() => { cleanup = result.current.initializeAuth() })
    expect(result.current.isAuthReady).toBe(true)
    if (cleanup) cleanup()
  })

  describe('loginWithEmail (backend JWT)', () => {
    it('✅ 백엔드 /api/auth/login 호출 → JWT localStorage 저장', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            access_token: 'jwt-access',
            refresh_token: 'jwt-refresh',
            user: { id: '1', email: 'u@test.com', name: 'User', role: 'user' },
          },
        }),
      }) as any

      const { result } = renderHook(() => useAuthKR())
      await act(async () => {
        await result.current.loginWithEmail('u@test.com', 'password')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }))
      expect(localStorage.getItem('user_type')).toBe('user')
      expect(localStorage.getItem('user_token')).toBe('jwt-access')
      expect(localStorage.getItem('user_email')).toBe('u@test.com')
      expect(result.current.userRole).toBe('user')
      expect(result.current.isAuthReady).toBe(true)
    })

    it('❌ 백엔드 401 → 에러 throw, localStorage 안 변경', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }),
      }) as any

      const { result } = renderHook(() => useAuthKR())
      await act(async () => {
        await expect(
          result.current.loginWithEmail('bad@test.com', 'wrong')
        ).rejects.toThrow(/이메일 또는 비밀번호/)
      })

      expect(localStorage.getItem('user_token')).toBeNull()
    })
  })

  describe('signupWithEmail (backend JWT)', () => {
    it('✅ /api/auth/register 호출', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            access_token: 'new-jwt',
            user: { id: '2', email: 'new@test.com', name: 'New' },
          },
        }),
      }) as any

      const { result } = renderHook(() => useAuthKR())
      await act(async () => {
        await result.current.signupWithEmail('new@test.com', 'password', 'New User')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', expect.any(Object))
      expect(result.current.error).toBeNull()
    })
  })

  describe('sendPasswordResetEmail (backend)', () => {
    it('✅ /api/auth/forgot-password 호출', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) as any

      const { result } = renderHook(() => useAuthKR())
      await act(async () => {
        await result.current.sendPasswordResetEmail('forgot@test.com')
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/forgot-password', expect.any(Object))
    })
  })

  describe('logout (no Firebase signOut)', () => {
    it('✅ /api/auth/logout 호출 + localStorage 정리', async () => {
      // setTimeout window.location.href 보호
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      })

      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true }) as any
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_id', '1')

      const { result } = renderHook(() => useAuthKR())
      act(() => {
        result.current.setUser({ uid: 'x' } as any)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }))
      expect(result.current.user).toBeNull()
    })
  })

  it('✅ selectors (error, role)', () => {
    useAuthKR.setState({ error: 'test-error', userRole: 'admin' as any })

    const { result: errResult } = renderHook(() => useAuthKRError())
    expect(errResult.current).toBe('test-error')

    const { result: roleResult } = renderHook(() => useAuthKRRole())
    expect(roleResult.current).toBe('admin')
  })
})
