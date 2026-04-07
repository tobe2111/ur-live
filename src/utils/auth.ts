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
 * 선택적 localStorage 키 삭제
 * localStorage.clear() 대신 사용하여 다른 세션 보호
 * 
 * @param type - 삭제할 세션 타입 ('seller' | 'admin' | 'user')
 */
export function clearAuthData(type: 'seller' | 'admin' | 'user') {
  const keysToRemove: string[] = []
  
  if (type === 'seller') {
    // Seller 전용 키만 삭제 (user_type 제거하지 않음 — 다른 세션 보호)
    keysToRemove.push(
      'seller_token',
      'seller_refresh_token',
      'seller_id',
      'seller_name',
      'seller_email',
      'access_token',  // 레거시 호환
      'refresh_token'  // 레거시 호환
    )
  } else if (type === 'admin') {
    // Admin 전용 키만 삭제 (user_type 제거하지 않음 — 다른 세션 보호)
    keysToRemove.push(
      'admin_token',
      'admin_refresh_token',
      'admin_id',
      'admin_name',
      'admin_email',
      'access_token',  // 레거시 호환
      'refresh_token'  // 레거시 호환
    )
  } else {
    // User 전용 키 (user_type은 seller/admin 세션이 없을 때만 삭제)
    keysToRemove.push(
      'firebase_token',
      'user_id',
      'user_name',
      'user_email',
      'user_profile_image',
      'user_session_token',  // 레거시 세션 토큰
      'hasCartItems',
      'tempCartItem',
      'loginReturnUrl',
      'lastLoginUid'
    )
    // seller/admin 세션이 남아있으면 user_type 유지
    const hasSellerSession = !!localStorage.getItem('seller_token')
    const hasAdminSession = !!localStorage.getItem('admin_token')
    if (!hasSellerSession && !hasAdminSession) {
      keysToRemove.push('user_type')
    }
  }
  
  // 선택적 삭제
  keysToRemove.forEach(key => {
    localStorage.removeItem(key)
  })
  
  // ✅ 보호된 키 (삭제하지 않음)
  // User 세션: firebase_token, user_id, user_name, hasCartItems (seller/admin 삭제 시)
  // Seller 세션: seller_token, seller_id, seller_name (user/admin 삭제 시)
  // Admin 세션: admin_token, admin_id, admin_name (user/seller 삭제 시)
}

/**
 * Firebase ID Token 가져오기
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN)
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
        return true
      }
    }
    
    if (userType === 'admin') {
      const adminToken = localStorage.getItem('admin_token')
      if (adminToken) {
        return true
      }
    }
    
    // 2️⃣ Check Firebase Auth (buyers with Kakao/Email login)
    const auth = await getFirebaseAuth()
    if (auth.currentUser) {
      return true
    }

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
 * 
 * ⚠️ user_type이 'user'인 경우에만 localStorage user_id를 읽음
 * Seller는 seller_id, Admin은 admin_id를 사용해야 함
 */
/**
 * Synchronous version - reads from localStorage only (no Firebase fallback)
 */
export function getUserIdSync(): string | null {
  return localStorage.getItem('user_id') || localStorage.getItem('userId') || null
}

/**
 * Synchronous version of getUserName - reads from localStorage only
 *
 * ⚠️ Firebase 전용 세션 대응:
 * Firebase 로그인 후 user_name이 저장되어 있어야 함
 * Seller/Admin의 경우 해당 role의 이름 반환
 */
export function getUserNameSync(): string | null {
  const userType = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
  // Seller/Admin은 별도 이름 키를 사용할 수 있음
  if (userType === 'seller') {
    return localStorage.getItem('seller_name') || localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_NAME) || null
  }
  if (userType === 'admin') {
    return localStorage.getItem('admin_name') || localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_NAME) || null
  }
  // User (Firebase): user_name 또는 user_email의 앞부분 반환
  const name = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_NAME)
  if (name) return name
  const email = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_EMAIL)
  if (email) return email.split('@')[0]
  return null
}

/**
 * Synchronous version of isLoggedIn - reads from localStorage only
 *
 * ⚠️ Firebase 전용 세션 대응:
 * Firebase는 자체적으로 IndexedDB/localStorage에 토큰을 관리하므로
 * 'firebase_token' 키가 없어도 'user_id' + 'user_type=user' 조합으로 로그인 상태 판단
 */
export function isLoggedInSync(): boolean {
  // Seller/Admin은 JWT 토큰으로 명확히 판단
  if (localStorage.getItem('seller_token')) return true
  if (localStorage.getItem('admin_token')) return true

  // Firebase User: user_id가 있고 user_type이 'user' (또는 미설정)이면 로그인 상태로 간주
  const userType = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
  const userId = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_ID)
  if (userId && (userType === 'user' || !userType)) return true

  // 레거시: firebase_token이 localStorage에 있는 경우 (구버전 호환)
  if (localStorage.getItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN)) return true

  return false
}

export async function getUserId(): Promise<string | null> {
  const userType = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
  
  // 1️⃣ Check localStorage first (user_type이 'user'인 경우에만!)
  if (userType === 'user' || !userType) {
    const userId = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_ID) || 
                   localStorage.getItem(LEGACY_KEYS.USER_ID_ALT)
    if (userId) {
      return userId
    }
  }
  
  // 2️⃣ Firebase Custom Claims (buyers with Kakao/Email login)
  try {
    const auth = await getFirebaseAuth()
    const user = auth.currentUser
    if (user) {
      // @ts-ignore - Firebase custom claims
      const claims = user.reloadUserInfo?.customAttributes
      if (claims) {
        try {
          const parsed = JSON.parse(claims)
          if (parsed.userId) {
            return parsed.userId.toString()
          }
        } catch (_) {}
      }
      // ✅ Fallback: use Firebase UID (email login users without custom claims)
      return user.uid
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
 * 3. localStorage (user_type이 'user'인 경우에만)
 * 
 * ⚠️ Seller/Admin은 seller_name, admin_name을 사용해야 하므로 제외
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
        return claims.userName
      }
      
      // 2️⃣ Firebase displayName (Google 로그인 등)
      if (user.displayName) {
        return user.displayName
      }
    }
  } catch (error) {
    console.warn('[Auth] getUserName - Firebase 조회 실패:', error)
  }
  
  // 3️⃣ localStorage 폴백 (user_type이 'user'인 경우에만!)
  const userType = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
  
  // ✅ Only read user_name if user_type is 'user' (not 'seller' or 'admin')
  if (userType === 'user' || !userType) {
    const localName = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_NAME) || 
                      localStorage.getItem(LEGACY_KEYS.USER_NAME_ALT)
    
    if (localName) {
      return localName
    }
  }

  return null
}

/**
 * 사용자 이메일 가져오기 (레거시 키 호환)
 * 
 * ⚠️ user_type이 'user'인 경우에만 localStorage user_email을 읽음
 * Seller는 seller_email, Admin은 admin_email을 사용해야 함
 */
export function getUserEmail(): string | null {
  const userType = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_TYPE)
  
  // ✅ Only read user_email if user_type is 'user' (not 'seller' or 'admin')
  if (userType === 'user' || !userType) {
    const email = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_EMAIL) || 
                  localStorage.getItem(LEGACY_KEYS.USER_EMAIL_ALT)
    
    if (email) {
      return email
    }
  }

  return null
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
 * 로그아웃 (선택적으로 특정 세션만 삭제)
 * 
 * @param type - 삭제할 세션 타입 ('seller', 'admin', 'user', 또는 undefined/null = 모든 세션)
 */
export async function logout(type?: 'seller' | 'admin' | 'user' | null): Promise<void> {
  if (type) {
    // ✅ Selective logout: Use clearAuthData
    clearAuthData(type)
    return
  }
  
  // ❌ Full logout: Remove ALL keys (legacy behavior)
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
  
}

