import { formatWon } from '@/utils/format'
import type { SettlementItem } from './types'

const SETTLE_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '정산 대기', cls: 'bg-amber-50 text-amber-700' },
  available: { label: '출금 가능', cls: 'bg-blue-50 text-blue-700' },
  paid: { label: '지급 완료', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: '취소(환불)', cls: 'bg-gray-100 text-gray-500' },
}

export default function SettlementsTab({ items, t }: { items: SettlementItem[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (items.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm">{t('supplier.noSettlements', { defaultValue: '아직 정산 내역이 없습니다.' })}</div>
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="text-left font-medium px-4 py-3">{t('supplier.colProduct', { defaultValue: '상품' })}</th>
            <th className="text-right font-medium px-4 py-3">{t('supplier.colSupplyAmount', { defaultValue: '공급액' })}</th>
            <th className="text-center font-medium px-4 py-3">{t('supplier.colStatus', { defaultValue: '상태' })}</th>
            <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">{t('supplier.colDate', { defaultValue: '일시' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(s => {
            const st = SETTLE_STATUS[s.status] || SETTLE_STATUS.pending
            return (
              <tr key={s.id}>
                <td className="px-4 py-3 text-gray-900">{s.product_name || `#${s.product_id ?? '-'}`}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatWon(s.supply_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{t(`supplier.settle_${s.status}`, { defaultValue: st.label })}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs hidden sm:table-cell">{(s.created_at || '').slice(0, 10)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
