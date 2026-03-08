/**
 * 🧪 LoginFlowService 단위 테스트
 * 
 * 테스트 범위:
 * 1. loginWithKakaoToken - Kakao OAuth → Firebase
 * 2. loginWithFirebaseToken - Custom Token → Firebase
 * 3. loginSeller - Email/Password → JWT
 * 4. loginAdmin - Email/Password → JWT
 * 5. logout - 통합 로그아웃
 * 6. getLoginType - 로그인 타입 확인
 * 7. getJWTToken - JWT 토큰 가져오기
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
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
// Mock 설정
// ============================================

vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
    signOut: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

// ============================================
// 테스트 시작
// ============================================

describe('LoginFlowService', () => {
  // 각 테스트 전에 localStorage 정리
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    
    // console.log, console.warn, console.error 무시
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
      // Mock: Backend API 응답
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          firebaseToken: 'mock-firebase-custom-token',
          user: { id: 1, name: 'Test User' },
        }),
      })

      // Mock: Firebase signInWithCustomToken
      const mockUser = {
        uid: 'test-firebase-uid',
        getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
      }
      const mockCredential = { user: mockUser }
      vi.mocked(signInWithCustomToken).mockResolvedValueOnce(mockCredential as any)

      // 실행
      await loginWithKakaoToken('mock-kakao-access-token')

      // 검증
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/kakao/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'mock-kakao-access-token' }),
      })
      expect(signInWithCustomToken).toHaveBeenCalledWith(auth, 'mock-firebase-custom-token')
      expect(mockUser.getIdToken).toHaveBeenCalledWith(true)
    })

    it('✅ customToken 응답 필드도 지원', async () => {
      // Mock: Backend API 응답 (customToken 필드)
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customToken: 'mock-custom-token', // firebaseToken 대신 customToken
        }),
      })

      const mockUser = {
        uid: 'test-uid',
        getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
      }
      vi.mocked(signInWithCustomToken).mockResolvedValueOnce({ user: mockUser } as any)

      await loginWithKakaoToken('kakao-token')

      expect(signInWithCustomToken).toHaveBeenCalledWith(auth, 'mock-custom-token')
    })

    it('❌ Backend API 에러 시 예외 발생', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      await expect(
        loginWithKakaoToken('invalid-token')
      ).rejects.toThrow('Backend error: 401')
    })

    it('❌ Firebase 토큰 없을 때 예외 발생', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // 토큰 없음
      })

      await expect(
        loginWithKakaoToken('token')
      ).rejects.toThrow('No Firebase token received from backend')
    })

    it('❌ Firebase signInWithCustomToken 실패 시 예외 발생', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ firebaseToken: 'invalid-token' }),
      })

      vi.mocked(signInWithCustomToken).mockRejectedValueOnce(
        new Error('Firebase auth failed')
      )

      await expect(
        loginWithKakaoToken('token')
      ).rejects.toThrow('Firebase auth failed')
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
      vi.mocked(signInWithCustomToken).mockResolvedValueOnce({ user: mockUser } as any)

      await loginWithFirebaseToken('direct-custom-token')

      expect(signInWithCustomToken).toHaveBeenCalledWith(auth, 'direct-custom-token')
      expect(mockUser.getIdToken).toHaveBeenCalledWith(true)
    })

    it('❌ Firebase 로그인 실패 시 예외 발생', async () => {
      vi.mocked(signInWithCustomToken).mockRejectedValueOnce(
        new Error('Invalid custom token')
      )

      await expect(
        loginWithFirebaseToken('bad-token')
      ).rejects.toThrow('Invalid custom token')
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
        data: { user: {} }, // token 필드 없음
      })

      await expect(
        loginSeller('seller@test.com', 'password')
      ).rejects.toThrow('No token received')
    })

    it('❌ API 에러 시 에러 메시지 정리', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          data: {
            message: '이메일 또는 비밀번호가 올바르지 않습니다',
          },
        },
      })

      await expect(
        loginSeller('wrong@test.com', 'wrong')
      ).rejects.toThrow('이메일 또는 비밀번호가 올바르지 않습니다')
    })

    it('❌ 네트워크 에러 시 기본 메시지', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'))

      await expect(
        loginSeller('seller@test.com', 'password')
      ).rejects.toThrow('Network error')
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
        data: { user: {} }, // token 필드 없음
      })

      await expect(
        loginAdmin('admin@test.com', 'password')
      ).rejects.toThrow('No token received')
    })

    it('❌ API 에러 시 에러 메시지 정리', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          data: {
            message: '권한이 없습니다',
          },
        },
      })

      await expect(
        loginAdmin('nonadmin@test.com', 'password')
      ).rejects.toThrow('권한이 없습니다')
    })
  })

  // ============================================
  // 5. logout 테스트
  // ============================================

  describe('logout', () => {
    it('✅ 통합 로그아웃 성공 - Firebase + localStorage 정리', async () => {
      // localStorage에 데이터 설정
      localStorage.setItem('user_name', 'Test User')
      localStorage.setItem('loginReturnUrl', '/profile')
      localStorage.setItem('seller_token', 'seller-token')
      localStorage.setItem('admin_token', 'admin-token')
      localStorage.setItem('user_type', 'seller')

      // Mock: Firebase signOut
      vi.mocked(auth.signOut).mockResolvedValueOnce(undefined)

      await logout()

      // 검증: Firebase signOut 호출
      expect(auth.signOut).toHaveBeenCalled()

      // 검증: localStorage 정리
      expect(localStorage.getItem('user_name')).toBeNull()
      expect(localStorage.getItem('loginReturnUrl')).toBeNull()
      expect(localStorage.getItem('seller_token')).toBeNull()
      expect(localStorage.getItem('admin_token')).toBeNull()
      expect(localStorage.getItem('user_type')).toBeNull()
    })

    it('✅ Firebase signOut 실패해도 계속 진행', async () => {
      localStorage.setItem('seller_token', 'token')
      
      // Mock: Firebase signOut 실패
      vi.mocked(auth.signOut).mockRejectedValueOnce(new Error('Firebase error'))

      // 예외 발생하지 않고 계속 진행
      await expect(logout()).resolves.not.toThrow()

      // localStorage는 정리됨
      expect(localStorage.getItem('seller_token')).toBeNull()
    })
  })

  // ============================================
  // 6. getLoginType 테스트
  // ============================================

  describe('getLoginType', () => {
    it('✅ Seller 로그인 타입 반환', () => {
      localStorage.setItem('user_type', 'seller')
      localStorage.setItem('seller_token', 'seller-token')

      expect(getLoginType()).toBe('seller')
    })

    it('✅ Admin 로그인 타입 반환', () => {
      localStorage.setItem('user_type', 'admin')
      localStorage.setItem('admin_token', 'admin-token')

      expect(getLoginType()).toBe('admin')
    })

    it('✅ User (Firebase) 로그인 타입 반환', () => {
      // Mock: Firebase currentUser
      ;(auth as any).currentUser = { uid: 'firebase-uid' }

      expect(getLoginType()).toBe('user')
      
      // Cleanup
      ;(auth as any).currentUser = null
    })

    it('✅ 로그인 안 됨 → null 반환', () => {
      expect(getLoginType()).toBeNull()
    })

    it('✅ user_type만 있고 토큰 없으면 null', () => {
      localStorage.setItem('user_type', 'seller')
      // seller_token 없음

      expect(getLoginType()).toBeNull()
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
      expect(getLoginType()).toBe('seller')

      // 2. 로그아웃
      vi.mocked(auth.signOut).mockResolvedValueOnce(undefined)
      await logout()
      expect(getLoginType()).toBeNull()

      // 3. User (Firebase) 로그인
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ firebaseToken: 'firebase-token' }),
      })
      
      const mockUser = {
        uid: 'user-uid',
        getIdToken: vi.fn().mockResolvedValue('id-token'),
      }
      vi.mocked(signInWithCustomToken).mockResolvedValueOnce({ user: mockUser } as any)
      ;(auth as any).currentUser = mockUser

      await loginWithKakaoToken('kakao-token')
      expect(getLoginType()).toBe('user')

      // Cleanup
      ;(auth as any).currentUser = null
    })
  })
})
