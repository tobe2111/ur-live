import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { saveJwtTokens, isLoggedIn, getAccessToken, getUserType } from '@/utils/auth'

/**
 * Auth Context - 전역 JWT 인증 상태 관리
 * 
 * 목적:
 * - JWT 기반 전역 인증 상태 제공
 * - 카카오 OAuth 콜백 처리 (URL 파라미터)
 * - 다이렉트 로그인 처리 (이메일/비밀번호)
 * - useSessionValidation 훅과 협업하여 401 오류 처리
 * 
 * 주요 차이점 (JWT 전환 후):
 * - sessionToken → accessToken, refreshToken (JWT 표준)
 * - isAuthReady: JWT 토큰 검증 전 세션 검증 차단
 * - isProcessingLogin: URL 파라미터 처리 중 세션 검증 차단
 */

interface AuthContextType {
  isProcessingLogin: boolean
  isAuthReady: boolean
  isLoggedIn: boolean
  accessToken: string | null
  loginWithCredentials: (
    accessToken: string, 
    refreshToken: string, 
    userId: string, 
    userName: string, 
    userType: 'user' | 'seller' | 'admin',
    userEmail?: string | null
  ) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const [isProcessingLogin, setIsProcessingLogin] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    accessToken: null as string | null
  })

  useEffect(() => {
    const initializeAuth = async () => {
      // Step 1: URL 파라미터 체크
      const accessToken = searchParams.get('access_token')   // ✨ JWT Access Token (신규)
      const refreshToken = searchParams.get('refresh_token') // ✨ JWT Refresh Token (신규)
      const urlUserId = searchParams.get('userId')           // 유저 ID
      const userName = searchParams.get('userName')          // 유저 이름
      const userEmail = searchParams.get('userEmail')        // 유저 이메일 (선택)
      
      // 레거시 파라미터
      const login = searchParams.get('login')
      const session = searchParams.get('session')

      console.log('[AuthContext] 🔐 JWT 인증 초기화 시작:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasUserId: !!urlUserId,
        currentPath: window.location.pathname
      })

      // Step 2: ✨ JWT 토큰이 URL에 있으면 즉시 저장 (신규 방식)
      if (accessToken && refreshToken && urlUserId && userName) {
        console.log('[AuthContext] ✨ URL에서 JWT 토큰 수신 - localStorage 저장')
        console.log('[AuthContext] 🔑 토큰 정보:', {
          accessTokenLength: accessToken.length,
          refreshTokenLength: refreshToken.length,
          userId: urlUserId,
          userName: decodeURIComponent(userName)
        })
        
        // JWT 토큰 저장
        saveJwtTokens(
          accessToken,
          refreshToken,
          urlUserId,
          decodeURIComponent(userName),
          'user',
          userEmail ? decodeURIComponent(userEmail) : null
        )

        // Sentry 사용자 설정
        try {
          const { setSentryUser } = await import('@/lib/sentry')
          setSentryUser({
            id: urlUserId,
            email: userEmail ? decodeURIComponent(userEmail) : undefined,
            username: decodeURIComponent(userName),
            userType: 'user'
          })
        } catch (e) {
          // Sentry 초기화 실패 시 무시
        }

        // ✅ 보안: URL 파라미터 즉시 제거 (모든 OAuth 관련 파라미터)
        const cleanUrl = window.location.pathname
        console.log('[AuthContext] 🧹 URL 파라미터 제거:', {
          before: window.location.href,
          after: cleanUrl
        })
        window.history.replaceState({}, '', cleanUrl)

        // 인증 상태 업데이트
        setAuthState({
          isLoggedIn: true,
          accessToken: accessToken
        })
        setIsAuthReady(true)
        
        // ✅ 버전 충돌 방지: 강제 새로고침 (한 번만)
        if (!sessionStorage.getItem('jwt_login_refreshed')) {
          sessionStorage.setItem('jwt_login_refreshed', 'true')
          console.log('[AuthContext] 🔄 JWT 로그인 완료 - 페이지 강제 새로고침 (캐시 무효화)')
          // 강제 캐시 무효화를 위해 location.reload(true) 대신 캐시 헤더 추가
          window.location.reload()
        }
        return
      }

      // Step 3: 레거시 로그인 파라미터가 있으면 URL에서 제거하고 경고 (호환성)
      if ((login === 'success' && session && urlUserId) || session) {
        console.warn('[AuthContext] ⚠️ 레거시 세션 파라미터 감지 - 즉시 제거')
        console.warn('[AuthContext] ⚠️ 이 파라미터는 더 이상 사용되지 않습니다. JWT를 사용하세요.')
        
        // URL 파라미터 제거
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
        
        // localStorage에 JWT가 있는지 확인
        const hasStoredToken = !!getAccessToken()
        console.log('[AuthContext] localStorage JWT 확인:', { hasStoredToken })
        
        // JWT가 없으면 로그인 필요
        if (!hasStoredToken) {
          console.error('[AuthContext] ❌ JWT 토큰 없음 - 로그인 페이지로 리다이렉트')
          setAuthState({
            isLoggedIn: false,
            accessToken: null
          })
          setIsAuthReady(true)
          return
        }
      }

      // Step 4: localStorage에서 JWT 세션 체크
      const existingToken = getAccessToken()
      const userType = getUserType()
      const loggedIn = isLoggedIn()

      console.log('[AuthContext] JWT 세션 상태:', {
        hasAccessToken: !!existingToken,
        userType,
        isLoggedIn: loggedIn
      })

      setAuthState({
        isLoggedIn: loggedIn,
        accessToken: existingToken
      })
      setIsAuthReady(true)
    }

    initializeAuth()
  }, [searchParams])

  /**
   * JWT 로그인 처리 (이메일/비밀번호 로그인)
   * AdminLoginPage, SellerLoginPage에서 사용
   */
  const loginWithCredentials = (
    accessToken: string,
    refreshToken: string,
    userId: string,
    userName: string,
    userType: 'user' | 'seller' | 'admin',
    userEmail?: string | null
  ) => {
    console.log('[AuthContext] 🔐 JWT 크레덴셜 로그인 처리:', { userId, userName, userType })

    // JWT 토큰 및 사용자 정보 저장
    saveJwtTokens(accessToken, refreshToken, userId, userName, userType, userEmail)

    // Sentry 사용자 컨텍스트 설정
    try {
      const { setSentryUser } = require('@/lib/sentry')
      setSentryUser({
        id: userId,
        email: userEmail || undefined,
        username: userName,
        userType
      })
    } catch (e) {
      // Sentry 초기화 실패 시 무시
    }

    // 인증 상태 업데이트
    setAuthState({
      isLoggedIn: true,
      accessToken
    })

    console.log('[AuthContext] ✅ JWT 로그인 완료')
  }

  return (
    <AuthContext.Provider
      value={{
        isProcessingLogin,
        isAuthReady,
        isLoggedIn: authState.isLoggedIn,
        accessToken: authState.accessToken,
        loginWithCredentials
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
