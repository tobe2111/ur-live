import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithCustomToken,
  type User
} from 'firebase/auth'
import { app } from '@/lib/firebase'
import api from '@/lib/api'

/**
 * Firebase Auth Context - 100% Firebase Authentication
 * 
 * 목적:
 * - Firebase Authentication 기반 전역 인증 상태 제공
 * - 카카오 OAuth → Firebase Custom Token 처리
 * - 이메일/비밀번호 로그인 (일반 사용자, 셀러, 관리자)
 * - 비밀번호 재설정 이메일 발송
 * - Custom Claims로 역할(role) 관리 (user, seller, admin)
 * 
 * 인증 방식:
 * - JWT 완전 제거, Firebase ID Token 단일 방식 사용
 * - 모든 사용자(일반/셀러/관리자)가 Firebase Auth 통합 관리
 * - Custom Claims를 통한 권한 구분
 */

interface AuthContextType {
  user: User | null
  isAuthReady: boolean
  isLoggedIn: boolean
  userRole: 'user' | 'seller' | 'admin' | null
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>
  loginWithKakao: (kakaoAccessToken: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const auth = getAuth(app)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'seller' | 'admin' | null>(null)

  // Firebase Auth로 모든 경로 통일 관리
  console.log('[AuthContext] 🔥 100% Firebase Auth 모드')

  // ✅ Firebase Auth 상태 리스너 (한 번만 등록)
  useEffect(() => {
    console.log('[AuthContext] 🔥 Firebase Auth 초기화 시작 (전체 통합)')
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] 🔥 onAuthStateChanged 트리거:', {
        hasUser: !!firebaseUser,
        email: firebaseUser?.email
      })
      
      if (firebaseUser) {
        // Firebase ID Token 가져오기
        const idToken = await firebaseUser.getIdToken()
        
        // Custom Claims에서 역할 확인
        const idTokenResult = await firebaseUser.getIdTokenResult()
        const role = idTokenResult.claims.role as 'user' | 'seller' | 'admin' | null
        
        console.log('[AuthContext] ✅ 사용자 인증됨:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: role || 'user'
        })
        
        // D1 동기화 (firebase_uid 업데이트)
        try {
          await api.post('/api/auth/firebase/sync', {
            idToken,
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName
          })
          console.log('[AuthContext] ✅ D1 동기화 완료')
        } catch (error) {
          console.error('[AuthContext] ❌ D1 동기화 실패:', error)
        }
        
        // 로컬 상태 저장
        localStorage.setItem('firebase_token', idToken)
        localStorage.setItem('user_type', role || 'user')
        
        setUser(firebaseUser)
        setUserRole(role || 'user')
      } else {
        console.log('[AuthContext] ❌ 사용자 로그아웃 상태')
        
        // Firebase 토큰도 없으면 진짜 로그아웃
        localStorage.removeItem('firebase_token')
        localStorage.removeItem('user_type')
        
        setUser(null)
        setUserRole(null)
      }
      
      setIsAuthReady(true)
    })

    return () => {
      console.log('[AuthContext] 🔥 Firebase Auth 리스너 해제')
      unsubscribe()
    }
  }, [searchParams])

  // ✅ 카카오 OAuth → Firebase Custom Token 로그인
  useEffect(() => {
    const handleKakaoCallback = async () => {
      const customToken = searchParams.get('firebase_token')
      const userName = searchParams.get('userName')
      
      // 🔥 JWT 토큰 자동 정리 (마이그레이션 지원)
      const hasJwtTokens = searchParams.has('access_token') || searchParams.has('refresh_token')
      if (hasJwtTokens) {
        console.warn('[AuthContext] ⚠️ URL에 JWT 토큰 감지 - 자동 정리 중')
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
        
        // 레거시 JWT 키 정리
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        
        console.log('[AuthContext] ✅ JWT 토큰 URL 파라미터 및 localStorage 정리 완료')
        return
      }
      
      if (customToken) {
        console.log('[AuthContext] 🔥 카카오 Custom Token 수신:', {
          hasToken: !!customToken,
          userName: userName ? decodeURIComponent(userName) : null
        })
        
        try {
          // Firebase Auth에 Custom Token으로 로그인
          const userCredential = await signInWithCustomToken(auth, customToken)
          console.log('[AuthContext] ✅ 카카오 Firebase 로그인 성공:', userCredential.user.uid)
          
          // URL 파라미터 제거
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
          
          // 페이지 새로고침 (한 번만)
          if (!sessionStorage.getItem('kakao_firebase_refreshed')) {
            sessionStorage.setItem('kakao_firebase_refreshed', 'true')
            console.log('[AuthContext] 🔄 카카오 로그인 완료 - 페이지 새로고침')
            window.location.reload()
          }
        } catch (error) {
          console.error('[AuthContext] ❌ 카카오 Firebase 로그인 실패:', error)
          // URL 파라미터 제거
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
        }
      }
    }
    
    handleKakaoCallback()
  }, [searchParams])

  /**
   * 이메일/비밀번호 로그인
   */
  const loginWithEmail = async (email: string, password: string) => {
    console.log('[AuthContext] 📧 이메일 로그인 시도:', email)
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      console.log('[AuthContext] ✅ 이메일 로그인 성공:', userCredential.user.uid)
      
      // onAuthStateChanged가 자동으로 처리
    } catch (error: any) {
      console.error('[AuthContext] ❌ 이메일 로그인 실패:', error)
      throw new Error(error.message)
    }
  }

  /**
   * 이메일/비밀번호 회원가입
   */
  const signupWithEmail = async (email: string, password: string, name: string) => {
    console.log('[AuthContext] 📧 이메일 회원가입 시도:', email)
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      console.log('[AuthContext] ✅ 이메일 회원가입 성공:', userCredential.user.uid)
      
      // D1에 사용자 정보 저장
      const idToken = await userCredential.user.getIdToken()
      await api.post('/api/auth/firebase/register', {
        idToken,
        firebaseUid: userCredential.user.uid,
        email: userCredential.user.email,
        name,
        userType: 'user'
      })
      
      console.log('[AuthContext] ✅ D1 사용자 등록 완료')
    } catch (error: any) {
      console.error('[AuthContext] ❌ 이메일 회원가입 실패:', error)
      throw new Error(error.message)
    }
  }

  /**
   * 카카오 로그인 (Custom Token)
   */
  const loginWithKakao = async (kakaoAccessToken: string) => {
    console.log('[AuthContext] 🔑 카카오 로그인 시도')
    
    try {
      // 백엔드에서 Firebase Custom Token 받기
      const response = await api.post('/api/auth/kakao/firebase', {
        accessToken: kakaoAccessToken
      })
      
      const { customToken, user: userData } = response.data
      console.log('[AuthContext] ✅ 카카오 Custom Token 수신:', userData)
      
      // Firebase Auth에 Custom Token으로 로그인
      const userCredential = await signInWithCustomToken(auth, customToken)
      console.log('[AuthContext] ✅ 카카오 Firebase 로그인 성공:', userCredential.user.uid)
      
      // onAuthStateChanged가 자동으로 처리
    } catch (error: any) {
      console.error('[AuthContext] ❌ 카카오 로그인 실패:', error)
      throw new Error(error.message)
    }
  }

  /**
   * 로그아웃
   */
  const logout = async () => {
    console.log('[AuthContext] 🚪 로그아웃 시도')
    
    try {
      await signOut(auth)
      console.log('[AuthContext] ✅ 로그아웃 성공')
      
      // 로컬 스토리지 클리어
      localStorage.clear()
      sessionStorage.clear()
    } catch (error: any) {
      console.error('[AuthContext] ❌ 로그아웃 실패:', error)
      throw new Error(error.message)
    }
  }

  /**
   * 비밀번호 재설정 이메일 발송
   */
  const resetPassword = async (email: string) => {
    console.log('[AuthContext] 📧 비밀번호 재설정 이메일 발송:', email)
    
    try {
      await sendPasswordResetEmail(auth, email)
      console.log('[AuthContext] ✅ 비밀번호 재설정 이메일 발송 완료')
    } catch (error: any) {
      console.error('[AuthContext] ❌ 비밀번호 재설정 이메일 발송 실패:', error)
      throw new Error(error.message)
    }
  }

  // ⚠️ isLoggedIn 계산 로직 - 100% Firebase Auth 단일화
  const hasFirebaseUser = !!user
  
  // 모든 경로: Firebase User만 체크 (Custom Claims로 role 구분)
  const computedIsLoggedIn = hasFirebaseUser
  
  console.log('[AuthContext] 로그인 상태 계산:', {
    hasFirebaseUser,
    userRole,
    computedIsLoggedIn
  })

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthReady,
        isLoggedIn: computedIsLoggedIn,
        userRole,
        loginWithEmail,
        signupWithEmail,
        loginWithKakao,
        logout,
        resetPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
