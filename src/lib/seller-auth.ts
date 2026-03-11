/**
 * 셀러 JWT 인증 헬퍼 함수
 * ⚠️ Firebase 절대 사용 안 함! seller_token만 사용!
 */

import { clearAuthData } from '@/utils/auth'

export function getSellerToken(): string | null {
  // PRIMARY: seller_token (최우선!)
  const sellerToken = localStorage.getItem('seller_token')
  if (sellerToken) {
    return sellerToken
  }
  
  // Fallback: access_token (호환성)
  const accessToken = localStorage.getItem('access_token')
  const userType = localStorage.getItem('user_type')
  if (accessToken && userType === 'seller') {
    return accessToken
  }
  
  return null
}

export function isSellerAuthenticated(): boolean {
  const token = getSellerToken()
  const userType = localStorage.getItem('user_type')
  
  console.log('[SellerAuth] 🔍 Checking:', {
    hasToken: !!token,
    userType,
    result: !!token && userType === 'seller'
  })
  
  return !!token && userType === 'seller'
}

export function getSellerId(): string | null {
  return localStorage.getItem('seller_id')
}

export function redirectToLogin(navigate: any) {
  console.log('[SellerAuth] ❌ Not authenticated, redirecting to login')
  
  // ✅ Clear only seller session (preserves User and Admin sessions)
  clearAuthData('seller')
  
  navigate('/seller/login', { replace: true })
}

export function logoutSeller(navigate: any) {
  console.log('[SellerAuth] 🚪 Logging out seller...')
  
  // ✅ Clear only seller session (preserves User and Admin sessions)
  clearAuthData('seller')
  
  console.log('[SellerAuth] ✅ Seller logged out (User/Admin sessions preserved)')
  navigate('/seller/login', { replace: true })
}
