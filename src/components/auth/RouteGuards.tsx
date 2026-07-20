/**
 * RouteGuards — 로그인 보호 라우트
 *
 * 한국 (urdeal.kr):
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
import BrandLoader from '@/components/brand/BrandLoader'
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
// 🔐 2026-07-04 [UNLOCK_LOADING] (P2 자가치유 — 대표 "다 해줘 이상적으로", platform-model §14-5):
//   연결 셀러인데 seller_token 만료/부재(셀러는 refresh_token 미발급이 일반)면 곧장 /seller/login
//   으로 튕기던 갭. 소비자 세션이 살아있으면 same-origin `POST /api/auth/reissue-role-tokens`
//   (카카오 로그인과 동일 함수 issueLinkedRoleTokens)로 조용히 재발급 후 통과 — 재로그인 0회.
//   ⚠️ 잠금 불변식 보존: isSellerLoggedIn/isDashboardTokenUsable 의 토큰-존재/exp 검사 로직은
//   byte-불변(user_type 검사 추가 없음) — 실패 분기 뒤에 additive 복구 단계만 추가.
//   연결 셀러가 아니면(재발급 결과 seller_token 없음) 기존과 동일하게 로그인으로.
// ═══════════════════════════════════════════════════════════════════════════════
function RoleTokenSelfHeal({ role, fallback, children }: {
  role: 'seller' | 'agency'
  fallback: React.ReactElement
  children: React.ReactNode
}) {
  const [state, setState] = useState<'trying' | 'ok' | 'fail'>('trying')
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/auth/reissue-role-tokens', { method: 'POST', credentials: 'include' })
        const d = await r.json().catch(() => null) as {
          success?: boolean
          data?: {
            seller_token?: string
            seller?: { id?: number; username?: string; business_name?: string; is_distributor?: number }
            agency_token?: string
            agency_refresh_token?: string
            agency?: { id?: number; name?: string }
          }
        } | null
        const data = d?.success ? d?.data : null
        if (role === 'seller' && data?.seller_token) {
          localStorage.setItem('seller_token', data.seller_token)
          if (data.seller?.id != null) localStorage.setItem('seller_id', String(data.seller.id))
          if (data.seller?.username) localStorage.setItem('seller_username', data.seller.username)
          if (data.seller?.business_name) localStorage.setItem('seller_name', data.seller.business_name)
          if (data.seller?.is_distributor) localStorage.setItem('is_distributor', '1')
          if (alive) setState('ok')
          return
        }
        if (role === 'agency' && data?.agency_token) {
          localStorage.setItem('agency_token', data.agency_token)
          if (data.agency_refresh_token) localStorage.setItem('agency_refresh_token', data.agency_refresh_token)
          if (data.agency?.id != null) localStorage.setItem('agency_id', String(data.agency.id))
          if (data.agency?.name) localStorage.setItem('agency_name', data.agency.name)
          if (alive) setState('ok')
          return
        }
      } catch { /* 네트워크 실패 → 기존 동작(로그인 이동) */ }
      if (alive) setState('fail')
    })()
    return () => { alive = false }
  }, [role])

  // 🚑 2026-07-10 (로딩 전수조사 — 로더 통일): 1 RTT 동안 빈 화면(null) → 라이트 브랜드 로더.
  //   목적지(셀러/에이전시 대시보드)는 라이트 고정 표면이라 forceLight + #F4F5F7 (worker placeholder 와 정합).
  //   잠긴 토큰-존재 검사 로직은 불변 — 재발급 대기 프레임의 페인트만 변경.
  if (state === 'trying') {
    return (
      <div style={{ background: '#F4F5F7' }}>
        <BrandLoader fullScreen forceLight />
      </div>
    )
  }
  if (state === 'ok') return <>{children}</>
  return fallback
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
    if (!ok) {
      // 🔐 2026-07-04 (P2 자가치유): 소비자 세션이 살아있으면 로그인으로 보내기 전에
      //   연결 셀러 토큰 재발급을 1회 시도(연결 셀러가 아니면 기존과 동일하게 로그인으로).
      if (isUserLoggedIn()) {
        return (
          <RoleTokenSelfHeal role="seller" fallback={<Navigate to="/seller/login" state={{ from: location.pathname }} replace />}>
            {children}
          </RoleTokenSelfHeal>
        )
      }
      return <Navigate to="/seller/login" state={{ from: location.pathname }} replace />
    }
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
