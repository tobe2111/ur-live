import { useNavigate } from 'react-router-dom'
import { Calendar, Eye, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { safeDate, safeTime } from '@/utils/safe-date'

interface LiveStream {
  id: number
  title: string
  youtube_video_id: string
  status: 'scheduled' | 'live' | 'ended'
  scheduled_at?: string
  viewer_count?: number
}

interface UpcomingLiveProps {
  streams: LiveStream[]
}

function calculateDDay(dateString: string): string {
  const target = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'D-Day'
  if (diffDays > 0) return `D-${diffDays}`
  return `D+${Math.abs(diffDays)}`
}

export function UpcomingLive({ streams }: UpcomingLiveProps) {
  const navigate = useNavigate()
  
  // Filter and sort: live first, then scheduled
  const sortedStreams = streams
    .filter(s => s.status === 'live' || s.status === 'scheduled')
    .sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1
      if (a.status !== 'live' && b.status === 'live') return 1
      if (a.scheduled_at && b.scheduled_at) {
        return safeTime(a.scheduled_at) - safeTime(b.scheduled_at)
      }
      return 0
    })

  if (sortedStreams.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
        Upcoming Live
      </h2>
      
      <div className="space-y-2">
        {sortedStreams.map((stream) => (
          <button
            key={stream.id}
            onClick={() => navigate(`/live/${stream.id}`)}
            className="w-full group"
          >
            {/* YouTube Thumbnail */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-2 bg-gray-100">
              <img
                src={`https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`}
                alt={stream.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              
              {/* Live Badge or D-Day Badge */}
              <div className="absolute top-2 left-2">
                {stream.status === 'live' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-red-500 text-white rounded">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                ) : stream.scheduled_at ? (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-black/70 text-white rounded backdrop-blur-sm">
                    {calculateDDay(stream.scheduled_at)}
                  </span>
                ) : null}
              </div>

              {/* Viewer Count (if live) */}
              {stream.status === 'live' && stream.viewer_count !== undefined && (
                <div className="absolute bottom-2 left-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-black/70 text-white rounded backdrop-blur-sm">
                    <Eye className="w-3 h-3" />
                    {formatNumber(stream.viewer_count)}
                  </span>
                </div>
              )}
            </div>

            {/* Stream Info */}
            <div className="flex items-start justify-between gap-2 text-left">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-gray-600 transition-colors">
                  {stream.title}
                </h3>
                {stream.scheduled_at && stream.status === 'scheduled' && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {safeDate(stream.scheduled_at)?.toLocaleString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) ?? '-'}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-600 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
