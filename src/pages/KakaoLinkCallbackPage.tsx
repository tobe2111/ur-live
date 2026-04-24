/**
 * KakaoLinkCallbackPage — 카카오 계정 연동용 OAuth 콜백
 *
 * 셀러/에이전시 대시보드에서 "카카오 연동" 클릭 시 팝업으로 이 페이지를 열고,
 * 팝업 내에서 서버가 /auth/kakao/sync/callback 로 전체 카카오 로그인을 수행.
 * 완료 후엔 redirect=/auth/kakao/link/callback 로 돌아오는데, 이때 URL 에
 *   ?login=success&userId=XXX&userName=YYY
 * 가 붙어있음 (code 는 이미 서버가 소비했고 세션 쿠키가 세팅돼 있음).
 *
 * 이 페이지는 opener(대시보드 창) 에게 postMessage 로 결과 전달.
 * 실제 link 는 opener 가 자신의 셀러/에이전시 JWT 로 /link-kakao 호출 (session mode).
 */

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function KakaoLinkCallbackPage() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const loginStatus = searchParams.get('login')
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName') || ''
    const profileImage = searchParams.get('profileImage') || ''
    // 구버전 호환 — code 플로우 (현재는 session 플로우가 기본)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (typeof window === 'undefined' || !window.opener) return

    const success = !error && (loginStatus === 'success' || !!code)

    try {
      window.opener.postMessage(
        {
          type: 'kakao_link_result',
          success,
          userId: userId ? Number(userId) : null,
          userName,
          profileImage,
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
