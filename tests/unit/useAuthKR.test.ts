/**
 * 🧪 useAuthKR Zustand Store 단위 테스트 (간소화 버전)
 *
 * Note: useAuthKR.ts 는 firebase/auth 를 직접 쓰지 않고
 *       @/lib/firebase-auth 래퍼를 lazy-import 합니다.
 *       따라서 '@/lib/firebase-auth' 를 mock 해야 합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useAuthKR,
  useAuthKRUser,
  useAuthKRLoading,
  useAuthKRError,
  useAuthKRRole,
  useAuthKRReady,
} from '@/shared/stores/useAuthKR'

// ── Mock: @/lib/firebase-auth (래퍼) ────────────────────────────────────────
const mockSignInWithEmail = vi.fn()
const mockCreateUser = vi.fn()
const mockSignOut = vi.fn()
const mockSendPasswordReset = vi.fn()
const mockOnAuthStateChanged = vi.fn()
const mockGetFirebaseAuth = vi.fn()

vi.mock('@/lib/firebase-auth', () => ({
  signInWithEmailAndPassword: (...a: unknown[]) => mockSignInWithEmail(...a),
  createUserWithEmailAndPassword: (...a: unknown[]) => mockCreateUser(...a),
  signOut: (...a: unknown[]) => mockSignOut(...a),
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordReset(...a),
  onAuthStateChanged: (...a: unknown[]) => mockOnAuthStateChanged(...a),
  getFirebaseAuth: (...a: unknown[]) => mockGetFirebaseAuth(...a),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  signInWithCustomToken: vi.fn().mockResolvedValue({ user: { uid: 'mock' } }),
}))

// ── Mock: @/lib/firebase ─────────────────────────────────────────────────────
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  app: { name: '[DEFAULT]' },
  db: {},
}))

// ── Mock: @/lib/firebase-config ──────────────────────────────────────────────
vi.mock('@/lib/firebase-config', () => ({
  initializeAll: vi.fn().mockResolvedValue({ name: '[DEFAULT]' }),
  initializeFirebase: vi.fn().mockResolvedValue({ name: '[DEFAULT]' }),
}))

// ── describe ─────────────────────────────────────────────────────────────────

describe('useAuthKR Store (간소화 버전)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    mockGetFirebaseAuth.mockResolvedValue({ currentUser: null })
    mockSignOut.mockResolvedValue(undefined)
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: null) => void) => {
      cb(null)
      return vi.fn()
    })

    useAuthKR.setState({
      user: null,
      isLoading: false,
      error: null,
      isAuthReady: false,
      userRole: null,
    })

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── basic state ────────────────────────────────────────────────────────────

  it('✅ 초기 상태가 올바르게 설정됨', () => {
    const { result } = renderHook(() => useAuthKR())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('✅ setUser - 사용자 설정', () => {
    const { result } = renderHook(() => useAuthKR())
    const mockUser = { uid: 'test-uid' } as Parameters<typeof result.current.setUser>[0]

    act(() => {
      result.current.setUser(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)
  })

  it('✅ setLoading - 로딩 상태 설정', () => {
    const { result } = renderHook(() => useAuthKR())

    act(() => {
      result.current.setLoading(true)
    })

    expect(result.current.isLoading).toBe(true)
  })

  // ── loginWithEmail ─────────────────────────────────────────────────────────

  it('✅ 이메일/비밀번호 로그인 성공', async () => {
    const { result } = renderHook(() => useAuthKR())

    const mockUser = {
      uid: 'test-uid',
      email: 'test@test.com',
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    }
    // loginWithEmail calls signIn then relies on onAuthStateChanged to set user.
    // We verify the call was made and no error state was set.
    mockSignInWithEmail.mockResolvedValueOnce({ user: mockUser })

    global.fetch = vi.fn().mockResolvedValueOnce({
      json: async () => ({ role: 'user' }),
    })

    await act(async () => {
      await result.current.loginWithEmail('test@test.com', 'password123')
    })

    expect(mockSignInWithEmail).toHaveBeenCalledWith('test@test.com', 'password123')
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  // ── signupWithEmail ────────────────────────────────────────────────────────

  it('✅ 이메일 회원가입 성공', async () => {
    const { result } = renderHook(() => useAuthKR())

    const mockUser = {
      uid: 'new-user-uid',
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    }
    // signupWithEmail calls createUser then relies on onAuthStateChanged to set user.
    // We verify the call was made and no error state was set.
    mockCreateUser.mockResolvedValueOnce({ user: mockUser })

    global.fetch = vi.fn().mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    await act(async () => {
      await result.current.signupWithEmail('newuser@test.com', 'password123', 'New User')
    })

    expect(mockCreateUser).toHaveBeenCalledWith('newuser@test.com', 'password123')
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  // ── sendPasswordResetEmail ─────────────────────────────────────────────────

  it('✅ 비밀번호 재설정 이메일 발송 성공', async () => {
    const { result } = renderHook(() => useAuthKR())
    mockSendPasswordReset.mockResolvedValueOnce(undefined)

    await act(async () => {
      await result.current.sendPasswordResetEmail('test@test.com')
    })

    expect(mockSendPasswordReset).toHaveBeenCalledWith('test@test.com')
  })

  // ── logout ────────────────────────────────────────────────────────────────

  it('✅ 로그아웃 성공 - Firebase + localStorage 정리', async () => {
    const { result } = renderHook(() => useAuthKR())

    act(() => {
      result.current.setUser({ uid: 'test-uid' } as Parameters<typeof result.current.setUser>[0])
    })
    localStorage.setItem('user', 'test-user')

    mockSignOut.mockResolvedValueOnce(undefined)

    await act(async () => {
      await result.current.logout()
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  // ── selectors ────────────────────────────────────────────────────────────

  it('✅ useAuthKRUser selector', () => {
    const mockUser = { uid: 'test-uid' } as Parameters<typeof useAuthKR.setState>[0] extends { user: infer U } ? U : never
    useAuthKR.setState({ user: mockUser as Parameters<typeof useAuthKR.setState>[0] extends { user: infer U } ? U : never })

    const { result } = renderHook(() => useAuthKRUser())
    expect(result.current).toEqual(mockUser)
  })

  it('✅ useAuthKRLoading selector', () => {
    useAuthKR.setState({ isLoading: true })

    const { result } = renderHook(() => useAuthKRLoading())
    expect(result.current).toBe(true)
  })

  // ── regression tests ─────────────────────────────────────────────────────

  it('🆕 initializeAuth — isAuthReady becomes true when onAuthStateChanged fires with null user', async () => {
    const { result } = renderHook(() => useAuthKR())

    mockOnAuthStateChanged.mockImplementationOnce((_auth: unknown, cb: (u: null) => void) => {
      cb(null)
      return vi.fn()
    })

    await act(async () => {
      const cleanup = result.current.initializeAuth()
      await new Promise((r) => setTimeout(r, 20))
      cleanup()
    })

    expect(result.current.isAuthReady).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('🆕 initializeAuth — isAuthReady becomes true even if firebase-auth import throws (BUG #9)', async () => {
    const { result } = renderHook(() => useAuthKR())

    // Simulate import failure by throwing from getFirebaseAuth
    mockGetFirebaseAuth.mockRejectedValueOnce(new Error('Firebase SDK not available'))
    mockOnAuthStateChanged.mockImplementationOnce(() => {
      throw new Error('Firebase SDK not available')
    })

    await act(async () => {
      const cleanup = result.current.initializeAuth()
      await new Promise((r) => setTimeout(r, 30))
      cleanup()
    })

    // isAuthReady must be true so the app doesn't hang
    expect(result.current.isAuthReady).toBe(true)
  })

  it('🆕 logout — isAuthReady stays true after logout (no infinite loading)', async () => {
    const { result } = renderHook(() => useAuthKR())
    useAuthKR.setState({ user: { uid: 'u1' } as Parameters<typeof useAuthKR.setState>[0] extends { user: infer U } ? U : never, isAuthReady: true })

    mockSignOut.mockResolvedValueOnce(undefined)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthReady).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('🆕 setAuthReady action works correctly', () => {
    const { result } = renderHook(() => useAuthKR())

    act(() => { result.current.setAuthReady(true) })
    expect(result.current.isAuthReady).toBe(true)

    act(() => { result.current.setAuthReady(false) })
    expect(result.current.isAuthReady).toBe(false)
  })

  it('🆕 loginWithEmail — seller/admin role is rejected and Firebase sign-out called', async () => {
    const { result } = renderHook(() => useAuthKR())

    const mockSellerUser = {
      uid: 'seller-uid',
      email: 'seller@test.com',
      displayName: 'Seller',
      getIdToken: vi.fn().mockResolvedValue('seller-token'),
    }
    mockSignInWithEmail.mockResolvedValueOnce({ user: mockSellerUser })

    global.fetch = vi.fn().mockResolvedValueOnce({
      json: async () => ({ role: 'seller' }),
    })

    await act(async () => {
      await expect(
        result.current.loginWithEmail('seller@test.com', 'password')
      ).rejects.toThrow(/seller/i)
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  it('🆕 useAuthKRError and useAuthKRRole selectors', () => {
    useAuthKR.setState({ error: 'test-error', userRole: 'admin' })

    const { result: errResult } = renderHook(() => useAuthKRError())
    expect(errResult.current).toBe('test-error')

    const { result: roleResult } = renderHook(() => useAuthKRRole())
    expect(roleResult.current).toBe('admin')
  })
})
