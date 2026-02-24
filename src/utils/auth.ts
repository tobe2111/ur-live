/**
 * JWT Authentication utility functions
 * 모든 페이지에서 일관된 JWT 기반 로그인/로그아웃 처리
 * 
 * localStorage 키 표준화 (JWT 전환 후):
 * - access_token: JWT 액세스 토큰 (15분)
 * - refresh_token: JWT 리프레시 토큰 (30일)
 * - user_id: 사용자 ID
 * - user_name: 사용자 이름
 * - user_email: 사용자 이메일
 * - user_profile_image: 프로필 이미지
 * - user_type: 사용자 타입 (user/seller/admin)
 */

import { NavigateFunction } from 'react-router-dom'

// JWT 표준 localStorage 키
const JWT_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  USER_EMAIL: 'user_email',
  USER_TYPE: 'user_type',
  USER_PROFILE_IMAGE: 'user_profile_image',
  LOGIN_RETURN_URL: 'loginReturnUrl',
  TEMP_CART_ITEM: 'tempCartItem',
  HAS_CART_ITEMS: 'hasCartItems',
} as const

// 레거시 세션 키 (읽기 전용, 마이그레이션 호환)
const LEGACY_SESSION_KEYS = {
  SESSION_OLD: 'session',
  SESSION_TOKEN: 'user_session_token',
  SESSION_TOKEN_ALT: 'sessionToken',
  ADMIN_SESSION: 'admin_session_token',
  SELLER_SESSION: 'seller_session_token',
  USER_ID_ALT: 'userId',
  USER_NAME_ALT: 'userName',
  USER_EMAIL_ALT: 'userEmail',
}

/**
 * JWT 액세스 토큰 가져오기
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * JWT 리프레시 토큰 가져오기
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.REFRESH_TOKEN)
}

/**
 * 로그인 상태 확인 (JWT 기반)
 */
export function isLoggedIn(): boolean {
  const accessToken = getAccessToken()
  const userId = getUserId()
  const userType = getUserType()
  
  return !!(accessToken && userId && userType)
}

/**
 * 사용자 타입 가져오기
 */
export function getUserType(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.USER_TYPE)
}

/**
 * 사용자 ID 가져오기 (레거시 키 호환)
 */
export function getUserId(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.USER_ID) || 
         localStorage.getItem(LEGACY_SESSION_KEYS.USER_ID_ALT)
}

/**
 * 사용자 이름 가져오기 (레거시 키 호환)
 */
export function getUserName(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.USER_NAME) || 
         localStorage.getItem(LEGACY_SESSION_KEYS.USER_NAME_ALT)
}

/**
 * 사용자 이메일 가져오기 (레거시 키 호환)
 */
export function getUserEmail(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.USER_EMAIL) || 
         localStorage.getItem(LEGACY_SESSION_KEYS.USER_EMAIL_ALT)
}

/**
 * 사용자 프로필 이미지 가져오기
 */
export function getUserProfileImage(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEYS.USER_PROFILE_IMAGE)
}

/**
 * 로그인 필요 시 로그인 페이지로 이동
 * 현재 페이지를 returnUrl로 저장하여 로그인 후 돌아올 수 있게 함
 * 
 * @param navigate - React Router의 navigate 함수
 * @param message - 사용자에게 표시할 메시지 (선택사항)
 */
export function requireLogin(navigate: NavigateFunction, message: string = '로그인이 필요합니다.'): void {
  // Save current URL as return destination
  const currentPath = window.location.pathname + window.location.search
  localStorage.setItem(JWT_STORAGE_KEYS.LOGIN_RETURN_URL, currentPath)
  
  // Show alert if message provided
  if (message) {
    alert(message)
  }
  
  // Navigate to login with returnUrl
  navigate('/login?returnUrl=' + encodeURIComponent(currentPath))
}

/**
 * 장바구니 아이템을 임시로 저장 (로그인 전)
 * 
 * @param productId - 상품 ID
 * @param quantity - 수량
 * @param priceSnapshot - 가격 스냅샷
 * @param liveStreamId - 라이브 스트림 ID (선택사항)
 * @param productName - 상품명 (선택사항)
 */
export function saveTempCartItem(
  productId: number,
  quantity: number,
  priceSnapshot: number,
  liveStreamId?: string,
  productName?: string
): void {
  const tempCart = {
    productId,
    quantity,
    priceSnapshot,
    liveStreamId,
    productName,
    timestamp: Date.now()
  }
  localStorage.setItem(JWT_STORAGE_KEYS.TEMP_CART_ITEM, JSON.stringify(tempCart))
}

/**
 * 임시 장바구니 아이템 가져오기
 */
export function getTempCartItem(): any | null {
  const tempCartItem = localStorage.getItem(JWT_STORAGE_KEYS.TEMP_CART_ITEM)
  if (!tempCartItem) return null
  
  try {
    return JSON.parse(tempCartItem)
  } catch (error) {
    console.error('Failed to parse temp cart item:', error)
    localStorage.removeItem(JWT_STORAGE_KEYS.TEMP_CART_ITEM)
    return null
  }
}

/**
 * 임시 장바구니 아이템 삭제
 */
export function clearTempCartItem(): void {
  localStorage.removeItem(JWT_STORAGE_KEYS.TEMP_CART_ITEM)
}

/**
 * 로그아웃 (JWT + 레거시 세션 키 모두 삭제)
 */
export function logout(): void {
  // JWT 키 제거
  Object.values(JWT_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  // 레거시 세션 키 제거
  Object.values(LEGACY_SESSION_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  console.log('[Auth JWT] 🚪 로그아웃 완료 (JWT + 레거시 키 모두 삭제)')
}

/**
 * JWT 토큰 저장 (로그인 성공 후)
 * 
 * @param accessToken - JWT 액세스 토큰
 * @param refreshToken - JWT 리프레시 토큰
 * @param userId - 사용자 ID
 * @param userName - 사용자 이름
 * @param userType - 사용자 타입 (user/seller/admin)
 * @param userEmail - 사용자 이메일 (선택사항)
 * @param profileImage - 프로필 이미지 URL (선택사항)
 */
export function saveJwtTokens(
  accessToken: string,
  refreshToken: string,
  userId: string | number,
  userName: string,
  userType: 'user' | 'seller' | 'admin',
  userEmail?: string | null,
  profileImage?: string | null
): void {
  // JWT 토큰 저장
  localStorage.setItem(JWT_STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  localStorage.setItem(JWT_STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
  
  // 사용자 정보 저장
  localStorage.setItem(JWT_STORAGE_KEYS.USER_ID, userId.toString())
  localStorage.setItem(JWT_STORAGE_KEYS.USER_NAME, userName)
  localStorage.setItem(JWT_STORAGE_KEYS.USER_TYPE, userType)
  
  if (userEmail) {
    localStorage.setItem(JWT_STORAGE_KEYS.USER_EMAIL, userEmail)
  } else {
    localStorage.removeItem(JWT_STORAGE_KEYS.USER_EMAIL)
  }
  
  if (profileImage) {
    localStorage.setItem(JWT_STORAGE_KEYS.USER_PROFILE_IMAGE, profileImage)
  } else {
    localStorage.removeItem(JWT_STORAGE_KEYS.USER_PROFILE_IMAGE)
  }
  
  // 레거시 세션 키 제거
  Object.values(LEGACY_SESSION_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  console.log('[Auth JWT] ✅ JWT 토큰 및 사용자 정보 저장 완료:', {
    userId: userId.toString(),
    userName,
    userType,
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken
  })
}

/**
 * 레거시 호환: saveUserInfo (JWT 전환 후 deprecated, saveJwtTokens 사용 권장)
 * 
 * @deprecated JWT 전환 후 이 함수는 saveJwtTokens로 대체됩니다.
 */
export function saveUserInfo(
  userId: string | number,
  userName: string,
  sessionToken: string,
  userEmail?: string | null,
  profileImage?: string | null
): void {
  console.warn('[Auth] ⚠️ saveUserInfo는 deprecated입니다. saveJwtTokens를 사용하세요.')
  
  // 임시 호환 처리: sessionToken을 accessToken으로 저장
  localStorage.setItem(JWT_STORAGE_KEYS.ACCESS_TOKEN, sessionToken)
  localStorage.setItem(JWT_STORAGE_KEYS.USER_ID, userId.toString())
  localStorage.setItem(JWT_STORAGE_KEYS.USER_NAME, userName)
  localStorage.setItem(JWT_STORAGE_KEYS.USER_TYPE, 'user')
  
  if (userEmail) {
    localStorage.setItem(JWT_STORAGE_KEYS.USER_EMAIL, userEmail)
  }
  
  if (profileImage) {
    localStorage.setItem(JWT_STORAGE_KEYS.USER_PROFILE_IMAGE, profileImage)
  }
}

/**
 * 레거시 호환: getSessionToken (JWT 전환 후 deprecated, getAccessToken 사용 권장)
 * 
 * @deprecated JWT 전환 후 이 함수는 getAccessToken으로 대체됩니다.
 */
export function getSessionToken(): string | null {
  console.warn('[Auth] ⚠️ getSessionToken는 deprecated입니다. getAccessToken을 사용하세요.')
  return getAccessToken() || 
         localStorage.getItem(LEGACY_SESSION_KEYS.SESSION_TOKEN) ||
         localStorage.getItem(LEGACY_SESSION_KEYS.SESSION_OLD)
}
