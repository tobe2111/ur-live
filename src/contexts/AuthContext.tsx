import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { saveUserInfo, isLoggedIn, getSessionToken } from '@/utils/auth'

/**
 * Auth Context - 전역 인증 상태 관리
 * 
 * 목적:
 * - 로그인 파라미터 처리와 세션 검증의 순서를 명확히 보장
 * - 타이밍 이슈로 인한 무한 리디렉션 루프 완전 차단
 * 
 * 상태:
 * - isProcessingLogin: 로그인 파라미터 처리 중 (true일 때 세션 검증 차단)
 * - isAuthReady: 인증 초기화 완료 (true일 때만 앱 렌더링)
 */

interface AuthContextType {
  isProcessingLogin: boolean
  isAuthReady: boolean
  isLoggedIn: boolean
  sessionToken: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const [isProcessingLogin, setIsProcessingLogin] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    sessionToken: null as string | null
  })

  useEffect(() => {
    const initializeAuth = async () => {
      // Step 1: URL 파라미터 체크
      const login = searchParams.get('login')
      const session = searchParams.get('session')
      const urlUserId = searchParams.get('userId')
      const userName = searchParams.get('userName')

      console.log('[AuthContext] 🔐 인증 초기화 시작:', {
        hasLoginParams: !!(login && session && urlUserId),
        currentPath: window.location.pathname
      })

      // Step 2: 로그인 파라미터가 있으면 처리
      if (login === 'success' && session && urlUserId) {
        setIsProcessingLogin(true) // ✅ 세션 검증 차단
        
        console.log('[AuthContext] ✅ 로그인 파라미터 발견 - 처리 시작')

        try {
          // localStorage에 저장
          saveUserInfo(
            urlUserId,
            userName ? decodeURIComponent(userName) : '사용자',
            session
          )

          console.log('[AuthContext] ✅ 로그인 정보 저장 완료:', {
            userId: urlUserId,
            userName: userName ? decodeURIComponent(userName) : '사용자',
            hasSession: !!session
          })

          // URL에서 파라미터 제거 (깔끔한 URL)
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
          console.log('[AuthContext] ✅ URL 파라미터 제거 완료:', cleanUrl)

          // 인증 상태 업데이트
          setAuthState({
            isLoggedIn: true,
            sessionToken: session
          })
        } catch (error) {
          console.error('[AuthContext] ❌ 로그인 파라미터 처리 실패:', error)
        } finally {
          setIsProcessingLogin(false) // ✅ 세션 검증 허용
          setIsAuthReady(true) // ✅ 앱 렌더링 허용
          console.log('[AuthContext] ✅ 로그인 파라미터 처리 완료')
        }
      } else {
        // 로그인 파라미터가 없으면 기존 세션 체크
        const token = getSessionToken()
        setAuthState({
          isLoggedIn: isLoggedIn(),
          sessionToken: token
        })
        setIsAuthReady(true)
        console.log('[AuthContext] ℹ️ 로그인 파라미터 없음 (기존 세션 사용)')
      }
    }

    initializeAuth()
  }, [searchParams])

  return (
    <AuthContext.Provider 
      value={{ 
        isProcessingLogin, 
        isAuthReady,
        isLoggedIn: authState.isLoggedIn,
        sessionToken: authState.sessionToken
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
