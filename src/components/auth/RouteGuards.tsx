/**
 * 🛡️ RouteGuards - 완전한 계정 분리 + 무한 루프 영구 해결 버전
 *
 * 핵심 설계 원칙:
 * 1. Seller/Admin → localStorage JWT 즉시 동기 체크 (Firebase 대기 없음)
 * 2. User (Firebase) → isAuthReady 플래그만 대기 (타임아웃 보장)
 * 3. isAuthReady가 true가 되면 절대 다시 loading 상태로 돌아가지 않음
 * 4. PublicRoute도 동일한 원칙 적용
 *
 * 🔧 무한루프 방지 핵심:
 * - ProtectedRoute: /login 리다이렉트 시 ?returnUrl= 쿼리파라미터 사용 (state 불사용)
 * - LoginPage: searchParams.get('returnUrl') 로 일관되게 읽음
 * - PublicRoute: redirectTo prop 우선, 쿼리파라미터 returnUrl 차선
 * - KR 고정: live.ur-team.com 은 항상 KR이므로 useAuthKR 만 사용
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { useEffect, useState, useRef } from 'react'

const DEBUG = import.meta.env.DEV

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

/**
 * User 보호 라우트 — 단순 3단계 로직 (Firebase 의존성 최소화)
 *
 * 1단계: session login (user_type + user_id) → 즉시 통과
 * 2단계: Firebase user 이미 있음 → 즉시 통과
 * 3단계: 둘 다 없음 → /login 리다이렉트
 *
 * Firebase 초기화 대기는 lastLoginUid가 있을 때만 최대 3초.
 * 세션 로그인 유저는 Firebase를 일절 대기하지 않음.
 */
function UserProtectedRoute({
  children,
  location,
}: {
  children: React.ReactNode
  location: ReturnType<typeof useLocation>
}) {
  // ── 훅 (반드시 최상단, 조건문 바깥) ──
  const kr = isKorea()
  const userKR = useAuthKR((s) => s.user)
  const userWorld = useAuthWorld((s) => s.user)
  const isAuthReadyKR = useAuthKR((s) => s.isAuthReady)
  const isAuthReadyWorld = useAuthWorld((s) => s.isAuthReady)
  const firebaseUser = kr ? userKR : userWorld
  const isAuthReady = kr ? isAuthReadyKR : isAuthReadyWorld

  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 동기 체크 ──
  const isSessionLogin = localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')
  const hasFirebaseTrace = !!localStorage.getItem('lastLoginUid')
  const needsFirebaseWait = !isSessionLogin && !firebaseUser && hasFirebaseTrace && !isAuthReady

  // 타임아웃: Firebase 대기가 필요한 경우에만 3초 제한
  useEffect(() => {
    if (!needsFirebaseWait) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      return
    }
    timerRef.current = setTimeout(() => setTimedOut(true), 3000)
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  }, [needsFirebaseWait])

  // ── 1단계: 세션 로그인 (카카오 등) → Firebase 무관, 즉시 통과 ──
  if (isSessionLogin) {
    if (DEBUG) console.log('[ProtectedRoute] ✅ 세션 로그인 → 즉시 통과')
    return <>{children}</>
  }

  // ── 2단계: Firebase user 이미 있음 → 즉시 통과 ──
  if (firebaseUser) {
    if (DEBUG) console.log('[ProtectedRoute] ✅ Firebase user → 통과')
    return <>{children}</>
  }

  // ── 3단계: Firebase 초기화 대기 중 (흔적 있고, 아직 준비 안 됨) ──
  if (needsFirebaseWait && !timedOut) {
    if (DEBUG) console.log('[ProtectedRoute] ⏳ Firebase 대기 중 (최대 3초)...')
    return <>{children}</>  // optimistic render
  }

  // ── 미인증 → 로그인 페이지 ──
  if (DEBUG) console.log('[ProtectedRoute] ❌ 미인증 → /login')
  const returnUrl = encodeURIComponent(location.pathname + location.search)
  return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
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
  // ── 훅 ──
  const kr = isKorea()
  const firebaseUser = kr ? useAuthKR((s) => s.user) : useAuthWorld((s) => s.user)

  // ── 이미 로그인됨 → 리다이렉트 ──
  const isSessionLogin = localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')
  if (isSessionLogin || firebaseUser) {
    const searchParams = new URLSearchParams(location.search)
    const returnUrl = searchParams.get('returnUrl')
    const destination = returnUrl ? decodeURIComponent(returnUrl) : redirectTo
    if (DEBUG) console.log('[PublicRoute] ✅ 이미 로그인됨 →', destination)
    return <Navigate to={destination} replace />
  }

  // ── 미로그인 → 즉시 렌더링 (스피너 없음) ──
  return <>{children}</>
}
