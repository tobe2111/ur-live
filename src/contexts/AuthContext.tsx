/**
 * 🚀 AuthContext (Clean Rewrite)
 * 
 * 핵심 원칙:
 * 1. URL userName 최우선: 카카오 로그인 시 URL에서 userName 즉시 저장
 * 2. Firebase 우선: Custom Claims → localStorage → 즉시 UI
 * 3. 단순성: 복잡한 분기문 완전 제거
 * 4. 무한 루프 방지: Lock + replaceState 즉시 실행
 */

// 🔧 Debug mode (환경변수로 제어)
// 🚨 TEMPORARY: Always debug in production to diagnose login issue
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
  loading: boolean        // ✅ 핵심: 초기화 완료 여부
  isAuthReady: boolean
  isLoggedIn: boolean
  userRole: UserRole | null
  initError: string | null
  loginWithEmail: (email: string, password: string) => Promise<void>
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
  const [loading, setLoading] = useState(true)           // ✅ 초기값 true (초기화 중)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  // Lock: 중복 처리 방지
  const isProcessingTokenRef = useRef(false)
  const processedTokenRef = useRef<string | null>(null)
  
  // ============================================
  // 🔥 1️⃣ URL 파라미터 처리 (최고 우선순위!)
  // firebase_token + userName을 먼저 처리해야 무한 루프 방지
  // ============================================
  
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userName = searchParams.get('userName')
    const errorParam = searchParams.get('error')
    
    // 🚫 Lock 1: 이미 처리 중이면 스킵
    if (isProcessingTokenRef.current) {
      if (DEBUG_AUTH) console.log('[Auth] ⏭️ 이미 처리 중 - 스킵')
      return
    }
    
    // 🚫 Lock 2: 이미 처리된 토큰이면 스킵
    if (firebaseToken && processedTokenRef.current === firebaseToken) {
      if (DEBUG_AUTH) console.log('[Auth] ⏭️ 이미 처리된 토큰 - 스킵')
      return
    }
    
    // ⚠️ 에러 파라미터가 있으면 즉시 처리
    if (errorParam) {
      console.error('[Auth] ❌ URL 에러:', errorParam)
      setInitError('인증 중 오류가 발생했습니다. 다시 시도해 주세요.')
      
      // URL 정리 (무한 루프 방지)
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }
    
    // ✅ firebase_token이 있으면 처리
    if (firebaseToken) {
      console.log('[Auth] 🔥🔥🔥 Firebase Token 감지! 🔥🔥🔥')
      console.log('[Auth] Token length:', firebaseToken.length)
      console.log('[Auth] UserName param:', userName)
      
      isProcessingTokenRef.current = true
      processedTokenRef.current = firebaseToken
      
      // 🚀 즉시 비동기 처리 (UI 블로킹 안 함)
      ;(async () => {
        try {
          // 🎯 STEP 1: firebase_token과 userName만 URL에서 제거 (다른 파라미터는 유지)
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('firebase_token');
          currentUrl.searchParams.delete('userName');
          
          // Clean URL로 교체
          const cleanUrl = currentUrl.pathname + currentUrl.search;
          window.history.replaceState({}, document.title, cleanUrl);
          
          if (DEBUG_AUTH) console.log('[Auth] ✅ URL 파라미터 제거 완료 (다른 params 유지)')
          if (DEBUG_AUTH) console.log('[Auth] 🎯 Clean URL:', cleanUrl)
          
          // 🎯 STEP 2: userName이 있으면 즉시 localStorage 저장 (최우선!)
          if (userName) {
            const decodedName = decodeURIComponent(userName)
            localStorage.setItem('user_name', decodedName)
            if (DEBUG_AUTH) console.log('[Auth] 🎯 URL userName 즉시 저장:', decodedName)
          }
          
          // 🎯 STEP 3: Firebase 로그인
          console.log('[Auth] 🔥 Firebase 커스텀 토큰 로그인 시작...')
          console.log('[Auth] 📝 Token preview:', firebaseToken.substring(0, 50) + '...')
          console.log('[Auth] 📝 Auth object:', auth ? 'initialized' : 'NOT initialized')
          
          const userCredential = await signInWithCustomToken(auth, firebaseToken)
          
          console.log('[Auth] ✅ Firebase 로그인 성공!')
          console.log('[Auth] 👤 UID:', userCredential.user.uid)
          console.log('[Auth] 📧 Email:', userCredential.user.email)
          console.log('[Auth] 🏷️ Display Name:', userCredential.user.displayName)
          
          // 🔥 CRITICAL: 즉시 Firebase ID Token을 localStorage에 저장!
          // (onAuthStateChanged를 기다리지 않음)
          const idToken = await userCredential.user.getIdToken()
          localStorage.setItem('firebase_token', idToken)
          console.log('[Auth] 🔥 Firebase ID Token 즉시 저장 완료!')
          console.log('[Auth] 🔑 Token preview:', idToken.substring(0, 50) + '...')
          
          // 🎯 STEP 4: returnUrl 복구 (스마트 리다이렉트)
          const returnUrl = sessionStorage.getItem('returnUrl') || '/'
          sessionStorage.removeItem('returnUrl')
          
          if (DEBUG_AUTH) console.log('[Auth] 🎯 리다이렉트 준비:', returnUrl)
          
          // onAuthStateChanged가 트리거될 때까지 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // 로그인 페이지가 아니면 리다이렉트
          if (window.location.pathname === '/login' && returnUrl !== '/login') {
            navigate(returnUrl, { replace: true })
          }
          
        } catch (error) {
          console.error('[Auth] ❌❌❌ Firebase 토큰 로그인 실패 ❌❌❌')
          console.error('[Auth] Error type:', error?.constructor?.name)
          console.error('[Auth] Error message:', (error as Error)?.message)
          console.error('[Auth] Error code:', (error as any)?.code)
          console.error('[Auth] Full error:', error)
          
          setInitError('로그인 처리에 실패했습니다. 다시 시도해 주세요.')
          
          // URL 정리 (실패 시에도)
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('firebase_token');
          currentUrl.searchParams.delete('userName');
          window.history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search);
          
        } finally {
          isProcessingTokenRef.current = false
        }
      })()
    }
    
  }, [searchParams, navigate])
  
  // ============================================
  // 🔥 2️⃣ Firebase Auth Listener
  // ============================================
  
  useEffect(() => {
    if (DEBUG_AUTH) console.log('[Auth] 🔥 Firebase Auth 리스너 시작')
    
    // Firebase 초기화 확인
    if (!isFirebaseInitialized()) {
      console.error('[Auth] ❌ Firebase 초기화 실패')
      setInitError('Firebase 초기화 실패. 페이지를 새로고침해 주세요.')
      setIsAuthReady(true)
      setLoading(false)  // ✅ 초기화 실패 시에도 loading 해제
      return
    }
    
    // onAuthStateChanged 리스너 (한 번만 등록)
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // ✅ 로그인 상태
        if (DEBUG_AUTH) console.log('[Auth] ✅ 로그인됨:', firebaseUser.uid)
        
        try {
          // 🎯 Custom Claims에서 정보 추출
          const idTokenResult = await firebaseUser.getIdTokenResult()
          const userId = idTokenResult.claims.userId as number | undefined
          const userNameFromClaims = idTokenResult.claims.userName as string | undefined
          const role = (idTokenResult.claims.role as UserRole) || 'user'
          
          // 🚀 localStorage 저장 (URL userName이 이미 있으면 그대로 유지)
          if (userId) {
            localStorage.setItem('user_id', userId.toString())
          }
          
          // 🎯 userName 우선순위: localStorage (URL에서 저장됨) > Claims > displayName
          const existingUserName = localStorage.getItem('user_name')
          if (!existingUserName) {
            // localStorage에 없을 때만 Claims 또는 displayName 사용
            const finalUserName = userNameFromClaims || firebaseUser.displayName || '사용자'
            localStorage.setItem('user_name', finalUserName)
            if (DEBUG_AUTH) console.log('[Auth] ✅ user_name 저장 (Claims/displayName):', finalUserName)
          } else {
            if (DEBUG_AUTH) console.log('[Auth] ✅ user_name 유지 (URL 우선):', existingUserName)
          }
          
          localStorage.setItem('user_type', role)
          localStorage.setItem('firebase_token', await firebaseUser.getIdToken())
          
          // 🚀 즉시 UI 렌더링
          setUser(firebaseUser)
          setUserRole(role)
          setIsAuthReady(true)
          setLoading(false)  // ✅ 핵심: 초기화 완료
          
          if (DEBUG_AUTH) {
            console.log('[Auth] 🚀 낙관적 업데이트 완료:', {
              uid: firebaseUser.uid,
              userId,
              userName: localStorage.getItem('user_name'),
              role
            })
          }
          
        } catch (error) {
          console.error('[Auth] ❌ Token 추출 실패:', error)
          // 실패해도 Firebase User는 유효하므로 계속 진행
          setUser(firebaseUser)
          setUserRole('user')
          setIsAuthReady(true)
          setLoading(false)  // ✅ 에러 발생 시에도 loading 해제
        }
        
      } else {
        // ❌ 로그아웃 상태
        if (DEBUG_AUTH) console.log('[Auth] ❌ 로그아웃됨')
        
        localStorage.removeItem('firebase_token')
        localStorage.removeItem('user_type')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_name')
        
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)
        setLoading(false)  // ✅ 로그아웃 시에도 loading 해제
      }
    })
    
    return () => {
      if (DEBUG_AUTH) console.log('[Auth] 🔥 Firebase Auth 리스너 해제')
      unsubscribe()
    }
  }, []) // ✅ 빈 의존성 배열 - 한 번만 실행
  
  // ============================================
  // 3️⃣ Auth Methods
  // ============================================
  
  const loginWithEmail = async (email: string, password: string) => {
    if (DEBUG_AUTH) console.log('[Auth] 📧 이메일 로그인 시도:', email)
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      if (DEBUG_AUTH) console.log('[Auth] ✅ 이메일 로그인 성공:', userCredential.user.uid)
      
    } catch (error: any) {
      console.error('[Auth] ❌ 이메일 로그인 실패:', error)
      throw new Error('이메일 또는 비밀번호가 잘못되었습니다.')
    }
  }
  
  const loginWithKakao = async (accessToken: string) => {
    if (DEBUG_AUTH) console.log('[Auth] 🟡 카카오 로그인 시작')
    
    try {
      // 백엔드 API 호출
      const response = await fetch('/api/auth/kakao/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      })
      
      const data = await response.json()
      
      if (!data.success || !data.customToken) {
        throw new Error(data.error || '카카오 로그인 실패')
      }
      
      // ★ 핵심 수정: Custom Token → ID Token 교환
      if (DEBUG_AUTH) console.log('[Auth] 🔥 Custom Token 받음, ID Token으로 교환 시작...')
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      
      // 🔥 CRITICAL: Custom Token이 아닌 ID Token을 localStorage에 저장!
      const idToken = await userCredential.user.getIdToken()
      localStorage.setItem('firebase_token', idToken)
      
      if (DEBUG_AUTH) console.log('[Auth] ✅ 카카오 로그인 성공')
      if (DEBUG_AUTH) console.log('[Auth] 🔑 ID Token 교환 & 저장 완료')
      if (DEBUG_AUTH) console.log('[Auth] 🔑 Token preview:', idToken.substring(0, 50) + '...')
      
      // 안전하게 user 상태도 업데이트 (onAuthStateChanged가 자동으로 해주지만)
      setUser(userCredential.user)
      
    } catch (error: any) {
      console.error('[Auth] ❌ 카카오 로그인 실패:', error)
      throw new Error('카카오 로그인에 실패했습니다.')
    }
  }
  
  const logout = async () => {
    if (DEBUG_AUTH) console.log('[Auth] 🚪 로그아웃 시작')
    
    try {
      await signOut(auth)
      if (DEBUG_AUTH) console.log('[Auth] ✅ 로그아웃 완료')
      
    } catch (error) {
      console.error('[Auth] ❌ 로그아웃 실패:', error)
      throw new Error('로그아웃에 실패했습니다.')
    }
  }
  
  // ============================================
  // Context Value
  // ============================================
  
  const value: AuthContextType = {
    user,
    loading,              // ✅ 핵심: loading 상태 제공
    isAuthReady,
    isLoggedIn: !!user,
    userRole,
    initError,
    loginWithEmail,
    loginWithKakao,
    logout
  }
  
  // ✅ 디버그 로그 (매 렌더링마다 상태 추적)
  if (DEBUG_AUTH) {
    console.log('[AuthContext] 🔄 렌더링:', {
      user: user?.uid || 'null',
      loading,
      isAuthReady,
      userRole
    })
  }
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
