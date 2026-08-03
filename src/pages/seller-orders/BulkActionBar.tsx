/**
 * 🛡️ 2026-08-02: `SellerOrdersPage` 에서 추출 — 표 위 일괄 처리 바.
 *
 * 마크업·핸들러 **byte-동일 이동**이다(로직 변경 0). 추출한 이유는 두 가지:
 * 파일 크기 래칫(`file-size-baseline.json` 이 615줄로 동결)에 자리를 만들기 위해서고,
 * PC 표 전용 UI 라 모바일 카드 뷰(`MobileOrderList`)와 관심사가 갈리기 때문이다.
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export default function BulkActionBar({
  count, status, onStatusChange, onApply, applying, onClear,
}: {
  count: number
  status: string
  onStatusChange: (v: string) => void
  onApply: () => void
  applying: boolean
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b border-blue-200">
      <span className="text-sm font-medium text-blue-700">{t('seller.selectedCount', { count })}</span>
      <select
        value={status}
        onChange={e => onStatusChange(e.target.value)}
        className="text-sm border border-blue-300 rounded-lg px-2 py-1.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{t('common.status')}</option>
        <option value="PREPARING">{t('seller.statusPreparing')}</option>
        <option value="SHIPPING">{t('seller.statusShipping')}</option>
        <option value="DELIVERED">{t('seller.statusDelivered')}</option>
        <option value="CANCELLED">{t('seller.statusCancelled')}</option>
      </select>
      <button
        onClick={onApply}
        disabled={!status || applying}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {t('seller.bulkChange')}
      </button>
      <button onClick={onClear} className="text-sm text-gray-500 hover:text-gray-700">
        {t('seller.deselectAll')}
      </button>
    </div>
  )
}
