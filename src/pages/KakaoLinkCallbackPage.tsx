/**
 * KakaoLinkCallbackPage — 카카오 계정 연동용 OAuth 콜백
 *
 * 셀러/에이전시 대시보드에서 "카카오 연동" 클릭 시 팝업으로 이 페이지를 열고,
 * 카카오 OAuth 완료 후 opener(대시보드 창) 에게 postMessage 로 code 전달.
 * 실제 link-kakao API 호출은 opener 에서 (셀러 JWT 가 거기 있음).
 */

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function KakaoLinkCallbackPage() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (typeof window === 'undefined' || !window.opener) return

    try {
      window.opener.postMessage(
        {
          type: 'kakao_link_result',
          code: code || null,
          error: error || null,
        },
        window.location.origin
      )
    } catch { /* opener closed */ }

    setTimeout(() => { try { window.close() } catch { /* ignore */ } }, 300)
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <p className="text-white text-sm">처리 중... 잠시 기다려주세요.</p>
    </div>
  )
}
