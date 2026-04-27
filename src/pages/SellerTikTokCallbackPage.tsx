import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

/**
 * TikTok OAuth callback 처리 페이지.
 * URL: /seller/tiktok-callback?code=...&state=...
 *
 * 1. URL params 에서 code/state 추출
 * 2. 백엔드 POST /api/seller/tiktok/callback 호출
 * 3. 성공 시 /seller/profile 로 리다이렉트
 *
 * 작성: 2026-04-26 (T1)
 */
export default function SellerTikTokCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [profile, setProfile] = useState<{ username?: string; display_name?: string } | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setErrorMsg(searchParams.get('error_description') || error)
      return
    }
    if (!code || !state) {
      setStatus('error')
      setErrorMsg('인증 파라미터 누락')
      return
    }

    const token = localStorage.getItem('seller_token')
    api.post('/api/seller/tiktok/callback', { code, state }, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.data?.success) {
          setProfile(r.data.data)
          setStatus('success')
          setTimeout(() => navigate('/seller/profile'), 2000)
        } else {
          setStatus('error')
          setErrorMsg(r.data?.error || '연동 실패')
        }
      })
      .catch((e: any) => {
        setStatus('error')
        setErrorMsg(e?.response?.data?.error || e?.message || '연동 실패')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm">
        {status === 'pending' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-center text-gray-900">TikTok 연동 중...</h2>
            <p className="text-sm text-gray-500 text-center mt-1">잠시만 기다려주세요</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-center text-gray-900">TikTok 연동 완료</h2>
            {profile?.username && (
              <p className="text-sm text-gray-700 text-center mt-2 font-bold">@{profile.username}</p>
            )}
            <p className="text-xs text-gray-500 text-center mt-1">잠시 후 프로필로 이동...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-center text-gray-900">연동 실패</h2>
            <p className="text-sm text-red-600 text-center mt-2">{errorMsg}</p>
            <button
              onClick={() => navigate('/seller/profile')}
              className="w-full mt-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold"
            >
              프로필로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
