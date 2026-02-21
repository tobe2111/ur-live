/**
 * 로그인 URL 파라미터 처리 Hook
 * 
 * 모든 페이지에서 일관되게 URL 파라미터(?login=success&session=...&userId=...)를 
 * 읽고 localStorage에 저장합니다.
 * 
 * 사용법:
 * ```typescript
 * const { isProcessed } = useLoginUrlParams()
 * 
 * // isProcessed가 true가 될 때까지 로그인 체크 지연
 * if (!isProcessed) return
 * ```
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { saveUserInfo } from '@/utils/auth'

export function useLoginUrlParams() {
  const [searchParams] = useSearchParams()
  const [isProcessed, setIsProcessed] = useState(false)

  useEffect(() => {
    const login = searchParams.get('login')
    const session = searchParams.get('session')
    const urlUserId = searchParams.get('userId')
    const userName = searchParams.get('userName')

    console.log('[useLoginUrlParams] 🔐 URL 파라미터 체크:', {
      login,
      hasSession: !!session,
      urlUserId,
      hasUserName: !!userName
    })

    if (login === 'success' && session && urlUserId) {
      console.log('[useLoginUrlParams] ✅ 로그인 성공 파라미터 발견 - localStorage 저장 시작')

      // localStorage에 저장
      saveUserInfo(
        urlUserId,
        userName ? decodeURIComponent(userName) : '사용자',
        session
      )

      console.log('[useLoginUrlParams] ✅ 로그인 정보 저장 완료:', {
        userId: urlUserId,
        userName: userName ? decodeURIComponent(userName) : '사용자',
        hasSession: !!session
      })

      // URL에서 파라미터 제거 (깔끔한 URL)
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      console.log('[useLoginUrlParams] ✅ URL 파라미터 제거 완료:', cleanUrl)
    } else {
      console.log('[useLoginUrlParams] ℹ️ 로그인 파라미터 없음 (정상)')
    }

    // ✅ URL 파라미터 처리 완료 표시 (로그인 정보가 있든 없든)
    setIsProcessed(true)
  }, [searchParams])

  return { isProcessed }
}
