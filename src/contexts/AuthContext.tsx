/**
 * 🚀 Lightweight Auth Context (완전 재설계)
 * 
 * 핵심 원칙:
 * 1. Firebase 우선: Custom Claims에서 모든 정보 추출 (userId, userName, role)
 * 2. 낙관적 UI: 서버 응답 기다리지 않고 즉시 렌더링
 * 3. 단순성: 복잡한 조건문 제거, Lock 로직 최상단 배치
 * 4. 에러 친화적: 한글 메시지 + 로그인 버튼
 */

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
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  // Lock: URL 파라미터 중복 처리 방지
  const isProcessingTokenRef = useRef(false)
  const processedTokenRef = useRef<string | null>(null)
  
  // ============================================
  // 1️⃣ Firebase Auth Listener (최고 우선순위)
  // ============================================
  
  useEffect(() => {
    console.log('[Auth] 🔥 Firebase Auth 리스너 시작')
    
    // Firebase 초기화 확인
    if (!isFirebaseInitialized()) {
      console.error('[Auth] ❌ Firebase 초기화 실패')
      setInitError('Firebase 초기화 실패. 페이지를 새로고침해 주세요.')
      setIsAuthReady(true)
      return
    }
    
    // onAuthStateChanged 리스너 (한 번만 등록)
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // ✅ 로그인 상태
        console.log('[Auth] ✅ 로그인됨:', firebaseUser.uid)
        
        try {
          // 🎯 Custom Claims에서 모든 정보 추출 (통합 인증)
          const idTokenResult = await firebaseUser.getIdTokenResult()
          const userId = idTokenResult.claims.userId as number | undefined
          const userName = idTokenResult.claims.userName as string | undefined
          const role = (idTokenResult.claims.role as UserRole) || 'user'
          
          // 🚀 즉시 localStorage 저장 (낙관적 업데이트)
          if (userId) localStorage.setItem('user_id', userId.toString())
          if (userName) localStorage.setItem('user_name', userName)
          localStorage.setItem('user_type', role)
          localStorage.setItem('firebase_token', await firebaseUser.getIdToken())
          
          // 🚀 즉시 UI 렌더링 (Firebase 우선 정책)
          setUser(firebaseUser)
          setUserRole(role)
          setIsAuthReady(true)
          
          console.log('[Auth] 🚀 낙관적 업데이트 완료:', {
            uid: firebaseUser.uid,
            userId,
            userName: userName || '(없음)',
            role
          })
          
        } catch (error) {
          console.error('[Auth] ❌ Token 추출 실패:', error)
          // 실패해도 Firebase User는 유효하므로 계속 진행
          setUser(firebaseUser)
          setUserRole('user')
          setIsAuthReady(true)
        }
        
      } else {
        // ❌ 로그아웃 상태
        console.log('[Auth] ❌ 로그아웃됨')
        
        localStorage.removeItem('firebase_token')
        localStorage.removeItem('user_type')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_name')
        
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)
      }
    })
    
    return () => {
      console.log('[Auth] 🔥 Firebase Auth 리스너 해제')
      unsubscribe()
    }
  }, []) // ✅ 빈 의존성 배열 - 한 번만 실행
  
  // ============================================
  // 2️⃣ URL 파라미터 처리 (firebase_token)
  // ============================================
  
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userName = searchParams.get('userName')
    const errorParam = searchParams.get('error')
    
    // 🚫 Lock: 중복 처리 방지
    if (isProcessingTokenRef.current) {
      console.log('[Auth] ⏭️ 이미 처리 중 - 스킵')
      return
    }
    
    if (firebaseToken && processedTokenRef.current === firebaseToken) {
      console.log('[Auth] ⏭️ 이미 처리된 토큰 - 스킵')
      return
    }
    
    // ⚠️ 에러 파라미터가 있으면 즉시 처리
    if (errorParam) {
      console.error('[Auth] ❌ URL 에러 파라미터:', errorParam)
      setInitError('인증 중 오류가 발생했습니다. 다시 시도해 주세요.')
      
      // URL 정리
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }
    
    // ✅ firebase_token이 있으면 처리
    if (firebaseToken) {
      console.log('[Auth] 🔥 Firebase Token 감지')
      
      isProcessingTokenRef.current = true
      processedTokenRef.current = firebaseToken
      
      // 🚀 비동기 처리 (UI 블로킹 하지 않음)
      ;(async () => {
        try {
          // 1️⃣ URL 파라미터 즉시 제거 (무한 루프 방지)
          window.history.replaceState({}, document.title, window.location.pathname)
          console.log('[Auth] ✅ URL 파라미터 제거 완료')
          
          // 2️⃣ userName이 있으면 즉시 저장 (낙관적 UI)
          if (userName) {
            const decodedName = decodeURIComponent(userName)
            localStorage.setItem('user_name', decodedName)
            console.log('[Auth] 🎯 URL userName 즉시 저장:', decodedName)
          }
          
          // 3️⃣ Firebase 로그인
          console.log('[Auth] 🔥 Firebase 커스텀 토큰 로그인 시작...')
          const userCredential = await signInWithCustomToken(auth, firebaseToken)
          console.log('[Auth] ✅ Firebase 로그인 성공:', userCredential.user.uid)
          
          // 4️⃣ returnUrl 복구 (스마트 리다이렉트)
          const returnUrl = sessionStorage.getItem('returnUrl') || '/'
          sessionStorage.removeItem('returnUrl')
          
          console.log('[Auth] 🎯 리다이렉트:', returnUrl)
          
          // onAuthStateChanged가 트리거될 때까지 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 300))
          
          if (returnUrl !== '/login') {
            navigate(returnUrl, { replace: true })
          }
          
        } catch (error) {
          console.error('[Auth] ❌ Firebase 토큰 로그인 실패:', error)
          setInitError('로그인 처리에 실패했습니다. 다시 시도해 주세요.')
          
        } finally {
          isProcessingTokenRef.current = false
        }
      })()
    }
    
  }, [searchParams, navigate])
  
  // ============================================
  // 3️⃣ Auth Methods
  // ============================================
  
  const loginWithEmail = async (email: string, password: string) => {
    console.log('[Auth] 📧 이메일 로그인 시작:', email)
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      console.log('[Auth] ✅ 이메일 로그인 성공:', userCredential.user.uid)
      
    } catch (error: any) {
      console.error('[Auth] ❌ 이메일 로그인 실패:', error)
      throw new Error('이메일 또는 비밀번호가 잘못되었습니다.')
    }
  }
  
  const loginWithKakao = async (accessToken: string) => {
    console.log('[Auth] 🟡 카카오 로그인 시작')
    
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
      
      // Firebase 로그인
      await signInWithCustomToken(auth, data.customToken)
      console.log('[Auth] ✅ 카카오 로그인 성공')
      
    } catch (error: any) {
      console.error('[Auth] ❌ 카카오 로그인 실패:', error)
      throw new Error('카카오 로그인에 실패했습니다.')
    }
  }
  
  const logout = async () => {
    console.log('[Auth] 🚪 로그아웃 시작')
    
    try {
      await signOut(auth)
      console.log('[Auth] ✅ 로그아웃 완료')
      
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
    isAuthReady,
    isLoggedIn: !!user,
    userRole,
    initError,
    loginWithEmail,
    loginWithKakao,
    logout
  }
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
