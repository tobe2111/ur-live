/**
 * 🛡️ ProtectedRoute & PublicRoute - 무한 루프 완전 해결 버전
 * 
 * 핵심:
 * 1. ✅ loading 상태 체크 필수 (초기화 완료 전까지 리다이렉트 차단)
 * 2. ✅ location.state로 returnUrl 전달
 * 3. ✅ 명확한 디버그 로그
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const DEBUG = true

// ============================================
// 🛡️ ProtectedRoute (로그인 필요)
// ============================================

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSeller?: boolean
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireSeller = false 
}: ProtectedRouteProps) {
  const { user, loading, userRole } = useAuth()
  const location = useLocation()

  if (DEBUG) {
    console.log('[ProtectedRoute]', {
      path: location.pathname,
      user: user?.uid,
      loading,
      userRole,
      requireAdmin,
      requireSeller
    })
  }

  // ✅ 1. loading 중이면 로딩 UI 표시 (리다이렉트 차단!)
  if (loading) {
    if (DEBUG) console.log('[ProtectedRoute] ⏳ Loading... 대기 중')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // ✅ 2. 로그인 안 되어 있으면 /login으로 리다이렉트
  if (!user) {
    if (DEBUG) console.log('[ProtectedRoute] ❌ 미로그인 → /login 리다이렉트')
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // ✅ 3. Admin 권한 체크
  if (requireAdmin && userRole !== 'admin') {
    if (DEBUG) console.log('[ProtectedRoute] ❌ Admin 권한 없음 → / 리다이렉트')
    return <Navigate to="/" replace />
  }

  // ✅ 4. Seller 권한 체크
  if (requireSeller && userRole !== 'seller' && userRole !== 'admin') {
    if (DEBUG) console.log('[ProtectedRoute] ❌ Seller 권한 없음 → / 리다이렉트')
    return <Navigate to="/" replace />
  }

  // ✅ 5. 모든 조건 통과 → children 렌더링
  if (DEBUG) console.log('[ProtectedRoute] ✅ 인증 완료 → 렌더링')
  return <>{children}</>
}

// ============================================
// 🌐 PublicRoute (로그인 시 홈으로)
// ============================================

interface PublicRouteProps {
  children: React.ReactNode
  redirectTo?: string  // 로그인 시 이동할 경로 (기본: '/')
}

export function PublicRoute({ 
  children, 
  redirectTo = '/' 
}: PublicRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (DEBUG) {
    console.log('[PublicRoute]', {
      path: location.pathname,
      user: user?.uid,
      loading,
      redirectTo
    })
  }

  // ✅ 1. loading 중이면 로딩 UI 표시 (리다이렉트 차단!)
  if (loading) {
    if (DEBUG) console.log('[PublicRoute] ⏳ Loading... 대기 중')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // ✅ 2. 로그인되어 있으면 홈으로 리다이렉트
  if (user) {
    // location.state.from이 있으면 그곳으로, 없으면 redirectTo로
    const from = (location.state as any)?.from || redirectTo
    
    if (DEBUG) console.log('[PublicRoute] ✅ 이미 로그인됨 → 리다이렉트:', from)
    return <Navigate to={from} replace />
  }

  // ✅ 3. 로그인 안 되어 있으면 children 렌더링 (로그인 페이지 등)
  if (DEBUG) console.log('[PublicRoute] ✅ 미로그인 → 렌더링')
  return <>{children}</>
}
