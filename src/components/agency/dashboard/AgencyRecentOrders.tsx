import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Skel } from './AgencySkel'
import { PayBadge } from './AgencyBadges'
import type { Order } from './agency-dashboard-types'

interface AgencyRecentOrdersProps {
  orders: Order[]
  loading: boolean
}

export function AgencyRecentOrders({ orders, loading }: AgencyRecentOrdersProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">{t('agency.recentOrders')}</h2>
        <button
          onClick={() => navigate('/agency/orders')}
          className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
        >
          {t('seller.viewAll')} <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
      {loading && orders.length === 0 ? (
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Skel className="h-3 w-1/3" />
                <Skel className="h-4 w-1/4" />
                <Skel className="h-3 w-1/2" />
              </div>
              <Skel className="h-4 w-16 ml-3" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">{t('agency.noOrders')}</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {orders.map(o => (
            <div key={o.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-mono text-gray-500">{o.order_number}</p>
                <p className="text-sm font-medium text-gray-900">{(o.total_amount).toLocaleString()}{t('common.won')}</p>
                <p className="text-xs text-gray-400">{o.seller_business_name}</p>
              </div>
              <div className="ml-3 flex-shrink-0">
                <PayBadge status={o.payment_status} />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {new Date(o.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
