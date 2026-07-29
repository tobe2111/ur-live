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
import { isSafeInternalPath } from './safe-internal-path'
import { useAuthStore } from '@/client/stores/auth.store'

// Firebase는 dynamic import로만 사용 (초기 번들에서 제외)
async function getFirebaseAuth() {
  const { getFirebaseAuth: getAuth } = await import('@/lib/firebase-auth')
  return getAuth()
}

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
 * 🔑 2026-06-29 (로그아웃 근본수정): 서버 httpOnly 세션 쿠키(ur_session/ur_seller_session/…) + SSR 토큰(ud_*)
 *   삭제. httpOnly 라 클라가 JS 로 직접 못 지움 → 서버 엔드포인트가 Set-Cookie Max-Age=0 으로 삭제해야 한다.
 *   type 지정 시 그 역할 세션만(선택적 로그아웃—듀얼로그인 보호), 미지정 시 전체. **await 가능** →
 *   네비게이션/리로드 *전*에 쿠키 삭제를 완료해 로그아웃 직후 그 쿠키로 재인증되는 레이스를 제거한다.
 */
export async function clearServerSessionCookies(type?: 'seller' | 'admin' | 'user' | 'agency' | 'supplier'): Promise<void> {
  try {
    await fetch('/api/auth/logout-cookies', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(type ? { type } : {}),
      // 🔑 keepalive: 호출 직후 navigate/reload 해도 요청이 끝까지 살아 Set-Cookie 가 적용되게(미-await 경로 보호).
      keepalive: true,
    })
  } catch { /* SSR/비브라우저/네트워크 — 로컬 정리는 계속 진행 */ }
}

/**
 * 선택적 localStorage 키 삭제
 * localStorage.clear() 대신 사용하여 다른 세션 보호
 *
 * @param type - 삭제할 세션 타입 ('seller' | 'admin' | 'user')
 */
export function clearAuthData(type: 'seller' | 'admin' | 'user') {
  // 🔑 2026-06-29: 서버 httpOnly 세션쿠키(ur_*) + SSR 토큰(ud_*) 삭제 — type 전달로 해당 역할 세션만 정리
  //   (듀얼로그인 보호). httpOnly 라 클라가 못 지움 → 서버 호출 필수. fire-and-forget(로컬 정리는 계속 진행).
  //   ⚠️ 즉시 리로드/네비게이션이 뒤따르는 경로는 logout(type) 를 써서 이 호출을 await 해야 레이스 0.
  try { void clearServerSessionCookies(type) } catch { /* SSR/비브라우저 */ }
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
    // 🛡️ 2026-05-12 (C3 fix): seller 로그아웃 시 user_type='seller' 잔존 시 다른 세션에 맞춰 정정.
    //   기존 버그: user → seller 후 seller 로그아웃 시 user_type='seller' + user_id=원래유저ID 로
    //   getUserId() 가 user_id 를 seller_id 로 오인. 다음 user 의 API 가 다른 유저 데이터 접근 가능.
    if (localStorage.getItem('user_type') === 'seller') {
      if (localStorage.getItem('admin_token')) {
        try { localStorage.setItem('user_type', 'admin') } catch { /* quota */ }
      } else if (localStorage.getItem('user_id') || localStorage.getItem('firebase_token')) {
        try { localStorage.setItem('user_type', 'user') } catch { /* quota */ }
      } else {
        keysToRemove.push('user_type')
      }
    }
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
    // 🛡️ 2026-05-12 (C3 fix): admin 로그아웃 시도 동일 정정.
    if (localStorage.getItem('user_type') === 'admin') {
      if (localStorage.getItem('seller_token')) {
        try { localStorage.setItem('user_type', 'seller') } catch { /* quota */ }
      } else if (localStorage.getItem('user_id') || localStorage.getItem('firebase_token')) {
        try { localStorage.setItem('user_type', 'user') } catch { /* quota */ }
      } else {
        keysToRemove.push('user_type')
      }
    }
  } else {
    // User 전용 키 (user_type은 seller/admin 세션이 없을 때만 삭제)
    keysToRemove.push(
      'firebase_token',
      'user_id',
      'user_name',
      'user_email',
      'user_profile_image',
      'user_session_token',  // 레거시 세션 토큰
      // 🛡️ 2026-06-20: 소비자 Bearer 토큰(user_token) + refresh 제거 — 안 지우면 로그아웃 후에도
      //   Bearer 로 인증 지속(버그). 이메일·카카오 로그인 공통(둘 다 localStorage.user_token 사용).
      'user_token',
      'user_refresh_token',
      'hasCartItems',
      'tempCartItem',
      'loginReturnUrl',
      'lastLoginUid',
      'session_login',
      // 🛡️ 2026-06-11 (사용자 신고 — 로그아웃했는데 링크샵 탭이 내 샵으로): BottomNav linkshopPath 가
      //   읽는 경로 캐시. 계정 전환(KakaoCallbackPage)에선 지우는데 일반 로그아웃에선 잔존했음.
      //   user 파생 키만 제거 — seller_username 은 셀러 세션 소유라 seller 로그아웃에서 처리.
      'user_handle',
      'linked_seller_username'
    )
    // seller/admin 세션이 남아있으면 user_type 유지
    const hasSellerSession = !!localStorage.getItem('seller_token')
    const hasAdminSession = !!localStorage.getItem('admin_token')
    if (!hasSellerSession && !hasAdminSession) {
      keysToRemove.push('user_type')
    }
    // v37 FIX: user 로그아웃 시 zustand persist 스토어들도 초기화
    // (이전 유저의 장바구니/찜 등이 새 유저 세션에 남지 않도록)
    keysToRemove.push(
      'cart-storage',
      'wishlist-storage',
      'deal-charge-storage',
      'recent-views-storage'
    )
    // 🔑 2026-06-29 (로그아웃 근본수정 — 핀/큐레이터 'auth-storage' 분리뷰): 소비자 로그아웃 시
    //   generic useAuthStore(persist key 'auth-storage') 도 초기화. 이 스토어는 핀(usePinAction)·
    //   PinButton·App.tsx 자동핀이 읽는 *별도* 인증 뷰라, 안 지우면 로그아웃 후 새로고침해도
    //   persist 가 isAuthenticated=true 로 rehydrate → 핀 UI 가 "로그인됨"으로 오표시.
    try { useAuthStore.getState().clearAuth() } catch { /* SSR/비브라우저 */ }
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
    // 🛡️ 2026-06-29: 토큰/세션 존재만으로 판단 — isLoggedInSync / RouteGuards 와 일관.
    //   기존 버그: user_type 게이트(=== 'seller'/'admin')에 묶여, 어드민/셀러 + 카카오 user 듀얼 로그인
    //   시 user_type 이 'admin'/'seller' 로 남으면 셀러/어드민이 아닌 *소비자* 세션을 못 인정.
    //   수정: user_type 무관하게 어떤 역할 토큰이든 있으면 로그인으로 판단(존재 기반).
    if (isLoggedInSync()) {
      return true
    }

    // Firebase Auth (글로벌 — Firebase 전용 세션이라 localStorage 신호가 없을 수 있음)
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
  // 🛡️ 2026-05-31 SSR: Node prerender 환경엔 localStorage 없음 → 가드 (없으면 renderToString throw).
  //   서버에선 항상 로그아웃으로 렌더 → 클라이언트 hydrate 시 실제 상태 반영 (동작 불변).
  if (typeof localStorage === 'undefined') return false
  // 🛡️ 2026-05-27: 토큰/세션 존재만으로 판단 — RouteGuards 와 일관.
  //   기존 버그: user_type 추가 검사 → admin/seller 로그인 (user_type='admin'/'seller') + 카카오 user
  //   동시에 있을 때 user_id 있어도 false. /my-vouchers `enabled` false → 빈 화면.
  //   수정: user_id 만 있으면 user 로그인 인정 (user_type 무관). DISPLAY 컨텍스트 분리.
  if (localStorage.getItem('seller_token')) return true
  if (localStorage.getItem('admin_token')) return true
  if (localStorage.getItem('agency_token')) return true

  // Firebase / 카카오 user: user_id 또는 session_login 있으면 로그인 인정 (user_type 검사 X)
  if (localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_ID)) return true
  if (localStorage.getItem('session_login')) return true

  // 레거시: firebase_token 호환
  if (localStorage.getItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN)) return true

  return false
}

/**
 * 소비자(메인 서비스) 세션 존재 여부 — `user_type` 비의존.
 *
 * 🛡️ 2026-06-17 (듀얼 로그인 충돌 수정): 어드민/셀러/에이전시 대시보드 + 소비자를 한 브라우저에서
 *   동시 로그인하면 단일 키 `user_type` 이 'admin'/'seller' 로 덮인다. 기존 다수 소비자 페이지가
 *   `user_type === 'user' && user_id` 로 로그인을 판단해 → 쿠키가 멀쩡한 소비자 세션을 "로그아웃"으로
 *   오인했다 (대시보드 로그인 직후 메인이 로그아웃돼 보이는 체감 + 401 시 실제 세션 삭제).
 *   RouteGuards / isLoggedInSync 와 동일하게 *세션 존재* 로만 판단한다.
 *
 *   주의: seller_token / admin_token 단독은 *소비자* 세션이 아니므로 포함하지 않는다 (구매자 식별용).
 *   소비자 신호: user_id (카카오/이메일) · session_login (세션 쿠키 발급) · firebase_token (레거시).
 */
export function hasConsumerSession(): boolean {
  if (typeof localStorage === 'undefined') return false
  return !!localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_ID) ||
         !!localStorage.getItem('session_login') ||
         !!localStorage.getItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN)
}

export async function getUserId(): Promise<string | null> {
  // 1️⃣ Check localStorage first.
  // 🛡️ 2026-06-17 (듀얼 로그인 충돌 수정): user_id 는 항상 소비자(구매자) id 이므로 user_type 무관하게
  //   우선 반환한다. 기존 `user_type === 'user'` 게이트는 어드민/셀러 + 소비자 듀얼 로그인 시
  //   user_type 이 'admin'/'seller' 로 남아 소비자 user_id 를 건너뛰고 Firebase 로 빠지는 버그였다.
  //   (getUserIdSync 와 동일 기준 — 일관성. 소비자 컨텍스트 호출자만 이 함수를 사용.)
  const localUserId = localStorage.getItem(FIREBASE_STORAGE_KEYS.USER_ID) ||
                      localStorage.getItem(LEGACY_KEYS.USER_ID_ALT)
  if (localUserId) {
    return localUserId
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
        } catch (_) {} // non-critical: JSON.parse of custom claims may fail
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
  // 🛡️ 2026-04-29: safeInternalPath 헬퍼로 통일 — auth path / 외부 URL / 위험 경로면
  //   returnUrl 저장·전달 안 함 (자기참조 무한 루프 방지)
  const currentPath = window.location.pathname + window.location.search
  const canUseAsReturnUrl = isSafeInternalPath(currentPath)

  if (canUseAsReturnUrl) {
    localStorage.setItem(FIREBASE_STORAGE_KEYS.LOGIN_RETURN_URL, currentPath)
  }

  // Show alert ONCE per session to prevent repetitive popups
  const alertShownKey = 'login_alert_shown_' + currentPath
  const alertShown = sessionStorage.getItem(alertShownKey)

  if (message && (force || !alertShown)) {
    alert(message)
    sessionStorage.setItem(alertShownKey, 'true')
  }

  // Navigate to login (auth path / 위험 경로면 returnUrl 생략)
  navigate(canUseAsReturnUrl ? '/login?returnUrl=' + encodeURIComponent(currentPath) : '/login')
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
    // ✅ 선택적 로그아웃 — 서버 세션쿠키(해당 역할) 삭제를 **await**(레이스 제거) 후 로컬 정리.
    await clearServerSessionCookies(type)
    clearAuthData(type)
    return
  }

  // ❌ Full logout: Remove ALL keys (legacy behavior)
  // 🔑 2026-06-29 (로그아웃 근본수정): 모든 역할의 서버 httpOnly 세션쿠키(ur_*) 삭제를 **await** —
  //   안 지우면 ur_session 잔존 → /api/auth/me·/session/health 가 그 쿠키로 재인증 → 로그아웃 실패.
  await clearServerSessionCookies()
  // Firebase 키 제거
  Object.values(FIREBASE_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })

  // 레거시 JWT/세션 키 제거
  Object.values(LEGACY_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })

  // 🔑 2026-06-29: 위 두 목록에 없던 소비자 Bearer 토큰/세션 신호도 제거 — 안 지우면 /session/health 의
  //   Bearer(user_token) fallback 으로 재인증돼 로그아웃이 안 됨(이메일·카카오 공통 localStorage.user_token).
  ;['user_token', 'user_refresh_token', 'user_session_token', 'session_login', 'lastLoginUid', 'user_handle', 'linked_seller_username']
    .forEach(k => localStorage.removeItem(k))

  // 🔑 2026-06-29 (로그아웃 근본수정): generic useAuthStore('auth-storage', 핀/큐레이터 인증 뷰) 초기화 —
  //   persist 가 isAuthenticated=true 로 남으면 로그아웃 후에도 핀 UI 가 로그인됨으로 보임.
  try { useAuthStore.getState().clearAuth() } catch { /* SSR/비브라우저 */ }
  
  // Sentry 사용자 컨텍스트 제거
  try {
    const { clearSentryUser } = require('@/lib/sentry')
    clearSentryUser()
  } catch (e) {
    // Sentry 초기화 실패 시 무시
  }
  
  // Firebase 로그아웃 (글로벌 전용 — 한국은 세션 쿠키만 사용)
  try {
    const { isKorea } = await import('@/shared/config/region')
    if (!isKorea()) {
      const auth = await getFirebaseAuth()
      auth.signOut()
    }
  } catch (e) {
    // Firebase 초기화 실패 시 무시
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

