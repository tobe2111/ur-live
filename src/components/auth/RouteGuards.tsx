/**
 * RouteGuards — 로그인 보호 라우트
 *
 * 한국 (live.ur-team.com):
 *   - localStorage 동기 체크만 (user_type + user_id)
 *   - Firebase 0, Zustand 0, isAuthReady 0, 타임아웃 0
 *
 * 글로벌:
 *   - Firebase user 또는 localStorage 세션 체크
 *   - Firebase 초기화 대기 최대 3초
 */

import React, { useEffect, useState, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isKorea } from '@/shared/config/region'

const DEBUG = import.meta.env.DEV

// ─── 순수 동기 체크 함수 ─────────────────────────────────────────────────────

function isUserLoggedIn(): boolean {
  return localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')
}

function isSellerLoggedIn(): boolean {
  return !!localStorage.getItem('seller_token') && localStorage.getItem('user_type') === 'seller'
}

function isAdminLoggedIn(): boolean {
  return !!localStorage.getItem('admin_token') && localStorage.getItem('user_type') === 'admin'
}

function makeLoginUrl(pathname: string, search: string): string {
  const returnUrl = encodeURIComponent(pathname + search)
  return `/login?returnUrl=${returnUrl}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// ProtectedRoute
// ═══════════════════════════════════════════════════════════════════════════════

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
  // 듀얼 세션: user_type이 'user'여도 seller_token이 있으면 셀러 대시보드 접근 허용
  if (requireSeller) {
    const sellerToken = localStorage.getItem('seller_token')
    const ok = !!sellerToken
    if (DEBUG) if (import.meta.env.DEV) console.log('[ProtectedRoute] Seller 체크:', { ok, path: location.pathname })
    if (!ok) return <Navigate to="/seller/login" state={{ from: location.pathname }} replace />
    return <>{children}</>
  }

  if (requireAdmin) {
    if (!isAdminLoggedIn()) return <Navigate to="/admin/login" replace />
    return <>{children}</>
  }

  // ─── User ──────────────────────────────────────────────────────────────

  // 한국: localStorage만 체크. 끝.
  if (isKorea()) {
    if (isUserLoggedIn()) {
      if (DEBUG) if (import.meta.env.DEV) console.log('[ProtectedRoute] ✅ KR 세션 로그인')
      return <>{children}</>
    }
    if (DEBUG) if (import.meta.env.DEV) console.log('[ProtectedRoute] ❌ KR 미인증 → /login')
    return <Navigate to={makeLoginUrl(location.pathname, location.search)} replace />
  }

  // 글로벌: Firebase 포함 체크
  return <GlobalUserProtectedRoute location={location}>{children}</GlobalUserProtectedRoute>
}

// 글로벌 전용: Firebase user 체크 (한국에서는 절대 실행 안 됨)
function GlobalUserProtectedRoute({
  children,
  location,
}: {
  children: React.ReactNode
  location: ReturnType<typeof useLocation>
}) {
  // 글로벌에서만 import (한국에서는 이 컴포넌트 자체가 렌더 안 됨)
  const { useAuthWorld } = require('@/shared/stores/useAuthWorld')
  const firebaseUser = useAuthWorld((s: any) => s.user)
  const isAuthReady = useAuthWorld((s: any) => s.isAuthReady)

  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasFirebaseTrace = !!localStorage.getItem('lastLoginUid')
  const needsWait = !isUserLoggedIn() && !firebaseUser && hasFirebaseTrace && !isAuthReady

  useEffect(() => {
    if (!needsWait) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      return
    }
    timerRef.current = setTimeout(() => setTimedOut(true), 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [needsWait])

  if (isUserLoggedIn()) return <>{children}</>
  if (firebaseUser) return <>{children}</>
  if (needsWait && !timedOut) return <>{children}</>

  return <Navigate to={makeLoginUrl(location.pathname, location.search)} replace />
}

// ═══════════════════════════════════════════════════════════════════════════════
// PublicRoute (로그인 페이지용 — 이미 로그인된 유저는 리다이렉트)
// ═══════════════════════════════════════════════════════════════════════════════

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

  if (forSeller) {
    const sellerToken = localStorage.getItem('seller_token')
    if (sellerToken) {
      if (DEBUG) if (import.meta.env.DEV) console.log('[PublicRoute] Seller 이미 로그인됨 → /seller')
      return <Navigate to="/seller" replace />
    }
    return <>{children}</>
  }

  if (forAdmin) {
    if (isAdminLoggedIn()) return <Navigate to="/admin" replace />
    return <>{children}</>
  }

  // ─── User ──────────────────────────────────────────────────────────────
  if (isUserLoggedIn()) {
    const searchParams = new URLSearchParams(location.search)
    const returnUrl = searchParams.get('returnUrl')
    // 🛡️ 2026-04-22: open redirect 방어 — 내부 path 만 허용
    const raw = returnUrl ? decodeURIComponent(returnUrl) : redirectTo
    const isInternal =
      typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\n') && !raw.includes('\t')
    const destination = isInternal ? raw : redirectTo
    if (DEBUG) if (import.meta.env.DEV) console.log('[PublicRoute] ✅ 이미 로그인됨 →', destination)
    return <Navigate to={destination} replace />
  }

  return <>{children}</>
}
