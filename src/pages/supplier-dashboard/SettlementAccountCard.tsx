import { useState, useEffect } from 'react'
import { Landmark, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'

// ── 🏦 2026-06-30 정산 계좌(출금 계좌) 등록/수정 카드 (self-contained 로드/저장) ──────────────
//   가입 시 '선택'이라 미등록 제조사가 출금하려면 여기서 등록해야 함. 미등록 시 경고 배너로 안내.
//   bank_name / bank_account / account_holder — 셋 다 입력해야 출금 가능(서버가 NO_BANK 로 게이트).
export default function SettlementAccountCard({ t, onSaved }: { t: (k: string, o?: Record<string, unknown>) => string; onSaved?: () => void }) {
  const [bankName, setBankName] = useState('')
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    supplierApi.get<{ data: { bank_name: string; bank_account: string; account_holder: string; registered: boolean } }>('/api/supplier/settlement-account')
      .then(r => {
        if (!alive) return
        setBankName(r.data?.bank_name || '')
        setAccount(r.data?.bank_account || '')
        setHolder(r.data?.account_holder || '')
        setRegistered(!!r.data?.registered)
      })
      .catch(err => { if (import.meta.env.DEV) console.error(err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const save = async () => {
    if (!bankName.trim() || !account.trim() || !holder.trim()) {
      toast.error(t('supplier.acctAllRequired', { defaultValue: '은행/계좌번호/예금주를 모두 입력해주세요' }))
      return
    }
    setSaving(true)
    try {
      await supplierApi.patch('/api/supplier/settlement-account', {
        bank_name: bankName.trim(),
        bank_account: account.trim(),
        account_holder: holder.trim(),
      })
      toast.success(t('supplier.acctSaved', { defaultValue: '정산 계좌가 저장되었습니다' }))
      setRegistered(true)
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('supplier.acctSaveErr', { defaultValue: '저장에 실패했습니다' }))
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-4 h-4 text-[#FC5424]" />
        <p className="text-sm font-semibold text-gray-900">{t('supplier.acctTitle', { defaultValue: '정산 계좌' })}</p>
      </div>
      <p className="text-xs text-gray-500 mb-4">{t('supplier.acctDesc', { defaultValue: '출금 신청 시 이 계좌로 송금됩니다. 출금하려면 정산 계좌가 반드시 등록돼 있어야 해요.' })}</p>
      {loading ? (
        <div className="py-6 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
      ) : (
        <>
          {registered === false ? (
            <div className="mb-4 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">{t('supplier.acctMissing', { defaultValue: '정산 계좌가 등록되지 않았어요. 등록해야 정산금을 출금할 수 있어요.' })}</p>
            </div>
          ) : registered === true ? (
            <div className="mb-4 px-3.5 py-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">{t('supplier.acctRegistered', { defaultValue: '정산 계좌가 등록되어 있어요. 출금 신청이 가능합니다.' })}</p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.acctBankName', { defaultValue: '은행' })}</label>
              <input value={bankName} disabled={saving} onChange={e => setBankName(e.target.value)} className={inputCls} placeholder={t('supplier.acctBankPlaceholder', { defaultValue: '예: 국민은행' })} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.acctNumber', { defaultValue: '계좌번호' })}</label>
              <input value={account} disabled={saving} inputMode="numeric" onChange={e => setAccount(e.target.value)} className={inputCls} placeholder="000-00-000000" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.acctHolder', { defaultValue: '예금주' })}</label>
              <input value={holder} disabled={saving} onChange={e => setHolder(e.target.value)} className={inputCls} placeholder={t('supplier.acctHolderPlaceholder', { defaultValue: '예금주명' })} />
            </div>
          </div>
          <button onClick={save} disabled={saving} className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FC5424] text-white font-semibold text-sm disabled:opacity-60">
            {saving ? t('common.loading', { defaultValue: '저장 중...' }) : t('supplier.acctSave', { defaultValue: '정산 계좌 저장' })}
          </button>
        </>
      )}
    </div>
  )
}
