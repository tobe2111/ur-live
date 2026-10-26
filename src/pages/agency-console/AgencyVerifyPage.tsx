import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { AgencyAuthShell } from './AgencyAuthShell'
import { toast } from '@/hooks/useToast'
import { agencyMyPath, agencyRequest, saveAgencySession, type AgencyLoginPayload } from './agency-api'

/**
 * 가입 인증 링크의 착지점. 링크는 **한 번만** 쓸 수 있으므로 요청도 한 번만 보낸다 —
 * React 개발 모드의 effect 두 번 실행이 두 번째 요청을 "만료된 링크"로 만들지 않게 ref 로 막는다.
 *
 * 🟡 `?kind=move` — 카카오로 만든 에이전시를 이메일 계정으로 옮기는 확인 링크(2026-10-26). 같은 착지점을 쓴다.
 */
export default function AgencyVerifyPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const sent = useRef(false)
  const [error, setError] = useState('')
  const move = params.get('kind') === 'move'

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    const token = params.get('token') || ''
    if (!token) { setError('링크가 올바르지 않아요.'); return }
    agencyRequest<AgencyLoginPayload>(move ? '/verify-move' : '/verify', { method: 'POST', body: { token }, auth: false }).then((r) => {
      if (!r.ok) { setError(r.data.error || '링크가 만료됐거나 이미 사용됐어요.'); return }
      saveAgencySession(r.data, true)
      if (move) {
        toast.success('이메일 계정으로 옮겼어요. 이제 직원을 초대할 수 있어요.')
        navigate(agencyMyPath(null), { replace: true })
        return
      }
      navigate('/agency?welcome=1', { replace: true })
    })
  }, [params, navigate, move])

  if (!error) return <BrandLoader fullScreen forceLight label={move ? '이메일 계정으로 옮기는 중이에요' : '에이전시를 만드는 중이에요'} />
  return (
    <AgencyAuthShell title="링크를 쓸 수 없어요" footer={<Link to="/agency/login" className="font-semibold text-gray-700">로그인으로</Link>}>
      <SEO title="에이전시 인증 - 유어딜" description="유어딜 에이전시 이메일 인증" url="/agency/verify" noindex />
      <p className="text-[15px] text-gray-700">{error}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
        이미 인증했다면 바로 로그인하면 돼요. 아니라면 <Link to="/agency/signup" className="font-semibold text-brand-text">같은 이메일로 다시 가입</Link>해
        새 인증 메일을 받아 주세요.
      </p>
    </AgencyAuthShell>
  )
}
