/**
 * 🛡️ RouteGuards - 완전한 계정 분리 지원 버전
 * 
 * 지원하는 인증 방식:
 * 1. ✅ User (Firebase) - Kakao/Google OAuth
 * 2. ✅ Seller (JWT) - 이메일/비밀번호
 * 3. ✅ Admin (JWT) - 이메일/비밀번호
 * 
 * 핵심:
 * - User: useAuthKR/useAuthWorld (Firebase)
 * - Seller: localStorage seller_token + user_type='seller'
 * - Admin: localStorage admin_token + user_type='admin'
 */

import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { useEffect, useState } from 'react'

const DEBUG = import.meta.env.DEV

// ============================================
// 🛡️ ProtectedRoute (로그인 필요)
// ============================================

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireSeller?: boolean
  requireUser?: boolean  // Firebase User 전용 (명시적)
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireSeller = false,
  requireUser = false
}: ProtectedRouteProps) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [isChecking, setIsChecking] = useState(true)
  const [authResult, setAuthResult] = useState<{
    isAuthenticated: boolean
    userType: 'user' | 'seller' | 'admin' | null
    redirectTo?: string
  }>({ isAuthenticated: false, userType: null })

  // Firebase User 체크 (Kakao/Google)
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  const firebaseUser = useAuth(state => state.user)
  const isFirebaseLoading = useAuth(state => state.isLoading)
  const hasFirebaseToken = searchParams.has('firebase_token')

  useEffect(() => {
    const checkAuth = async () => {
      // ✅ 1. Firebase 초기화 대기 (User용)
      if (isFirebaseLoading || (hasFirebaseToken && !firebaseUser)) {
        setIsChecking(true)
        return
      }

      // ✅ 2. Seller JWT 인증 체크
      if (requireSeller) {
        const sellerToken = localStorage.getItem('seller_token')
        const userType = localStorage.getItem('user_type')
        
        if (DEBUG) {
          console.log('[ProtectedRoute] Seller 체크:', {
            hasToken: !!sellerToken,
            userType,
            path: location.pathname
          })
        }
        
        if (sellerToken && userType === 'seller') {
          setAuthResult({ isAuthenticated: true, userType: 'seller' })
          setIsChecking(false)
          return
        }
        
        setAuthResult({ 
          isAuthenticated: false, 
          userType: null, 
          redirectTo: '/seller/login' 
        })
        setIsChecking(false)
        return
      }

      // ✅ 3. Admin JWT 인증 체크
      if (requireAdmin) {
        const adminToken = localStorage.getItem('admin_token')
        const userType = localStorage.getItem('user_type')
        
        if (DEBUG) {
          console.log('[ProtectedRoute] Admin 체크:', {
            hasToken: !!adminToken,
            userType,
            path: location.pathname
          })
        }
        
        if (adminToken && userType === 'admin') {
          setAuthResult({ isAuthenticated: true, userType: 'admin' })
          setIsChecking(false)
          return
        }
        
        setAuthResult({ 
          isAuthenticated: false, 
          userType: null, 
          redirectTo: '/admin/login' 
        })
        setIsChecking(false)
        return
      }

      // ✅ 4. Firebase User 인증 체크
      if (requireUser || (!requireSeller && !requireAdmin)) {
        if (DEBUG) {
          console.log('[ProtectedRoute] User 체크:', {
            hasFirebaseUser: !!firebaseUser,
            path: location.pathname
          })
        }
        
        if (firebaseUser) {
          setAuthResult({ isAuthenticated: true, userType: 'user' })
          setIsChecking(false)
          return
        }
        
        setAuthResult({ 
          isAuthenticated: false, 
          userType: null, 
          redirectTo: '/login' 
        })
        setIsChecking(false)
        return
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [
    requireSeller, 
    requireAdmin, 
    requireUser, 
    firebaseUser, 
    isFirebaseLoading, 
    hasFirebaseToken,
    location.pathname
  ])

  // ✅ 로딩 중
  if (isChecking) {
    if (DEBUG) console.log('[ProtectedRoute] ⏳ 인증 체크 중...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // ✅ 인증 실패 → 리다이렉트
  if (!authResult.isAuthenticated) {
    const redirectPath = authResult.redirectTo || '/login'
    if (DEBUG) {
      console.log('[ProtectedRoute] ❌ 인증 실패 → 리다이렉트:', redirectPath)
    }
    return <Navigate to={redirectPath} state={{ from: location.pathname }} replace />
  }

  // ✅ 인증 성공
  if (DEBUG) {
    console.log('[ProtectedRoute] ✅ 인증 성공:', authResult.userType)
  }
  return <>{children}</>
}

// ============================================
// 🌐 PublicRoute (로그인 페이지용)
// ============================================

interface PublicRouteProps {
  children: React.ReactNode
  redirectTo?: string
  forSeller?: boolean  // Seller 로그인 페이지
  forAdmin?: boolean   // Admin 로그인 페이지
}

export function PublicRoute({ 
  children, 
  redirectTo = '/',
  forSeller = false,
  forAdmin = false
}: PublicRouteProps) {
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState(redirectTo)

  // Firebase User 체크
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  const firebaseUser = useAuth(state => state.user)
  const isFirebaseLoading = useAuth(state => state.isLoading)

  useEffect(() => {
    const checkAuth = async () => {
      // Firebase 초기화 대기
      if (isFirebaseLoading) {
        setIsChecking(true)
        return
      }

      // ✅ Seller 로그인 페이지
      if (forSeller) {
        const sellerToken = localStorage.getItem('seller_token')
        const userType = localStorage.getItem('user_type')
        
        if (sellerToken && userType === 'seller') {
          if (DEBUG) console.log('[PublicRoute] Seller 이미 로그인됨 → /seller')
          setRedirectTarget('/seller')
          setShouldRedirect(true)
        }
        
        setIsChecking(false)
        return
      }

      // ✅ Admin 로그인 페이지
      if (forAdmin) {
        const adminToken = localStorage.getItem('admin_token')
        const userType = localStorage.getItem('user_type')
        
        if (adminToken && userType === 'admin') {
          if (DEBUG) console.log('[PublicRoute] Admin 이미 로그인됨 → /admin')
          setRedirectTarget('/admin')
          setShouldRedirect(true)
        }
        
        setIsChecking(false)
        return
      }

      // ✅ User 로그인 페이지
      if (firebaseUser) {
        const from = (location.state as any)?.from || redirectTo
        if (DEBUG) console.log('[PublicRoute] User 이미 로그인됨 →', from)
        setRedirectTarget(from)
        setShouldRedirect(true)
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [
    forSeller, 
    forAdmin, 
    firebaseUser, 
    isFirebaseLoading, 
    location.state, 
    redirectTo
  ])

  // ✅ 로딩 중
  if (isChecking) {
    if (DEBUG) console.log('[PublicRoute] ⏳ 인증 체크 중...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // ✅ 이미 로그인됨 → 리다이렉트
  if (shouldRedirect) {
    if (DEBUG) console.log('[PublicRoute] ✅ 리다이렉트:', redirectTarget)
    return <Navigate to={redirectTarget} replace />
  }

  // ✅ 미로그인 → children 렌더링
  if (DEBUG) console.log('[PublicRoute] ✅ 미로그인 → 렌더링')
  return <>{children}</>
}
