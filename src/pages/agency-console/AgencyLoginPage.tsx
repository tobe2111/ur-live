import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import { AgencyAuthShell, Field, FormError, inputCls, primaryBtnCls } from './AgencyAuthShell'
import { AgencyIntro } from './AgencyIntro'
import { agencyRequest, safeAgencyReturn, saveAgencySession, type AgencyLoginPayload } from './agency-api'

/** 안 A · Login2 — 에이전시 로그인(이메일 전용). */
export default function AgencyLoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unverified, setUnverified] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setUnverified(false)
    setBusy(true)
    const r = await agencyRequest<AgencyLoginPayload>('/login', { method: 'POST', body: { email, password }, auth: false })
    setBusy(false)
    if (!r.ok) {
      setError(r.data.error || '로그인하지 못했어요.')
      setUnverified(r.data.code === 'EMAIL_NOT_VERIFIED')
      return
    }
    saveAgencySession(r.data, remember)
    navigate(safeAgencyReturn(params.get('returnUrl')), { replace: true })
  }

  return (
    <AgencyAuthShell
      title="에이전시 로그인"
      aside={<AgencyIntro />}
      footer={
        <div className="flex flex-col gap-3">
          <p>
            처음이에요 · <Link to="/agency/signup" className="font-medium text-brand-text hover:underline underline-offset-4">에이전시 만들기</Link>
          </p>
          <p>
            손님으로 이용하시려면 {/* login-return-ok: 손님 로그인 뒤 에이전시 로그인으로 되돌아오면 안 된다 */}<Link to="/login" className="font-medium text-gray-700 hover:underline underline-offset-4">카카오 로그인</Link>
          </p>
        </div>
      }
    >
      <SEO title="에이전시 로그인 - 유어딜" description="유어딜 에이전시 계정으로 로그인" url="/agency/login" noindex />
      <form onSubmit={submit} className="flex flex-col gap-4">
        {params.get('reset') === '1' && (
          <p className="text-[13px] font-medium text-brand-text">비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.</p>
        )}
        <Field label="업무용 이메일">
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={busy} placeholder="name@company.com" className={inputCls} />
        </Field>
        <Field label="비밀번호">
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={busy} className={inputCls} />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-gray-600">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#1C69EF]" />
          이 컴퓨터에서 로그인 유지
        </label>
        <FormError message={error} />
        {unverified && (
          <p className="text-[13px] text-gray-600">
            인증 메일이 안 보이면 <Link to="/agency/signup" className="font-medium text-brand-text">같은 이메일로 다시 가입</Link>하면 새 메일을 보내 드려요.
          </p>
        )}
        <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? '확인하는 중…' : '로그인'}</button>
        <div className="flex flex-col items-center gap-2 text-center">
          <Link to="/agency/reset" className="text-[13px] font-medium text-gray-600 hover:underline underline-offset-4">비밀번호 찾기</Link>
          <span className="text-[12px] text-gray-500">초대 메일을 받았다면 메일의 [합류하기] 버튼으로 들어와 주세요.</span>
        </div>
      </form>
    </AgencyAuthShell>
  )
}
