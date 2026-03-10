/**
 * 셀러 JWT 인증 헬퍼 함수
 * ⚠️ Firebase 절대 사용 안 함! seller_token만 사용!
 */

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
  
  // Clear invalid tokens
  localStorage.removeItem('seller_token')
  localStorage.removeItem('access_token')
  localStorage.removeItem('seller_refresh_token')
  localStorage.removeItem('user_type')
  localStorage.removeItem('seller_id')
  
  navigate('/seller/login', { replace: true })
}

export function logoutSeller(navigate: any) {
  console.log('[SellerAuth] 🚪 Logging out seller...')
  
  // Clear all seller-related data
  localStorage.removeItem('seller_token')
  localStorage.removeItem('access_token')
  localStorage.removeItem('seller_refresh_token')
  localStorage.removeItem('user_type')
  localStorage.removeItem('seller_id')
  localStorage.removeItem('user_id')
  localStorage.removeItem('seller_name')
  localStorage.removeItem('seller_email')
  
  console.log('[SellerAuth] ✅ Seller logged out')
  navigate('/seller/login', { replace: true })
}
