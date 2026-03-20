/**
 * useAuth — 앱 전체 단일 인증 스토어
 *
 * 설계 원칙:
 * 1. Firebase onAuthStateChanged 가 유일한 진실의 원천(SSoT).
 *    로그인/콜백 페이지에서 절대 setUser() / setReady() 를 직접 호출하지 않는다.
 *    signInWithCustomToken / signInWithEmailAndPassword 가 완료되면
 *    Firebase SDK 가 IndexedDB 세션을 즉시 업데이트하고,
 *    동기적으로 onAuthStateChanged 를 발생시켜 이 스토어가 자동으로 갱신된다.
 *
 * 2. 스토어는 단 하나. useAuthKR / useAuthWorld / useAuthStore 전부 제거.
 *    어디서든 `useAuth()` 하나만 import 한다.
 *
 * 3. getIdToken() 은 Firebase auth.currentUser.getIdToken() 을 직접 호출.
 *    Firebase SDK 가 토큰 캐싱·갱신을 내부적으로 처리하므로 별도 캐시 불필요.
 *
 * 4. Seller / Admin 은 이 스토어를 사용하지 않는다.
 *    localStorage 의 seller_token / admin_token 을 직접 확인한다.
 */

import { create } from 'zustand'
import type { User as FirebaseUser } from 'firebase/auth'

// ─── 타입 ──────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'seller' | 'admin'

export interface AuthState {
  /** Firebase User 객체. null = 비로그인 또는 초기화 전 */
  user: FirebaseUser | null
  /** Firebase onAuthStateChanged 첫 콜백 완료 여부.
   *  true 가 되기 전까지 ProtectedRoute 는 스피너를 보여준다. */
  isReady: boolean
  /** DB에서 확인된 역할. null = 아직 조회 전 */
  role: UserRole | null
  /** 로딩 상태 (이메일 로그인/가입 등의 작업 중) */
  isLoading: boolean
  /** 에러 메시지 */
  error: string | null

  // ── 내부용 (AuthProvider 에서만 호출) ────────────────────────────────────
  _setUser: (user: FirebaseUser | null, role: UserRole | null) => void
  _setReady: () => void

  // ── 공개 액션 ─────────────────────────────────────────────────────────────
  /** Firebase ID Token 반환 (내부 캐싱은 Firebase SDK 가 담당) */
  getIdToken: () => Promise<string | null>
  /** 이메일/비밀번호 로그인 */
  loginWithEmail: (email: string, password: string) => Promise<void>
  /** 이메일/비밀번호 회원가입 */
  signupWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  /** 카카오 로그인 (OAuth redirect) */
  loginWithKakao: () => void
  /** 비밀번호 재설정 이메일 발송 */
  sendPasswordReset: (email: string) => Promise<void>
  /** 로그아웃 */
  logout: () => Promise<void>
  /** 에러 초기화 */
  clearError: () => void
}

// ─── 스토어 ────────────────────────────────────────────────────────────────

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  isReady: false,
  role: null,
  isLoading: false,
  error: null,

  _setUser: (user, role) => set({ user, role }),
  _setReady: () => set({ isReady: true }),

  clearError: () => set({ error: null }),

  getIdToken: async () => {
    const { user } = get()
    if (!user) return null
    try {
      // Firebase SDK 가 내부적으로 캐싱 + 만료 전 자동 갱신
      return await user.getIdToken(false)
    } catch (err) {
      console.error('[useAuth] getIdToken 실패:', err)
      return null
    }
  },

  loginWithEmail: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { signInWithEmailAndPassword } = await import('@/lib/firebase-auth')
      const { user } = await signInWithEmailAndPassword(email, password)

      // 역할 확인 (seller/admin 차단)
      const idToken = await user.getIdToken(true)
      const res = await fetch('/api/users/role', {
        headers: { Authorization: `Bearer ${idToken}` },
      })
      const body = (await res.json().catch(() => ({ role: 'user' }))) as { role?: string }
      const role: string = body.role || 'user'

      if (role === 'seller' || role === 'admin') {
        const { signOut } = await import('@/lib/firebase-auth')
        await signOut().catch(() => {})
        set({ isLoading: false })
        throw new Error(`${role} 계정은 /seller/login 또는 /admin/login을 이용하세요.`)
      }

      // localStorage 동기화
      localStorage.setItem('user_type', 'user')
      const displayName = user.displayName || user.email?.split('@')[0] || 'User'
      localStorage.setItem('user_name', displayName)

      // onAuthStateChanged 가 user/isReady 를 자동 업데이트
      set({ isLoading: false, error: null })
    } catch (err: any) {
      set({ error: err.message || '로그인 실패', isLoading: false })
      throw err
    }
  },

  signupWithEmail: async (email, password, displayName) => {
    set({ isLoading: true, error: null })
    try {
      const { createUserWithEmailAndPassword } = await import('@/lib/firebase-auth')
      const { user } = await createUserWithEmailAndPassword(email, password)

      await fetch('/api/users/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ displayName }),
      }).catch(() => {})

      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_name', displayName ?? email.split('@')[0])
      set({ isLoading: false, error: null })
    } catch (err: any) {
      set({ error: err.message || '회원가입 실패', isLoading: false })
      throw err
    }
  },

  loginWithKakao: () => {
    // returnUrl 은 호출 전에 sessionStorage 에 저장되어 있어야 함
    const KAKAO_REST_API_KEY = (import.meta as any).env?.VITE_KAKAO_REST_API_KEY
    if (!KAKAO_REST_API_KEY) {
      console.error('[useAuth] VITE_KAKAO_REST_API_KEY 환경변수 누락')
      return
    }
    const REDIRECT_URI = `${window.location.origin}/auth/kakao/sync/callback`
    const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/'
    const kakaoAuthUrl =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(returnUrl)}`
    window.location.href = kakaoAuthUrl
  },

  sendPasswordReset: async (email) => {
    const { sendPasswordResetEmail } = await import('@/lib/firebase-auth')
    await sendPasswordResetEmail(email)
  },

  logout: async () => {
    try {
      const { signOut } = await import('@/lib/firebase-auth')
      await signOut()
    } catch (_) {}

    // 세션 정리 (seller_token / admin_token 은 각자 관리)
    localStorage.removeItem('user_type')
    localStorage.removeItem('user_name')
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_email')
    localStorage.removeItem('firebase_token_cache')
    localStorage.removeItem('auth-kr-storage')
    localStorage.removeItem('auth-world-storage')
    localStorage.removeItem('auth-storage')
    localStorage.removeItem('lastLoginUid')
    sessionStorage.removeItem('auth_processed_uid')
    sessionStorage.removeItem('returnUrl')
    sessionStorage.removeItem('loginReturnUrl')

    set({ user: null, role: null, isReady: true, isLoading: false, error: null })
    // 완전한 상태 초기화를 위해 홈으로 리로드
    setTimeout(() => { window.location.href = '/' }, 50)
  },
}))

// ─── 편의 셀렉터 ───────────────────────────────────────────────────────────
export const useAuthUser = () => useAuth((s) => s.user)
export const useAuthReady = () => useAuth((s) => s.isReady)
export const useIsLoggedIn = () => useAuth((s) => !!s.user)
