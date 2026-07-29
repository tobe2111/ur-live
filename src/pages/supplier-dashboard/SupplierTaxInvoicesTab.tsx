import { formatWon } from '@/utils/format'
import type { SupplierTaxInvoiceRow } from './types'

// 🏭 Wave 3c: 매입 역발행 전자세금계산서 목록(제조사→플랫폼). 공급가액/부가세/합계/상태.
const TAX_INV_STATUS: Record<string, { label: string; cls: string }> = {
  issued: { label: '발행완료', cls: 'bg-emerald-50 text-emerald-700' },
  draft: { label: '발행대기', cls: 'bg-amber-50 text-amber-700' },
  failed: { label: '발행실패', cls: 'bg-red-50 text-red-700' },
}
export default function SupplierTaxInvoicesTab({ items, t }: { items: SupplierTaxInvoiceRow[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (items.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center text-gray-400 text-sm">{t('supplier.noTaxInvoices', { defaultValue: '아직 발행된 세금계산서가 없습니다.' })}</div>
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="text-left font-medium px-4 py-3">{t('supplier.colOrder', { defaultValue: '주문' })}</th>
            <th className="text-right font-medium px-4 py-3">{t('supplier.colSupplyValue', { defaultValue: '공급가액' })}</th>
            <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">{t('supplier.colVat', { defaultValue: '부가세' })}</th>
            <th className="text-right font-medium px-4 py-3">{t('supplier.colTotal', { defaultValue: '합계' })}</th>
            <th className="text-center font-medium px-4 py-3">{t('supplier.colStatus', { defaultValue: '상태' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(inv => {
            const st = TAX_INV_STATUS[inv.status] || TAX_INV_STATUS.draft
            return (
              <tr key={inv.id}>
                <td className="px-4 py-3 text-gray-900">#{inv.order_id}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatWon(inv.supply_amount)}</td>
                <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{formatWon(inv.vat_amount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatWon(inv.total_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{t(`supplier.taxinv_${inv.status}`, { defaultValue: st.label })}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
