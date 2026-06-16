import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi } from '@/lib/supplier-api'

export default function WithdrawModal({ t, spendable, onClose, onDone }: {
  t: (k: string, o?: Record<string, unknown>) => string
  spendable: number
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const amt = Math.floor(Number(amount))
    if (!Number.isFinite(amt) || amt < 10000) { setError(t('supplier.withdrawMin', { defaultValue: '최소 출금 금액은 10,000원입니다' })); return }
    if (amt > spendable) { setError(t('supplier.withdrawOver', { defaultValue: '출금 가능 잔액을 초과했습니다' })); return }
    setSaving(true)
    try {
      await supplierApi.post('/api/supplier/withdrawals/request', { amount: amt })
      toast.success(t('supplier.withdrawOk', { defaultValue: '출금 신청이 접수되었습니다. 영업일 기준 처리됩니다.' }))
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.withdrawBtn', { defaultValue: '출금 신청' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            {t('supplier.withdrawAvail', { defaultValue: '출금 가능' })}: <span className="font-bold">{formatWon(spendable)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.withdrawAmount', { defaultValue: '금액' })}</label>
            <input
              type="number" inputMode="numeric" min={10000} step={1000}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="10000" className={inputCls}
            />
            <button type="button" onClick={() => setAmount(String(spendable))} className="mt-1.5 text-xs font-medium text-[#FC5424]">
              {t('supplier.withdrawAll', { defaultValue: '전액 신청' })}
            </button>
          </div>
          <p className="text-xs text-gray-500">{t('supplier.withdrawNote', { defaultValue: '등록된 정산 계좌로 송금됩니다. 신청 후 관리자 송금 확인 시 처리 완료됩니다.' })}</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#FC5424] text-white font-bold text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('supplier.withdrawSubmit', { defaultValue: '출금 신청하기' })}
          </button>
        </form>
      </div>
    </div>
  )
}
