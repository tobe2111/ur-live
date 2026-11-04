import { useState } from 'react'
import { toast } from '@/hooks/useToast'
import { passwordRuleChecklist } from '@/shared/password-policy'
import { Field, FormError, PasswordRules, panelInputCls, primaryBtnCls } from './AgencyAuthShell'
import { AGENCY_TOKEN_KEY, agencyRequest, saveAgencySession, type AgencyLoginPayload } from './agency-api'

/**
 * 🔑 에이전시 마이 '비밀번호 바꾸기' 시트 안 — 2026-11-04 대표 *"남은 1,2,3도 다 해줘"*.
 *   서버 `POST /api/agency-console/me/password` 가 다른 기기 로그인을 끊고 **이 화면엔 새 토큰**을 준다 →
 *   그 토큰을 같은 저장소(로그인 유지 여부 그대로)에 다시 적는다. 안 적으면 다음 요청부터 이 화면도 끊긴다.
 */
export function AgencyPasswordPanel({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setError('새 비밀번호가 서로 달라요.'); return }
    setBusy(true); setError('')
    const r = await agencyRequest<AgencyLoginPayload & { message?: string }>('/me/password', {
      method: 'POST', body: { current_password: current, new_password: next },
    })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '비밀번호를 바꾸지 못했어요.'); return }
    let remember = true
    try { remember = !!localStorage.getItem(AGENCY_TOKEN_KEY) } catch { remember = false }
    saveAgencySession(r.data, remember)
    toast.success(r.data.message || '비밀번호를 바꿨어요.')
    onDone()
  }

  return (
    <form onSubmit={(e) => { void submit(e) }} className="flex flex-col gap-5">
      <Field label="지금 비밀번호">
        <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} className={panelInputCls} />
      </Field>
      <Field label="새 비밀번호">
        <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} className={panelInputCls} />
        <PasswordRules rules={passwordRuleChecklist(next)} />
      </Field>
      <Field label="새 비밀번호 확인">
        <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} className={panelInputCls} />
      </Field>
      {error && <FormError message={error} />}
      <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</button>
      <p className="text-[13px] text-gray-500 dark:text-gray-400">바꾸면 다른 컴퓨터·휴대폰에 남은 에이전시 로그인은 끊겨요.</p>
    </form>
  )
}
