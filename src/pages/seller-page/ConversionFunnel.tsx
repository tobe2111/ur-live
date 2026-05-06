import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'

interface Props {
  totalViewers: number
  totalOrders: number
}

/**
 * 전환 퍼널 — 시청자 → 주문 (실제 데이터만 표시, 추정값 사용 금지).
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function ConversionFunnel({ totalViewers, totalOrders }: Props) {
  const { t } = useTranslation()
  const hasViewerData = totalViewers > 0
  const orderCount = totalOrders || 0
  const viewerCount = totalViewers || 0
  const orderPct = hasViewerData && viewerCount > 0
    ? Math.max(0, Math.round((orderCount / viewerCount) * 100))
    : 0

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E8EAEE]">
      <h3 className="text-[14px] font-extrabold text-gray-900 mb-3">{t('seller.conversionFunnel')}</h3>
      {!hasViewerData && orderCount === 0 ? (
        <p className="text-[12px] text-gray-500 py-4 text-center">
          {t('seller.noViewerData')}
        </p>
      ) : (
        <div className="space-y-3">
          {hasViewerData && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-gray-700">{t('seller.broadcastViewers')}</span>
                <span className="text-[12px] font-extrabold text-gray-900">
                  {formatNumber(viewerCount)}<span className="text-[10px] text-gray-500 ml-1">(100%)</span>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: '100%', background: '#FF0033' }} />
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-semibold text-gray-700">{t('seller.ordersCompleted')}</span>
              <span className="text-[12px] font-extrabold text-gray-900">
                {formatNumber(orderCount)}
                {hasViewerData && (
                  <span className="text-[10px] text-gray-500 ml-1">({orderPct}%)</span>
                )}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${hasViewerData ? Math.min(orderPct, 100) : 100}%`,
                  background: '#10B981'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
