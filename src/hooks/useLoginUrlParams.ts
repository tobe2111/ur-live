/**
 * @deprecated Firebase 전환 후 이 훅은 더 이상 사용하지 않습니다.
 * 
 * ✅ 대신 사용: firebase_token 파라미터 직접 처리
 * 
 * 예시:
 * ```typescript
 * const [searchParams] = useSearchParams()
 * const firebaseToken = searchParams.get('firebase_token')
 * 
 * if (firebaseToken) {
 *   await loginWithFirebaseToken(firebaseToken)
 * }
 * ```
 * 
 * 이유:
 * - JWT 세션 방식 → Firebase Custom Token 방식으로 전환
 * - URL 파라미터 로그인 로직 변경 (session, userId → firebase_token)
 * - 각 페이지별 컨텍스트에 맞게 직접 처리하는 것이 더 명확
 * 
 * TODO: 모든 사용처 제거 후 이 파일 삭제
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * @deprecated 사용하지 마세요. firebase_token 파라미터를 직접 처리하세요.
 */
export function useLoginUrlParams() {
  const [searchParams] = useSearchParams()
  const [isProcessed, setIsProcessed] = useState(false)

  useEffect(() => {
    console.warn('[useLoginUrlParams] ⚠️ DEPRECATED: 이 훅은 더 이상 사용하지 마세요!')
    console.warn('[useLoginUrlParams] ✅ 대신: firebase_token 파라미터를 직접 처리하세요')
    
    // Legacy parameter check (for warning purposes only)
    const login = searchParams.get('login')
    const session = searchParams.get('session')
    const urlUserId = searchParams.get('userId')

    if (login === 'success' && session && urlUserId) {
      console.error('[useLoginUrlParams] ❌ LEGACY LOGIN DETECTED!')
      console.error('[useLoginUrlParams] 레거시 로그인 방식이 감지되었습니다.')
      console.error('[useLoginUrlParams] Firebase Custom Token 방식으로 전환하세요.')
    }

    // Mark as processed
    setIsProcessed(true)
  }, [searchParams])

  return { isProcessed }
}
