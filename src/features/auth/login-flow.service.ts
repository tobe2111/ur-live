/**
 * 🔐 Login Flow Service
 *
 * 3가지 로그인 방식 (Firebase 100% 제거 — 2026-05-01):
 * 1. 일반 사용자 - 카카오 server-side OAuth (세션 쿠키)
 * 2. 셀러 - 이메일/비밀번호 + JWT
 * 3. 어드민 - 이메일/비밀번호 + JWT
 *
 * Updated: 2026-05-01 - Firebase 의존성 완전 제거 (loginWithKakaoToken / loginWithFirebaseToken 삭제)
 */

import api from '@/lib/api'
import { logger } from '@/utils/logger'

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

  // 🔑 2026-06-29 (로그아웃 근본수정): httpOnly 세션쿠키(ur_session 등)는 클라가 JS 로 못 지움 → 서버가
  //   삭제해야 진짜 로그아웃. 이 경로(UserProfilePage 등 실제 로그아웃 버튼)가 **이동 전에 await** 하도록 명시 호출
  //   (아래 clearAuthData 도 fire-and-forget 로 같은 삭제를 하지만, 여기서 await 해 네비게이션 전 쿠키 삭제를 보장).
  try {
    const { clearServerSessionCookies } = await import('@/utils/auth')
    await clearServerSessionCookies(userType)
  } catch { /* best-effort — 로컬 정리는 계속 진행 */ }

  logger.info(`[LoginFlow] 🚪 ${userType} 로그아웃 시작`)
  
  try {
    // ✅ userType에 따라 선택적 로그아웃
    if (userType === 'user') {
      // 1️⃣ User 로그아웃 (세션 쿠키 + User 세션만 정리)
      // 🛡️ 2026-05-01: Firebase 100% 제거 — signOut 호출 안 함.
      //   서버 사이드 카카오 로그아웃은 cookie 만료/clear 로 처리.

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
      // 2️⃣ Seller 로그아웃 (Seller 세션만 정리)
      const { clearAuthData } = await import('@/utils/auth')
      clearAuthData('seller')
      logger.info('[LoginFlow] ✅ Seller 세션 정리 완료')

    } else if (userType === 'admin') {
      // 3️⃣ Admin 로그아웃 (Admin 세션만 정리)
      const { clearAuthData } = await import('@/utils/auth')
      clearAuthData('admin')
      logger.info('[LoginFlow] ✅ Admin 세션 정리 완료')
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

/**
 * 🔑 2026-07-07 (대표 승인 "전부 로그아웃"): 마이페이지 로그아웃 = 소비자+셀러+어드민+에이전시
 *   세션 전부 종료(단일 역할이든 다중역할이든 완전 로그아웃).
 *
 *   배경: 다중역할 계정(어드민/셀러 + 소비자)에서 `logout('user')` 로 소비자만 지우면
 *   대시보드 Bearer 토큰(seller_token/admin_token/agency_token)이 남아 `isLoggedInSync()`
 *   가 true → 홈이 여전히 "로그인됨"으로 보임 → 대표 신고 "로그아웃이 안 됨". 이중 로그인
 *   편의를 포기하고 명시적 로그아웃은 전 역할을 종료하도록 대표가 확정.
 *
 *   서버 httpOnly 세션쿠키(ur_*) 전체 삭제를 **await**(네비게이션 전 완료 → 재인증 레이스 0)
 *   후, 각 역할 localStorage(clearAuthData) + 에이전시/파생 신호 + 인메모리 스토어를 정리한다.
 */
export async function logoutAll(): Promise<void> {
  // 1️⃣ 모든 역할 서버 세션쿠키(ur_session/ur_seller_session/ur_admin_session/ur_agency_session)
  //    + ud_* SSR 토큰 삭제. 무인자 = 전체(worker /api/auth/logout-cookies 의 else 분기).
  try {
    const { clearServerSessionCookies } = await import('@/utils/auth')
    await clearServerSessionCookies()
  } catch { /* best-effort — 로컬 정리는 계속 진행 */ }

  // 2️⃣ 인메모리 인증 스토어 초기화 (하드 리로드가 최종 보증이나 방어적으로 선정리).
  try {
    const isKR = (await import('@/shared/config/region')).isKorea()
    if (isKR) {
      const { useAuthKR } = await import('@/shared/stores/useAuthKR')
      const s = useAuthKR.getState(); s.setUser(null); s.setLoading(false); s.setAuthReady(true)
    } else {
      const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
      const s = useAuthWorld.getState(); s.setUser(null); s.setLoading(false); s.setAuthReady(true)
    }
  } catch (err) {
    logger.warn('[LoginFlow] logoutAll 스토어 초기화 실패(무시):', { error: String(err) })
  }

  // 3️⃣ 역할별 localStorage 정리 (clearAuthData 가 zustand persist·useAuthStore 도 함께 정리).
  try {
    const { clearAuthData } = await import('@/utils/auth')
    clearAuthData('user'); clearAuthData('seller'); clearAuthData('admin')
    // 에이전시 키(clearAuthData 미지원) + user_type + 링크샵/도매 파생 신호까지 확실히 제거 →
    //   isLoggedInSync() 가 검사하는 모든 토큰/신호를 남김없이 삭제(잔여 로그인 0).
    ;['agency_token', 'agency_refresh_token', 'agency_id', 'agency_name', 'agency_email',
      'user_type', 'seller_username', 'user_handle', 'linked_seller_username', 'is_distributor']
      .forEach(k => { try { localStorage.removeItem(k) } catch { /* quota */ } })
  } catch (err) {
    logger.warn('[LoginFlow] logoutAll localStorage 정리 실패(무시):', { error: String(err) })
  }

  // 4️⃣ sessionStorage 정리 후 홈으로 하드 리로드(모든 상태 초기화).
  try { sessionStorage.clear() } catch { /* 무시 */ }
  logger.info('[LoginFlow] ✅ 전체 로그아웃 완료 — 홈으로 이동')
  setTimeout(() => { window.location.href = '/' }, 50)
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

  // 🛡️ 2026-05-01: Firebase 100% 제거 — Firebase getCurrentUser 호출 안 함.
  //   user_type 만으로 판단 (세션 쿠키는 서버에서 검증).
  if (userType === 'user') {
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

