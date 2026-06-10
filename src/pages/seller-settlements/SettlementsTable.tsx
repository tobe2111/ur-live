import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import type { Settlement } from './types'

// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 정산 내역 테이블 (동작 변화 0, 순수 이동).
export default function SettlementsTable({ settlements, onDownload }: {
  settlements: Settlement[]
  onDownload: (settlementId: number) => void
}) {
  const { t } = useTranslation()

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }

    const labels: Record<string, string> = {
      pending: t('common.pending'),
      approved: t('common.completed'),
      paid: t('common.paid'),
      rejected: t('common.cancelled'),
    }

    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.settlementPeriod')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.sales')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.commissionRate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.commissionAmountColumn')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.settlementAmountColumn')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('common.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.requestDateColumn')}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('seller.actionColumn')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {t('common.noData')}
                </td>
              </tr>
            ) : (
              settlements.map((settlement) => (
                <tr key={settlement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatKSTDate(settlement.period_start)} ~
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatKSTDate(settlement.period_end)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ₩{formatNumber(settlement.total_sales)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {settlement.commission_rate}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-red-600 font-medium">
                      -₩{formatNumber(settlement.commission_amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-green-600 font-bold">
                      ₩{formatNumber(settlement.settlement_amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(settlement.status)}
                    {/* 🛡️ 배치 170: 예상 입금일 표시 */}
                    {settlement.status === 'pending' && (
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        {t('seller.settlementEstimate', '예상 입금: 요청 후 영업일 3~5일')}
                      </p>
                    )}
                    {settlement.status === 'approved' && (
                      <p className="text-[10px] text-blue-600 mt-0.5">
                        {t('seller.settlementApprovedEstimate', '입금 예정: 1~2 영업일 내')}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatKSTDate(settlement.requested_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <Button
                      onClick={() => onDownload(settlement.id)}
                      variant="ghost"
                      size="sm"
                      disabled={settlement.status === 'pending'}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
