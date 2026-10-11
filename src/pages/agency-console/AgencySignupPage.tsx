import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import { passwordRuleChecklist, validatePasswordComplexity } from '@/shared/password-policy'
import { AgencyAuthShell, Field, FormError, PasswordRules, inputCls, primaryBtnCls } from './AgencyAuthShell'
import { agencyRequest } from './agency-api'

type Kind = 'business' | 'individual'

/** 안 A · Login5 — 에이전시 만들기. 인증 메일의 링크를 눌러야 에이전시가 생긴다. */
export default function AgencySignupPage() {
  const [kind, setKind] = useState<Kind>('business')
  const [name, setName] = useState('')
  const [bizNo, setBizNo] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    const pw = validatePasswordComplexity(password)
    if (!pw.ok) { setError(pw.error); return }
    if (!agree) { setError('이용약관에 동의해 주세요.'); return }
    setBusy(true)
    const r = await agencyRequest('/signup', {
      method: 'POST',
      auth: false,
      body: { kind, agency_name: name, business_number: kind === 'business' ? bizNo : undefined, email, password, agree_terms: true },
    })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '가입하지 못했어요.'); return }
    setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <AgencyAuthShell title="메일을 확인해 주세요" footer={<Link to="/agency/login" className="font-semibold text-gray-700">로그인으로 돌아가기</Link>}>
        <SEO title="에이전시 만들기 - 유어딜" description="유어딜 에이전시 계정 만들기" url="/agency/signup" noindex />
        <p className="text-[15px] leading-relaxed text-gray-700">
          <strong className="font-semibold text-gray-900">{sentTo}</strong> 로 인증 메일을 보냈어요.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
          메일의 링크를 누르면 에이전시가 만들어지고, 바로 직원을 초대할 수 있어요. 링크는 24시간 동안 쓸 수 있어요.
          메일이 안 보이면 스팸함을 확인하거나 같은 이메일로 다시 가입해 주세요.
        </p>
      </AgencyAuthShell>
    )
  }

  return (
    <AgencyAuthShell
      title="에이전시 만들기"
      lead="여러 매장을 맡아 운영하는 회사·팀을 위한 계정이에요. 카카오가 아니라 이메일로 만들어요."
      footer={<p>이미 계정이 있어요 · <Link to="/agency/login" className="font-semibold text-brand-text hover:underline underline-offset-4">로그인</Link></p>}
    >
      <SEO title="에이전시 만들기 - 유어딜" description="유어딜 에이전시 계정 만들기" url="/agency/signup" noindex />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <div role="radiogroup" aria-label="에이전시 종류" className="grid grid-cols-2 gap-2 rounded-xl bg-[#F8F7FC] p-1">
            {([['business', '사업자(회사)'], ['individual', '개인']] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`h-10 rounded-lg text-[15px] font-semibold transition-colors ${kind === k ? 'bg-brand text-white' : 'text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-gray-500">사업자는 세금계산서로, 개인은 3.3% 떼고 정산돼요.</p>
        </div>
        <Field label="에이전시 이름">
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
            placeholder="예: 성수 마케팅랩" className={inputCls} />
        </Field>
        {kind === 'business' && (
          <Field label="사업자등록번호" hint="숫자 10자리. 하이픈은 있어도 없어도 돼요.">
            <input required inputMode="numeric" value={bizNo} onChange={(e) => setBizNo(e.target.value)} disabled={busy}
              placeholder="123-45-67890" className={inputCls} />
          </Field>
        )}
        <Field label="대표 이메일" hint="로그인 아이디가 돼요. 직원은 나중에 각자 이메일로 초대해요.">
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
            placeholder="name@company.com" className={inputCls} />
        </Field>
        <Field label="비밀번호">
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            className={inputCls} />
          <PasswordRules rules={passwordRuleChecklist(password)} />
        </Field>
        <label className="flex items-start gap-2 text-[13px] text-gray-600">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1C69EF]" />
          <span>
            <Link to="/terms" target="_blank" className="font-semibold text-gray-800 underline underline-offset-4">이용약관</Link>과{' '}
            <Link to="/privacy" target="_blank" className="font-semibold text-gray-800 underline underline-offset-4">개인정보 처리방침</Link>에 동의해요.
          </span>
        </label>
        <FormError message={error} />
        <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? '보내는 중…' : '인증 메일 보내기'}</button>
      </form>
    </AgencyAuthShell>
  )
}
