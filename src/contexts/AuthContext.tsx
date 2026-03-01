import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'seller' | 'admin' | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  // ✅ useRef로 동기 처리 상태 즉시 제어
  const isProcessingTokenRef = useRef(false)
  const processedTokenRef = useRef<string | null>(null)
  const authChangeCounterRef = useRef(0)
  const syncAttemptedUidsRef = useRef<Set<string>>(new Set())
  const lastAuthStateRef = useRef<'loading' | 'logged-in' | 'logged-out'>('loading')  // ✅ 상태 변경 추적

  // Firebase Auth로 모든 경로 통일 관리
  console.log('[AuthContext] 🔥 100% Firebase Auth 모드 + useRef 동기 제어')

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
      authChangeCounterRef.current++
      const currentState = firebaseUser ? 'logged-in' : 'logged-out'
      
      console.log(`[AuthContext] 🔥 onAuthStateChanged 트리거 #${authChangeCounterRef.current}:`, {
        hasUser: !!firebaseUser,
        email: firebaseUser?.email,
        uid: firebaseUser?.uid,
        lastState: lastAuthStateRef.current,
        currentState
      })
      
      // ✅ 상태가 실제로 변경되지 않았으면 스킵
      if (lastAuthStateRef.current === currentState && lastAuthStateRef.current !== 'loading') {
        console.log('[AuthContext] ⏭️ 상태 변경 없음 - 스킵')
        return
      }
      
      lastAuthStateRef.current = currentState
      
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
        
        // ✅ CRITICAL FIX 1: URL 파라미터의 userName을 최우선으로 사용
        const urlUserName = localStorage.getItem('temp_user_name_from_url')
        
        // ✅ Custom Claims에서 userId 바로 가져오기 (API 호출 불필요!)
        const userIdFromClaims = idTokenResult.claims.userId as number | undefined
        const userNameFromFirebase = firebaseUser.displayName
        
        if (userIdFromClaims) {
          localStorage.setItem('user_id', userIdFromClaims.toString())
          console.log('[AuthContext] ✅ user_id를 Custom Claims에서 저장:', userIdFromClaims)
        } else {
          console.warn('[AuthContext] ⚠️ Custom Claims에 userId 없음 - D1 sync 시도')
        }
        
        // ✅ CRITICAL FIX 2: userName 우선순위 - URL > Firebase > D1
        if (urlUserName) {
          localStorage.setItem('user_name', urlUserName)
          localStorage.removeItem('temp_user_name_from_url') // 임시 저장소 정리
          console.log('[AuthContext] ✅ user_name을 URL 파라미터에서 저장 (최우선):', urlUserName)
        } else if (userNameFromFirebase) {
          localStorage.setItem('user_name', userNameFromFirebase)
          console.log('[AuthContext] ✅ user_name을 Firebase에서 저장:', userNameFromFirebase)
        } else {
          console.warn('[AuthContext] ⚠️ user_name 없음 - D1 sync에서 가져오기 시도')
        }
        
        // D1 동기화 (firebase_uid 업데이트) - Rate Limiting 회피 + 백오프
        const lastSyncKey = `last_sync_${firebaseUser.uid}`
        const lastSync = localStorage.getItem(lastSyncKey)
        const rateLimitKey = `rate_limit_${firebaseUser.uid}`
        const rateLimitUntil = localStorage.getItem(rateLimitKey)
        const now = Date.now()
        const syncInterval = 600000 // 10분 (서버와 동기화 - 60000ms × 10)
        
        // ✅ Rate Limit 중이면 sync 완전 스킵
        if (rateLimitUntil && now < parseInt(rateLimitUntil)) {
          const waitSeconds = Math.ceil((parseInt(rateLimitUntil) - now) / 1000)
          console.log(`[AuthContext] ⏱️ Rate Limit 대기 중 (${waitSeconds}초 남음)`)
        } else if (!syncAttemptedUidsRef.current.has(firebaseUser.uid) && (!lastSync || now - parseInt(lastSync) > syncInterval)) {
          try {
            const syncResponse = await api.post('/api/auth/firebase/sync', {
              idToken,
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName
            })
            
            // ✅ D1 sync 성공 시 Custom Claims에 없던 데이터만 저장
            if (syncResponse.data?.success && syncResponse.data?.user) {
              const userData = syncResponse.data.user
              
              // Custom Claims에서 못 가져온 경우만 저장
              if (!userIdFromClaims && userData.id) {
                localStorage.setItem('user_id', userData.id.toString())
                console.log('[AuthContext] ✅ D1에서 user_id 저장:', userData.id)
              }
              
              if (!userNameFromFirebase && userData.name) {
                localStorage.setItem('user_name', userData.name)
                console.log('[AuthContext] ✅ D1에서 user_name 저장:', userData.name)
              }
            }
            
            localStorage.setItem(lastSyncKey, now.toString())
            localStorage.removeItem(rateLimitKey) // 성공 시 rate limit 해제
            console.log('[AuthContext] ✅ D1 동기화 완료')
          } catch (error: any) {
            const status = error?.response?.status
            const errorData = error?.response?.data
            
            // ✅ firebase_uid 컬럼 없음 에러는 무시 (마이그레이션 대기 중)
            if (errorData?.error?.includes('no such column: firebase_uid') || 
                errorData?.error?.includes('firebase_uid')) {
              console.warn('[AuthContext] ⚠️ D1 마이그레이션 대기 중 - firebase_uid 컬럼 없음')
              console.warn('[AuthContext] ℹ️ 로그인은 정상 작동, D1 sync만 스킵')
              localStorage.setItem(lastSyncKey, now.toString())
            } else if (status === 429) {
              // ✅ CRITICAL FIX 3: 429 에러여도 로그인 승인 (Fallback 로직)
              const backoffMs = 120000 // 2분
              localStorage.setItem(rateLimitKey, (now + backoffMs).toString())
              localStorage.setItem(lastSyncKey, now.toString())
              console.warn(`[AuthContext] ⚠️ Rate Limit (429) - D1 sync 실패`)
              console.log(`[AuthContext] ✅ FALLBACK: Firebase Auth는 유효함 - 로그인 승인 계속`)
              // ✅ user_id와 user_name이 이미 저장되어 있으면 로그인 정상 진행
            } else if (status === 401) {
              console.error('[AuthContext] ❌ 401 Unauthorized - Token 검증 실패')
              console.log('[AuthContext] ✅ FALLBACK: Firebase Auth는 유효함 - 로그인 승인 계속')
              localStorage.setItem(lastSyncKey, now.toString())
            } else {
              console.error('[AuthContext] ❌ D1 동기화 실패:', error)
              console.log('[AuthContext] ✅ FALLBACK: Firebase Auth는 유효함 - 로그인 승인 계속')
            }
          } finally {
            syncAttemptedUidsRef.current.add(firebaseUser.uid)  // ✅ uid별로 기록
          }
        } else {
          console.log('[AuthContext] ⏭️ Sync 스킵 (최근 sync: ' + (lastSync ? new Date(parseInt(lastSync)).toLocaleTimeString() : 'N/A') + ')')
          
          // ✅ Custom Claims에서 못 가져온 경우에만 조회 API 호출
          if (!userIdFromClaims && (!rateLimitUntil || now >= parseInt(rateLimitUntil))) {
            try {
              console.log('[AuthContext] 🔍 Custom Claims에 userId 없음 - D1 조회 API 호출')
              const userIdResponse = await api.get(`/api/auth/firebase/user-id/${firebaseUser.uid}`)
              
              if (userIdResponse.data?.success) {
                localStorage.setItem('user_id', userIdResponse.data.userId?.toString() || '')
                localStorage.setItem('user_name', userIdResponse.data.userName || '')
                
                console.log('[AuthContext] ✅ D1에서 user_id 조회 완료:', {
                  userId: userIdResponse.data.userId,
                  userName: userIdResponse.data.userName
                })
              }
            } catch (err: any) {
              if (err?.response?.status === 429) {
                const backoffMs = 120000
                localStorage.setItem(rateLimitKey, (now + backoffMs).toString())
                console.warn(`[AuthContext] ⚠️ user_id 조회 Rate Limit - 2분 대기 설정`)
              } else {
                console.warn('[AuthContext] ⚠️ user_id 조회 실패 (계속 진행):', err)
              }
            }
          }
        }
        
        // ✅ D1 sync 실패 여부와 관계없이 Firebase User 기준으로 로그인 상태 설정
        // Firebase가 Single Source of Truth
        localStorage.setItem('firebase_token', idToken)
        localStorage.setItem('user_type', role || 'user')
        
        // ✅ 상태 업데이트를 한 번에 (batch update)
        setUser(firebaseUser)
        setUserRole(role || 'user')
        setIsAuthReady(true)  // ✅ 여기서 한 번만 설정
        
        console.log('[AuthContext] ✅ 로그인 상태 확정:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: role || 'user',
          source: 'Firebase Auth (Single Source of Truth)'
        })
      } else {
        console.log(`[AuthContext] ❌ 사용자 로그아웃 상태 (#${authChangeCounterRef.current})`)
        
        // Firebase 토큰도 없으면 진짜 로그아웃
        localStorage.removeItem('firebase_token')
        localStorage.removeItem('user_type')
        
        setUser(null)
        setUserRole(null)
        setIsAuthReady(true)  // ✅ 로그아웃도 ready
      }
    })

    return () => {
      console.log('[AuthContext] 🔥 Firebase Auth 리스너 해제')
      unsubscribe()
    }
  }, []) // ✅ 빈 의존성 배열 - Firebase Auth 리스너는 한 번만 등록되어야 함 (무한 루프 방지)

  // ✅ URL 파라미터 처리 - useRef 동기 제어 + window.history.replaceState
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')  // ✅ 변수로 추출
    const userName = searchParams.get('userName')  // ✅ URL에서 사용자 이름 추출
    const errorParam = searchParams.get('error')
    const errorDetail = searchParams.get('detail')
    const jwtParams = ['access_token', 'refresh_token', 'userId', 'userEmail']
    const hasJwtTokens = jwtParams.some(param => searchParams.has(param))
    
    console.log('[AuthContext] 🔍 URL useEffect 트리거:', { 
      firebaseToken: firebaseToken?.substring(0, 20) + '...', 
      hasJwtTokens,
      pathname: window.location.pathname 
    })
    
    // ✅ 가드 0: 에러 파라미터가 있으면 즉시 제거하고 에러 표시
    if (errorParam) {
      console.error('[AuthContext] ❌ URL에서 에러 감지:', { error: errorParam, detail: errorDetail })
      
      // 에러 상태 설정
      if (errorParam === 'database_error' && errorDetail?.includes('Firebase custom token')) {
        setInitError('Firebase 인증 설정 오류: 서버 환경변수를 확인해주세요')
      } else {
        setInitError(errorDetail || errorParam)
      }
      
      // URL 정리
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, document.title, cleanUrl)
      console.log('[AuthContext] ✅ 에러 URL 파라미터 제거 완료')
      
      // 로그인 페이지로 리다이렉트
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 100)
      
      return
    }
    
    // ✅ 가드 1: 처리할 파라미터가 없으면 조기 종료
    if (!firebaseToken && !hasJwtTokens) {
      return
    }
    
    // ✅ 가드 2: 이미 처리 중이면 조기 종료 (useRef 즉시 체크)
    if (isProcessingTokenRef.current) {
      console.log('[AuthContext] ⏭️ 이미 토큰 처리 중 - 스킵')
      return
    }
    
    // ✅ 가드 3: 이미 처리한 토큰이면 조기 종료
    if (firebaseToken && processedTokenRef.current === firebaseToken) {
      console.log('[AuthContext] ⏭️ 이미 처리된 토큰 - 스킵')
      return
    }
    
    console.log('[AuthContext] 🔍 URL 파라미터 처리 시작:', { 
      hasFirebaseToken: !!firebaseToken, 
      hasJwtTokens 
    })
    
    // ✅ 즉시 락(Lock) 설정 - 중복 실행 완전 차단
    isProcessingTokenRef.current = true
    if (firebaseToken) {
      processedTokenRef.current = firebaseToken
    }
    
    const handleUrlParams = async () => {
      try {
        // ✅ 🚨 CRITICAL: URL 파라미터를 즉시 제거 (비동기 처리 전에!)
        // 이렇게 하지 않으면 React Router가 파라미터를 다시 감지해서 무한 루프 발생
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, document.title, cleanUrl)
        console.log('[AuthContext] ✅ URL 파라미터 즉시 제거 (무한 루프 방지)')
        
        // JWT 레거시 파라미터 정리
        if (hasJwtTokens) {
          console.warn('[AuthContext] ⚠️ JWT 레거시 토큰 정리 중')
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('userId')
          localStorage.removeItem('userEmail')
          console.log('[AuthContext] ✅ JWT 정리 완료')
        }
        
        // ✅ CRITICAL FIX 1: URL 파라미터에서 userName을 즉시 저장 (서버 sync 불필요)
        // 429 에러가 발생해도 이름이 보장됨
        if (userName) {
          const decodedName = decodeURIComponent(userName)
          localStorage.setItem('user_name', decodedName) // 즉시 저장!
          localStorage.setItem('temp_user_name_from_url', decodedName) // 임시 저장소에도 저장
          console.log('[AuthContext] 🎯 URL에서 user_name 즉시 저장 (서버 sync 불필요):', decodedName)
        }
        
        // Firebase Custom Token 처리
        if (firebaseToken) {
          console.log('[AuthContext] 🔥 Firebase Custom Token 로그인 시작')
          
          const userCredential = await signInWithCustomToken(auth, firebaseToken)
          console.log('[AuthContext] ✅ Firebase 로그인 성공:', userCredential.user.uid)
          
          // ✅ CRITICAL FIX 2: Firebase displayName에 userName 동기화 (근본 해결)
          // 이렇게 하면 서버(D1)가 죽어도 Firebase에서 이름을 가져올 수 있음
          const urlUserName = localStorage.getItem('temp_user_name_from_url')
          if (urlUserName && !userCredential.user.displayName) {
            try {
              const { updateProfile } = await import('firebase/auth')
              await updateProfile(userCredential.user, { displayName: urlUserName })
              console.log('[AuthContext] 🎯 Firebase displayName 동기화 완료:', urlUserName)
            } catch (err) {
              console.warn('[AuthContext] ⚠️ Firebase displayName 업데이트 실패 (무시):', err)
            }
          }
          
          // ✅ returnUrl 저장만 하고 navigate는 onAuthStateChanged에서 처리
          const returnUrl = localStorage.getItem('loginReturnUrl') || '/'
          console.log('[AuthContext] ✅ returnUrl 저장:', returnUrl)
          
          // ✅ CRITICAL FIX: onAuthStateChanged가 트리거될 때까지 짧은 대기
          // signInWithCustomToken이 완료되어도 onAuthStateChanged는 비동기로 트리거됨
          // 이 대기 시간 동안 Firebase Auth 상태가 업데이트됨
          await new Promise(resolve => setTimeout(resolve, 300))
          console.log('[AuthContext] ✅ Firebase Auth 상태 업데이트 대기 완료')
          // navigate는 하지 않음 - onAuthStateChanged가 완료되면 자동으로 페이지가 렌더링됨
        }
      } catch (error) {
        console.error('[AuthContext] ❌ URL 파라미터 처리 실패:', error)
        setInitError('로그인 처리 실패')
      } finally {
        // ✅ 락(Lock) 해제
        isProcessingTokenRef.current = false
      }
    }
    
    handleUrlParams()
  }, [searchParams, navigate])  // ✅ searchParams 전체를 의존성으로

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
