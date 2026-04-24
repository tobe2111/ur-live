import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Skel } from './AgencySkel'
import { StatusBadge } from './AgencyBadges'
import type { Seller } from './agency-dashboard-types'

interface AgencySellerRankingProps {
  sortedSellers: Seller[]
  loading: boolean
}

export function AgencySellerRanking({ sortedSellers, loading }: AgencySellerRankingProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">{t('agency.affiliatedSellers')}</h2>
        <button
          onClick={() => navigate('/agency/sellers')}
          className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
        >
          {t('seller.viewAll')} <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
      {loading && sortedSellers.length === 0 ? (
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Skel className="w-5 h-4" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Skel className="h-4 w-1/2" />
                  <Skel className="h-3 w-1/3" />
                </div>
              </div>
              <Skel className="h-5 w-12" />
            </div>
          ))}
        </div>
      ) : sortedSellers.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">
          {t('agency.noSellers')}<br />
          <span className="text-xs">{t('agency.requestAssignment')}</span>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {sortedSellers.slice(0, 8).map((s, idx) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[12px] font-bold text-gray-400 w-5 text-center">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.business_name || s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-gray-900">{(s.total_revenue / 10000).toFixed(0)}{t('agency.manwon')}</p>
                  <p className="text-xs text-gray-400">{s.total_orders}{t('agency.unitCase')}</p>
                </div>
                {s.active_streams > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
