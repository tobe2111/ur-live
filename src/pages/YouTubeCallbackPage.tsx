/**
 * YouTube OAuth Callback Page
 * Handles OAuth redirect and token exchange
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, CheckCircle2, AlertCircle, Youtube, Radio, RefreshCw } from 'lucide-react'

const LOADING_STEPS = [
  'Google 인증 확인 중',
  '채널 정보 가져오는 중',
  '계정 연동 처리 중',
]

function ConnectDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  )
}

export default function YouTubeCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  const calledRef = useRef(false)

  useEffect(() => {
    if (status !== 'loading') return
    const t1 = setTimeout(() => setLoadingStep(1), 700)
    const t2 = setTimeout(() => setLoadingStep(2), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [status])

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true
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
        setMessage(`${response.data.data.channel.title}`)
        // 🛡️ 2026-05-11: 재연동 직후 stale 캐시 (token_expired=true) 가 화면에 잠시 깜빡이는
        //   현상 제거 — OAuth 성공 시 캐시 무효화 후 페이지로 이동.
        try { localStorage.removeItem('yt_channels_cache_v1') } catch { /* ignore */ }
        setTimeout(() => navigate('/seller/live-broadcast'), 2000)
      } else {
        throw new Error(response.data.error || 'Unknown error')
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
      if (import.meta.env.DEV) console.error('OAuth callback error:', error)
      setStatus('error')
      setMessage(error_.response?.data?.error || error_.message || 'YouTube 연동에 실패했습니다.')
      setTimeout(() => navigate('/seller/live-broadcast'), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="apple-card p-8 sm:p-10 text-center max-w-sm w-full">

        {/* ── 로딩 ── */}
        {status === 'loading' && (
          <div className="space-y-8">
            {/* 브랜드 플로우 */}
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                <span className="text-[22px] font-black" style={{ color: '#4285F4' }}>G</span>
              </div>
              <ConnectDots />
              <div className="w-12 h-12 rounded-2xl bg-[#007aff] flex items-center justify-center shadow-sm">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <ConnectDots />
              <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-sm">
                <Youtube className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* 타이틀 */}
            <div>
              <h2 className="text-[20px] font-bold text-[#1d1d1f] mb-1.5">
                YouTube 계정 연동 중
              </h2>
              <p className="text-[13px] text-[#8e8e93]">잠시만 기다려주세요</p>
            </div>

            {/* 진행 단계 */}
            <div className="space-y-3 text-left">
              {LOADING_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-opacity duration-500 ${
                    i <= loadingStep ? 'opacity-100' : 'opacity-25'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {i < loadingStep ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : i === loadingStep ? (
                      <Loader2 className="w-4 h-4 text-[#007aff] animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-gray-200 block" />
                    )}
                  </div>
                  {/* 🛡️ 2026-05-14: 진행 안 한 단계 text-[#c7c7cc] (RGB 199) 너무 흐림 → 가독성 보강 (gray-500). */}
                  <span className={`text-[14px] transition-colors duration-300 ${
                    i < loadingStep
                      ? 'text-gray-500 line-through decoration-gray-400'
                      : i === loadingStep
                      ? 'text-[#1d1d1f] font-medium'
                      : 'text-gray-500'
                  }`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 성공 ── */}
        {status === 'success' && (
          <div className="space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center shadow-sm">
                <Youtube className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-[#1d1d1f] mb-1">연동 완료!</h2>
              <p className="text-[15px] font-medium text-[#1d1d1f]">{message}</p>
              <p className="text-[13px] text-[#8e8e93] mt-2">잠시 후 자동으로 이동합니다</p>
            </div>
          </div>
        )}

        {/* ── 실패 ── */}
        {status === 'error' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-[#1d1d1f] mb-2">연동 실패</h2>
              <p className="text-[13px] text-[#6e6e73] bg-gray-50 rounded-xl px-4 py-3 text-left break-all">
                {message}
              </p>
            </div>
            <button
              onClick={() => navigate('/seller/live-broadcast')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#007aff] text-white rounded-xl hover:bg-[#0051d5] transition-colors text-[15px] font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              다시 시도하기
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
