import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, LogIn } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'

/**
 * 벤더사 팀 멤버 초대 수락 페이지 (`/agency/accept-invite?token=...`).
 *   AgencyMembersPage 가 이 URL 을 생성해 초대장 링크로 발송하는데 라우트가 없어 404 였음(초대 플로우 단절).
 *   흐름: token 파싱 → 벤더사 로그인 필요 시 로그인으로(returnUrl 로 복귀) → POST /accept → 완료.
 */
export default function AgencyAcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [state, setState] = useState<'idle' | 'accepting' | 'success' | 'error' | 'need_login'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('유효하지 않은 초대 링크입니다. (토큰 없음)')
      return
    }
    const agencyToken = localStorage.getItem('agency_token')
    if (!agencyToken) {
      setState('need_login')
      return
    }
    setState('accepting')
    api.post('/api/agency/members/accept', { invite_token: token })
      .then(() => {
        setState('success')
        setMessage('팀 멤버로 등록되었습니다.')
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setState('error')
        setMessage(e.response?.data?.error || '초대 수락에 실패했습니다. 초대받은 이메일로 로그인했는지 확인해주세요.')
      })
  }, [token])

  function goLogin() {
    const returnUrl = `/agency/accept-invite?token=${encodeURIComponent(token)}`
    navigate(`/agency/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-50 flex items-center justify-center p-4">
      <SEO title="팀 초대 수락 - 유어딜" description="벤더사 팀 멤버 초대 수락" url="/agency/accept-invite" noindex />
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm text-center">
        <div className="flex justify-center mb-5">
          <UrDealLogo size={20} />
        </div>

        {(state === 'idle' || state === 'accepting') && (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-600">초대를 확인하는 중...</p>
          </>
        )}

        {state === 'need_login' && (
          <>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-indigo-100">
              <LogIn className="w-7 h-7 text-indigo-600" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">팀 초대를 받으셨습니다</h1>
            <p className="text-sm text-gray-500 mb-5">
              초대를 수락하려면 <strong>초대받은 이메일</strong>의 벤더사 계정으로 로그인해주세요.
            </p>
            <button
              onClick={goLogin}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              벤더사 로그인
            </button>
            <p className="text-xs text-gray-400 mt-3">
              계정이 없으신가요? <Link to="/agency/register" className="text-indigo-600 font-medium hover:underline">벤더사 등록</Link>
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-emerald-100">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">초대 수락 완료</h1>
            <p className="text-sm text-gray-500 mb-5">{message}</p>
            <button
              onClick={() => navigate('/agency', { replace: true })}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              대시보드로 이동
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-100">
              <XCircle className="w-7 h-7 text-red-600" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">초대를 수락할 수 없습니다</h1>
            <p className="text-sm text-gray-500 mb-5">{message}</p>
            <button
              onClick={goLogin}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              다른 계정으로 로그인
            </button>
          </>
        )}
      </div>
    </div>
  )
}
