/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerPage 실시간 주문 패널 (헤더 + 테이블).
 *   props: 폴링/리프레시는 부모(useSellerOrdersPolling 또는 inline) 가 담당.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingBag, RefreshCw, ArrowUpRight, Clock, CheckCircle2, Package, Truck, XCircle } from 'lucide-react'
import type { Order } from './types'

const STATUS_CONFIG_BASE: Record<string, { labelKey: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:   { labelKey: 'seller.statusPending',   color: '#D97706', bg: '#FEF3C7', icon: <Clock className="w-3 h-3" /> },
  DONE:      { labelKey: 'seller.statusDone',      color: '#2563EB', bg: '#DBEAFE', icon: <CheckCircle2 className="w-3 h-3" /> },
  PAID:      { labelKey: 'seller.statusDone',      color: '#2563EB', bg: '#DBEAFE', icon: <CheckCircle2 className="w-3 h-3" /> },
  PREPARING: { labelKey: 'seller.statusPreparing', color: '#7C3AED', bg: '#EDE9FE', icon: <Package className="w-3 h-3" /> },
  SHIPPING:  { labelKey: 'seller.statusShipping',  color: '#0891B2', bg: '#CFFAFE', icon: <Truck className="w-3 h-3" /> },
  DELIVERED: { labelKey: 'seller.statusDelivered', color: '#059669', bg: '#D1FAE5', icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELLED: { labelKey: 'seller.statusCancelled', color: '#DC2626', bg: '#FEE2E2', icon: <XCircle className="w-3 h-3" /> },
}

interface Props {
  recentOrders: Order[]
  newOrderIds: Set<number>
  ordersRefreshing: boolean
  lastUpdated: Date
  onRefresh: () => void
  fmtPrice: (n: number) => string
  timeAgo: (date: Date) => string
}

export default function RealtimeOrdersPanel({ recentOrders, newOrderIds, ordersRefreshing, lastUpdated, onRefresh, fmtPrice, timeAgo }: Props) {
  const { t, i18n } = useTranslation()

  return (
    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{t('seller.realtimeOrders')}</h2>
          {newOrderIds.size > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {t('seller.newOrders', { count: newOrderIds.size })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{t('seller.lastUpdated', { time: timeAgo(lastUpdated) })}</span>
          <button
            onClick={onRefresh}
            disabled={ordersRefreshing}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title={t('seller.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${ordersRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/seller/orders"
            className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
          >
            {t('seller.viewAll')} <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {recentOrders.length === 0 ? (
        <div className="py-16 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{t('seller.noOrders')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t('seller.orderNumber')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t('seller.buyer')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t('seller.amount')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t('seller.status')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t('seller.orderTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.map(order => {
                const isNew = newOrderIds.has(order.id)
                const scBase = STATUS_CONFIG_BASE[order.status] || { labelKey: '', color: '#6B7280', bg: '#F3F4F6', icon: null }
                const sc = { ...scBase, label: scBase.labelKey ? t(scBase.labelKey) : order.status }
                return (
                  <tr
                    key={order.id}
                    className={`transition-colors ${isNew ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isNew && (
                          <span className="text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full leading-none">
                            NEW
                          </span>
                        )}
                        <span className="text-xs font-mono text-gray-700">
                          #{order.order_number?.slice(-8) || order.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-800">{order.shipping_name || order.user_name || '-'}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[120px]">{order.user_email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {fmtPrice(order.total_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                        style={{ color: sc.color, backgroundColor: sc.bg }}
                      >
                        {sc.icon}
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleString(i18n.language, {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
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
