/**
 * Authentication utility functions
 * 모든 페이지에서 일관된 로그인/로그아웃 처리
 */

import { NavigateFunction } from 'react-router-dom'

/**
 * 로그인 상태 확인
 */
export function isLoggedIn(): boolean {
  const token = localStorage.getItem('access_token')
  const session = localStorage.getItem('session')
  const userId = localStorage.getItem('user_id')
  
  return !!((token && userId) || (session && userId))
}

/**
 * 사용자 ID 가져오기
 */
export function getUserId(): string | null {
  return localStorage.getItem('user_id') || localStorage.getItem('userId')
}

/**
 * 사용자 이름 가져오기
 */
export function getUserName(): string | null {
  return localStorage.getItem('user_name') || localStorage.getItem('userName')
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
  localStorage.setItem('loginReturnUrl', currentPath)
  
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
  localStorage.setItem('tempCartItem', JSON.stringify(tempCart))
}

/**
 * 임시 장바구니 아이템 가져오기
 */
export function getTempCartItem(): any | null {
  const tempCartItem = localStorage.getItem('tempCartItem')
  if (!tempCartItem) return null
  
  try {
    return JSON.parse(tempCartItem)
  } catch (error) {
    console.error('Failed to parse temp cart item:', error)
    localStorage.removeItem('tempCartItem')
    return null
  }
}

/**
 * 임시 장바구니 아이템 삭제
 */
export function clearTempCartItem(): void {
  localStorage.removeItem('tempCartItem')
}

/**
 * 로그아웃
 * 모든 인증 관련 localStorage 데이터 삭제
 */
export function logout(): void {
  // Remove all authentication keys
  localStorage.removeItem('user_id')
  localStorage.removeItem('user_name')
  localStorage.removeItem('session')
  localStorage.removeItem('userId')
  localStorage.removeItem('userName')
  localStorage.removeItem('userEmail')
  localStorage.removeItem('access_token')
  localStorage.removeItem('accessToken')
  localStorage.removeItem('hasCartItems')
  localStorage.removeItem('loginReturnUrl')
  localStorage.removeItem('tempCartItem')
}

/**
 * 사용자 정보 저장 (로그인 성공 후)
 * 
 * @param userId - 사용자 ID
 * @param userName - 사용자 이름
 * @param sessionToken - 세션 토큰
 * @param userEmail - 사용자 이메일 (선택사항)
 */
export function saveUserInfo(
  userId: string,
  userName: string,
  sessionToken: string,
  userEmail?: string
): void {
  // Save with both key styles for compatibility
  localStorage.setItem('accessToken', sessionToken)
  localStorage.setItem('userId', userId)
  localStorage.setItem('userName', userName)
  if (userEmail) {
    localStorage.setItem('userEmail', userEmail)
  }
  
  // Alternative keys
  localStorage.setItem('user_id', userId)
  localStorage.setItem('user_name', userName)
  localStorage.setItem('session', sessionToken)
}
