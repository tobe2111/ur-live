import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { passwordRuleChecklist, validatePasswordComplexity } from '@/shared/password-policy'
import { AgencyAuthShell, Field, FormError, PasswordRules, inputCls, primaryBtnCls } from './AgencyAuthShell'
import { agencyRequest, saveAgencySession, type AgencyLoginPayload } from './agency-api'

/** 안 A · Login6 — 초대 메일로 들어온 직원이 이름·비밀번호를 정하고 합류한다. */
export default function AgencyInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [lookup, setLookup] = useState<{ email: string; agencyName: string } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setLookupError('초대 링크가 올바르지 않아요.'); return }
    let alive = true
    agencyRequest<{ email: string; agencyName: string }>(`/invite/lookup?token=${encodeURIComponent(token)}`, { auth: false }).then((r) => {
      if (!alive) return
      if (!r.ok) { setLookupError(r.data.error || '초대 링크가 만료됐거나 이미 사용됐어요.'); return }
      setLookup({ email: r.data.email, agencyName: r.data.agencyName })
    })
    return () => { alive = false }
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    const pw = validatePasswordComplexity(password)
    if (!pw.ok) { setError(pw.error); return }
    setBusy(true)
    const r = await agencyRequest<AgencyLoginPayload>('/invite/accept', { method: 'POST', auth: false, body: { token, name, password } })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '합류하지 못했어요.'); return }
    saveAgencySession(r.data, true)
    navigate('/agency', { replace: true })
  }

  if (lookupError) {
    return (
      <AgencyAuthShell title="초대 링크를 쓸 수 없어요" footer={<Link to="/agency/login" className="font-semibold text-gray-700">로그인으로</Link>}>
        <SEO title="에이전시 합류 - 유어딜" description="유어딜 에이전시 직원 합류" url="/agency/invite" noindex />
        <p className="text-[15px] text-gray-700">{lookupError}</p>
        <p className="mt-3 text-[13px] text-gray-500">초대한 관리자에게 메일을 다시 보내 달라고 해 주세요.</p>
      </AgencyAuthShell>
    )
  }
  if (!lookup) return <BrandLoader fullScreen forceLight />

  return (
    <AgencyAuthShell
      title={`${lookup.agencyName}에 합류`}
      lead="이 에이전시가 맡은 매장을 함께 운영할 수 있어요. 정산과 직원 관리는 관리자만 해요."
      footer={<p>초대 링크는 7일 뒤 만료돼요. 관리자가 언제든 내보낼 수 있어요.</p>}
    >
      <SEO title="에이전시 합류 - 유어딜" description="유어딜 에이전시 직원 합류" url="/agency/invite" noindex />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="로그인 아이디">
          <input type="email" value={lookup.email} readOnly disabled autoComplete="username" className={inputCls} />
        </Field>
        <Field label="이름" hint="에이전시 안에서 서로 알아볼 이름이에요.">
          <input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className={inputCls} />
        </Field>
        <Field label="비밀번호 정하기">
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            className={inputCls} />
          <PasswordRules rules={passwordRuleChecklist(password)} />
        </Field>
        <FormError message={error} />
        <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? '합류하는 중…' : '합류하고 시작하기'}</button>
      </form>
    </AgencyAuthShell>
  )
}
