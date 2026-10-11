import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import { passwordRuleChecklist, validatePasswordComplexity } from '@/shared/password-policy'
import { AgencyAuthShell, Field, FormError, PasswordRules, inputCls, primaryBtnCls } from './AgencyAuthShell'
import { agencyRequest } from './agency-api'

/** 비밀번호 찾기(토큰 없음 → 메일 요청) · 재설정(메일 링크의 토큰 → 새 비밀번호). */
export default function AgencyResetPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  return token ? <ResetForm token={token} /> : <ForgotForm />
}

function ForgotForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    const r = await agencyRequest('/forgot-password', { method: 'POST', auth: false, body: { email } })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '잠시 후 다시 시도해 주세요.'); return }
    setDone(r.data.message || '가입된 이메일이면 재설정 메일을 보냈어요.')
  }

  return (
    <AgencyAuthShell
      title="비밀번호 찾기"
      lead="가입한 이메일로 재설정 링크를 보내 드려요. 링크는 1시간 동안 쓸 수 있어요."
      footer={<Link to="/agency/login" className="font-semibold text-gray-700">로그인으로 돌아가기</Link>}
    >
      <SEO title="에이전시 비밀번호 찾기 - 유어딜" description="유어딜 에이전시 비밀번호 재설정" url="/agency/reset" noindex />
      {done ? (
        <p className="text-[15px] leading-relaxed text-gray-700">{done}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="업무용 이메일">
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
              placeholder="name@company.com" className={inputCls} />
          </Field>
          <FormError message={error} />
          <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? '보내는 중…' : '재설정 메일 보내기'}</button>
        </form>
      )}
    </AgencyAuthShell>
  )
}

function ResetForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    const pw = validatePasswordComplexity(password)
    if (!pw.ok) { setError(pw.error); return }
    setBusy(true)
    const r = await agencyRequest('/reset-password', { method: 'POST', auth: false, body: { token, password } })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '링크가 만료됐어요. 다시 요청해 주세요.'); return }
    navigate('/agency/login?reset=1', { replace: true })
  }

  return (
    <AgencyAuthShell
      title="새 비밀번호"
      lead="바꾸면 다른 기기에서 로그인된 곳은 모두 로그아웃돼요."
      footer={<Link to="/agency/reset" className="font-semibold text-gray-700">재설정 메일 다시 받기</Link>}
    >
      <SEO title="에이전시 비밀번호 재설정 - 유어딜" description="유어딜 에이전시 비밀번호 재설정" url="/agency/reset" noindex />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="새 비밀번호">
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            className={inputCls} />
          <PasswordRules rules={passwordRuleChecklist(password)} />
        </Field>
        <FormError message={error} />
        <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</button>
      </form>
    </AgencyAuthShell>
  )
}
