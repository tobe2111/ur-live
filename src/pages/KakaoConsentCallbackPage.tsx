import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { safeInternalPath } from '@/utils/safe-internal-path'

/**
 * 카카오 추가 동의 전용 콜백 (talk_calendar 등)
 * 동의 후 토큰을 갱신하고 원래 페이지로 복귀
 */
export default function KakaoConsentCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error || !code) {
      setStatus('error')
      setTimeout(() => {
        if (window.opener) window.close()
        // 🛡️ 2026-04-29: safeInternalPath — /auth/*·/login 자기참조 차단
        else navigate(safeInternalPath(state, '/'), { replace: true })
      }, 1000)
      return
    }

    async function processConsent() {
      try {
        await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/consent/callback`,
        })
        setStatus('done')
      } catch {
        setStatus('error')
      }

      setTimeout(() => {
        if (window.opener) {
          // 🛡️ 2026-04-22: wildcard origin 제거 — phishing 팝업 공격 방어
          // opener 가 같은 origin 일 때만 메시지 전송 (cross-origin 악성 opener 차단)
          try {
            window.opener.postMessage({ type: 'kakao_consent_done' }, window.location.origin)
          } catch {
            // opener 가 다른 origin 이거나 closed — 무시
          }
          window.close()
        } else {
          // 🛡️ 2026-04-29: safeInternalPath — /auth/*·/login 자기참조 차단
          navigate(safeInternalPath(state, '/'), { replace: true })
        }
      }, 500)
    }

    processConsent()
  }, [])

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <p className="text-white text-sm">
        {status === 'processing' ? '동의 처리 중...' :
         status === 'done' ? '완료! 돌아갑니다...' :
         '오류가 발생했습니다'}
      </p>
    </div>
  )
}
