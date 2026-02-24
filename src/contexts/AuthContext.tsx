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
      // Step 1: URL 파라미터 체크 (카카오 로그인)
      const login = searchParams.get('login')
      const session = searchParams.get('session')
      const urlUserId = searchParams.get('userId')
      const userName = searchParams.get('userName')

      console.log('[AuthContext] 🔐 JWT 인증 초기화 시작:', {
        hasLoginParams: !!(login && session && urlUserId),
        currentPath: window.location.pathname
      })

      // Step 2: 로그인 파라미터가 있으면 처리 (카카오 OAuth 콜백)
      if (login === 'success' && session && urlUserId) {
        setIsProcessingLogin(true)
        
        console.warn('[AuthContext] ⚠️ 카카오 OAuth 콜백 감지 - 레거시 세션 ID는 JWT로 사용 불가')
        console.warn('[AuthContext] → 백엔드에서 JWT 발급 필요. 임시로 로그인 페이지로 리다이렉트')

        // URL 파라미터 제거
        window.history.replaceState({}, '', window.location.pathname)
        
        // 로그인 페이지로 리다이렉트 (카카오 로그인 재시도)
        setAuthState({
          isLoggedIn: false,
          accessToken: null
        })
        setIsProcessingLogin(false)
        setIsAuthReady(true)
      } else {
        // Step 3: URL 파라미터 없으면 기존 JWT 세션 체크
        console.log('[AuthContext] ℹ️ 로그인 파라미터 없음 (기존 JWT 세션 사용)')

        const token = getAccessToken()
        const userType = getUserType()
        const loggedIn = isLoggedIn()

        console.log('[AuthContext] JWT 세션 상태:', {
          hasAccessToken: !!token,
          userType,
          isLoggedIn: loggedIn
        })

        setAuthState({
          isLoggedIn: loggedIn,
          accessToken: token
        })
        setIsAuthReady(true)
      }
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
