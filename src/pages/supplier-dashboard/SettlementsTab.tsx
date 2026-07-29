import { Download } from 'lucide-react'
import { formatWon } from '@/utils/format'
import type { SettlementItem } from './types'
import { downloadSupplierCsv } from './download-csv'

const SETTLE_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '정산 대기', cls: 'bg-amber-50 text-amber-700' },
  available: { label: '출금 가능', cls: 'bg-blue-50 text-blue-700' },
  paid: { label: '지급 완료', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: '취소(환불)', cls: 'bg-gray-100 text-gray-500' },
}

export default function SettlementsTab({ items, t }: { items: SettlementItem[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  // 🏭 2026-06-29 (#11 대표 요청): 제조사 거래(정산) 내역 .xlsx 다운로드 — GET /api/supplier/settlements/export.
  const exportXlsx = () => downloadSupplierCsv('/api/supplier/settlements/export', `supplier-settlements-${new Date().toISOString().slice(0, 10)}.xlsx`)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">{t('supplier.settlementsTitle', { defaultValue: '거래(정산) 내역' })}</h3>
        <button type="button" onClick={exportXlsx} className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" /> {t('supplier.settlementsExport', { defaultValue: '엑셀 다운로드' })}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm">{t('supplier.noSettlements', { defaultValue: '아직 정산 내역이 없습니다.' })}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
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
            // 🏭 2026-06-29 (audit): 환불 클로백 행은 supply_amount 음수 + product_id 음수 + product_name null →
            //   기존엔 '#-123 / 음수액 / 출금 가능' 으로 떠 혼란. '환불 차감'(빨강 음수)로 명확히 구분.
            const isClawback = (s.supply_amount ?? 0) < 0
            const st = SETTLE_STATUS[s.status] || SETTLE_STATUS.pending
            return (
              <tr key={s.id}>
                <td className="px-4 py-3 text-gray-900">{isClawback ? t('supplier.settleClawback', { defaultValue: '환불 차감' }) : (s.product_name || `#${s.product_id ?? '-'}`)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${isClawback ? 'text-red-600' : 'text-gray-900'}`}>{formatWon(s.supply_amount)}</td>
                <td className="px-4 py-3 text-center">
                  {isClawback ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600">{t('supplier.settleClawback', { defaultValue: '환불 차감' })}</span>
                  ) : (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{t(`supplier.settle_${s.status}`, { defaultValue: st.label })}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs hidden sm:table-cell">{(s.created_at || '').slice(0, 10)}</td>
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
