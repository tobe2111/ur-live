/**
 * 🏦 어드민 매장 카드 — 정산 계좌 대신 입력 (2026-11-24 대표 *"1번 일단 만들어줘봐"*)
 *
 * 사장님이 마이 › 정산 › 계좌 등록에서 직접 넣는 것이 기본이다. 대표가 영업하며 받은 계좌를 넣을 길이 없어 만들었다
 * (11-24 실측: 승인 매장 13곳 중 등록 0곳). 서버 규칙: `features/admin/api/admin-store-bank.routes.ts`.
 *   - 계좌번호는 끝 4자리만 보인다 · 이미 있으면 한 번 더 확인하고 바꾼다 · 저장하면 사장님에게 알림이 간다
 * 라이트 테마 고정(대시보드 룰 — `dark:` 금지).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Select } from '@/components/ui/select'
import { BANKS } from '@/shared/banks'

interface BankData { registered: boolean; bank_name: string | null; bank_account_masked: string | null; account_holder: string | null }

const INPUT = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-brand focus:outline-none'

export default function StoreBankCard({ sellerId }: { sellerId: number }) {
  const [data, setData] = useState<BankData | null>(null)
  const [open, setOpen] = useState(false)
  const [bank, setBank] = useState('')
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null); setOpen(false)
    api.get(`/api/admin/sellers/${sellerId}/bank-account`)
      .then((r) => { if (alive && r.data?.success) setData(r.data.data as BankData) })
      .catch(() => { /* 조회 실패면 카드를 안 그린다 — 틀린 계좌 상태보다 없는 게 낫다 */ })
    return () => { alive = false }
  }, [sellerId])

  if (!data) return null

  async function save(confirmOverwrite = false) {
    if (saving) return
    setSaving(true)
    try {
      const r = await api.put(`/api/admin/sellers/${sellerId}/bank-account`, {
        bank_name: bank, bank_account: account.trim(), account_holder: holder.trim(), ...(confirmOverwrite ? { confirm_overwrite: true } : {}),
      })
      if (r.data?.success) {
        setData(r.data.data as BankData)
        setOpen(false); setAccount(''); setHolder(''); setBank('')
        toast.success(r.data.message || '저장했어요')
      } else toast.error(r.data?.error || '저장하지 못했어요')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string; error?: string } } }
      if (e?.response?.data?.code === 'OVERWRITE_CONFIRM_REQUIRED' && !confirmOverwrite) {
        setSaving(false)
        if (await confirmDialog({ message: `${e.response.data.error} 새 계좌로 바꿀까요?`, danger: true })) return save(true)
        return
      }
      toast.error(e?.response?.data?.error || '저장하지 못했어요')
    } finally { setSaving(false) }
  }

  // 🔑 잊은 매장 PIN 초기화(2026-11-25) — 사장님 본인 확인을 한 뒤에만 누른다. 지우면 사장님이 새 PIN 을 만든다.
  async function resetPin() {
    if (!(await confirmDialog({ message: '이 매장의 PIN 을 초기화할까요? 사장님 본인이 요청했는지 확인한 뒤에만 눌러 주세요. 사장님에게 알림이 갑니다.', danger: true }))) return
    try {
      const r = await api.post(`/api/admin/sellers/${sellerId}/bank-account/reset-pin`, {})
      if (r.data?.success) toast.success(r.data.message || 'PIN 을 초기화했어요')
      else toast.error(r.data?.error || 'PIN 을 초기화하지 못했어요')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'PIN 을 초기화하지 못했어요')
    }
  }

  const ready = !!bank && account.trim().length >= 8 && !!holder.trim()
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">정산 계좌</p>
          {data.registered
            ? <p className="text-xs text-gray-600 mt-0.5">{data.bank_name} {data.bank_account_masked} · {data.account_holder || '예금주 없음'}</p>
            : <p className="text-xs text-amber-700 mt-0.5">등록된 계좌가 없어요. 정산이 생겨도 보낼 수 없습니다.</p>}
        </div>
        {!open && (
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={resetPin} className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-500 hover:bg-gray-50">PIN 초기화</button>
            <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
              {data.registered ? '바꾸기' : '대신 입력'}
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-2">
          <Select value={bank} onChange={(e) => setBank(e.target.value)} className={INPUT} aria-label="은행">
            <option value="">은행 선택</option>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <input value={account} onChange={(e) => setAccount(e.target.value.replace(/[^0-9-]/g, ''))} inputMode="numeric" maxLength={24} placeholder="계좌번호 (숫자·하이픈)" aria-label="계좌번호" className={INPUT} />
          <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={40} placeholder="예금주" aria-label="예금주" className={INPUT} />
          <p className="text-xs text-gray-500">사장님께 직접 받은 계좌만 넣어 주세요. 저장하면 사장님에게 알림이 가고, 누가 넣었는지 기록됩니다.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">취소</button>
            <button type="button" disabled={!ready || saving} onClick={() => save(false)} className="ur-btn ur-btn-sm ur-btn-primary flex-1 disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
