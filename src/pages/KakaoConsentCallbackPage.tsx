import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'

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
        else navigate(state ? decodeURIComponent(state) : '/', { replace: true })
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
          window.opener.postMessage({ type: 'kakao_consent_done' }, '*')
          window.close()
        } else {
          const returnUrl = state ? decodeURIComponent(state) : '/'
          navigate(returnUrl, { replace: true })
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
