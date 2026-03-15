/**
 * 🔐 Login Flow Service
 * 
 * 4가지 로그인 방식을 모두 지원:
 * 1. 일반 사용자 - Kakao/Google OAuth + Firebase
 * 2. 셀러 - 이메일/비밀번호 + JWT
 * 3. 어드민 - 이메일/비밀번호 + JWT
 * 4. Custom Token - Firebase Custom Token 직접 처리
 * 
 * Updated: 2026-03-09 - Lazy loading Firebase Auth
 */

import api from '@/lib/api'
import { logger } from '@/utils/logger'

// ============================================
// 1. 일반 사용자 로그인 (Firebase) - Lazy Loaded
// ============================================

/**
 * 카카오 액세스 토큰으로 Firebase 로그인
 * 
 * ✅ 인증 상태 전파 대기 추가 - 타이밍 이슈 해결
 */
export async function loginWithKakaoToken(accessToken: string): Promise<void> {
  logger.info('[LoginFlow] 🔑 카카오 토큰으로 Firebase 로그인 시작')
  
  try {
    // ✅ CRITICAL: 다른 세션 완전 정리 (Seller/Admin 세션)
    logger.info('[LoginFlow] 🧹 Seller/Admin 세션 정리 중...')
    const { clearAuthData } = await import('@/utils/auth')
    clearAuthData('seller')
    clearAuthData('admin')
    logger.info('[LoginFlow] ✅ Seller/Admin 세션 정리 완료')
    // 1. 백엔드에서 Firebase Custom Token 받기
    const response = await fetch('/api/auth/kakao/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }

    const data = await response.json() as any
    
    if (!data.firebaseToken && !data.customToken) {
      throw new Error('No Firebase token received from backend')
    }

    const customToken = data.firebaseToken || data.customToken

    // 2. Lazy load Firebase Auth
    logger.info('[LoginFlow] 🔥 Lazy loading Firebase Auth...')
    const { signInWithCustomToken, getFirebaseAuth } = await import('@/lib/firebase-auth')
    
    // 3. Firebase Custom Token으로 로그인
    logger.info('[LoginFlow] 🔥 Firebase Custom Token으로 로그인 중...')
    const credential = await signInWithCustomToken(customToken)
    
    logger.info('[LoginFlow] ✅ Firebase 로그인 성공:', credential.user.uid)

    // ✅ 중요: Auth State 동기화 대기 (800ms + currentUser 확인)
    logger.info('[LoginFlow] ⏳ Auth State 동기화 대기 중...')
    const auth = await getFirebaseAuth()
    
    await new Promise<void>((resolve) => {
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        
        // currentUser가 설정되었는지 체크
        if (auth.currentUser && auth.currentUser.uid === credential.user.uid) {
          clearInterval(checkInterval)
          logger.info(`[LoginFlow] ✅ Auth State 동기화 완료 (${elapsed}ms):`, auth.currentUser.uid)
          resolve()
          return
        }
        
        // 최대 1000ms 대기
        if (elapsed >= 1000) {
          clearInterval(checkInterval)
          logger.warn('[LoginFlow] ⚠️ Auth State 동기화 타임아웃 (1000ms)')
          resolve() // 타임아웃되어도 계속 진행
        }
      }, 50) // 50ms마다 체크
    })
    
    // ✅ lastLoginUid 저장 (다음 로드 시 즉시 인식)
    localStorage.setItem('lastLoginUid', credential.user.uid)
    
    // ✅ user_type을 'user'로 설정 (일반 사용자)
    localStorage.setItem('user_type', 'user')
    logger.info('[LoginFlow] ✅ user_type을 "user"로 설정 완료')

    // 4. 백그라운드에서 Token 갱신 (속도 최적화)
    credential.user.getIdToken(true)
      .then(() => logger.info('[LoginFlow] 🔥 ID Token 강제 갱신 완료'))
      .catch((err) => logger.warn('[LoginFlow] ⚠️ Token 갱신 실패 (무시):', { error: String(err) }))

  } catch (error) {
    logger.error('[LoginFlow] ❌ 카카오 로그인 실패:', { error: String(error) })
    throw error
  }
}

/**
 * Firebase Custom Token으로 직접 로그인 (URL에서 받은 경우)
 * 
 * ✅ 인증 상태 전파 대기 추가 - 타이밍 이슈 해결
 */
export async function loginWithFirebaseToken(firebaseToken: string): Promise<void> {
  logger.info('[LoginFlow] 🔑 Firebase Custom Token으로 직접 로그인')
  
  try {
    // ✅ CRITICAL: 다른 세션 완전 정리 (Seller/Admin 세션)
    logger.info('[LoginFlow] 🧹 Seller/Admin 세션 정리 중...')
    const { clearAuthData } = await import('@/utils/auth')
    clearAuthData('seller')
    clearAuthData('admin')
    logger.info('[LoginFlow] ✅ Seller/Admin 세션 정리 완료')
    // Lazy load Firebase Auth
    const { signInWithCustomToken, getFirebaseAuth } = await import('@/lib/firebase-auth')
    
    const credential = await signInWithCustomToken(firebaseToken)
    logger.info('[LoginFlow] ✅ Firebase 로그인 성공:', credential.user.uid)

    // ✅ 중요: Auth State 동기화 대기 (800ms + currentUser 확인)
    logger.info('[LoginFlow] ⏳ Auth State 동기화 대기 중...')
    const auth = await getFirebaseAuth()
    
    await new Promise<void>((resolve) => {
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        
        // currentUser가 설정되었는지 체크
        if (auth.currentUser && auth.currentUser.uid === credential.user.uid) {
          clearInterval(checkInterval)
          logger.info(`[LoginFlow] ✅ Auth State 동기화 완료 (${elapsed}ms):`, auth.currentUser.uid)
          resolve()
          return
        }
        
        // 최대 1000ms 대기
        if (elapsed >= 1000) {
          clearInterval(checkInterval)
          logger.warn('[LoginFlow] ⚠️ Auth State 동기화 타임아웃 (1000ms)')
          resolve() // 타임아웃되어도 계속 진행
        }
      }, 50) // 50ms마다 체크
    })
    
    // ✅ lastLoginUid 저장 (다음 로드 시 즉시 인식)
    localStorage.setItem('lastLoginUid', credential.user.uid)
    
    // ✅ user_type을 'user'로 설정 (일반 사용자)
    localStorage.setItem('user_type', 'user')
    logger.info('[LoginFlow] ✅ user_type을 "user"로 설정 완료')

    // 백그라운드 Token 갱신
    credential.user.getIdToken(true)
      .then(() => logger.info('[LoginFlow] 🔥 ID Token 강제 갱신 완료'))
      .catch((err) => logger.warn('[LoginFlow] ⚠️ Token 갱신 실패 (무시):', { error: String(err) }))

  } catch (error) {
    logger.error('[LoginFlow] ❌ Firebase Token 로그인 실패:', { error: String(error) })
    throw error
  }
}

// ============================================
// 2. 셀러 로그인 (JWT)
// ============================================

export interface SellerLoginResponse {
  token: string
  user: {
    id: number
    email: string
    name: string
    role: 'seller'
  }
}

/**
 * 셀러 이메일/비밀번호 로그인
 */
export async function loginSeller(email: string, password: string): Promise<SellerLoginResponse> {
  logger.info('[LoginFlow] 🏪 셀러 로그인 시작:', email)
  
  try {
    const response = await api.post('/auth/seller/login', {
      email,
      password,
    })

    const data = response.data as SellerLoginResponse
    
    // JWT 토큰 저장
    if (data.token) {
      localStorage.setItem('seller_token', data.token)
      localStorage.setItem('user_type', 'seller')
      logger.info('[LoginFlow] ✅ 셀러 로그인 성공:', data.user.email)
    } else {
      throw new Error('No token received')
    }

    return data
  } catch (error) {
    logger.error('[LoginFlow] ❌ 셀러 로그인 실패:', { error: String(error) })
    
    // 에러 메시지 정리
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || (error as Error).message || '로그인에 실패했습니다'
    throw new Error(message)
  }
}

// ============================================
// 3. 어드민 로그인 (JWT)
// ============================================

export interface AdminLoginResponse {
  token: string
  user: {
    id: number
    email: string
    name: string
    role: 'admin'
  }
}

/**
 * 어드민 이메일/비밀번호 로그인
 */
export async function loginAdmin(email: string, password: string): Promise<AdminLoginResponse> {
  logger.info('[LoginFlow] 👔 어드민 로그인 시작:', email)
  
  try {
    const response = await api.post('/auth/admin/login', {
      email,
      password,
    })

    const data = response.data as AdminLoginResponse
    
    // JWT 토큰 저장
    if (data.token) {
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('user_type', 'admin')
      logger.info('[LoginFlow] ✅ 어드민 로그인 성공:', data.user.email)
    } else {
      throw new Error('No token received')
    }

    return data
  } catch (error) {
    logger.error('[LoginFlow] ❌ 어드민 로그인 실패:', { error: String(error) })
    
    // 에러 메시지 정리
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || (error as Error).message || '로그인에 실패했습니다'
    throw new Error(message)
  }
}

// ============================================
// 4. 로그아웃 (통합)
// ============================================

/**
 * 타입별 선택적 로그아웃 - 완벽한 계정 분리
 * 
 * @param userType - 로그아웃할 사용자 타입 (자동 감지 시 undefined)
 */
export async function logout(userType?: 'user' | 'seller' | 'admin'): Promise<void> {
  // ✅ userType 자동 감지
  if (!userType) {
    const storedType = localStorage.getItem('user_type')
    userType = (storedType as 'user' | 'seller' | 'admin') || 'user'
  }
  
  logger.info(`[LoginFlow] 🚪 ${userType} 로그아웃 시작`)
  
  try {
    // ✅ userType에 따라 선택적 로그아웃
    if (userType === 'user') {
      // 1️⃣ User 로그아웃 (Firebase + User 세션만 정리)
      
      // Firebase 로그아웃
      try {
        const { signOut } = await import('@/lib/firebase-auth')
        await signOut()
        logger.info('[LoginFlow] ✅ Firebase 로그아웃 완료')
      } catch (err) {
        logger.warn('[LoginFlow] ⚠️ Firebase 로그아웃 실패 (무시):', { error: String(err) })
      }
      
      // Zustand 스토어 초기화 (persist 포함)
      try {
        const { isKorea } = await import('@/shared/config/region')
        const isKR = isKorea()
        
        if (isKR) {
          const { useAuthKR } = await import('@/shared/stores/useAuthKR')
          const store = useAuthKR.getState()
          store.setUser(null)
          store.setLoading(false)
          store.setAuthReady(true)
        } else {
          const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
          const store = useAuthWorld.getState()
          store.setUser(null)
          store.setLoading(false)
          store.setAuthReady(true)
        }
        logger.info('[LoginFlow] ✅ Zustand 스토어 초기화 완료')
      } catch (err) {
        logger.warn('[LoginFlow] ⚠️ Zustand 스토어 초기화 실패 (무시):', { error: String(err) })
      }
      
      // User 세션만 정리 (Seller/Admin 보호)
      const { clearAuthData } = await import('@/utils/auth')
      clearAuthData('user')
      
      // Zustand persist 추가 정리
      try {
        localStorage.removeItem('auth-kr-storage')
        localStorage.removeItem('auth-world-storage')
      } catch (e) {
        logger.warn('[LoginFlow] Zustand persist 정리 실패:', { error: String(e) })
      }
      
    } else if (userType === 'seller') {
      // 2️⃣ Seller 로그아웃 (Seller 세션만 정리, Firebase 영향 없음)
      const { clearAuthData } = await import('@/utils/auth')
      clearAuthData('seller')
      logger.info('[LoginFlow] ✅ Seller 세션 정리 완료 (Firebase 보호됨)')
      
    } else if (userType === 'admin') {
      // 3️⃣ Admin 로그아웃 (Admin 세션만 정리, Firebase 영향 없음)
      const { clearAuthData } = await import('@/utils/auth')
      clearAuthData('admin')
      logger.info('[LoginFlow] ✅ Admin 세션 정리 완료 (Firebase 보호됨)')
    }
    
    // sessionStorage 정리 (공통)
    try {
      sessionStorage.clear()
      logger.info('[LoginFlow] ✅ sessionStorage 정리 완료')
    } catch (e) {
      logger.warn('[LoginFlow] sessionStorage.clear() failed:', { error: String(e) })
    }
    
    logger.info(`[LoginFlow] ✅ ${userType} 로그아웃 완료 - 홈으로 이동`)
    
    // 강제 페이지 새로고침으로 모든 상태 초기화
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
    
  } catch (error) {
    logger.error(`[LoginFlow] ❌ ${userType} 로그아웃 실패:`, { error: String(error) })
    // 에러가 발생해도 강제 새로고침
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
    throw error
  }
}

// ============================================
// 5. 유틸리티 함수
// ============================================

/**
 * 현재 로그인 타입 확인
 */
export async function getLoginType(): Promise<'user' | 'seller' | 'admin' | null> {
  const userType = localStorage.getItem('user_type')
  
  if (userType === 'seller' && localStorage.getItem('seller_token')) {
    return 'seller'
  }
  
  if (userType === 'admin' && localStorage.getItem('admin_token')) {
    return 'admin'
  }
  
  // 현재 로그인 타입 확인 (Lazy load)
  const { getCurrentUser } = await import('@/lib/firebase-auth')
  const currentUser = await getCurrentUser()
  
  if (currentUser) {
    return 'user'
  }
  
  return null
}

/**
 * JWT 토큰 가져오기
 */
export function getJWTToken(type: 'seller' | 'admin'): string | null {
  const key = type === 'seller' ? 'seller_token' : 'admin_token'
  return localStorage.getItem(key)
}

