/**
 * Firebase Authentication utility functions
 * 모든 페이지에서 일관된 Firebase 기반 로그인/로그아웃 처리
 * 
 * localStorage 키 표준화 (Firebase 전환 후):
 * - firebase_token: Firebase ID Token (1시간, 자동 갱신)
 * - user_id: 사용자 ID
 * - user_name: 사용자 이름
 * - user_email: 사용자 이메일
 * - user_profile_image: 프로필 이미지
 * - user_type: 사용자 타입 (user/seller/admin)
 */

import { NavigateFunction } from 'react-router-dom'
import { getFirebaseAuth } from '@/lib/firebase-auth'

// Firebase 표준 localStorage 키
const FIREBASE_STORAGE_KEYS = {
  FIREBASE_TOKEN: 'firebase_token',
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  USER_EMAIL: 'user_email',
  USER_TYPE: 'user_type',
  USER_PROFILE_IMAGE: 'user_profile_image',
  LOGIN_RETURN_URL: 'loginReturnUrl',
  TEMP_CART_ITEM: 'tempCartItem',
  HAS_CART_ITEMS: 'hasCartItems',
} as const

// 레거시 JWT/세션 키 (마이그레이션 호환, 삭제용)
const LEGACY_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
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
 * Firebase ID Token 가져오기
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN)
}

/**
 * @deprecated JWT refresh token은 더 이상 사용하지 않습니다 (Firebase 자동 갱신)
 */
export function getRefreshToken(): string | null {
  console.warn('[Auth] ⚠️ getRefreshToken는 deprecated입니다. Firebase는 자동으로 토큰을 갱신합니다.')
  return null
}

/**
 * 로그인 상태 확인 (Firebase + JWT 통합)
 * 
 * ✅ Multi-auth Support:
 * 1. JWT sellers/admins: check seller_token or admin_token in localStorage
 * 2. Firebase buyers: check Firebase auth.currentUser
 * 
 * Priority: JWT tokens first (seller/admin), then Firebase (buyers)
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    // 1️⃣ Check JWT tokens first (seller/admin)
    const userType = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
    
    if (userType === 'seller') {
      const sellerToken = localStorage.getItem('seller_token')
      if (sellerToken) {
        console.log('[Auth] isLoggedIn: seller JWT found ✅')
        return true
      }
    }
    
    if (userType === 'admin') {
      const adminToken = localStorage.getItem('admin_token')
      if (adminToken) {
        console.log('[Auth] isLoggedIn: admin JWT found ✅')
        return true
      }
    }
    
    // 2️⃣ Check Firebase Auth (buyers with Kakao/Email login)
    const auth = await getFirebaseAuth()
    if (auth.currentUser) {
      console.log('[Auth] isLoggedIn: Firebase user found ✅')
      return true
    }
    
    console.log('[Auth] isLoggedIn: no authentication found ❌')
    return false
  } catch (error) {
    console.error('[Auth] isLoggedIn 체크 실패:', error)
    return false
  }
}

/**
 * 사용자 타입 가져오기
 */
export function getUserType(): string | null {
  return localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
}

/**
 * 사용자 ID 가져오기 (JWT + Firebase Custom Claims 통합)
 * ✅ Multi-auth Support: JWT sellers/admins first, then Firebase buyers
 */
export async function getUserId(): Promise<string | null> {
  // 1️⃣ Check localStorage first (JWT sellers/admins store user_id here)
  const userId = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_ID) || 
                 localStorage.getItem(LEGACY_KEYS.USER_ID_ALT)
  if (userId) {
    return userId
  }
  
  // 2️⃣ Firebase Custom Claims (buyers with Kakao/Email login)
  try {
    const auth = await getFirebaseAuth()
    const user = auth.currentUser
    if (user) {
      // @ts-ignore - Firebase custom claims
      const claims = user.reloadUserInfo?.customAttributes
      if (claims) {
        const parsed = JSON.parse(claims)
        if (parsed.userId) {
          return parsed.userId.toString()
        }
      }
    }
  } catch (error) {
    console.warn('[Auth] getUserId - Firebase claims 조회 실패:', error)
  }
  
  return null
}

/**
 * 사용자 이름 가져오기 (Firebase Custom Claims 우선)
 * 
 * 우선순위:
 * 1. Firebase Custom Claims (Kakao 로그인 시 userName 포함)
 * 2. Firebase displayName
 * 3. localStorage (레거시)
 */
export async function getUserName(): Promise<string | null> {
  try {
    // 1️⃣ Firebase Custom Claims 체크 (Kakao 로그인 시 userName 포함)
    const auth = await getFirebaseAuth()
    const user = auth.currentUser
    
    if (user) {
      // Force token refresh to get latest claims
      const idTokenResult = await user.getIdTokenResult()
      const claims = idTokenResult.claims
      
      // Custom Claims에서 userName 추출
      if (claims.userName && typeof claims.userName === 'string') {
        console.log('[Auth] getUserName: Firebase Custom Claims userName found:', claims.userName)
        return claims.userName
      }
      
      // 2️⃣ Firebase displayName (Google 로그인 등)
      if (user.displayName) {
        console.log('[Auth] getUserName: Firebase displayName found:', user.displayName)
        return user.displayName
      }
    }
  } catch (error) {
    console.warn('[Auth] getUserName - Firebase 조회 실패:', error)
  }
  
  // 3️⃣ localStorage 폴백 (레거시, JWT sellers/admins)
  const localName = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_NAME) || 
                    localStorage.getItem(LEGACY_KEYS.USER_NAME_ALT)
  
  if (localName) {
    console.log('[Auth] getUserName: localStorage found:', localName)
    return localName
  }
  
  console.log('[Auth] getUserName: no name found')
  return null
}

/**
 * 사용자 이메일 가져오기 (레거시 키 호환)
 */
export function getUserEmail(): string | null {
  return localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_EMAIL) || 
         localStorage.getItem(LEGACY_KEYS.USER_EMAIL_ALT)
}

/**
 * 사용자 프로필 이미지 가져오기
 */
export function getUserProfileImage(): string | null {
  return localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_PROFILE_IMAGE)
}

/**
 * 로그인 필요 시 로그인 페이지로 이동
 * 현재 페이지를 returnUrl로 저장하여 로그인 후 돌아올 수 있게 함
 * 
 * ⚠️ Alert 중복 방지: 같은 세션에서 한 번만 표시
 * 
 * @param navigate - React Router의 navigate 함수
 * @param message - 사용자에게 표시할 메시지 (선택사항)
 * @param force - 강제로 alert 표시 (기본값: false)
 */
export function requireLogin(navigate: NavigateFunction, message: string = '로그인이 필요합니다.', force: boolean = false): void {
  // Save current URL as return destination
  const currentPath = window.location.pathname + window.location.search
  localStorage.setItem(FIREBASE_STORAGE_KEYS.LOGIN_RETURN_URL, currentPath)
  
  // Show alert ONCE per session to prevent repetitive popups
  const alertShownKey = 'login_alert_shown_' + currentPath
  const alertShown = sessionStorage.getItem(alertShownKey)
  
  if (message && (force || !alertShown)) {
    alert(message)
    sessionStorage.setItem(alertShownKey, 'true')
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
  localStorage.setItem(FIREBASE_STORAGE_KEYS.TEMP_CART_ITEM, JSON.stringify(tempCart))
}

/**
 * 임시 장바구니 아이템 가져오기
 */
export function getTempCartItem(): any | null {
  const tempCartItem = localStorage.getItem(FIREBASE_STORAGE_KEYS.TEMP_CART_ITEM)
  if (!tempCartItem) return null
  
  try {
    return JSON.parse(tempCartItem)
  } catch (error) {
    console.error('Failed to parse temp cart item:', error)
    localStorage.removeItem(FIREBASE_STORAGE_KEYS.TEMP_CART_ITEM)
    return null
  }
}

/**
 * 임시 장바구니 아이템 삭제
 */
export function clearTempCartItem(): void {
  localStorage.removeItem(FIREBASE_STORAGE_KEYS.TEMP_CART_ITEM)
}

/**
 * 로그아웃 (Firebase + 레거시 JWT 키 모두 삭제)
 */
export async function logout(): Promise<void> {
  // Firebase 키 제거
  Object.values(FIREBASE_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  // 레거시 JWT/세션 키 제거
  Object.values(LEGACY_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  // Sentry 사용자 컨텍스트 제거
  try {
    const { clearSentryUser } = require('@/lib/sentry')
    clearSentryUser()
  } catch (e) {
    // Sentry 초기화 실패 시 무시
  }
  
  // Firebase 로그아웃
  try {
    const auth = await getFirebaseAuth()
    auth.signOut()
  } catch (e) {
    console.error('[Auth] Firebase signOut 실패:', e)
  }
  
  console.log('[Auth] 🚪 로그아웃 완료 (Firebase + 레거시 키 모두 삭제)')
}

/**
 * Firebase 토큰 저장 (로그인 성공 후)
 * 
 * @param firebaseToken - Firebase ID Token
 * @param userId - 사용자 ID
 * @param userName - 사용자 이름
 * @param userType - 사용자 타입 (user/seller/admin)
 * @param userEmail - 사용자 이메일 (선택사항)
 * @param profileImage - 프로필 이미지 URL (선택사항)
 */
export function saveFirebaseTokens(
  firebaseToken: string,
  userId: string | number,
  userName: string,
  userType: 'user' | 'seller' | 'admin',
  userEmail?: string | null,
  profileImage?: string | null
): void {
  // Firebase 토큰 저장
  localStorage.setItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN, firebaseToken)
  
  // 사용자 정보 저장
  localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_ID, userId.toString())
  localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_NAME, userName)
  localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_TYPE, userType)
  
  if (userEmail) {
    localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_EMAIL, userEmail)
  } else {
    localStorage.removeItem(FIREBASE_STORAGE_KEYS.USER_EMAIL)
  }
  
  if (profileImage) {
    localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_PROFILE_IMAGE, profileImage)
  } else {
    localStorage.removeItem(FIREBASE_STORAGE_KEYS.USER_PROFILE_IMAGE)
  }
  
  // 레거시 JWT 키 제거
  Object.values(LEGACY_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
  
  console.log('[Auth Firebase] ✅ Firebase 토큰 및 사용자 정보 저장 완료:', {
    userId: userId.toString(),
    userName,
    userType,
    hasFirebaseToken: !!firebaseToken
  })
}

/**
 * 레거시 호환: saveJwtTokens (Firebase 전환 후 deprecated, saveFirebaseTokens 사용 권장)
 * 
 * @deprecated Firebase 전환 후 이 함수는 saveFirebaseTokens로 대체됩니다.
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
  console.warn('[Auth] ⚠️ saveJwtTokens는 deprecated입니다. saveFirebaseTokens를 사용하세요.')
  
  // 임시 호환 처리: accessToken을 firebase_token으로 저장
  saveFirebaseTokens(accessToken, userId, userName, userType, userEmail, profileImage)
}

/**
 * 레거시 호환: saveUserInfo (Firebase 전환 후 deprecated, saveFirebaseTokens 사용 권장)
 * 
 * @deprecated Firebase 전환 후 이 함수는 saveFirebaseTokens로 대체됩니다.
 */
export function saveUserInfo(
  userId: string | number,
  userName: string,
  sessionToken: string,
  userEmail?: string | null,
  profileImage?: string | null
): void {
  console.warn('[Auth] ⚠️ saveUserInfo는 deprecated입니다. saveFirebaseTokens를 사용하세요.')
  
  // 임시 호환 처리: sessionToken을 firebase_token으로 저장
  localStorage.setItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN, sessionToken)
  localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_ID, userId.toString())
  localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_NAME, userName)
  localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_TYPE, 'user')
  
  if (userEmail) {
    localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_EMAIL, userEmail)
  }
  
  if (profileImage) {
    localStorage.setItem(FIREBASE_STORAGE_KEYS.USER_PROFILE_IMAGE, profileImage)
  }
}

/**
 * 레거시 호환: getSessionToken (Firebase 전환 후 deprecated, getAccessToken 사용 권장)
 * 
 * @deprecated Firebase 전환 후 이 함수는 getAccessToken으로 대체됩니다.
 */
export function getSessionToken(): string | null {
  console.warn('[Auth] ⚠️ getSessionToken는 deprecated입니다. getAccessToken을 사용하세요.')
  return getAccessToken() || 
         localStorage.getItem(LEGACY_KEYS.ACCESS_TOKEN) ||
         localStorage.getItem(LEGACY_KEYS.SESSION_TOKEN) ||
         localStorage.getItem(LEGACY_KEYS.SESSION_OLD)
}
