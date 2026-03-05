/**
 * 🚀 AuthContext v3.0 - Region-Safe Multi-Auth
 * 
 * ✅ 핵심 개선사항:
 * 1. React Hook 규칙 준수 (모든 Hook은 최상위에서 무조건 호출)
 * 2. 국내(KR)/글로벌(GLOBAL) 분기 안전화
 * 3. Firebase Duplicate Instance 방지
 * 4. OAuth Domain 에러 처리
 */

// 🔧 Debug mode
const DEBUG_AUTH = true

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { 
  User,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { isFirebaseInitialized } from '@/lib/firebase-utils'
import { isKorea } from '@/config/region'
import api from '@/lib/api'

// ============================================
// Types
// ============================================

type UserRole = 'user' | 'seller' | 'admin'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthReady: boolean
  isLoggedIn: boolean
  userRole: UserRole | null
  initError: string | null
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  loginWithKakao: (accessToken: string) => Promise<void>
  loginWithGoogle: () => Promise<void>  // ✅ 글로벌 전용
  logout: () => Promise<void>
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// ============================================
// Provider
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  
  // 🔥 모든 State는 최상위에서 무조건 선언 (Hook 규칙 준수)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  // 🔥 모든 Ref도 최상위에서 선언
  const previousUserRef = useRef<User | null>(null)
  const isIntentionalLogoutRef = useRef(false)
  const isInitialAuthRef = useRef(true)
  const isInitialMountRef = useRef(true)
  const isAuthenticatingRef = useRef(false)
  const pendingNavigationRef = useRef<string | null>(null)
  const hasProcessedTokenRef = useRef(false)
  const authStateUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processedTokenRef = useRef<string | null>(null)
  
  // 🎯 Region 감지 (Hook 외부에서 호출 가능)
  const region = isKorea() ? 'KR' : 'GLOBAL'
  
  if (DEBUG_AUTH) {
    console.log('[AuthContext] 🌍 Region:', region)
  }
  
  // ============================================
  // 🔥 1️⃣ URL 파라미터 처리 (Firebase Custom Token)
  // ============================================
  
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userName = searchParams.get('userName')
    const errorParam = searchParams.get('error')
    
    // 이미 처리된 토큰 스킵
    if (firebaseToken && (hasProcessedTokenRef.current || processedTokenRef.current === firebaseToken)) {
      if (DEBUG_AUTH) console.log('[Auth] ⏭️ URL token 이미 처리됨 - 스킵')
      return
    }
    
    // OAuth 에러 처리
    if (errorParam) {
      console.error('[Auth] ❌ OAuth 에러:', errorParam)
      
      // Firebase Authorized Domain 미등록 에러 특별 처리
      if (errorParam.includes('domain') || errorParam.includes('authorized')) {
        setInitError(`
          ⚠️ OAuth 도메인 미등록 에러
          
          현재 도메인: ${window.location.hostname}
          
          해결 방법:
          1. Firebase Console → Authentication → Settings
          2. Authorized domains 섹션 찾기
          3. 다음 도메인 추가:
             - ${window.location.hostname}
             - localhost (개발용)
          4. 페이지 새로고침
        `)
      } else {
        setInitError('인증 중 오류가 발생했습니다. 다시 시도해 주세요.')
      }
      
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }
    
    // Custom Token 처리
    if (firebaseToken) {
      console.log('[Auth] 🔥 Firebase Token 감지!')
      
      hasProcessedTokenRef.current = true
      processedTokenRef.current = firebaseToken
      isAuthenticatingRef.current = true
      
      ;(async () => {
        try {
          // URL 클린업
          const currentUrl = new URL(window.location.href)
          currentUrl.searchParams.delete('firebase_token')
          currentUrl.searchParams.delete('userName')
          window.history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search)
          
          // userName 저장
          if (userName) {
            const decodedName = decodeURIComponent(userName)
            localStorage.setItem('user_name', decodedName)
            if (DEBUG_AUTH) console.log('[Auth] 🎯 userName 저장:', decodedName)
          }
          
          // Custom Token으로 로그인
          const userCredential = await signInWithCustomToken(auth, firebaseToken)
          
          // ✅ ID Token 강제 갱신 (401 에러 방지)
          const idToken = await userCredential.user.getIdToken(true)
          localStorage.setItem('firebase_token', idToken)
          
          if (DEBUG_AUTH) console.log('[Auth] 🔄 ID Token 강제 갱신 완료')
          
          // 복귀 URL 처리
          const returnUrl = sessionStorage.getItem('returnUrl') || '/'
          sessionStorage.removeItem('returnUrl')
          pendingNavigationRef.current = returnUrl
          
          if (DEBUG_AUTH) console.log('[Auth] ✅ Firebase 로그인 성공')
          
        } catch (error: any) {
          console.error('[Auth] ❌ Firebase 토큰 로그인 실패:', error)
          
          // Firebase 에러 타입별 처리
          if (error.code === 'auth/invalid-custom-token') {
            setInitError('인증 토큰이 만료되었습니다. 다시 로그인해 주세요.')
          } else if (error.code === 'auth/network-request-failed') {
            setInitError('네트워크 연결을 확인해 주세요.')
          } else {
            setInitError('로그인 처리에 실패했습니다.')
          }
          
          isAuthenticatingRef.current = false
          pendingNavigationRef.current = null
        }
      })()
    }
    
  }, [searchParams])
  
  // ============================================
  // 🔥 2️⃣ Multi-Auth System (Firebase + JWT)
  // ============================================
  
  useEffect(() => {
    const pathname = location.pathname
    
    // ✅ JWT 인증 경로 (/seller, /admin)
    if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) {
      if (DEBUG_AUTH) console.log('[Auth] 🔑 JWT 인증 경로:', pathname)
      
      const token = localStorage.getItem('seller_token') || localStorage.getItem('admin_token')
      const userId = localStorage.getItem('seller_id') || localStorage.getItem('admin_id')
      const userType = localStorage.getItem('user_type') as UserRole | null
      
      if (token && userId) {
        if (DEBUG_AUTH) console.log('[Auth] ✅ JWT 토큰 발견')
        setUser(null)
        setUserRole(userType)
        setIsAuthReady(true)
        setLoading(false)
        return
      } else {
        if (DEBUG_AUTH) console.log('[Auth] ❌ JWT 토큰 없음')
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)
        setLoading(false)
        return
      }
    }
    
    // ✅ Firebase 인증 경로 (buyer)
    if (DEBUG_AUTH) console.log('[Auth] 🔥 Firebase Auth 리스너 시작')
    
    // Firebase 초기화 확인
    if (!isFirebaseInitialized()) {
      console.error('[Auth] ❌ Firebase 초기화 실패')
      setInitError('Firebase 초기화 실패. 페이지를 새로고침해 주세요.')
      setIsAuthReady(true)
      setLoading(false)
      return
    }
    
    // ✅ 강제 타임아웃 (10초)
    const forceTimeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] ⏰ 강제 타임아웃 (10초)')
        setLoading(false)
        setIsAuthReady(true)
        isInitialMountRef.current = false
      }
    }, 10000)
    
    // ✅ onAuthStateChanged 리스너
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      // Debounce (500ms)
      if (authStateUpdateTimerRef.current) {
        clearTimeout(authStateUpdateTimerRef.current)
      }
      
      authStateUpdateTimerRef.current = setTimeout(async () => {
        // ✅ 최초 null 이벤트 무시
        if (!firebaseUser && isInitialMountRef.current) {
          if (DEBUG_AUTH) console.log('[Auth] ⏭️ 최초 null 이벤트 무시')
          return
        }
        
        if (firebaseUser) {
          if (DEBUG_AUTH) console.log('[Auth] ✅ 로그인됨:', firebaseUser.uid)
          
          isInitialAuthRef.current = false
          isInitialMountRef.current = false
          previousUserRef.current = firebaseUser
          
          try {
            // ID Token + Custom Claims 가져오기
            const idTokenResult = await firebaseUser.getIdTokenResult()
            const userId = idTokenResult.claims.userId as number | undefined
            const userNameFromClaims = idTokenResult.claims.userName as string | undefined
            const role = (idTokenResult.claims.role as UserRole) || 'user'
            
            // User ID 저장
            if (!userId) {
              localStorage.setItem('user_id', firebaseUser.uid)
            } else {
              localStorage.setItem('user_id', userId.toString())
            }
            
            // User Name 저장
            const existingUserName = localStorage.getItem('user_name')
            if (!existingUserName) {
              const finalUserName = userNameFromClaims || firebaseUser.displayName || '사용자'
              localStorage.setItem('user_name', finalUserName)
            }
            
            // Role 저장
            localStorage.setItem('user_role', role)
            
            // Firebase Token 갱신 (7일 유효)
            const freshToken = await firebaseUser.getIdToken(false)
            localStorage.setItem('firebase_token', freshToken)
            
            // State 업데이트
            setUser(firebaseUser)
            setUserRole(role)
            setLoading(false)
            setIsAuthReady(true)
            
            // Pending Navigation 처리
            if (pendingNavigationRef.current && !isAuthenticatingRef.current) {
              const targetUrl = pendingNavigationRef.current
              pendingNavigationRef.current = null
              if (DEBUG_AUTH) console.log('[Auth] 🎯 Pending navigation:', targetUrl)
              navigate(targetUrl, { replace: true })
            }
            
            // Authenticating 플래그 해제 (500ms 후)
            setTimeout(() => {
              isAuthenticatingRef.current = false
            }, 500)
            
          } catch (error) {
            console.error('[Auth] ❌ Token 처리 실패:', error)
          }
          
        } else {
          // 로그아웃 처리
          if (DEBUG_AUTH) {
            if (isIntentionalLogoutRef.current) {
              console.log('[Auth] 🚪 의도적 로그아웃')
            } else {
              console.log('[Auth] ❌ 로그아웃 감지 (세션 만료?)')
            }
          }
          
          if (isIntentionalLogoutRef.current) {
            isIntentionalLogoutRef.current = false
          }
          
          // State 초기화
          if (!isAuthenticatingRef.current) {
            setUser(null)
            setUserRole(null)
            setLoading(false)
            setIsAuthReady(true)
            
            // localStorage 클린업
            localStorage.removeItem('firebase_token')
            localStorage.removeItem('user_id')
            localStorage.removeItem('user_name')
            localStorage.removeItem('user_role')
          }
        }
      }, 500)
    })
    
    // Cleanup
    return () => {
      unsubscribe()
      clearTimeout(forceTimeoutId)
      if (authStateUpdateTimerRef.current) {
        clearTimeout(authStateUpdateTimerRef.current)
      }
    }
  }, [location.pathname, navigate])
  
  // ============================================
  // 🔥 3️⃣ Auth Methods
  // ============================================
  
  // 이메일 로그인
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await userCredential.user.getIdToken(true)
      localStorage.setItem('firebase_token', idToken)
      
      if (DEBUG_AUTH) console.log('[Auth] ✅ 이메일 로그인 성공')
    } catch (error: any) {
      console.error('[Auth] ❌ 이메일 로그인 실패:', error)
      throw error
    }
  }, [])
  
  // 이메일 회원가입
  const signupWithEmail = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await api.post('/api/auth/email/register', {
        email,
        password,
        name
      })
      
      if (response.data.success) {
        const { customToken } = response.data
        const userCredential = await signInWithCustomToken(auth, customToken)
        const idToken = await userCredential.user.getIdToken(true)
        localStorage.setItem('firebase_token', idToken)
        localStorage.setItem('user_name', name)
        
        if (DEBUG_AUTH) console.log('[Auth] ✅ 회원가입 성공')
      }
    } catch (error: any) {
      console.error('[Auth] ❌ 회원가입 실패:', error)
      throw error
    }
  }, [])
  
  // 비밀번호 재설정
  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      if (DEBUG_AUTH) console.log('[Auth] ✅ 비밀번호 재설정 이메일 발송')
    } catch (error: any) {
      console.error('[Auth] ❌ 비밀번호 재설정 실패:', error)
      throw error
    }
  }, [])
  
  // 카카오 로그인 (KR 전용)
  const loginWithKakao = useCallback(async (accessToken: string) => {
    if (region !== 'KR') {
      throw new Error('Kakao login is only available in Korea region')
    }
    
    try {
      const response = await api.post('/api/auth/kakao/firebase', {
        accessToken
      })
      
      if (response.data.success) {
        const { customToken, user } = response.data
        const userCredential = await signInWithCustomToken(auth, customToken)
        const idToken = await userCredential.user.getIdToken(true)
        
        localStorage.setItem('firebase_token', idToken)
        localStorage.setItem('user_name', user.name)
        
        if (DEBUG_AUTH) console.log('[Auth] ✅ 카카오 로그인 성공')
      }
    } catch (error: any) {
      console.error('[Auth] ❌ 카카오 로그인 실패:', error)
      throw error
    }
  }, [region])
  
  // 구글 로그인 (GLOBAL 전용)
  const loginWithGoogle = useCallback(async () => {
    if (region !== 'GLOBAL') {
      throw new Error('Google login is only available in Global region')
    }
    
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
      
      const provider = new GoogleAuthProvider()
      provider.addScope('email')
      provider.addScope('profile')
      
      const result = await signInWithPopup(auth, provider)
      
      // 백엔드에 사용자 정보 저장
      await api.post('/api/auth/google/register', {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName,
        photoURL: result.user.photoURL
      })
      
      const idToken = await result.user.getIdToken(true)
      localStorage.setItem('firebase_token', idToken)
      
      if (DEBUG_AUTH) console.log('[Auth] ✅ 구글 로그인 성공')
    } catch (error: any) {
      console.error('[Auth] ❌ 구글 로그인 실패:', error)
      throw error
    }
  }, [region])
  
  // 로그아웃
  const logout = useCallback(async () => {
    try {
      isIntentionalLogoutRef.current = true
      await signOut(auth)
      
      // localStorage 클린업
      localStorage.removeItem('firebase_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_role')
      localStorage.removeItem('seller_token')
      localStorage.removeItem('admin_token')
      
      setUser(null)
      setUserRole(null)
      setIsAuthReady(true)
      setLoading(false)
      
      if (DEBUG_AUTH) console.log('[Auth] ✅ 로그아웃 완료')
    } catch (error: any) {
      console.error('[Auth] ❌ 로그아웃 실패:', error)
      throw error
    }
  }, [])
  
  // ============================================
  // Context Value
  // ============================================
  
  const value: AuthContextType = {
    user,
    loading,
    isAuthReady,
    isLoggedIn: !!user,
    userRole,
    initError,
    loginWithEmail,
    signupWithEmail,
    resetPassword,
    loginWithKakao,
    loginWithGoogle,
    logout,
  }
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
