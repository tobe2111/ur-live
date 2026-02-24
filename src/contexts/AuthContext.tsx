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
        setIsProcessingLogin(true) // ✅ 세션 검증 차단
        
        console.log('[AuthContext] ✅ 카카오 로그인 파라미터 발견 - JWT 처리 시작')

        try {
          // JWT 전환 후: session을 accessToken으로 처리 (카카오 콜백에서 제공)
          // refreshToken은 카카오 콜백에서 제공되지 않으므로 임시로 빈 문자열 처리
          // (실제 서비스에서는 카카오 로그인 후 백엔드에서 JWT 발급 필요)
          const tempRefreshToken = session // 카카오 콜백에서는 refreshToken 미제공
          
          saveJwtTokens(
            session, // accessToken
            tempRefreshToken, // refreshToken (임시)
            urlUserId,
            userName ? decodeURIComponent(userName) : '사용자',
            'user', // 카카오 로그인은 user 타입
            null // userEmail (카카오 콜백에서 미제공)
          )

          console.log('[AuthContext] ✅ JWT 로그인 정보 저장 완료:', {
            userId: urlUserId,
            userName: userName ? decodeURIComponent(userName) : '사용자',
            hasAccessToken: !!session
          })

          // URL에서 파라미터 제거 (깔끔한 URL)
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
          console.log('[AuthContext] ✅ URL 파라미터 제거 완료:', cleanUrl)

          // 인증 상태 업데이트
          setAuthState({
            isLoggedIn: true,
            accessToken: session
          })
        } catch (error) {
          console.error('[AuthContext] ❌ JWT 로그인 파라미터 처리 실패:', error)
          setAuthState({
            isLoggedIn: false,
            accessToken: null
          })
        } finally {
          setIsProcessingLogin(false)
          setIsAuthReady(true)
        }
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
