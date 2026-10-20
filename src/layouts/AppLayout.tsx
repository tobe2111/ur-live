/**
 * 앱 전체 레이아웃 시스템 (Single Source of Truth)
 *
 * 모든 페이지는 이 레이아웃 중 하나를 사용합니다:
 *
 * 1. MobileLayout  — 일반 페이지 (홈, 검색, 장바구니, 상세, 프로필 등)
 *    → max-w-screen-sm (640px), 중앙 정렬, 흰 배경, BottomNav 포함
 *
 * 2. FullScreenLayout — 전체 화면 페이지 (라이브, 체크아웃, 로그인 등)
 *    → 너비 제한 없음, BottomNav 없음
 *
 * 3. DashboardLayout — 셀러/어드민 대시보드
 *    → 각자 SellerLayout/AdminLayout 사용 (기존 유지)
 */

import React from 'react'

const APP_MAX_WIDTH = '640px' // max-w-screen-sm

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

/**
 * 모바일 커머스 레이아웃 (홈, 검색, 장바구니, 상세 등)
 * - 640px 중앙 정렬
 * - 흰 배경
 * - BottomNav 공간(pb-14) 포함
 */
export function MobileLayout({ children, className = '' }: LayoutProps) {
  return (
    <div
      className={`mx-auto min-h-dvh bg-white pb-14 ${className}`}
      style={{ maxWidth: APP_MAX_WIDTH }}
    >
      {children}
    </div>
  )
}

/**
 * 전체 화면 레이아웃 (라이브, 체크아웃, 로그인, 결제 등)
 * - 너비 제한 없음
 * - BottomNav 없음
 */
export function FullScreenLayout({ children, className = '' }: LayoutProps) {
  return (
    <div className={`min-h-dvh ${className}`}>
      {children}
    </div>
  )
}

/**
 * BottomNav의 max-width (MobileLayout과 동일)
 * BottomNav 컴포넌트에서 사용합니다.
 */
export const BOTTOM_NAV_MAX_WIDTH = APP_MAX_WIDTH

/**
 * 현재 경로가 전체 화면 레이아웃인지 확인
 */
export function isFullScreenPath(pathname: string): boolean {
  const fullScreenPrefixes = [
    '/live/', '/checkout', '/payment/', '/points/',
    '/seller/', '/admin/',
    '/login', '/register', '/auth/', '/embed/',
    '/introduce',
  ]
  return fullScreenPrefixes.some(prefix => pathname.startsWith(prefix))
}
