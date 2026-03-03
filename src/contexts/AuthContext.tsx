/**
 * 🚀 AuthContext (Multi-Auth: Firebase + JWT)
 * 
 * 핵심 원칙:
 * 1. Buyer: Firebase Auth (onAuthStateChanged)
 * 2. Seller/Admin: JWT 토큰 (localStorage)
 * 3. 경로 기반 인증 분기: /seller, /admin → JWT 체크만
 * 4. 무한 루프 방지: Lock + replaceState 즉시 실행
 */

// 🔧 Debug mode
const DEBUG_AUTH = true

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  User,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { isFirebaseInitialized } from '@/lib/firebase-utils'

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
  const [searchParams] = useSearchParams()
  
  // State
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  // 무한 루프 방지 플래그
  const previousUserRef = useRef<User | null>(null)
  const isIntentionalLogoutRef = useRef(false)
  const isInitialAuthRef = useRef(true)
  const isAuthenticatingRef = useRef(false)
  const pendingNavigationRef = useRef<string | null>(null)
  const hasProcessedTokenRef = useRef(false)
  const processedTokenRef = useRef<string | null>(null)
  
  // ============================================
  // 🔥 1️⃣ URL 파라미터 처리
  // ============================================
  
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userName = searchParams.get('userName')
    const errorParam = searchParams.get('error')
    
    if (firebaseToken && hasProcessedTokenRef.current) {
      if (DEBUG_AUTH) console.log('[Auth] ⏭️ 이미 URL token 처리 완료 - 스킵')
      return
    }
    
    if (firebaseToken && processedTokenRef.current === firebaseToken) {
      if (DEBUG_AUTH) console.log('[Auth] ⏭️ 동일한 token - 스킵')
      return
    }
    
    if (errorParam) {
      console.error('[Auth] ❌ URL 에러:', errorParam)
      setInitError('인증 중 오류가 발생했습니다. 다시 시도해 주세요.')
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }
    
    if (firebaseToken) {
      console.log('[Auth] 🔥 Firebase Token 감지!')
      
      hasProcessedTokenRef.current = true
      processedTokenRef.current = firebaseToken
      isAuthenticatingRef.current = true
      
      ;(async () => {
        try {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('firebase_token');
          currentUrl.searchParams.delete('userName');
          window.history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search);
          
          if (userName) {
            const decodedName = decodeURIComponent(userName)
            localStorage.setItem('user_name', decodedName)
            if (DEBUG_AUTH) console.log('[Auth] 🎯 userName 저장:', decodedName)
          }
          
          const userCredential = await signInWithCustomToken(auth, firebaseToken)
          const idToken = await userCredential.user.getIdToken()
          localStorage.setItem('firebase_token', idToken)
          
          const returnUrl = sessionStorage.getItem('returnUrl') || '/'
          sessionStorage.removeItem('returnUrl')
          pendingNavigationRef.current = returnUrl
          
          if (DEBUG_AUTH) console.log('[Auth] ✅ Firebase 로그인 성공')
          
        } catch (error) {
          console.error('[Auth] ❌ Firebase 토큰 로그인 실패:', error)
          setInitError('로그인 처리에 실패했습니다.')
          isAuthenticatingRef.current = false
          pendingNavigationRef.current = null
        }
      })()
    }
    
  }, [searchParams, navigate])
  
  // ============================================
  // 🔥 2️⃣ Multi-Auth System (Firebase + JWT)
  // ============================================
  
  useEffect(() => {
    const pathname = window.location.pathname
    
    // ✅ JWT 인증이 필요한 경로 (seller/admin)
    if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) {
      if (DEBUG_AUTH) console.log('[Auth] 🔑 JWT 인증 경로 감지:', pathname)
      
      // JWT 토큰 확인
      const token = localStorage.getItem('seller_token') || localStorage.getItem('admin_token')
      const userId = localStorage.getItem('seller_id') || localStorage.getItem('admin_id')
      const userName = localStorage.getItem('seller_name') || localStorage.getItem('admin_name')
      const userType = localStorage.getItem('user_type') as UserRole | null
      
      if (token && userId) {
        if (DEBUG_AUTH) console.log('[Auth] ✅ JWT 토큰 발견:', { userId, userName, userType })
        
        // JWT로 인증된 상태 설정 (Firebase user는 null)
        setUser(null)
        setUserRole(userType)
        setIsAuthReady(true)
        setLoading(false)
        return
      } else {
        if (DEBUG_AUTH) console.log('[Auth] ❌ JWT 토큰 없음 - 로그인 필요')
        
        // 인증 실패 - 로그인 페이지로 리다이렉트는 각 페이지에서 처리
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)
        setLoading(false)
        return
      }
    }
    
    // ✅ Firebase 인증이 필요한 경로 (buyer)
    if (DEBUG_AUTH) console.log('[Auth] 🔥 Firebase Auth 리스너 시작')
    
    // 강제 타임아웃 (buyer 경로만)
    const forceTimeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] ⏰ 강제 타임아웃 (3초) - 로딩 해제')
        setLoading(false)
        setIsAuthReady(true)
      }
    }, 3000)
    
    // Firebase 초기화 확인
    if (!isFirebaseInitialized()) {
      console.error('[Auth] ❌ Firebase 초기화 실패')
      setInitError('Firebase 초기화 실패. 페이지를 새로고침해 주세요.')
      setIsAuthReady(true)
      setLoading(false)
      clearTimeout(forceTimeoutId)
      return
    }
    
    // onAuthStateChanged 리스너
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        if (DEBUG_AUTH) console.log('[Auth] ✅ 로그인됨:', firebaseUser.uid)
        
        isInitialAuthRef.current = false
        previousUserRef.current = firebaseUser
        
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult()
          const userId = idTokenResult.claims.userId as number | undefined
          const userNameFromClaims = idTokenResult.claims.userName as string | undefined
          const role = (idTokenResult.claims.role as UserRole) || 'user'
          
          if (!userId) {
            console.log('[Auth] ⚠️ Custom Claims에 userId 없음')
          } else {
            localStorage.setItem('user_id', userId.toString())
          }
          
          const existingUserName = localStorage.getItem('user_name')
          if (!existingUserName) {
            const finalUserName = userNameFromClaims || firebaseUser.displayName || '사용자'
            localStorage.setItem('user_name', finalUserName)
          }
          
          localStorage.setItem('user_type', role)
          
          const freshToken = await firebaseUser.getIdToken(true)
          localStorage.setItem('firebase_token', freshToken)
          
          setUser(firebaseUser)
          setUserRole(role)
          setIsAuthReady(true)
          setLoading(false)
          
          // 대기 중인 리다이렉트 처리
          if (isAuthenticatingRef.current && pendingNavigationRef.current) {
            const targetUrl = pendingNavigationRef.current
            pendingNavigationRef.current = null
            isAuthenticatingRef.current = false
            
            if (window.location.pathname === '/login' && targetUrl !== '/login') {
              navigate(targetUrl, { replace: true })
            }
          }
          
          setTimeout(() => {
            isAuthenticatingRef.current = false
          }, 500)
          
        } catch (error) {
          console.error('[Auth] ❌ Token 추출 실패:', error)
          setUser(firebaseUser)
          setUserRole('user')
          setIsAuthReady(true)
          setLoading(false)
        }
        
      } else {
        if (DEBUG_AUTH) console.log('[Auth] ❌ 로그아웃 감지')
        
        if (isInitialAuthRef.current || (previousUserRef.current && !isIntentionalLogoutRef.current)) {
          console.warn('[Auth] ⚠️ 로그아웃 무시 - 최초 인증 중')
          return
        }
        
        if (DEBUG_AUTH) console.log('[Auth] ✅ 정상 로그아웃 처리')
        
        isInitialAuthRef.current = false
        previousUserRef.current = null
        isIntentionalLogoutRef.current = false
        
        localStorage.removeItem('firebase_token')
        localStorage.removeItem('user_type')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_name')
        
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)
        setLoading(false)
      }
    })
    
    return () => {
      if (DEBUG_AUTH) console.log('[Auth] 🔥 Firebase Auth 리스너 해제')
      if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) {
        // JWT 경로는 Firebase 리스너 없음
        return
      }
      clearTimeout(forceTimeoutId)
      unsubscribe()
    }
  }, [loading, isAuthReady, user, navigate])
  
  // ============================================
  // 3️⃣ Auth Methods
  // ============================================
  
  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error('[Auth] ❌ 이메일 로그인 실패:', error)
      throw new Error('이메일 또는 비밀번호가 잘못되었습니다.')
    }
  }
  
  const signupWithEmail = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('/api/auth/email/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })
      
      const data = await response.json()
      
      if (!data.success || !data.customToken) {
        throw new Error(data.error || '회원가입 실패')
      }
      
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      const idToken = await userCredential.user.getIdToken()
      localStorage.setItem('firebase_token', idToken)
      localStorage.setItem('user_name', name)
      
    } catch (error: any) {
      console.error('[Auth] ❌ 이메일 회원가입 실패:', error)
      throw error
    }
  }
  
  const resetPassword = async (email: string) => {
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth')
      await sendPasswordResetEmail(auth, email)
    } catch (error: any) {
      console.error('[Auth] ❌ 비밀번호 재설정 실패:', error)
      throw error
    }
  }
  
  const loginWithKakao = async (accessToken: string) => {
    try {
      const response = await fetch('/api/auth/kakao/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      })
      
      const data = await response.json()
      
      if (!data.success || !data.customToken) {
        throw new Error(data.error || '카카오 로그인 실패')
      }
      
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      const idToken = await userCredential.user.getIdToken()
      localStorage.setItem('firebase_token', idToken)
      
      setUser(userCredential.user)
      
    } catch (error: any) {
      console.error('[Auth] ❌ 카카오 로그인 실패:', error)
      throw new Error('카카오 로그인에 실패했습니다.')
    }
  }
  
  const logout = async () => {
    try {
      isIntentionalLogoutRef.current = true
      await signOut(auth)
      isIntentionalLogoutRef.current = false
    } catch (error) {
      console.error('[Auth] ❌ 로그아웃 실패:', error)
      isIntentionalLogoutRef.current = false
      throw new Error('로그아웃에 실패했습니다.')
    }
  }
  
  // ============================================
  // Context Value
  // ============================================
  
  const value: AuthContextType = {
    user,
    loading,
    isAuthReady,
    isLoggedIn: !!user || !!userRole, // JWT 사용자도 로그인 상태로 인식
    userRole,
    initError,
    loginWithEmail,
    signupWithEmail,
    resetPassword,
    loginWithKakao,
    logout
  }
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
