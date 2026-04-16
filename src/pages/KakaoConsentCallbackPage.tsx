import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'

/**
 * 카카오 추가 동의 전용 콜백 (talk_calendar 등)
 * 로그인이 아닌 추가 scope 동의 후 돌아오는 페이지
 * 토큰을 갱신하고 원래 페이지로 복귀
 */
export default function KakaoConsentCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (code) {
      // 서버에 코드 전송 → 토큰 갱신
      api.post('/api/auth/kakao/callback', {
        code,
        redirect_uri: `${window.location.origin}/auth/kakao/consent/callback`,
      }).catch(() => {})
    }

    // 팝업이면 닫기
    if (window.opener) {
      window.close()
      return
    }

    // 팝업이 아니면 원래 페이지로 이동
    const returnUrl = state ? decodeURIComponent(state) : '/'
    setTimeout(() => navigate(returnUrl, { replace: true }), 500)
  }, [])

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <p className="text-white text-sm">동의 처리 중...</p>
    </div>
  )
}
