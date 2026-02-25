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
  // 🔧 표준 logout 함수 사용 (JWT + 레거시 키 모두 삭제)
  const { logout } = require('@/utils/auth')
  logout()
  
  console.log('[SellerAuth] 🚪 셀러 로그아웃 완료')
  navigate('/seller/login')
}
