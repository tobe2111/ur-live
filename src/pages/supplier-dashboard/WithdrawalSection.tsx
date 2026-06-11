import { Wallet } from 'lucide-react'
import { formatWon } from '@/utils/format'
import type { WithdrawalItem } from './types'

// 🏦 2026-06-09: 정산금 출금 — 실가용 잔액 + 출금 신청 버튼 + 신청 내역.
const WD_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: '처리 대기', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: '승인', cls: 'bg-emerald-50 text-emerald-700' },
  paid: { label: '송금 완료', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-gray-100 text-gray-500' },
}
export default function WithdrawalSection({ spendable, items, t, onRequest }: {
  spendable: number
  items: WithdrawalItem[]
  t: (k: string, o?: Record<string, unknown>) => string
  onRequest: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5"><Wallet className="w-4 h-4 text-blue-600" />{t('supplier.withdrawTitle', { defaultValue: '정산금 출금' })}</p>
          <p className="text-xs text-gray-500 mt-1">{t('supplier.withdrawAvail', { defaultValue: '출금 가능' })}: <span className="font-bold text-blue-600">{formatWon(spendable)}</span></p>
        </div>
        <button
          onClick={onRequest}
          disabled={spendable < 10000}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF0033] text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="w-4 h-4" /> {t('supplier.withdrawBtn', { defaultValue: '출금 신청' })}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{t('supplier.withdrawEmpty', { defaultValue: '출금 신청 내역이 없습니다.' })}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium py-2">{t('supplier.colDate', { defaultValue: '일시' })}</th>
                <th className="text-right font-medium py-2">{t('supplier.withdrawAmount', { defaultValue: '금액' })}</th>
                <th className="text-center font-medium py-2">{t('supplier.colStatus', { defaultValue: '상태' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(w => {
                const st = WD_STATUS[w.status] || WD_STATUS.requested
                return (
                  <tr key={w.id}>
                    <td className="py-2.5 text-gray-500 text-xs">{(w.requested_at || '').slice(0, 10)}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900">{formatWon(w.amount)}</td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      {w.admin_memo && <span className="block text-[10px] text-gray-400 mt-0.5">{w.admin_memo}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
