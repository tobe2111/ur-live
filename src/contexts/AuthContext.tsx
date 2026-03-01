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
import { app, auth as firebaseAuth, isFirebaseInitialized } from '@/lib/firebase'
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

// ✅ Firebase Auth 인스턴스 (전역)
// 초기화 실패 시 null일 수 있음
const auth = firebaseAuth

export function AuthProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'seller' | 'admin' | null>(null)
  const [syncAttempted, setSyncAttempted] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  // Firebase Auth로 모든 경로 통일 관리
  console.log('[AuthContext] 🔥 100% Firebase Auth 모드')

  // ✅ Firebase Auth 상태 리스너 (한 번만 등록) - 의존성 배열 비움 (무한 루프 방지)
  useEffect(() => {
    console.log('[AuthContext] 🔥 Firebase Auth 초기화 시작 (전체 통합)')
    console.log('[AuthContext] 🔍 Firebase 초기화 상태 체크...')
    
    // ✅ Firebase 초기화 에러 처리
    if (!isFirebaseInitialized()) {
      const errorMsg = 'Firebase 초기화 실패 - firebase.ts에서 초기화 에러 발생'
      console.error('[AuthContext] ❌', errorMsg)
      console.error('[AuthContext] ❌ auth:', auth)
      console.error('[AuthContext] ❌ app:', app)
      setInitError(errorMsg)
      setIsAuthReady(true) // 에러가 있어도 ready 상태로 전환 (흰 화면 방지)
      return
    }
    
    if (!auth) {
      const errorMsg = 'Firebase Auth 인스턴스가 null입니다'
      console.error('[AuthContext] ❌', errorMsg)
      setInitError(errorMsg)
      setIsAuthReady(true)
      return
    }
    
    console.log('[AuthContext] ✅ Firebase 초기화 상태 확인 완료')
    
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
        
        // D1 동기화 (firebase_uid 업데이트) - Rate Limiting 회피
        const lastSyncKey = `last_sync_${firebaseUser.uid}`
        const lastSync = localStorage.getItem(lastSyncKey)
        const now = Date.now()
        const syncInterval = 60000 // 1분
        
        if (!syncAttempted && (!lastSync || now - parseInt(lastSync) > syncInterval)) {
          try {
            await api.post('/api/auth/firebase/sync', {
              idToken,
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName
            })
            localStorage.setItem(lastSyncKey, now.toString())
            console.log('[AuthContext] ✅ D1 동기화 완료')
          } catch (error: any) {
            const status = error?.response?.status
            
            if (status === 429) {
              console.warn('[AuthContext] ⚠️ Rate Limit - sync 스킵 (사용자 인증은 유지)')
              // Rate limit에도 인증 상태 유지
              localStorage.setItem(lastSyncKey, now.toString())
            } else if (status === 401) {
              console.error('[AuthContext] ❌ 401 Unauthorized - Token 검증 실패')
              console.error('[AuthContext] 상세:', {
                firebaseUid: firebaseUser.uid,
                email: firebaseUser.email,
                errorMessage: error?.response?.data?.error
              })
              // ✅ 401이어도 Firebase User가 있으면 로그인 상태 유지 (무한 루프 방지)
              console.warn('[AuthContext] ⚠️ D1 sync 실패했지만 Firebase Auth는 유효함 - 로그인 유지')
              localStorage.setItem(lastSyncKey, now.toString()) // 재시도 방지
            } else {
              console.error('[AuthContext] ❌ D1 동기화 실패:', error)
            }
          } finally {
            setSyncAttempted(true)
          }
        } else {
          console.log('[AuthContext] ⏭️ Sync 스킵 (최근 sync: ' + (lastSync ? new Date(parseInt(lastSync)).toLocaleTimeString() : 'N/A') + ')')
        }
        
        // ✅ D1 sync 실패 여부와 관계없이 Firebase User 기준으로 로그인 상태 설정
        // Firebase가 Single Source of Truth
        localStorage.setItem('firebase_token', idToken)
        localStorage.setItem('user_type', role || 'user')
        
        setUser(firebaseUser)
        setUserRole(role || 'user')
        
        console.log('[AuthContext] ✅ 로그인 상태 확정:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: role || 'user',
          source: 'Firebase Auth (Single Source of Truth)'
        })
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
  }, []) // ✅ 빈 의존성 배열 - Firebase Auth 리스너는 한 번만 등록되어야 함 (무한 루프 방지)

  // ✅ URL 파라미터 처리 (한 번만 실행) - 카카오 OAuth 및 레거시 파라미터 정리
  useEffect(() => {
    // ✅ URL 파라미터가 없으면 아예 실행하지 않음
    const customToken = searchParams.get('firebase_token')
    const jwtParams = ['access_token', 'refresh_token', 'userId', 'userEmail', 'userName']
    const hasJwtTokens = jwtParams.some(param => searchParams.has(param))
    
    if (!customToken && !hasJwtTokens) {
      // 처리할 파라미터가 없으면 스킵
      return
    }
    
    // ✅ 중복 실행 방지 - 이미 처리했으면 스킵
    const processedKey = 'url_params_processed'
    const alreadyProcessed = sessionStorage.getItem(processedKey)
    
    if (alreadyProcessed) {
      console.log('[AuthContext] ⏭️ URL 파라미터 이미 처리됨 - 스킵')
      return
    }
    
    console.log('[AuthContext] 🔍 URL 파라미터 처리 시작:', { customToken: !!customToken, hasJwtTokens })
    
    const handleUrlParams = async () => {
      const userName = searchParams.get('userName')
      
      // ⚠️ 처리 시작 즉시 플래그 설정 (중복 방지)
      sessionStorage.setItem(processedKey, 'true')
      
      if (hasJwtTokens) {
        console.warn('[AuthContext] ⚠️ URL에 JWT/레거시 토큰 감지 - 자동 정리 중')
        
        // 레거시 JWT 키 정리
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('userId')
        localStorage.removeItem('userEmail')
        
        console.log('[AuthContext] ✅ JWT/레거시 파라미터 완전 정리 완료')
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
          
          // URL 완전 정리 - 모든 파라미터 제거
          setSearchParams(new URLSearchParams(), { replace: true })
          console.log('[AuthContext] ✅ URL 파라미터 완전 제거')
          
          // ✅ 페이지 새로고침 없이 onAuthStateChanged가 자동 처리하도록 함
          console.log('[AuthContext] ✅ Firebase Auth가 자동으로 상태 업데이트 처리')
        } catch (error) {
          console.error('[AuthContext] ❌ 카카오 Firebase 로그인 실패:', error)
          setInitError('카카오 로그인 처리 실패')
          // URL 파라미터 제거
          setSearchParams(new URLSearchParams(), { replace: true })
        }
      } else if (hasJwtTokens) {
        // JWT 파라미터만 있고 firebase_token이 없으면 URL 정리만
        setSearchParams(new URLSearchParams(), { replace: true })
      }
    }
    
    handleUrlParams()
  }, [searchParams, setSearchParams]) // searchParams 변경 시 실행되지만 중복 방지 로직으로 한 번만 실행됨

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
    computedIsLoggedIn,
    isAuthReady,
    initError
  })
  
  // ✅ 초기화 에러가 있으면 에러 UI 표시 (흰 화면 방지)
  if (initError && isAuthReady) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="mb-4 text-red-600">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">인증 시스템 오류</h2>
          <p className="text-gray-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }

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
