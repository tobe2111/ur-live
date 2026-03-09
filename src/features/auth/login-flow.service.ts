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

// ============================================
// 1. 일반 사용자 로그인 (Firebase) - Lazy Loaded
// ============================================

/**
 * 카카오 액세스 토큰으로 Firebase 로그인
 * 
 * ✅ 인증 상태 전파 대기 추가 - 타이밍 이슈 해결
 */
export async function loginWithKakaoToken(accessToken: string): Promise<void> {
  console.log('[LoginFlow] 🔑 카카오 토큰으로 Firebase 로그인 시작')
  
  try {
    // 1. 백엔드에서 Firebase Custom Token 받기
    const response = await fetch('/api/auth/kakao/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.firebaseToken && !data.customToken) {
      throw new Error('No Firebase token received from backend')
    }

    const customToken = data.firebaseToken || data.customToken

    // 2. Lazy load Firebase Auth
    console.log('[LoginFlow] 🔥 Lazy loading Firebase Auth...')
    const { signInWithCustomToken, onAuthStateChanged } = await import('@/lib/firebase-auth')
    
    // 3. Firebase Custom Token으로 로그인
    console.log('[LoginFlow] 🔥 Firebase Custom Token으로 로그인 중...')
    const credential = await signInWithCustomToken(customToken)
    
    console.log('[LoginFlow] ✅ Firebase 로그인 성공:', credential.user.uid)

    // ✅ 중요: onAuthStateChanged가 발화될 때까지 대기 (최대 2초)
    console.log('[LoginFlow] ⏳ Auth State 업데이트 대기 중...')
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe()
        console.warn('[LoginFlow] ⚠️ Auth State 대기 타임아웃 (2초)')
        resolve() // 타임아웃되어도 계속 진행
      }, 2000)

      const unsubscribe = onAuthStateChanged(async (user) => {
        if (user && user.uid === credential.user.uid) {
          clearTimeout(timeout)
          unsubscribe()
          console.log('[LoginFlow] ✅ Auth State 업데이트 완료:', user.uid)
          resolve()
        }
      })
    })

    // 4. 백그라운드에서 Token 갱신 (속도 최적화)
    credential.user.getIdToken(true)
      .then(() => console.log('[LoginFlow] 🔥 ID Token 강제 갱신 완료'))
      .catch((err) => console.warn('[LoginFlow] ⚠️ Token 갱신 실패 (무시):', err))

  } catch (error) {
    console.error('[LoginFlow] ❌ 카카오 로그인 실패:', error)
    throw error
  }
}

/**
 * Firebase Custom Token으로 직접 로그인 (URL에서 받은 경우)
 * 
 * ✅ 인증 상태 전파 대기 추가 - 타이밍 이슈 해결
 */
export async function loginWithFirebaseToken(firebaseToken: string): Promise<void> {
  console.log('[LoginFlow] 🔑 Firebase Custom Token으로 직접 로그인')
  
  try {
    // Lazy load Firebase Auth
    const { signInWithCustomToken, onAuthStateChanged } = await import('@/lib/firebase-auth')
    
    const credential = await signInWithCustomToken(firebaseToken)
    console.log('[LoginFlow] ✅ Firebase 로그인 성공:', credential.user.uid)

    // ✅ 중요: onAuthStateChanged가 발화될 때까지 대기 (최대 2초)
    console.log('[LoginFlow] ⏳ Auth State 업데이트 대기 중...')
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe()
        console.warn('[LoginFlow] ⚠️ Auth State 대기 타임아웃 (2초)')
        resolve() // 타임아웃되어도 계속 진행
      }, 2000)

      const unsubscribe = onAuthStateChanged(async (user) => {
        if (user && user.uid === credential.user.uid) {
          clearTimeout(timeout)
          unsubscribe()
          console.log('[LoginFlow] ✅ Auth State 업데이트 완료:', user.uid)
          resolve()
        }
      })
    })

    // 백그라운드 Token 갱신
    credential.user.getIdToken(true)
      .then(() => console.log('[LoginFlow] 🔥 ID Token 강제 갱신 완료'))
      .catch((err) => console.warn('[LoginFlow] ⚠️ Token 갱신 실패 (무시):', err))

  } catch (error) {
    console.error('[LoginFlow] ❌ Firebase Token 로그인 실패:', error)
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
  console.log('[LoginFlow] 🏪 셀러 로그인 시작:', email)
  
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
      console.log('[LoginFlow] ✅ 셀러 로그인 성공:', data.user.email)
    } else {
      throw new Error('No token received')
    }

    return data
  } catch (error: any) {
    console.error('[LoginFlow] ❌ 셀러 로그인 실패:', error)
    
    // 에러 메시지 정리
    const message = error.response?.data?.message || error.message || '로그인에 실패했습니다'
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
  console.log('[LoginFlow] 👔 어드민 로그인 시작:', email)
  
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
      console.log('[LoginFlow] ✅ 어드민 로그인 성공:', data.user.email)
    } else {
      throw new Error('No token received')
    }

    return data
  } catch (error: any) {
    console.error('[LoginFlow] ❌ 어드민 로그인 실패:', error)
    
    // 에러 메시지 정리
    const message = error.response?.data?.message || error.message || '로그인에 실패했습니다'
    throw new Error(message)
  }
}

// ============================================
// 4. 로그아웃 (통합)
// ============================================

/**
 * 통합 로그아웃 - 모든 인증 정보 제거
 */
export async function logout(): Promise<void> {
  console.log('[LoginFlow] 🚪 로그아웃 시작')
  
  try {
    // 1. Firebase 로그아웃
    try {
      const { signOut } = await import('@/lib/firebase-auth')
      await signOut()
      console.log('[LoginFlow] ✅ Firebase 로그아웃 완료')
    } catch (err) {
      console.warn('[LoginFlow] ⚠️ Firebase 로그아웃 실패 (무시):', err)
    }
    
    // 2. Zustand 스토어 초기화 (persist 포함)
    try {
      const { isKorea } = await import('@/shared/config/region')
      const isKR = isKorea()
      
      if (isKR) {
        const { useAuthKR } = await import('@/shared/stores/useAuthKR')
        const store = useAuthKR.getState()
        // 스토어 상태 초기화
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
      console.log('[LoginFlow] ✅ Zustand 스토어 초기화 완료')
    } catch (err) {
      console.warn('[LoginFlow] ⚠️ Zustand 스토어 초기화 실패 (무시):', err)
    }
    
    // 3. localStorage 완전 정리 (Zustand persist 포함)
    const keysToRemove = [
      'user_name',
      'loginReturnUrl',
      'seller_token',
      'admin_token',
      'user_type',
      'auth-kr-storage',  // Zustand persist key (KR)
      'auth-world-storage',  // Zustand persist key (WORLD)
      'kakao_token',
      'hasCartItems',
    ]
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.warn(`[LoginFlow] localStorage.removeItem("${key}") failed:`, e)
      }
    })
    
    console.log('[LoginFlow] ✅ localStorage 정리 완료')
    
    // 4. sessionStorage 정리
    try {
      sessionStorage.clear()
      console.log('[LoginFlow] ✅ sessionStorage 정리 완료')
    } catch (e) {
      console.warn('[LoginFlow] sessionStorage.clear() failed:', e)
    }
    
    console.log('[LoginFlow] ✅ 로그아웃 완료 - 홈으로 이동')
    
    // 5. 강제 페이지 새로고침으로 모든 상태 초기화
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
    
  } catch (error) {
    console.error('[LoginFlow] ❌ 로그아웃 실패:', error)
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

