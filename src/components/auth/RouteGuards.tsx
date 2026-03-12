/**
 * 🛡️ RouteGuards - 완전한 계정 분리 + 무한 루프 영구 해결 버전
 *
 * 핵심 설계 원칙:
 * 1. Seller/Admin → localStorage JWT 즉시 동기 체크 (Firebase 대기 없음)
 * 2. User (Firebase) → isAuthReady 플래그만 대기 (타임아웃 보장)
 * 3. isAuthReady가 true가 되면 절대 다시 loading 상태로 돌아가지 않음
 * 4. PublicRoute도 동일한 원칙 적용
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { useEffect, useState, useRef } from 'react'

const DEBUG = process.env.NODE_ENV === 'development'

// ============================================
// 🛡️ ProtectedRoute (로그인 필요)
// ============================================

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSeller?: boolean
  requireUser?: boolean
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireSeller = false,
}: ProtectedRouteProps) {
  const location = useLocation()

  // ─── Seller: 동기 체크 (Firebase 완전 무관) ─────────────────────────
  if (requireSeller) {
    const sellerToken = localStorage.getItem('seller_token')
    const userType = localStorage.getItem('user_type')
    const ok = !!(sellerToken && userType === 'seller')
    if (DEBUG) console.log('[ProtectedRoute] Seller 체크:', { ok, path: location.pathname })
    if (!ok) return <Navigate to="/seller/login" state={{ from: location.pathname }} replace />
    return <>{children}</>
  }

  // ─── Admin: 동기 체크 (Firebase 완전 무관) ──────────────────────────
  if (requireAdmin) {
    const adminToken = localStorage.getItem('admin_token')
    const userType = localStorage.getItem('user_type')
    const ok = !!(adminToken && userType === 'admin')
    if (DEBUG) console.log('[ProtectedRoute] Admin 체크:', { ok, path: location.pathname })
    if (!ok) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
    return <>{children}</>
  }

  // ─── User (Firebase): isAuthReady 대기 후 체크 ────────────────────────
  return <UserProtectedRoute location={location}>{children}</UserProtectedRoute>
}

/** Firebase User 전용 보호 라우트 */
function UserProtectedRoute({
  children,
  location,
}: {
  children: React.ReactNode
  location: ReturnType<typeof useLocation>
}) {
  const firebaseUser = isKorea() ? useAuthKR.getState().user : useAuthWorld.getState().user
  const isAuthReadyKR = useAuthKR((state) => state.isAuthReady)
  const isAuthReadyWorld = useAuthWorld((state) => state.isAuthReady)
  const isAuthReady = isKorea() ? isAuthReadyKR : isAuthReadyWorld
  const userKR = useAuthKR((state) => state.user)
  const userWorld = useAuthWorld((state) => state.user)
  const currentUser = isKorea() ? userKR : userWorld

  // ✅ 타임아웃 안전장치: 최대 4초 대기 후 강제 진행
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isAuthReady) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    timerRef.current = setTimeout(() => {
      console.warn('[ProtectedRoute] ⏰ Firebase Auth 타임아웃 (4s) - 강제 진행')
      setTimedOut(true)
    }, 4000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthReady])

  // 아직 초기화 중 (타임아웃 전)
  if (!isAuthReady && !timedOut) {
    if (DEBUG) console.log('[ProtectedRoute] ⏳ Firebase Auth 초기화 대기 중...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // 인증 확인
  if (!currentUser) {
    if (DEBUG) console.log('[ProtectedRoute] ❌ User 미인증 → /login')
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (DEBUG) console.log('[ProtectedRoute] ✅ User 인증 성공')
  return <>{children}</>
}

// ============================================
// 🌐 PublicRoute (로그인 페이지용)
// ============================================

interface PublicRouteProps {
  children: React.ReactNode
  redirectTo?: string
  forSeller?: boolean
  forAdmin?: boolean
}

export function PublicRoute({
  children,
  redirectTo = '/',
  forSeller = false,
  forAdmin = false,
}: PublicRouteProps) {
  const location = useLocation()

  // ─── Seller 로그인 페이지: 동기 체크 ────────────────────────────────
  if (forSeller) {
    const sellerToken = localStorage.getItem('seller_token')
    const userType = localStorage.getItem('user_type')
    if (sellerToken && userType === 'seller') {
      if (DEBUG) console.log('[PublicRoute] Seller 이미 로그인됨 → /seller')
      return <Navigate to="/seller" replace />
    }
    return <>{children}</>
  }

  // ─── Admin 로그인 페이지: 동기 체크 ─────────────────────────────────
  if (forAdmin) {
    const adminToken = localStorage.getItem('admin_token')
    const userType = localStorage.getItem('user_type')
    if (adminToken && userType === 'admin') {
      if (DEBUG) console.log('[PublicRoute] Admin 이미 로그인됨 → /admin')
      return <Navigate to="/admin" replace />
    }
    return <>{children}</>
  }

  // ─── User 로그인 페이지: Firebase isAuthReady 대기 ───────────────────
  return (
    <UserPublicRoute redirectTo={redirectTo} location={location}>
      {children}
    </UserPublicRoute>
  )
}

function UserPublicRoute({
  children,
  redirectTo,
  location,
}: {
  children: React.ReactNode
  redirectTo: string
  location: ReturnType<typeof useLocation>
}) {
  const isAuthReadyKR = useAuthKR((state) => state.isAuthReady)
  const isAuthReadyWorld = useAuthWorld((state) => state.isAuthReady)
  const userKR = useAuthKR((state) => state.user)
  const userWorld = useAuthWorld((state) => state.user)
  const isAuthReady = isKorea() ? isAuthReadyKR : isAuthReadyWorld
  const currentUser = isKorea() ? userKR : userWorld

  // ✅ 타임아웃 안전장치: 최대 3초
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isAuthReady) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    timerRef.current = setTimeout(() => {
      console.warn('[PublicRoute] ⏰ Firebase Auth 타임아웃 (3s) - 강제 진행')
      setTimedOut(true)
    }, 3000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthReady])

  // 초기화 중 (타임아웃 전)
  if (!isAuthReady && !timedOut) {
    if (DEBUG) console.log('[PublicRoute] ⏳ Firebase Auth 초기화 대기 중...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // 이미 로그인된 경우 리다이렉트
  if (currentUser) {
    const from = (location.state as any)?.from || redirectTo
    if (DEBUG) console.log('[PublicRoute] ✅ User 이미 로그인됨 →', from)
    return <Navigate to={from} replace />
  }

  if (DEBUG) console.log('[PublicRoute] ✅ 미로그인 → 렌더링')
  return <>{children}</>
}
