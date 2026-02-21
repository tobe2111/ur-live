import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getSessionToken, logout } from '@/utils/auth'

/**
 * Session Validation Hook
 * 
 * 세션 유효성을 주기적으로 검증하여 만료된 세션을 자동으로 처리합니다.
 * 
 * 기능:
 * - 페이지 로드 시 즉시 세션 검증
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

  useEffect(() => {
    const validateSession = async () => {
      const token = getSessionToken()
      
      // 토큰이 없으면 검증 스킵 (로그인 안 한 상태)
      if (!token) {
        return
      }

      try {
        // 세션 유효성 검증 API 호출
        await api.get('/api/auth/validate')
        
        console.log('[SessionValidation] ✅ 세션 유효함')
      } catch (error: any) {
        // 401 에러: 세션 만료
        if (error.response?.status === 401) {
          console.warn('[SessionValidation] ⚠️ 세션 만료 감지, 자동 로그아웃')
          
          // 현재 페이지를 returnUrl로 저장
          const currentPath = window.location.pathname + window.location.search
          localStorage.setItem('loginReturnUrl', currentPath)
          
          // 로그아웃 처리
          logout()
          
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
          console.warn('[SessionValidation] 세션 검증 실패 (네트워크 오류):', error.message)
        }
      }
    }

    // 초기 검증 (페이지 로드 시)
    validateSession()

    // 5분마다 주기적 검증
    const interval = setInterval(validateSession, 5 * 60 * 1000) // 5분

    // Cleanup
    return () => clearInterval(interval)
  }, [navigate])
}
