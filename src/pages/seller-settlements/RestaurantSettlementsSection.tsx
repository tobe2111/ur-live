/**
 * 🏁 2026-06-11 (공구 플로우 감사 갭#11 — 사용자 승인 "모두 이상적 진행"):
 *   공구(동네딜) 자동정산 내역 섹션. cron(auto-settlement, 매일 KST 03:00)이
 *   restaurant_settlements 에 적립하는데 셀러가 볼 화면이 0 이었음 —
 *   기존 API GET /api/seller/restaurant-settlements 를 그대로 표시만 배선.
 *   대시보드 라이트 테마 고정 (dark: variant 금지 룰).
 */
import { useTranslation } from 'react-i18next'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon, formatNumber } from '@/utils/format'

interface RestaurantSettlement {
  id: number
  restaurant_name: string
  product_id: number | null
  period_start: string | null
  period_end: string | null
  total_vouchers_used: number
  total_revenue: number
  commission_rate: number
  commission_amount: number
  settlement_amount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  settled_at: string | null
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
}

export default function RestaurantSettlementsSection() {
  const { t } = useTranslation()
  const q = useApiQuery<{ success: boolean; items?: RestaurantSettlement[] }>(
    ['seller', 'restaurant-settlements'],
    '/api/seller/restaurant-settlements',
    { select: (d) => d as { success: boolean; items?: RestaurantSettlement[] } },
  )
  const items = q.data?.items ?? []

  const statusLabel = (s: string) =>
    s === 'completed' ? t('seller.gbSettle.statusCompleted', { defaultValue: '지급 완료' })
    : s === 'processing' ? t('seller.gbSettle.statusProcessing', { defaultValue: '처리 중' })
    : s === 'failed' ? t('seller.gbSettle.statusFailed', { defaultValue: '실패' })
    : t('seller.gbSettle.statusPending', { defaultValue: '대기' })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-bold text-gray-900">
          {t('seller.gbSettle.title', { defaultValue: '공구 자동정산 내역' })}
        </h3>
      </div>
      <p className="text-[12px] text-gray-500 mb-4">
        {t('seller.gbSettle.subtitle', { defaultValue: '사용된 교환권 기준으로 매일 새벽 자동 집계됩니다' })}
      </p>

      {q.isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">…</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          {t('seller.gbSettle.empty', { defaultValue: '아직 자동정산 내역이 없어요 — 교환권이 사용되면 다음 날 새벽에 집계됩니다' })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">{t('seller.gbSettle.colPeriod', { defaultValue: '기간' })}</th>
                <th className="py-2 pr-3 font-medium">{t('seller.gbSettle.colStore', { defaultValue: '매장' })}</th>
                <th className="py-2 pr-3 font-medium text-right">{t('seller.gbSettle.colUsed', { defaultValue: '사용 수' })}</th>
                <th className="py-2 pr-3 font-medium text-right">{t('seller.gbSettle.colAmount', { defaultValue: '정산액' })}</th>
                <th className="py-2 font-medium">{t('seller.gbSettle.colStatus', { defaultValue: '상태' })}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">
                    {(r.period_start || '').slice(5, 10)}{r.period_end ? ` ~ ${r.period_end.slice(5, 10)}` : ''}
                  </td>
                  <td className="py-2.5 pr-3 text-gray-900 font-medium">{r.restaurant_name}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-600">{formatNumber(r.total_vouchers_used)}</td>
                  <td className="py-2.5 pr-3 text-right font-bold text-gray-900">{formatWon(r.settlement_amount)}</td>
                  <td className="py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[r.status] || STATUS_STYLE.pending}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
