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
import { safeInternalPath } from '@/utils/safe-internal-path'
import type { User as FirebaseUser } from 'firebase/auth'

interface AuthWorldState {
  user: FirebaseUser | null;
  isAuthReady: boolean;
}

const DEBUG = import.meta.env.DEV

// ─── 순수 동기 체크 함수 ─────────────────────────────────────────────────────
// 🛡️ 2026-05-27 (이중 로그인 race fix): 토큰 존재만으로 인증 판단.
//   기존: `user_type === 'admin'` 등 user_type 도 같이 검사 → user_type 은 단일 키라
//         어드민/유저 둘 다 로그인 시 마지막 로그인 한 쪽 user_type 만 살아남음 →
//         반대 역할 페이지 진입 시 ProtectedRoute false → 자동 로그아웃.
//   수정: 각 토큰 (admin_token / seller_token / user_id) 의 존재만 검사.
//         user_type 은 BottomNav active_role 처럼 DISPLAY 용으로만 사용.
//         seller 는 이미 `!!seller_token` 만 검사 (RouteGuards.tsx requireSeller 블록) — 일관성 통일.

function isUserLoggedIn(): boolean {
  return !!localStorage.getItem('user_id') || !!localStorage.getItem('session_login')
}

// 🔑 2026-07-02 (인증 회복력 P1b — 대표 "상품등록 흰화면"): JWT exp 디코드.
//   기존 게이트는 토큰 '존재'만 봐, **만료된** seller_token 도 통과시켜 → 페이지 마운트 → API 401 폭포 →
//   흰화면이 됐다. 만료 + 갱신불가(refresh_token 없음)면 '로그아웃'으로 취급해 로그인으로 **깔끔히** 보낸다.
//   (만료됐어도 refresh_token 이 있으면 통과 — 인터셉터가 401→refresh 로 복구. 디코드 실패 시 관대하게 통과 = 기존 동작.)
function isDashboardTokenUsable(role: 'seller' | 'admin' | 'agency'): boolean {
  const token = localStorage.getItem(`${role}_token`)
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true // 비표준 토큰 — 기존처럼 관대 통과
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4) // base64url 패딩 보정 (atob 엄격 엔진 대비)
    const payload = JSON.parse(atob(b64))
    const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : null
    if (expMs === null) return true // exp 없음 — 관대 통과
    if (expMs > Date.now()) return true // 아직 유효
    // 만료됨 → refresh_token 있으면 통과(인터셉터가 복구), 없으면 로그인 필요
    return !!localStorage.getItem(`${role}_refresh_token`)
  } catch {
    return true // 디코드 실패 — 기존 동작(관대 통과)
  }
}

function isSellerLoggedIn(): boolean {
  return isDashboardTokenUsable('seller')
}

function isAdminLoggedIn(): boolean {
  return isDashboardTokenUsable('admin')
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
    // 🔑 2026-07-02 (P1b): 존재만 X → 유효성(exp)까지. 만료+갱신불가면 흰화면 대신 로그인으로.
    const ok = isSellerLoggedIn()
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
  const firebaseUser = useAuthWorld((s: AuthWorldState) => s.user)
  const isAuthReady = useAuthWorld((s: AuthWorldState) => s.isAuthReady)

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
  // 🛡️ 2026-05-01: ?switch=1 query 면 redirect skip → LoginPage 가 localStorage 청소 + 재로그인 UI.
  //   사용자 신고: "다른 계정으로 로그인" 버튼 누르면 그냥 메인페이지로 가버림.
  //   원인: PublicRoute 가 LoginPage 렌더 전에 isUserLoggedIn=true 보고 즉시 redirect.
  const searchParams = new URLSearchParams(location.search)
  const wantsSwitch = searchParams.get('switch') === '1'

  if (isUserLoggedIn() && !wantsSwitch) {
    const returnUrl = searchParams.get('returnUrl')
    const destination = returnUrl ? safeInternalPath(returnUrl, redirectTo) : redirectTo
    if (DEBUG) if (import.meta.env.DEV) console.log('[PublicRoute] ✅ 이미 로그인됨 →', destination)
    return <Navigate to={destination} replace />
  }

  return <>{children}</>
}
