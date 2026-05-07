import { useTranslation } from 'react-i18next'
import { Loader2, TrendingUp } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import type { SupplySalesRow, SupplySalesSummary } from './types'

interface Props {
  loading: boolean
  supplySummary: SupplySalesSummary | null
  supplySales: SupplySalesRow[]
}

export default function SupplySalesTab({ loading, supplySummary, supplySales }: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      {supplySummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('admin.products.supplySummaryOrders', { defaultValue: '총 주문 수' }), value: `${formatNumber(supplySummary.total_orders)}건`, color: 'text-blue-700' },
            { label: t('admin.products.supplySummaryQty', { defaultValue: '총 판매 수량' }), value: `${formatNumber(supplySummary.total_qty)}개`, color: 'text-gray-700' },
            { label: t('admin.products.supplySummaryRevenue', { defaultValue: '셀러 총 매출' }), value: `${formatNumber(supplySummary.total_revenue)}원`, color: 'text-gray-700' },
            { label: t('admin.products.supplySummaryCost', { defaultValue: '어드민 공급 수익' }), value: `${formatNumber(supplySummary.total_supply_cost)}원`, color: 'text-purple-700' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
        ) : supplySales.length === 0 ? (
          <div className="py-20 text-center">
            <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{t('admin.products.k037', { defaultValue: '공급 상품 판매 내역이 없습니다.' })}</p>
            <p className="text-xs text-gray-300 mt-1">{t('admin.products.k038', { defaultValue: '셀러가 공급 상품을 등록하고 판매하면 여기에 표시됩니다.' })}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-gray-50">
                  {[
                    t('admin.products.k039', { defaultValue: '공급 상품' }),
                    t('admin.products.k040', { defaultValue: '셀러' }),
                    t('admin.products.k041', { defaultValue: '셀러 판매가' }),
                    t('admin.products.k042', { defaultValue: '공급가' }),
                    t('admin.products.k043', { defaultValue: '주문' }),
                    t('admin.products.k044', { defaultValue: '판매량' }),
                    t('admin.products.k045', { defaultValue: '셀러 매출' }),
                    t('admin.products.k046', { defaultValue: '어드민 수익' }),
                    t('admin.products.k047', { defaultValue: '셀러 마진' }),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {supplySales.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{row.supply_product_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900">{row.business_name || row.seller_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right">{formatNumber(row.seller_price)}원</td>
                    <td className="px-4 py-3 text-xs text-purple-600 font-medium text-right">{formatNumber(row.supply_price)}원</td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-center">{row.order_count}건</td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-center">{row.total_qty}개</td>
                    <td className="px-4 py-3 text-xs text-gray-900 font-medium text-right">{formatNumber(row.total_revenue)}원</td>
                    <td className="px-4 py-3 text-xs text-purple-700 font-semibold text-right">{formatNumber(row.total_supply_cost)}원</td>
                    <td className="px-4 py-3 text-xs text-emerald-600 text-right">{formatNumber(row.seller_margin)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
