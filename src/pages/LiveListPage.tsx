import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Radio, Clock, Play, ChevronRight, ArrowLeft, Bell } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BroadcastNotifyButton from '@/components/live/BroadcastNotifyButton'

interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  status: string
  seller_name?: string
  viewer_count?: number
  current_product?: { name: string; price: number } | null
  scheduled_at?: string
  created_at?: string
  thumbnail_url?: string
  image_url?: string
}

export default function LiveListPage() {
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'live' | 'scheduled' | 'replay'>('all')

  useEffect(() => { document.title = 'Live - YourDeal' }, [])

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/streams?status=live'),
      api.get('/api/streams?status=scheduled'),
      api.get('/api/streams?status=ended&limit=20'),
    ]).then(([liveRes, scheduledRes, endedRes]) => {
      if (liveRes.status === 'fulfilled' && liveRes.value.data.success) setLiveStreams(liveRes.value.data.data || [])
      if (scheduledRes.status === 'fulfilled' && scheduledRes.value.data.success) setScheduledStreams(scheduledRes.value.data.data || [])
      if (endedRes.status === 'fulfilled' && endedRes.value.data.success) setEndedStreams(endedRes.value.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const getThumb = (s: LiveStream) =>
    s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`
    : s.thumbnail_url || s.image_url || null

  const totalCount = liveStreams.length + scheduledStreams.length + endedStreams.length

  return (
    <div className="min-h-screen bg-[#020202]">
      <SEO title="Live" description="Yourdeal live streams and replays" url="/live" />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-[17px] font-bold text-white">Live</h1>
          <button onClick={() => navigate('/notifications')} className="p-1.5 rounded-full hover:bg-white/10">
            <Bell className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {[
            { key: 'all' as const, label: 'All', count: totalCount },
            { key: 'live' as const, label: 'Live', count: liveStreams.length },
            { key: 'scheduled' as const, label: 'Coming', count: scheduledStreams.length },
            { key: 'replay' as const, label: 'Replay', count: endedStreams.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === t.key
                  ? 'bg-white text-gray-900'
                  : 'bg-[#1A1A1A] text-gray-400'
              }`}
            >
              {t.label} {t.count > 0 && <span className="ml-0.5 opacity-60">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#121212] flex items-center justify-center mb-4">
            <Radio className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-base font-bold text-white mb-1">No live right now</p>
          <p className="text-sm text-gray-500">Check back soon</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6 pb-24">

          {/* Live Now */}
          {(tab === 'all' || tab === 'live') && liveStreams.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-sm font-bold text-white">NOW</h2>
                <span className="text-xs text-red-400 font-bold">{liveStreams.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {liveStreams.map(s => (
                  <StreamCard key={s.id} stream={s} type="live" onClick={() => navigate(`/live/${s.id}`)} getThumb={getThumb} />
                ))}
              </div>
            </section>
          )}

          {/* Scheduled */}
          {(tab === 'all' || tab === 'scheduled') && scheduledStreams.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">COMING SOON</h2>
                <span className="text-xs text-blue-400 font-bold">{scheduledStreams.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {scheduledStreams.map(s => (
                  <div key={s.id}>
                    <StreamCard stream={s} type="scheduled" onClick={() => navigate(`/live/${s.id}`)} getThumb={getThumb} />
                    <div className="mt-2">
                      <BroadcastNotifyButton streamId={s.id} compact />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Replay */}
          {(tab === 'all' || tab === 'replay') && endedStreams.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Play className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-bold text-white">REPLAY</h2>
                <span className="text-xs text-gray-500 font-bold">{endedStreams.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {endedStreams.map(s => (
                  <StreamCard key={s.id} stream={s} type="ended" onClick={() => navigate(`/live/${s.id}`)} getThumb={getThumb} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function StreamCard({ stream, type, onClick, getThumb }: {
  stream: LiveStream; type: 'live' | 'scheduled' | 'ended'
  onClick: () => void; getThumb: (s: LiveStream) => string | null
}) {
  const thumb = getThumb(stream)
  const schedDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null

  return (
    <button onClick={onClick} className="text-left active:scale-[0.97] transition-transform w-full">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#121212]">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <Play className="w-8 h-8 text-gray-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Badge */}
        {type === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-md shadow-lg shadow-red-500/30">
            <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white">LIVE</span>
          </div>
        )}
        {type === 'scheduled' && (
          <div className="absolute top-2 left-2 bg-blue-500 px-2 py-0.5 rounded-md">
            <span className="text-[10px] font-bold text-white">SOON</span>
          </div>
        )}
        {type === 'ended' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-md">
            <Play className="h-2.5 w-2.5 text-white fill-white" />
            <span className="text-[10px] font-bold text-white">REPLAY</span>
          </div>
        )}

        {/* Viewers */}
        {type === 'live' && stream.viewer_count !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-md">
            <Eye className="h-3 w-3 text-white" />
            <span className="text-[10px] text-white font-medium">{stream.viewer_count}</span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {stream.seller_name && (
            <p className="text-[10px] text-white/60 mb-0.5">{stream.seller_name}</p>
          )}
          <p className="text-[12px] font-bold text-white line-clamp-2 leading-snug">{stream.title}</p>
          {type === 'scheduled' && schedDate && (
            <p className="text-[10px] text-blue-300 mt-1 font-medium">
              {schedDate.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
