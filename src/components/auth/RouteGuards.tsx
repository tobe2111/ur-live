/**
 * RouteGuards — 단순하고 예측 가능한 라우트 보호
 *
 * 설계 원칙:
 * - User:   useAuth().isReady 대기 → user 확인 → 없으면 /login?returnUrl=...
 * - Seller: localStorage.seller_token 동기 확인 → 없으면 /seller/login
 * - Admin:  localStorage.admin_token 동기 확인 → 없으면 /admin/login
 * - PublicRoute(로그인 페이지): user 있으면 returnUrl 또는 / 로 리다이렉트
 *
 * 무한루프 방지:
 * - returnUrl 이 /login 이나 /auth/ 로 시작하면 / 로 강제 변환
 * - ProtectedRoute 는 state 를 쓰지 않고 ?returnUrl= 쿼리만 사용
 */

import React, { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/stores/useAuth'

// ─── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  )
}

// ─── 안전한 returnUrl 생성 ────────────────────────────────────────────────

function safeReturnUrl(pathname: string, search: string): string {
  const raw = pathname + search
  // /login, /auth/ 로 시작하는 경로는 순환이 되므로 홈으로
  if (raw.startsWith('/login') || raw.startsWith('/auth/')) return '/'
  return raw
}

// ─── ProtectedRoute (User) ───────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: React.ReactNode
  requireSeller?: boolean
  requireAdmin?: boolean
  /** 일반 사용자(Firebase) 보호 라우트. 기본값 동작과 동일하나 명시적 선언 가능 */
  requireUser?: boolean
}

export function ProtectedRoute({
  children,
  requireSeller = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const location = useLocation()

  // Seller: localStorage 동기 체크
  if (requireSeller) {
    const ok = !!(
      localStorage.getItem('seller_token') &&
      localStorage.getItem('user_type') === 'seller'
    )
    return ok
      ? <>{children}</>
      : <Navigate to="/seller/login" state={{ from: location.pathname }} replace />
  }

  // Admin: localStorage 동기 체크
  if (requireAdmin) {
    const ok = !!(
      localStorage.getItem('admin_token') &&
      localStorage.getItem('user_type') === 'admin'
    )
    return ok
      ? <>{children}</>
      : <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }

  // User: Firebase isReady 대기
  return <UserRoute location={location}>{children}</UserRoute>
}

function UserRoute({
  children,
  location,
}: {
  children: React.ReactNode
  location: ReturnType<typeof useLocation>
}) {
  const isReady = useAuth((s) => s.isReady)
  const user = useAuth((s) => s.user)

  // 최대 5초 타임아웃 — Firebase 응답이 느린 경우 무한 스피너 방지
  const [timedOut, setTimedOut] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isReady) {
      if (timer.current) clearTimeout(timer.current)
      return
    }
    timer.current = setTimeout(() => {
      console.warn('[ProtectedRoute] Firebase 타임아웃 (5s)')
      setTimedOut(true)
    }, 5000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [isReady])

  if (!isReady && !timedOut) return <Spinner />

  if (!user) {
    const returnUrl = encodeURIComponent(safeReturnUrl(location.pathname, location.search))
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
  }

  return <>{children}</>
}

// ─── PublicRoute (로그인 · 회원가입 페이지) ──────────────────────────────────

interface PublicRouteProps {
  children: React.ReactNode
  forSeller?: boolean
  forAdmin?: boolean
}

export function PublicRoute({
  children,
  forSeller = false,
  forAdmin = false,
}: PublicRouteProps) {
  const location = useLocation()

  if (forSeller) {
    const ok = !!(
      localStorage.getItem('seller_token') &&
      localStorage.getItem('user_type') === 'seller'
    )
    return ok ? <Navigate to="/seller" replace /> : <>{children}</>
  }

  if (forAdmin) {
    const ok = !!(
      localStorage.getItem('admin_token') &&
      localStorage.getItem('user_type') === 'admin'
    )
    return ok ? <Navigate to="/admin" replace /> : <>{children}</>
  }

  return <UserPublicRoute location={location}>{children}</UserPublicRoute>
}

function UserPublicRoute({
  children,
  location,
}: {
  children: React.ReactNode
  location: ReturnType<typeof useLocation>
}) {
  const isReady = useAuth((s) => s.isReady)
  const user = useAuth((s) => s.user)

  const [timedOut, setTimedOut] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isReady) {
      if (timer.current) clearTimeout(timer.current)
      return
    }
    timer.current = setTimeout(() => {
      console.warn('[PublicRoute] Firebase 타임아웃 (3s)')
      setTimedOut(true)
    }, 3000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [isReady])

  if (!isReady && !timedOut) return <Spinner />

  if (user) {
    const params = new URLSearchParams(location.search)
    const raw = params.get('returnUrl') ? decodeURIComponent(params.get('returnUrl')!) : '/'
    // 안전한 경로만 허용
    const destination = (raw.startsWith('/login') || raw.startsWith('/auth/')) ? '/' : raw
    return <Navigate to={destination} replace />
  }

  return <>{children}</>
}
