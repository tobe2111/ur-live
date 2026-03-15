/**
 * 🧪 LoginFlowService 단위 테스트
 *
 * 테스트 범위:
 * 1. loginWithKakaoToken - Kakao OAuth → Firebase (via @/lib/firebase-auth)
 * 2. loginWithFirebaseToken - Custom Token → Firebase (via @/lib/firebase-auth)
 * 3. loginSeller - Email/Password → JWT
 * 4. loginAdmin - Email/Password → JWT
 * 5. logout - 타입별 선택적 로그아웃
 * 6. getLoginType - async 로그인 타입 확인
 * 7. getJWTToken - JWT 토큰 가져오기
 *
 * NOTE: login-flow.service.ts 는 firebase/auth 를 직접 쓰지 않고
 *       @/lib/firebase-auth 래퍼를 lazy-import 합니다.
 *       따라서 '@/lib/firebase-auth' 를 mock 해야 합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/lib/api'
import {
  loginWithKakaoToken,
  loginWithFirebaseToken,
  loginSeller,
  loginAdmin,
  logout,
  getLoginType,
  getJWTToken,
  type SellerLoginResponse,
  type AdminLoginResponse,
} from '@/features/auth/login-flow.service'

// ============================================
// Mock: @/lib/firebase-auth (래퍼 모듈)
// ============================================

const mockSignInWithCustomToken = vi.fn()
const mockSignOut = vi.fn()
const mockGetCurrentUser = vi.fn()

// getFirebaseAuth returns a mutable auth-like object so that
// loginWithKakaoToken's setInterval loop can see currentUser after sign-in.
const mockAuthObject = { currentUser: null as { uid: string } | null }

// We need a stable reference for getFirebaseAuth so vi.clearAllMocks()
// doesn't wipe its return value between tests.
const mockGetFirebaseAuth = vi.fn()

vi.mock('@/lib/firebase-auth', () => ({
  signInWithCustomToken: (...args: unknown[]) => mockSignInWithCustomToken(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
}))

// ============================================
// Mock: @/lib/api
// ============================================

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

// ============================================
// Mock: @/utils/auth (clearAuthData)
// ============================================

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
      localStorage.removeItem('loginReturnUrl')
      localStorage.removeItem('user_type')
    }
  }),
}))

// ============================================
// Mock: @/shared/config/region
// ============================================

vi.mock('@/shared/config/region', () => ({
  isKorea: vi.fn(() => false),
}))

// ============================================
// Mock: @/shared/stores/useAuthKR, useAuthWorld
// ============================================

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

// ============================================
// 테스트 시작
// ============================================

describe('LoginFlowService', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()

    // Reset shared auth object
    mockAuthObject.currentUser = null

    // Always return the shared mutable mockAuthObject so setInterval checks work
    mockGetFirebaseAuth.mockResolvedValue(mockAuthObject)

    // 기본 getCurrentUser: 로그인 안 됨
    mockGetCurrentUser.mockResolvedValue(null)

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================
  // 1. loginWithKakaoToken 테스트
  // ============================================

  describe('loginWithKakaoToken', () => {
    it('✅ Kakao 액세스 토큰으로 Firebase 로그인 성공', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          firebaseToken: 'mock-firebase-custom-token',
          user: { id: 1, name: 'Test User' },
        }),
      })

      const mockUser = {
        uid: 'test-firebase-uid',
        getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
      }
      mockSignInWithCustomToken.mockImplementationOnce(async () => {
        // Simulate Firebase setting currentUser after sign-in
        mockAuthObject.currentUser = mockUser
        return { user: mockUser }
      })

      await loginWithKakaoToken('mock-kakao-access-token')

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/kakao/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'mock-kakao-access-token' }),
      })
      expect(mockSignInWithCustomToken).toHaveBeenCalledWith('mock-firebase-custom-token')
    })

    it('✅ customToken 응답 필드도 지원', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customToken: 'mock-custom-token',
        }),
      })

      const mockUser = {
        uid: 'test-uid',
        getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
      }
      mockSignInWithCustomToken.mockImplementationOnce(async () => {
        mockAuthObject.currentUser = mockUser
        return { user: mockUser }
      })

      await loginWithKakaoToken('kakao-token')

      expect(mockSignInWithCustomToken).toHaveBeenCalledWith('mock-custom-token')
    })

    it('❌ Backend API 에러 시 예외 발생', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      await expect(loginWithKakaoToken('invalid-token')).rejects.toThrow('Backend error: 401')
    })

    it('❌ Firebase 토큰 없을 때 예외 발생', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await expect(loginWithKakaoToken('token')).rejects.toThrow(
        'No Firebase token received from backend'
      )
    })

    it('❌ Firebase signInWithCustomToken 실패 시 예외 발생', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ firebaseToken: 'invalid-token' }),
      })

      mockSignInWithCustomToken.mockRejectedValueOnce(new Error('Firebase auth failed'))

      await expect(loginWithKakaoToken('token')).rejects.toThrow('Firebase auth failed')
    })
  })

  // ============================================
  // 2. loginWithFirebaseToken 테스트
  // ============================================

  describe('loginWithFirebaseToken', () => {
    it('✅ Firebase Custom Token으로 직접 로그인 성공', async () => {
      const mockUser = {
        uid: 'direct-uid',
        getIdToken: vi.fn().mockResolvedValue('id-token'),
      }
      mockSignInWithCustomToken.mockImplementationOnce(async () => {
        mockAuthObject.currentUser = mockUser
        return { user: mockUser }
      })

      await loginWithFirebaseToken('direct-custom-token')

      expect(mockSignInWithCustomToken).toHaveBeenCalledWith('direct-custom-token')
    })

    it('❌ Firebase 로그인 실패 시 예외 발생', async () => {
      mockSignInWithCustomToken.mockRejectedValueOnce(new Error('Invalid custom token'))

      await expect(loginWithFirebaseToken('bad-token')).rejects.toThrow('Invalid custom token')
    })
  })

  // ============================================
  // 3. loginSeller 테스트
  // ============================================

  describe('loginSeller', () => {
    it('✅ 셀러 이메일/비밀번호 로그인 성공', async () => {
      const mockResponse: SellerLoginResponse = {
        token: 'seller-jwt-token',
        user: {
          id: 1,
          email: 'seller@test.com',
          name: 'Test Seller',
          role: 'seller',
        },
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await loginSeller('seller@test.com', 'password123')

      expect(api.post).toHaveBeenCalledWith('/auth/seller/login', {
        email: 'seller@test.com',
        password: 'password123',
      })
      expect(result).toEqual(mockResponse)
      expect(localStorage.getItem('seller_token')).toBe('seller-jwt-token')
      expect(localStorage.getItem('user_type')).toBe('seller')
    })

    it('❌ 토큰 없을 때 예외 발생', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { user: {} },
      })

      await expect(loginSeller('seller@test.com', 'password')).rejects.toThrow('No token received')
    })

    it('❌ API 에러 시 에러 메시지 정리', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          data: {
            message: '이메일 또는 비밀번호가 올바르지 않습니다',
          },
        },
      })

      await expect(loginSeller('wrong@test.com', 'wrong')).rejects.toThrow(
        '이메일 또는 비밀번호가 올바르지 않습니다'
      )
    })

    it('❌ 네트워크 에러 시 기본 메시지', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'))

      await expect(loginSeller('seller@test.com', 'password')).rejects.toThrow('Network error')
    })
  })

  // ============================================
  // 4. loginAdmin 테스트
  // ============================================

  describe('loginAdmin', () => {
    it('✅ 어드민 이메일/비밀번호 로그인 성공', async () => {
      const mockResponse: AdminLoginResponse = {
        token: 'admin-jwt-token',
        user: {
          id: 1,
          email: 'admin@test.com',
          name: 'Test Admin',
          role: 'admin',
        },
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await loginAdmin('admin@test.com', 'admin123')

      expect(api.post).toHaveBeenCalledWith('/auth/admin/login', {
        email: 'admin@test.com',
        password: 'admin123',
      })
      expect(result).toEqual(mockResponse)
      expect(localStorage.getItem('admin_token')).toBe('admin-jwt-token')
      expect(localStorage.getItem('user_type')).toBe('admin')
    })

    it('❌ 토큰 없을 때 예외 발생', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { user: {} },
      })

      await expect(loginAdmin('admin@test.com', 'password')).rejects.toThrow('No token received')
    })

    it('❌ API 에러 시 에러 메시지 정리', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          data: {
            message: '권한이 없습니다',
          },
        },
      })

      await expect(loginAdmin('nonadmin@test.com', 'password')).rejects.toThrow('권한이 없습니다')
    })
  })

  // ============================================
  // 5. logout 테스트
  // ============================================

  describe('logout', () => {
    it('✅ Seller 로그아웃 - seller 세션만 정리', async () => {
      localStorage.setItem('seller_token', 'seller-tok')
      localStorage.setItem('user_type', 'seller')

      await logout('seller')

      expect(localStorage.getItem('seller_token')).toBeNull()
    })

    it('✅ Admin 로그아웃 - admin 세션만 정리', async () => {
      localStorage.setItem('admin_token', 'admin-tok')
      localStorage.setItem('user_type', 'admin')

      await logout('admin')

      expect(localStorage.getItem('admin_token')).toBeNull()
    })

    it('✅ User 로그아웃 - Firebase signOut 호출', async () => {
      localStorage.setItem('user_type', 'user')
      mockSignOut.mockResolvedValueOnce(undefined)

      await logout('user')

      expect(mockSignOut).toHaveBeenCalled()
    })

    it('✅ Firebase signOut 실패해도 계속 진행', async () => {
      localStorage.setItem('seller_token', 'token')
      localStorage.setItem('user_type', 'seller')
      mockSignOut.mockRejectedValueOnce(new Error('Firebase error'))

      // seller logout은 Firebase signOut을 호출하지 않으므로 항상 성공
      await expect(logout('seller')).resolves.not.toThrow()
      expect(localStorage.getItem('seller_token')).toBeNull()
    })
  })

  // ============================================
  // 6. getLoginType 테스트 (async!)
  // ============================================

  describe('getLoginType', () => {
    it('✅ Seller 로그인 타입 반환', async () => {
      localStorage.setItem('user_type', 'seller')
      localStorage.setItem('seller_token', 'seller-token')

      expect(await getLoginType()).toBe('seller')
    })

    it('✅ Admin 로그인 타입 반환', async () => {
      localStorage.setItem('user_type', 'admin')
      localStorage.setItem('admin_token', 'admin-token')

      expect(await getLoginType()).toBe('admin')
    })

    it('✅ User (Firebase) 로그인 타입 반환', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ uid: 'firebase-uid' })

      expect(await getLoginType()).toBe('user')
    })

    it('✅ 로그인 안 됨 → null 반환', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null)

      expect(await getLoginType()).toBeNull()
    })

    it('✅ user_type만 있고 토큰 없으면 Firebase로 확인', async () => {
      localStorage.setItem('user_type', 'seller')
      // seller_token 없음 → Firebase로 fallback
      mockGetCurrentUser.mockResolvedValueOnce(null)

      expect(await getLoginType()).toBeNull()
    })
  })

  // ============================================
  // 7. getJWTToken 테스트
  // ============================================

  describe('getJWTToken', () => {
    it('✅ Seller JWT 토큰 가져오기', () => {
      localStorage.setItem('seller_token', 'seller-jwt')
      expect(getJWTToken('seller')).toBe('seller-jwt')
    })

    it('✅ Admin JWT 토큰 가져오기', () => {
      localStorage.setItem('admin_token', 'admin-jwt')
      expect(getJWTToken('admin')).toBe('admin-jwt')
    })

    it('✅ 토큰 없으면 null 반환', () => {
      expect(getJWTToken('seller')).toBeNull()
      expect(getJWTToken('admin')).toBeNull()
    })
  })

  // ============================================
  // 8. 통합 시나리오 테스트
  // ============================================

  describe('통합 시나리오', () => {
    it('✅ Seller 로그인 → 로그아웃 → 다시 User 로그인', async () => {
      // 1. Seller 로그인
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'seller-token',
          user: { id: 1, email: 'seller@test.com', name: 'Seller', role: 'seller' },
        },
      })

      await loginSeller('seller@test.com', 'password')
      expect(await getLoginType()).toBe('seller')

      // 2. Seller 로그아웃
      await logout('seller')
      mockGetCurrentUser.mockResolvedValueOnce(null)
      expect(await getLoginType()).toBeNull()

      // 3. User (Firebase) 로그인
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ firebaseToken: 'firebase-token' }),
      })

      const mockUser = {
        uid: 'user-uid',
        getIdToken: vi.fn().mockResolvedValue('id-token'),
      }
      mockSignInWithCustomToken.mockImplementationOnce(async () => {
        mockAuthObject.currentUser = mockUser
        return { user: mockUser }
      })

      await loginWithKakaoToken('kakao-token')

      // User 로그인 후 getCurrentUser mock
      mockGetCurrentUser.mockResolvedValueOnce({ uid: 'user-uid' })
      expect(await getLoginType()).toBe('user')
    })
  })
})
