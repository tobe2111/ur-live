import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getSessionToken, logout } from '@/utils/auth'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Session Validation Hook
 * 
 * 세션 유효성을 주기적으로 검증하여 만료된 세션을 자동으로 처리합니다.
 * 
 * ✅ 영구 해결 (무한 루프 완전 차단):
 * - AuthContext의 isProcessingLogin 상태를 감시
 * - 로그인 파라미터 처리 중일 때는 세션 검증 완전 차단
 * - 상태 기반 제어로 타이밍 이슈 근본 해결
 * 
 * 기능:
 * - 페이지 로드 시 세션 검증 (로그인 처리 완료 후)
 * - 5분마다 자동 세션 검증
 * - 세션 만료 시 자동 로그아웃 및 로그인 페이지 이동
 * - 현재 페이지를 returnUrl로 저장
 * 
 * 사용 예시:
 * ```typescript
 * function App() {
 *   useSessionValidation()
 *   return <Router>...</Router>
 * }
 * ```
 */
export function useSessionValidation() {
  const navigate = useNavigate()
  const { isProcessingLogin, isAuthReady } = useAuth()

  useEffect(() => {
    // ⚠️ 로그인 파라미터 처리 중이거나 인증 초기화 전이면 세션 검증 스킵
    if (isProcessingLogin || !isAuthReady) {
      console.log('[SessionValidation] ⏳ 인증 초기화 대기 중, 세션 검증 스킵')
      return
    }

    const validateSession = async () => {
      // JWT 토큰 확인 (access_token)
      const accessToken = localStorage.getItem('access_token')
      
      // 토큰이 없으면 검증 스킵 (로그인 안 한 상태)
      if (!accessToken) {
        return
      }

      try {
        // JWT 세션 유효성 검증 (API client가 자동으로 Authorization 헤더 추가)
        await api.get('/api/auth/validate')
        
        console.log('[SessionValidation] ✅ JWT 세션 유효함')
      } catch (error: any) {
        // 401 에러: JWT 토큰 만료 (Refresh token도 만료됨)
        if (error.response?.status === 401) {
          console.warn('[SessionValidation] ⚠️ JWT 토큰 만료 감지, 자동 로그아웃')
          
          // 현재 페이지를 returnUrl로 저장
          const currentPath = window.location.pathname + window.location.search
          localStorage.setItem('loginReturnUrl', currentPath)
          
          // JWT 토큰 제거
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user_type')
          localStorage.removeItem('user_id')
          
          // 로그인 페이지로 이동 (페이지 타입에 따라 분기)
          if (currentPath.includes('/seller')) {
            navigate('/seller/login?returnUrl=' + encodeURIComponent(currentPath))
          } else if (currentPath.includes('/admin')) {
            navigate('/admin/login?returnUrl=' + encodeURIComponent(currentPath))
          } else {
            navigate('/login?returnUrl=' + encodeURIComponent(currentPath))
          }
        } else {
          // 네트워크 오류 등은 무시 (서버 일시적 문제일 수 있음)
          console.warn('[SessionValidation] JWT 세션 검증 실패 (네트워크 오류):', error.message)
        }
      }
    }

    // 초기 검증 (인증 초기화 완료 후 즉시 실행)
    validateSession()

    // 5분마다 주기적 검증
    const interval = setInterval(validateSession, 5 * 60 * 1000) // 5분

    // Cleanup
    return () => clearInterval(interval)
  }, [navigate, isProcessingLogin, isAuthReady]) // ✅ 상태 변화에 반응
}
