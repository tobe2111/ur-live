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

/** localStorage 동기 체크: Firebase User 로그인 흔적이 있는지 확인 */
function hasFirebaseUserSession(): boolean {
  const userType = localStorage.getItem('user_type')
  const lastLoginUid = localStorage.getItem('lastLoginUid')
  if (userType === 'user' && !!lastLoginUid) return true
  // firebase_token이 URL에 있으면 로그인 진행 중으로 간주 (즉시 리다이렉트 방지)
  return !!new URLSearchParams(window.location.search).get('firebase_token')
}

/** localStorage에 유효한(만료 전) Firebase 토큰 캐시가 있는지 확인 */
function hasValidTokenCache(): boolean {
  try {
    const cached = localStorage.getItem('firebase_token_cache')
    if (!cached) return false
    const { expiresAt } = JSON.parse(cached)
    return typeof expiresAt === 'number' && Date.now() < expiresAt
  } catch {
    return false
  }
}

/** Firebase User 전용 보호 라우트 */
function UserProtectedRoute({
  children,
  location,
}: {
  children: React.ReactNode
  location: ReturnType<typeof useLocation>
}) {
  // ✅ 동기 사전 체크: localStorage에 로그인 흔적이 없으면 즉시 리다이렉트 (스피너 없음)
  const hasPossibleSession = hasFirebaseUserSession()

  // ✅ 훅 규칙 준수: 두 스토어를 모두 구독하되, 렌더 시 region으로 선택
  // isKorea()는 순수 함수(hostname 체크)이므로 렌더 중 호출 안전
  const isAuthReadyKR = useAuthKR((state) => state.isAuthReady)
  const isAuthReadyWorld = useAuthWorld((state) => state.isAuthReady)
  const userKR = useAuthKR((state) => state.user)
  const userWorld = useAuthWorld((state) => state.user)

  const kr = isKorea()
  const isAuthReady = kr ? isAuthReadyKR : isAuthReadyWorld
  const currentUser = kr ? userKR : userWorld

  // ✅ 로그인 캐시 있으면 즉시 페이지 표시 (optimistic rendering)
  // Firebase 인증은 백그라운드에서 확인, 실패 시 리다이렉트
  const hasTokenCache = hasValidTokenCache()

  // ✅ 타임아웃 안전장치: 최대 5초 대기 후 강제 진행
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hasPossibleSession) return
    if (isAuthReady) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = setTimeout(() => {
      console.warn('[ProtectedRoute] ⏰ Firebase Auth 타임아웃 (5s) - 강제 진행')
      setTimedOut(true)
    }, 5000)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isAuthReady, hasPossibleSession])

  // ✅ 로그인 흔적 없음 → 즉시 리다이렉트 (Firebase 대기 없음, 스피너 없음)
  // ✅ 단, Zustand store에 이미 user가 있으면 localStorage 동기화 전이어도 리다이렉트 하지 않음
  if (!hasPossibleSession && !currentUser) {
    if (DEBUG) console.log('[ProtectedRoute] ⚡ 비로그인 확인 (동기) → /login')
    const cleanParams = new URLSearchParams(location.search)
    cleanParams.delete('firebase_token')
    cleanParams.delete('userName')
    cleanParams.delete('profileImage')
    const cleanSearch = cleanParams.toString() ? `?${cleanParams.toString()}` : ''
    const returnUrl = encodeURIComponent(location.pathname + cleanSearch)
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
  }

  // 아직 초기화 중 (타임아웃 전)
  // ✅ 로그인 캐시(토큰 or localStorage 흔적)가 있으면 스피너 없이 바로 페이지 표시
  if (!isAuthReady && !timedOut) {
    if (hasTokenCache || hasPossibleSession) {
      // optimistic rendering: 페이지 먼저 보여주고 백그라운드에서 인증 확인
      return <>{children}</>
    }
    if (DEBUG) console.log('[ProtectedRoute] ⏳ Firebase Auth 초기화 대기 중...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // 인증 확인 (isAuthReady 완료 또는 타임아웃 후에만 미인증 리다이렉트)
  // 세션 쿠키 로그인은 Firebase user가 없으므로 localStorage로 확인
  const isSessionLogin = localStorage.getItem('session_login') === 'true' && localStorage.getItem('user_id')
  if ((isAuthReady || timedOut) && !currentUser && !isSessionLogin) {
    if (DEBUG) console.log('[ProtectedRoute] ❌ User 미인증 → /login')
    // ✅ 무한루프 방지: auth 관련 파라미터 모두 제거
    const cleanParams = new URLSearchParams(location.search)
    cleanParams.delete('firebase_token')
    cleanParams.delete('userName')
    cleanParams.delete('profileImage')
    const cleanSearch = cleanParams.toString() ? `?${cleanParams.toString()}` : ''
    const returnUrl = encodeURIComponent(location.pathname + cleanSearch)
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
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
  // ✅ 동기 사전 체크: localStorage에 로그인 흔적 없으면 즉시 렌더링 (스피너 없음)
  const hasPossibleSession = hasFirebaseUserSession()

  // ✅ 훅 규칙 준수: 두 스토어 모두 구독
  const isAuthReadyKR = useAuthKR((state) => state.isAuthReady)
  const isAuthReadyWorld = useAuthWorld((state) => state.isAuthReady)
  const userKR = useAuthKR((state) => state.user)
  const userWorld = useAuthWorld((state) => state.user)

  const kr = isKorea()
  const isAuthReady = kr ? isAuthReadyKR : isAuthReadyWorld
  const currentUser = kr ? userKR : userWorld

  // ✅ 타임아웃 안전장치: 최대 3초 (로그인 세션이 있을 때만)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 로그인 흔적 없으면 타이머 불필요
    if (!hasPossibleSession) return
    if (isAuthReady) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = setTimeout(() => {
      console.warn('[PublicRoute] ⏰ Firebase Auth 타임아웃 (3s) - 강제 진행')
      setTimedOut(true)
    }, 3000)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isAuthReady, hasPossibleSession])

  // ✅ 로그인 흔적 없음 → 즉시 렌더링 (Firebase 대기 없음, 스피너 없음)
  if (!hasPossibleSession) {
    if (DEBUG) console.log('[PublicRoute] ⚡ 비로그인 확인 (동기) → 즉시 렌더링')
    return <>{children}</>
  }

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
    // ✅ returnUrl 쿼리파라미터 우선 (state.from 제거 → 무한루프 원인 제거)
    const searchParams = new URLSearchParams(location.search)
    const returnUrl = searchParams.get('returnUrl')
    const destination = returnUrl ? decodeURIComponent(returnUrl) : redirectTo
    if (DEBUG) console.log('[PublicRoute] ✅ User 이미 로그인됨 →', destination)
    return <Navigate to={destination} replace />
  }

  if (DEBUG) console.log('[PublicRoute] ✅ 미로그인 → 렌더링')
  return <>{children}</>
}
