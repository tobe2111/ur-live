import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import { getAccessToken, getUserType, logout } from '@/utils/auth'
import { isKorea } from '@/config/region'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'

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
 * - 429 에러 방지: interval 중복 생성 방지
 */
export function useSessionValidation() {
  const navigate = useNavigate()
  const location = useLocation()
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  const isAuthReady = useAuth(state => state.isAuthReady)
  // Note: isProcessingLogin is not in Zustand stores, removing this check
  const isProcessingLogin = false

  useEffect(() => {
    let validateTimeout: NodeJS.Timeout | null = null
    let isValidating = false  // 중복 호출 방지 플래그
    
    const validateJwtSession = async () => {
      // 중복 호출 방지
      if (isValidating) {
        console.log('[SessionValidation] ⏸️ 이미 검증 중, 스킵')
        return
      }
      
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

      isValidating = true
      
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
        } else if (error.response?.status === 429) {
          // 5. 429 Too Many Requests: 너무 많은 요청, 조용히 스킵
          console.warn('[SessionValidation] ⚠️ 429 Too Many Requests - 다음 검증까지 대기')
        }
      } finally {
        isValidating = false
      }
    }

    // 6. ✅ interval은 한 번만 생성 (의존성 없음)
    // 인증 준비 완료 후에만 검증 시작
    if (!isAuthReady) {
      console.log('[SessionValidation] ⏸️ 인증 초기화 대기 중')
      return
    }

    // 7. 10분마다 JWT 세션 검증 실행 (5분 → 10분으로 변경하여 429 방지)
    const interval = setInterval(validateJwtSession, 10 * 60 * 1000)

    // 8. 컴포넌트 마운트 시 1회 실행 (10초 지연 - 초기 로딩 완료 대기, 3초 → 10초로 변경)
    validateTimeout = setTimeout(validateJwtSession, 10000)

    return () => {
      clearInterval(interval)
      if (validateTimeout) clearTimeout(validateTimeout)
    }
  }, [isAuthReady]) // ✅ 의존성을 isAuthReady만 포함 (한 번만 실행)
}
