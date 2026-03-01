/**
 * 🚀 AuthContext - 무한 루프 완전 해결 버전
 * 
 * 핵심 개선:
 * 1. ✅ loading 상태 추가 (초기화 완료 전까지 리다이렉트 차단)
 * 2. ✅ onAuthStateChanged를 한 번만 등록 (의존성 배열 [])
 * 3. ✅ 중복 리다이렉트 로직 제거 (AuthContext는 상태만 관리)
 * 4. ✅ URL 파라미터 처리 분리 (useEffect dependency 명확화)
 * 5. ✅ Optimistic 업데이트 개선
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { 
  User,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

// 🔧 Debug mode
const DEBUG_AUTH = true

// ============================================
// Types
// ============================================

type UserRole = 'user' | 'seller' | 'admin'

interface AuthContextType {
  user: User | null
  loading: boolean        // ✅ 핵심: 초기화 로딩 상태
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
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)           // ✅ 초기값 true
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  const [searchParams] = useSearchParams()
  const location = useLocation()
  
  // Lock to prevent duplicate token processing
  const isProcessingTokenRef = useRef(false)
  const processedTokenRef = useRef<string | null>(null)

  // ============================================
  // 🔥 1. Firebase Auth 리스너 (최우선, 한 번만 실행)
  // ============================================
  useEffect(() => {
    if (DEBUG_AUTH) console.log('[Auth] 🚀 Setting up Firebase Auth listener')

    // ✅ onAuthStateChanged는 한 번만 등록 (dependency [])
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (DEBUG_AUTH) {
        console.log('[Auth] 🔥 onAuthStateChanged triggered:', {
          uid: firebaseUser?.uid,
          email: firebaseUser?.email
        })
      }

      if (firebaseUser) {
        // 사용자 로그인됨
        try {
          const idToken = await firebaseUser.getIdToken()
          const idTokenResult = await firebaseUser.getIdTokenResult()
          
          // Custom Claims에서 role, userId, userName 추출
          const role = (idTokenResult.claims.role as UserRole) || 'user'
          const userId = idTokenResult.claims.userId as number | undefined
          const userName = idTokenResult.claims.userName as string | undefined
          
          if (DEBUG_AUTH) {
            console.log('[Auth] ✅ 로그인됨:', {
              uid: firebaseUser.uid,
              role,
              userId,
              userName
            })
          }

          // localStorage 저장
          if (userId) localStorage.setItem('user_id', userId.toString())
          if (userName) localStorage.setItem('user_name', userName)
          localStorage.setItem('user_type', role)
          localStorage.setItem('firebase_token', idToken)

          // State 업데이트
          setUser(firebaseUser)
          setUserRole(role)
          setIsAuthReady(true)
          
        } catch (error) {
          console.error('[Auth] ❌ Token 추출 실패:', error)
          setUser(firebaseUser)
          setUserRole('user')
          setIsAuthReady(true)
        }
      } else {
        // 사용자 로그아웃됨
        if (DEBUG_AUTH) console.log('[Auth] ❌ 로그아웃 상태')
        
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)
      }

      // ✅ 핵심: 초기화 완료
      setLoading(false)
    })

    // Cleanup
    return () => {
      if (DEBUG_AUTH) console.log('[Auth] 🧹 Cleaning up listener')
      unsubscribe()
    }
  }, []) // ✅ 빈 배열: 마운트 시 한 번만 실행

  // ============================================
  // 🔥 2. URL 파라미터 처리 (firebase_token)
  // ============================================
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userName = searchParams.get('userName')

    // 이미 처리 중이거나 처리된 토큰이면 스킵
    if (!firebaseToken) return
    if (isProcessingTokenRef.current) return
    if (processedTokenRef.current === firebaseToken) return

    if (DEBUG_AUTH) {
      console.log('[Auth] 🔑 firebase_token 감지:', {
        tokenLength: firebaseToken.length,
        userName
      })
    }

    isProcessingTokenRef.current = true
    processedTokenRef.current = firebaseToken

    ;(async () => {
      try {
        // ✅ URL 파라미터 즉시 제거 (무한 루프 방지)
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.delete('firebase_token')
        currentUrl.searchParams.delete('userName')
        window.history.replaceState({}, document.title, currentUrl.toString())

        if (DEBUG_AUTH) console.log('[Auth] ✅ URL 파라미터 제거 완료')

        // ✅ userName이 있으면 즉시 localStorage 저장
        if (userName) {
          const decodedName = decodeURIComponent(userName)
          localStorage.setItem('user_name', decodedName)
          if (DEBUG_AUTH) console.log('[Auth] 🎯 userName 저장:', decodedName)
        }

        // ✅ Firebase 커스텀 토큰 로그인
        if (DEBUG_AUTH) console.log('[Auth] 🔥 signInWithCustomToken 시작...')
        
        const userCredential = await signInWithCustomToken(auth, firebaseToken)
        
        // ✅ 즉시 ID Token 저장
        const idToken = await userCredential.user.getIdToken()
        localStorage.setItem('firebase_token', idToken)
        
        if (DEBUG_AUTH) {
          console.log('[Auth] ✅ 로그인 성공!', {
            uid: userCredential.user.uid,
            email: userCredential.user.email
          })
          console.log('[Auth] 🔥 Firebase ID Token 즉시 저장 완료!')
        }

        // ✅ Optimistic 업데이트 (onAuthStateChanged 전에 UI 업데이트)
        setUser(userCredential.user)
        setIsAuthReady(true)
        setLoading(false)

      } catch (error) {
        console.error('[Auth] ❌ 커스텀 토큰 로그인 실패:', error)
        setInitError('로그인 처리 중 오류가 발생했습니다.')
      } finally {
        isProcessingTokenRef.current = false
      }
    })()
  }, [searchParams]) // ✅ searchParams 변경 시에만 실행

  // ============================================
  // 🔥 3. Login Methods
  // ============================================

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      // onAuthStateChanged가 자동으로 처리하므로 별도 setUser 불필요
      if (DEBUG_AUTH) console.log('[Auth] ✅ Email 로그인 성공:', userCredential.user.uid)
      
    } catch (error: any) {
      console.error('[Auth] ❌ Email 로그인 실패:', error)
      throw new Error(error.message || '이메일 로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  const loginWithKakao = async (accessToken: string) => {
    // 카카오 로그인은 서버에서 Custom Token을 받아 처리
    // 여기서는 placeholder
    throw new Error('Use /auth/kakao/sync/callback flow')
  }

  const logout = async () => {
    try {
      if (DEBUG_AUTH) console.log('[Auth] 🚪 로그아웃 시작...')
      
      await signOut(auth)
      
      // localStorage 정리
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_type')
      localStorage.removeItem('firebase_token')
      
      setUser(null)
      setUserRole(null)
      setIsAuthReady(false)
      
      if (DEBUG_AUTH) console.log('[Auth] ✅ 로그아웃 완료')
      
    } catch (error) {
      console.error('[Auth] ❌ 로그아웃 실패:', error)
      throw error
    }
  }

  // ============================================
  // 🔥 4. Context Value
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

  // ✅ 디버그 로그 (매 렌더링마다)
  if (DEBUG_AUTH) {
    console.log('[AuthContext] Render:', {
      user: user?.uid,
      loading,
      isAuthReady,
      userRole,
      pathname: location.pathname
    })
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
