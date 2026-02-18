/**
 * Authentication utility functions
 * 모든 페이지에서 일관된 로그인/로그아웃 처리
 * 
 * localStorage 키 표준화:
 * - user_session_token: 세션 토큰 (API 클라이언트와 동일)
 * - user_id: 사용자 ID
 * - user_name: 사용자 이름
 * - user_email: 사용자 이메일
 * - user_profile_image: 프로필 이미지
 * - user_type: 사용자 타입 (user/seller/admin)
 */

import { NavigateFunction } from 'react-router-dom'

// 표준 localStorage 키 (API 클라이언트와 완전 동일)
const STORAGE_KEYS = {
  SESSION: 'user_session_token',  // ✅ API 클라이언트와 동일
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  USER_EMAIL: 'user_email',
  USER_TYPE: 'user_type',  // ✅ 추가
  USER_PROFILE_IMAGE: 'user_profile_image',
  LOGIN_RETURN_URL: 'loginReturnUrl',
  TEMP_CART_ITEM: 'tempCartItem',
  HAS_CART_ITEMS: 'hasCartItems',
} as const

// 레거시 키 (읽기 전용, 호환성 유지)
const LEGACY_KEYS = {
  SESSION_OLD: 'session',  // ✅ 이전 키
  ACCESS_TOKEN: 'access_token',
  ACCESS_TOKEN_ALT: 'accessToken',
  USER_ID_ALT: 'userId',
  USER_NAME_ALT: 'userName',
  USER_EMAIL_ALT: 'userEmail',
}

/**
 * 세션 토큰 가져오기 (레거시 키 호환)
 */
export function getSessionToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SESSION) || 
         localStorage.getItem(LEGACY_KEYS.SESSION_OLD)
}

/**
 * 로그인 상태 확인
 */
export function isLoggedIn(): boolean {
  const session = getSessionToken()
  const userId = getUserId()
  
  return !!(session && userId)
}

/**
 * 사용자 ID 가져오기 (레거시 키 호환)
 */
export function getUserId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_ID) || 
         localStorage.getItem(LEGACY_KEYS.USER_ID_ALT)
}

/**
 * 사용자 이름 가져오기 (레거시 키 호환)
 */
export function getUserName(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_NAME) || 
         localStorage.getItem(LEGACY_KEYS.USER_NAME_ALT)
}

/**
 * 사용자 이메일 가져오기 (레거시 키 호환)
 */
export function getUserEmail(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_EMAIL) || 
         localStorage.getItem(LEGACY_KEYS.USER_EMAIL_ALT)
}

/**
 * 사용자 프로필 이미지 가져오기
 */
export function getUserProfileImage(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_PROFILE_IMAGE)
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
  localStorage.setItem(STORAGE_KEYS.LOGIN_RETURN_URL, currentPath)
  
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
  localStorage.setItem(STORAGE_KEYS.TEMP_CART_ITEM, JSON.stringify(tempCart))
}

/**
 * 임시 장바구니 아이템 가져오기
 */
export function getTempCartItem(): any | null {
  const tempCartItem = localStorage.getItem(STORAGE_KEYS.TEMP_CART_ITEM)
  if (!tempCartItem) return null
  
  try {
    return JSON.parse(tempCartItem)
  } catch (error) {
    console.error('Failed to parse temp cart item:', error)
    localStorage.removeItem(STORAGE_KEYS.TEMP_CART_ITEM)
    return null
  }
}

/**
 * 임시 장바구니 아이템 삭제
 */
export function clearTempCartItem(): void {
  localStorage.removeItem(STORAGE_KEYS.TEMP_CART_ITEM)
}

/**
 * 로그아웃
 * 모든 인증 관련 localStorage 데이터 삭제 (표준 키 + 레거시 키)
 */
export function logout(): void {
  // 표준 키 제거
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  // 레거시 키 제거
  Object.values(LEGACY_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

/**
 * 사용자 정보 저장 (로그인 성공 후)
 * 
 * API 클라이언트와 동일한 키로 저장합니다.
 * 
 * @param userId - 사용자 ID
 * @param userName - 사용자 이름
 * @param sessionToken - 세션 토큰
 * @param userEmail - 사용자 이메일 (선택사항, null이면 저장 안 함)
 * @param profileImage - 프로필 이미지 URL (선택사항)
 */
export function saveUserInfo(
  userId: string | number,
  userName: string,
  sessionToken: string,
  userEmail?: string | null,
  profileImage?: string | null
): void {
  // ✅ API 클라이언트와 동일한 키로 저장
  localStorage.setItem(STORAGE_KEYS.USER_ID, userId.toString())
  localStorage.setItem(STORAGE_KEYS.USER_NAME, userName)
  localStorage.setItem(STORAGE_KEYS.SESSION, sessionToken)  // user_session_token
  localStorage.setItem(STORAGE_KEYS.USER_TYPE, 'user')  // ✅ 사용자 타입 추가
  
  if (userEmail) {
    localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userEmail)
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER_EMAIL)
  }
  
  if (profileImage) {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE_IMAGE, profileImage)
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_IMAGE)
  }
  
  // ✅ 레거시 키 제거
  localStorage.removeItem(LEGACY_KEYS.SESSION_OLD)
  localStorage.removeItem(LEGACY_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(LEGACY_KEYS.ACCESS_TOKEN_ALT)
  localStorage.removeItem(LEGACY_KEYS.USER_ID_ALT)
  localStorage.removeItem(LEGACY_KEYS.USER_NAME_ALT)
  localStorage.removeItem(LEGACY_KEYS.USER_EMAIL_ALT)
  
  console.log('[Auth] ✅ 사용자 정보 저장 완료:', {
    userId: userId.toString(),
    userName,
    hasSession: !!sessionToken,
    userType: 'user'
  })
}
