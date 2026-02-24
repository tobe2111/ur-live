/**
 * 셀러 JWT 인증 헬퍼 함수
 * seller_session_token 대신 access_token (JWT) 사용
 */

export function getSellerToken(): string | null {
  // JWT 우선 사용
  const accessToken = localStorage.getItem('access_token')
  if (accessToken) {
    return accessToken
  }
  
  // 레거시 호환성
  return localStorage.getItem('seller_session_token')
}

export function isSellerAuthenticated(): boolean {
  const token = getSellerToken()
  const userType = localStorage.getItem('user_type')
  return !!token && userType === 'seller'
}

export function getSellerId(): string | null {
  return localStorage.getItem('seller_id')
}

export function redirectToLogin(navigate: any) {
  console.log('[SellerAuth] ❌ Not authenticated, redirecting to login')
  navigate('/seller/login', { replace: true })
}

export function logoutSeller(navigate: any) {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('seller_session_token')
  localStorage.removeItem('user_type')
  localStorage.removeItem('seller_id')
  localStorage.removeItem('seller_name')
  localStorage.removeItem('seller_email')
  navigate('/seller/login')
}
