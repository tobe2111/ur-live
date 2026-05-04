import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

const TEST_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY || ''
const TEST_REDIRECT_URI = 'https://live.ur-team.com/admin/kakao-test/callback'

export default function AdminKakaoTestCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const err = searchParams.get('error')

    if (err) {
      setError(`카카오 인증 실패: ${err}`)
      return
    }

    if (!code) {
      setError('인증 코드가 없습니다')
      return
    }

    // 카카오 토큰 교환
    exchangeToken(code)
  }, [])

  async function exchangeToken(code: string) {
    try {
      const res = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: TEST_REST_API_KEY,
          redirect_uri: TEST_REDIRECT_URI,
          code,
        }).toString(),
      })

      const data = await res.json() as { access_token?: string; error_description?: string }

      if (data.access_token) {
        localStorage.setItem('kakao_test_token', data.access_token)
        navigate('/admin/kakao-test', { replace: true })
      } else {
        setError(`토큰 교환 실패: ${data.error_description || JSON.stringify(data)}`)
      }
    } catch (err: unknown) {
      const err_ = err as { message?: string }
      setError(`오류: ${err_.message}`)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 font-bold mb-2">인증 실패</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => navigate('/admin/kakao-test')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600">카카오 인증 처리 중...</p>
      </div>
    </div>
  )
}
