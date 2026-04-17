/**
 * YouTube OAuth Callback Page
 * Handles OAuth redirect and token exchange
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function YouTubeCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    handleCallback()
  }, [])

  async function handleCallback() {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setMessage(`OAuth 인증 실패: ${error}`)
      setTimeout(() => navigate('/seller/live-broadcast'), 3000)
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('인증 코드가 없습니다.')
      setTimeout(() => navigate('/seller/live-broadcast'), 3000)
      return
    }

    try {
      const response = await api.post('/api/youtube/oauth/callback', { code })

      if (response.data.success) {
        setStatus('success')
        setMessage(`YouTube 계정이 연동되었습니다: ${response.data.data.channel.title}`)
        setTimeout(() => navigate('/seller/live-broadcast'), 2000)
      } else {
        throw new Error(response.data.error || 'Unknown error')
      }
    } catch (error: unknown) {
      console.error('OAuth callback error:', error)
      setStatus('error')
      setMessage(error.response?.data?.error || error.message || 'YouTube 연동에 실패했습니다.')
      setTimeout(() => navigate('/seller/live-broadcast'), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
      <div className="apple-card p-8 sm:p-12 text-center max-w-md w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-[#007aff] mx-auto mb-6" />
            <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-3">
              YouTube 계정 연동 중...
            </h2>
            <p className="text-[15px] text-[#6e6e73]">
              잠시만 기다려주세요
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-3">
              연동 완료!
            </h2>
            <p className="text-[15px] text-[#6e6e73] mb-4">
              {message}
            </p>
            <p className="text-[13px] text-[#8e8e93]">
              잠시 후 자동으로 이동합니다...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-3">
              연동 실패
            </h2>
            <p className="text-[15px] text-[#6e6e73] mb-4">
              {message}
            </p>
            <button
              onClick={() => navigate('/seller/live-broadcast')}
              className="px-6 py-3 bg-[#007aff] text-white rounded-lg hover:bg-[#0051d5] transition-colors text-[15px] font-semibold"
            >
              돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
