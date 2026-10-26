import { useState } from 'react'
import { passwordRuleChecklist, validatePasswordComplexity } from '@/shared/password-policy'
import { PasswordRules, panelInputCls } from './AgencyAuthShell'
import { agencyRequest } from './agency-api'

/**
 * 🟡 카카오로 만든 에이전시를 **이메일 계정으로 옮기기** — 2026-10-26 대표 확정(*"이메일 계정으로 옮기기 제공"*).
 *
 * 회사 이메일과 비밀번호를 정하면 그 주소로 확인 메일이 간다. 메일의 버튼을 눌러야 옮겨진다 — 남의 이메일을
 * 적어 그 사람 주소를 가로채지 못하게. 옮긴 뒤에는 그 이메일로 로그인하고 직원을 초대할 수 있다.
 * 매장·이용권·성과는 그대로다(같은 에이전시의 같은 직원 행이 로그인 방법만 바뀐다).
 */
export function AgencyMoveToEmailSheet() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    const pw = validatePasswordComplexity(password)
    if (!pw.ok) { setError(pw.error); return }
    setBusy(true)
    const r = await agencyRequest('/move-to-email', { method: 'POST', body: { email, password } })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '보내지 못했어요.'); return }
    setSent(r.data.message || '확인 메일을 보냈어요.')
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift" data-testid="agency-move-sent">
        <p className="text-[15px] font-medium text-gray-900 dark:text-white">메일을 확인해 주세요</p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{sent} 버튼을 누르기 전까지는 지금처럼 카카오로 쓰면 돼요.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
      <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        옮기면 이 이메일로 로그인하고, 직원을 한 명씩 초대해 함께 쓸 수 있어요. 맡은 매장과 이용권, 성과는 그대로예요.
      </p>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">회사 이메일</span>
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
          placeholder="name@company.com" className={panelInputCls} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">비밀번호</span>
        <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
          className={panelInputCls} />
        <PasswordRules rules={passwordRuleChecklist(password)} />
      </label>
      {error && <p role="alert" className="text-[13px] text-tone-bad">{error}</p>}
      <button type="submit" disabled={busy} className="h-12 rounded-xl bg-brand text-[15px] font-medium text-white disabled:opacity-50">
        {busy ? '보내는 중…' : '확인 메일 보내기'}
      </button>
    </form>
  )
}
