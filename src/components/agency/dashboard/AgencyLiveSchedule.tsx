import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronRight } from 'lucide-react'

interface LiveScheduleItem {
  sellerName: string
  title: string
  isLive: boolean
}

interface AgencyLiveScheduleProps {
  items: LiveScheduleItem[]
}

export function AgencyLiveSchedule({ items }: AgencyLiveScheduleProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (items.length === 0) return null

  return (
    <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">{t('agency.liveInProgress')}</h2>
        <button
          onClick={() => navigate('/agency/streams')}
          className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
        >
          {t('agency.liveStatus')} <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3.5 bg-pink-50/60">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                LIVE
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{item.sellerName}</p>
                <p className="text-[11px] text-gray-500 truncate">{item.title}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/agency/streams')}
              className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-0.5 ml-3 flex-shrink-0"
            >
              {t('common.preview')} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
