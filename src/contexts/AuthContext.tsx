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
      const login = searchParams.get('login')
      const token = searchParams.get('token')        // ✨ JWT 토큰 (신규)
      const refreshToken = searchParams.get('refresh_token')  // ✨ Refresh 토큰 (신규)
      const session = searchParams.get('session')    // 🗑️ 레거시 세션 ID
      const urlUserId = searchParams.get('userId')   // 🗑️ 레거시 유저 ID
      const userName = searchParams.get('userName')  // 🗑️ 레거시 유저 이름

      console.log('[AuthContext] 🔐 JWT 인증 초기화 시작:', {
        hasLoginParams: !!(login && session && urlUserId),
        hasJwtToken: !!token,
        hasRefreshToken: !!refreshToken,
        currentPath: window.location.pathname
      })

      // Step 2: JWT 토큰이 URL에 있으면 저장 (신규 방식)
      if (token && refreshToken && urlUserId && userName) {
        console.log('[AuthContext] ✨ URL에서 JWT 토큰 수신 - localStorage 저장')
        
        // JWT 토큰 저장
        saveJwtTokens(
          token,
          refreshToken,
          urlUserId,
          decodeURIComponent(userName),
          'user',
          searchParams.get('userEmail') || null
        )

        // URL 파라미터 제거
        window.history.replaceState({}, '', window.location.pathname)

        // 인증 상태 업데이트
        setAuthState({
          isLoggedIn: true,
          accessToken: token
        })
        setIsAuthReady(true)
        return
      }

      // Step 3: 레거시 로그인 파라미터가 있으면 URL에서 제거 (JWT는 localStorage에 있음)
      if (login === 'success' && session && urlUserId) {
        console.log('[AuthContext] ℹ️ 레거시 로그인 파라미터 감지 - URL에서 제거')
        
        // URL 파라미터 제거 (JWT는 이미 localStorage에 저장되어 있음)
        window.history.replaceState({}, '', window.location.pathname)
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
