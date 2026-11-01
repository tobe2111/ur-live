import { useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { Field, panelInputCls } from './AgencyAuthShell'
import { agencyRequest, type AgencyInfo } from './agency-api'

/** 에이전시 정보(관리자만) — 이름·사업자등록번호. */
export function AgencyInfoPanel({ agency, onSaved, bare = false }: { agency: AgencyInfo; onSaved: () => void; bare?: boolean }) {
  const [name, setName] = useState(agency.name)
  const [bizNo, setBizNo] = useState(agency.businessNumber || '')
  const [busy, setBusy] = useState(false)

  // 서버에서 새 값이 오면 따라간다(편집 중이 아닐 때만 — 입력을 덮어쓰지 않게).
  useEffect(() => { if (!busy) { setName(agency.name); setBizNo(agency.businessNumber || '') } }, [agency.name, agency.businessNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const body: Record<string, string> = { name }
    if (agency.kind === 'business') body.business_number = bizNo
    const r = await agencyRequest('/account', { method: 'PATCH', body })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '저장하지 못했어요.'); return }
    toast.success(r.data.message || '저장했어요.')
    onSaved()
  }

  return (
    <section className={bare ? '' : 'mt-8'}>
      {!bare && <h2 className="text-[17px] font-semibold text-gray-500 dark:text-gray-400">에이전시 정보</h2>}
      <form onSubmit={save} className={`${bare ? '' : 'mt-3 '}flex flex-col gap-4 rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift`}>
        <Field label="에이전시 이름">
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className={panelInputCls} />
        </Field>
        {agency.kind === 'business' ? (
          <Field label="사업자등록번호">
            <input inputMode="numeric" value={bizNo} onChange={(e) => setBizNo(e.target.value)} disabled={busy} className={panelInputCls} />
          </Field>
        ) : (
          <p className="text-[13px] text-gray-500 dark:text-gray-400">개인 에이전시예요. 정산 때 3.3% 원천징수 후 지급돼요.</p>
        )}
        <button type="submit" disabled={busy} className="h-12 self-start rounded-xl bg-brand px-5 text-[15px] font-semibold text-white disabled:opacity-50">
          {busy ? '저장하는 중…' : '저장'}
        </button>
      </form>
    </section>
  )
}
