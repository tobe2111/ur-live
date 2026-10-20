/**
 * 🧪 LoginFlowService 단위 테스트
 *
 * 🛡️ 2026-05-01: Firebase 100% 제거 — loginWithKakaoToken / loginWithFirebaseToken 삭제됨.
 *   세션 쿠키 기반 인증으로 통일 → 이 테스트는 남은 JWT 기반 함수만 검증.
 *
 * 테스트 범위:
 * 1. loginSeller - Email/Password → JWT
 * 2. loginAdmin - Email/Password → JWT
 * 3. logout - 타입별 선택적 로그아웃 (Firebase signOut 호출 없음)
 * 4. getLoginType - localStorage 기반 (Firebase fallback 제거)
 * 5. getJWTToken - JWT 토큰 가져오기
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/lib/api'
import {
  loginSeller,
  loginAdmin,
  logout,
  getLoginType,
  getJWTToken,
} from '@/features/auth/login-flow.service'

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

vi.mock('@/utils/auth', () => ({
  clearAuthData: vi.fn((type: string) => {
    if (type === 'seller') {
      localStorage.removeItem('seller_token')
      localStorage.removeItem('user_type')
    } else if (type === 'admin') {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('user_type')
    } else if (type === 'user') {
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_type')
    }
  }),
}))

vi.mock('@/shared/config/region', () => ({
  isKorea: vi.fn(() => true),
}))

vi.mock('@/shared/stores/useAuthKR', () => ({
  useAuthKR: {
    getState: vi.fn(() => ({
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setAuthReady: vi.fn(),
    })),
  },
}))

vi.mock('@/shared/stores/useAuthWorld', () => ({
  useAuthWorld: {
    getState: vi.fn(() => ({
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setAuthReady: vi.fn(),
    })),
  },
}))

describe('LoginFlowService (post Firebase removal)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loginSeller', () => {
    it('✅ JWT 토큰을 localStorage 에 저장', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'seller-jwt',
          user: { id: 1, email: 's@test.com', name: 'Seller', role: 'seller' },
        },
      } as any)

      const res = await loginSeller('s@test.com', 'pw')
      expect(localStorage.getItem('seller_token')).toBe('seller-jwt')
      expect(localStorage.getItem('user_type')).toBe('seller')
      expect(res.user.email).toBe('s@test.com')
    })

    it('❌ 토큰 없으면 throw', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 1 } } } as any)
      await expect(loginSeller('s@test.com', 'pw')).rejects.toThrow()
    })
  })

  describe('loginAdmin', () => {
    it('✅ JWT 토큰을 localStorage 에 저장', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'admin-jwt',
          user: { id: 1, email: 'a@test.com', name: 'Admin', role: 'admin' },
        },
      } as any)

      const res = await loginAdmin('a@test.com', 'pw')
      expect(localStorage.getItem('admin_token')).toBe('admin-jwt')
      expect(localStorage.getItem('user_type')).toBe('admin')
      expect(res.user.email).toBe('a@test.com')
    })
  })

  describe('logout', () => {
    it('✅ user 타입 — localStorage 정리 (Firebase 호출 없음)', async () => {
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_name', 'Test')

      // Mock fetch for /api/auth/logout
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true }) as any

      // logout 후 setTimeout 으로 redirect → 즉시 검증
      const promise = logout('user')
      await promise

      // session_login 등 정리 확인 (clearAuthData 가 처리)
      expect(localStorage.getItem('user_name')).toBeNull()
    })

    it('✅ seller 타입 — seller_token 정리', async () => {
      localStorage.setItem('seller_token', 'seller-jwt')
      localStorage.setItem('user_type', 'seller')

      await logout('seller')
      expect(localStorage.getItem('seller_token')).toBeNull()
    })
  })

  describe('getLoginType', () => {
    it('✅ seller 타입 반환 (seller_token 있음)', async () => {
      localStorage.setItem('user_type', 'seller')
      localStorage.setItem('seller_token', 'jwt')
      expect(await getLoginType()).toBe('seller')
    })

    it('✅ admin 타입 반환', async () => {
      localStorage.setItem('user_type', 'admin')
      localStorage.setItem('admin_token', 'jwt')
      expect(await getLoginType()).toBe('admin')
    })

    it('✅ user 타입 — Firebase fallback 없이 localStorage 만 (post Firebase removal)', async () => {
      localStorage.setItem('user_type', 'user')
      expect(await getLoginType()).toBe('user')
    })

    it('✅ 비로그인 → null', async () => {
      expect(await getLoginType()).toBeNull()
    })
  })

  describe('getJWTToken', () => {
    it('✅ seller_token 반환', () => {
      localStorage.setItem('seller_token', 'jwt-s')
      expect(getJWTToken('seller')).toBe('jwt-s')
    })

    it('✅ admin_token 반환', () => {
      localStorage.setItem('admin_token', 'jwt-a')
      expect(getJWTToken('admin')).toBe('jwt-a')
    })

    it('✅ 토큰 없으면 null', () => {
      expect(getJWTToken('seller')).toBeNull()
    })
  })
})
