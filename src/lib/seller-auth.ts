/**
 * 셀러 JWT 인증 헬퍼 함수
 * ⚠️ Firebase 절대 사용 안 함! seller_token만 사용!
 */

import { clearAuthData } from '@/utils/auth'
import { getQueryClient } from '@/lib/react-query'

export function getSellerToken(): string | null {
  // PRIMARY: seller_token (최우선!)
  const sellerToken = localStorage.getItem('seller_token')
  if (sellerToken) {
    return sellerToken
  }
  
  // Fallback: access_token (이메일 가입 셀러 호환)
  const accessToken = localStorage.getItem('access_token')
  if (accessToken && localStorage.getItem('seller_id')) {
    return accessToken
  }
  
  return null
}

export function isSellerAuthenticated(): boolean {
  return !!getSellerToken()
}

export function getSellerId(): string | null {
  return localStorage.getItem('seller_id')
}

export function redirectToLogin(navigate: any) {
  // ✅ Clear only seller session (preserves User and Admin sessions)
  clearAuthData('seller')
  // 🛡️ 2026-04-22: React Query 캐시 초기화 — 이전 셀러의 주문/정산 데이터 누출 방어
  try { getQueryClient().clear() } catch {}

  navigate('/seller/login', { replace: true })
}

export function logoutSeller(navigate: any) {
  // ✅ Clear only seller session (preserves User and Admin sessions)
  clearAuthData('seller')
  try { getQueryClient().clear() } catch {}

  navigate('/seller/login', { replace: true })
}
