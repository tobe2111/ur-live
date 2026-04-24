import { useTranslation } from 'react-i18next'
import { Users, ShoppingBag, DollarSign, Play, TrendingUp } from 'lucide-react'
import { Skel } from './AgencySkel'
import type { Stats } from './agency-dashboard-types'

interface AgencyKpiRowProps {
  stats: Stats | null
  loading: boolean
  ordersDelta: number
  revenueDelta: number
  showDelta: boolean
}

export function AgencyKpiRow({ stats, loading, ordersDelta, revenueDelta, showDelta }: AgencyKpiRowProps) {
  const { t } = useTranslation()
  const showStatsSkeleton = loading && !stats

  const kpis = [
    { label: t('agency.kpiSellers'), value: String(stats?.sellers ?? 0), sub: t('common.person'), icon: Users, color: 'bg-blue-600', delta: 0, showDelta: false },
    { label: t('agency.kpiOrders'), value: String(stats?.orders_30d ?? 0), sub: t('agency.kpiOrdersSub'), icon: ShoppingBag, color: 'bg-blue-500', delta: ordersDelta, showDelta },
    { label: t('agency.kpiRevenue'), value: `${((stats?.revenue_30d ?? 0) / 10000).toFixed(0)}${t('agency.manwon')}`, sub: t('agency.kpiRevenueSub'), icon: DollarSign, color: 'bg-emerald-500', delta: revenueDelta, showDelta },
    { label: t('agency.kpiSellerRevenue'), value: `${((stats?.net_revenue_30d ?? 0) / 10000).toFixed(0)}${t('agency.manwon')}`, sub: t('agency.kpiSellerRevenueSub'), icon: TrendingUp, color: 'bg-violet-500', delta: revenueDelta, showDelta },
    { label: t('agency.kpiLive'), value: String(stats?.active_streams ?? 0), sub: t('agency.kpiLiveSub'), icon: Play, color: 'bg-rose-500', delta: 0, showDelta: false },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-2xl p-4 bg-white border border-[#E8EAEE]">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">{kpi.label}</p>
              {showStatsSkeleton ? (
                <>
                  <Skel className="h-6 w-2/3 mb-1" />
                  <Skel className="h-3 w-1/2" />
                </>
              ) : (
                <>
                  <p className="text-[22px] font-extrabold text-[#111]">{kpi.value}</p>
                  {kpi.showDelta && (
                    <span className={`text-[10px] font-bold block ${kpi.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {kpi.delta >= 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}% {t('seller.vsPreviousPeriod')}
                    </span>
                  )}
                  {kpi.sub && <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>}
                </>
              )}
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.color} shrink-0`}>
              <kpi.icon className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
