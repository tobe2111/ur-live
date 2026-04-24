import { useTranslation } from 'react-i18next'
import { formatKSTDate } from '@/utils/date'
import type { LiveStream } from '@/components/seller/broadcast/broadcast-types'

export interface StreamListProps {
  streams: LiveStream[]; onManage: (stream: LiveStream) => void
}

// ── 기존/최근 방송 목록 ──────────────────────────────────────────
export function StreamList({ streams, onManage }: StreamListProps) {
  const { t } = useTranslation()
  // 자동 redirect가 1시간 이내 예약/라이브 처리 → 여기서는 1시간 이후 예약만 표시
  const upcoming = streams.filter((s: LiveStream) => {
    if (s.status !== 'scheduled') return false
    if (!s.scheduled_at) return true
    return new Date(s.scheduled_at).getTime() - Date.now() > 60 * 60 * 1000
  })
  const ended = streams.filter((s: LiveStream) => s.status === 'ended')
  if (upcoming.length === 0 && ended.length === 0) return null
  return (
    <div className="mt-6 space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.upcomingBroadcasts')}</h3>
          {upcoming.map((s: LiveStream) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-orange-100 text-orange-600">
                📅 {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : t('common.scheduled')}
              </span>
              <p className="text-sm font-medium text-gray-900 truncate flex-1">{s.title}</p>
              <button onClick={() => onManage(s)} className="text-xs text-blue-600 font-medium shrink-0">{t('common.manage')} →</button>
            </div>
          ))}
        </div>
      )}
      {ended.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.recentBroadcasts')}</h3>
          {ended.slice(0, 5).map((s: LiveStream) => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {s.youtube_video_id && <img src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                <p className="text-xs text-gray-500">{s.ended_at ? formatKSTDate(s.ended_at) : ''}</p>
              </div>
              <a href={`/seller/live-analytics/${s.id}`} className="text-xs text-blue-600 font-medium shrink-0">{t('seller.analytics')}</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
