import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import { getAccessToken, getUserType, logout } from '@/utils/auth'
import { useAuth } from '@/contexts/AuthContext'

/**
 * JWT 세션 검증 훅
 * 
 * - 5분마다 JWT 액세스 토큰 유효성 검증
 * - 401 오류 시 로그아웃 후 로그인 페이지로 리다이렉트
 * - 토큰 자동 갱신은 api.ts의 응답 인터셉터에서 처리
 * 
 * JWT 전환 후 변경사항:
 * - sessionToken → accessToken 검증
 * - /api/auth/validate → JWT 기반 검증
 */
export function useSessionValidation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isProcessingLogin, isAuthReady } = useAuth()

  useEffect(() => {
    const validateJwtSession = async () => {
      // 1. 로그인 처리 중이거나 인증 초기화 전에는 검증 스킵
      if (isProcessingLogin || !isAuthReady) {
        console.log('[SessionValidation] ⏳ 인증 초기화 대기 중, JWT 세션 검증 스킵')
        return
      }

      // 2. JWT 토큰이 없으면 검증 불필요
      const accessToken = getAccessToken()
      if (!accessToken) {
        console.log('[SessionValidation] ℹ️ JWT 액세스 토큰 없음, 검증 스킵')
        return
      }

      try {
        // 3. JWT 토큰 검증 (백엔드 /api/auth/validate 엔드포인트)
        const response = await api.get('/api/auth/validate')
        
        if (response.data.valid) {
          console.log('[SessionValidation] ✅ JWT 토큰 유효:', response.data.user)
        }
      } catch (error: any) {
        console.error('[SessionValidation] ❌ JWT 검증 실패:', error)

        // 4. 401 Unauthorized: JWT 토큰 만료 또는 무효
        if (error.response?.status === 401) {
          console.warn('[SessionValidation] 🚪 JWT 토큰 만료/무효 - 로그아웃 처리')

          // 현재 페이지 URL 저장 (로그인 후 돌아오기 위해)
          const returnUrl = location.pathname + location.search
          localStorage.setItem('loginReturnUrl', returnUrl)

          // 모든 인증 정보 삭제
          logout()

          // 사용자 타입에 따라 로그인 페이지 결정
          const userType = getUserType()
          const loginPath = userType === 'seller' 
            ? '/seller/login' 
            : userType === 'admin' 
            ? '/admin/login' 
            : '/login'

          // 로그인 페이지로 리다이렉트 (returnUrl 포함)
          navigate(`${loginPath}?returnUrl=${encodeURIComponent(returnUrl)}`)
        }
      }
    }

    // 5. 5분마다 JWT 세션 검증 실행
    const interval = setInterval(validateJwtSession, 5 * 60 * 1000)

    // 6. 컴포넌트 마운트 시 1회 실행
    validateJwtSession()

    return () => clearInterval(interval)
  }, [navigate, location, isProcessingLogin, isAuthReady])
}
