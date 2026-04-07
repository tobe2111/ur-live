import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Eye, Radio, Clock, CheckCircle } from 'lucide-react'
import api from '@/lib/api'

interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  status: string
  seller_name?: string
  viewer_count?: number
  current_product?: { name: string; price: number } | null
  scheduled_at?: string
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <div className="absolute top-1 left-1 flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded">
        <span className="h-1 w-1 bg-white rounded-full animate-pulse" />
        <span className="text-[8px] font-bold text-white">LIVE</span>
      </div>
    )
  }
  if (status === 'scheduled') {
    return (
      <div className="absolute top-1 left-1 flex items-center gap-1 bg-blue-500 px-1.5 py-0.5 rounded">
        <Clock className="h-2 w-2 text-white" />
        <span className="text-[8px] font-bold text-white">예정</span>
      </div>
    )
  }
  return (
    <div className="absolute top-1 left-1 flex items-center gap-1 bg-gray-600 px-1.5 py-0.5 rounded">
      <CheckCircle className="h-2 w-2 text-white" />
      <span className="text-[8px] font-bold text-white">종료</span>
    </div>
  )
}

function StreamCard({ stream, onClick }: { stream: LiveStream; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 p-3 bg-[#121212] rounded-xl border border-[#1A1A1A] text-left active:scale-[0.98] transition-transform"
    >
      {/* 썸네일 */}
      <div className="w-24 h-32 rounded-lg overflow-hidden bg-[#1A1A1A] shrink-0 relative">
        {stream.youtube_video_id ? (
          <img
            src={`https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
        )}
        <StatusBadge status={stream.status} />
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0 py-1">
        <p className="text-sm font-semibold text-white line-clamp-2">{stream.title}</p>
        {stream.seller_name && (
          <p className="text-xs text-gray-500 mt-1">@{stream.seller_name}</p>
        )}
        {stream.status === 'live' && stream.viewer_count !== undefined && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
            <Eye className="w-3 h-3" />
            <span>{stream.viewer_count.toLocaleString()}명 시청 중</span>
          </div>
        )}
        {stream.status === 'scheduled' && stream.scheduled_at && (
          <p className="text-xs text-blue-400 mt-1.5">
            {new Date(stream.scheduled_at).toLocaleString('ko-KR', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
        {stream.current_product && (
          <div className="mt-2 px-2 py-1 bg-red-500/10 rounded-lg inline-block">
            <p className="text-xs font-bold text-red-400">
              {stream.current_product.name} ₩{stream.current_product.price.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </button>
  )
}

export default function LiveListPage() {
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = '라이브 - 유어딜' }, [])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [liveRes, scheduledRes, endedRes] = await Promise.allSettled([
          api.get('/api/streams?status=live'),
          api.get('/api/streams?status=scheduled'),
          api.get('/api/streams?status=ended&limit=10'),
        ])

        if (liveRes.status === 'fulfilled' && liveRes.value.data.success) {
          setLiveStreams(liveRes.value.data.data || [])
        }
        if (scheduledRes.status === 'fulfilled' && scheduledRes.value.data.success) {
          setScheduledStreams(scheduledRes.value.data.data || [])
        }
        if (endedRes.status === 'fulfilled' && endedRes.value.data.success) {
          setEndedStreams(endedRes.value.data.data || [])
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasNoContent = liveStreams.length === 0 && scheduledStreams.length === 0 && endedStreams.length === 0

  if (hasNoContent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center mb-4">
          <Radio className="w-7 h-7 text-gray-500" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">현재 진행 중인 라이브 방송이 없습니다</h2>
        <p className="text-sm text-gray-500">곧 새로운 라이브가 시작됩니다</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-6 overflow-y-auto">
      {/* Live streams */}
      {liveStreams.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            라이브 방송 ({liveStreams.length})
          </h2>
          <div className="space-y-3">
            {liveStreams.map(stream => (
              <StreamCard key={stream.id} stream={stream} onClick={() => navigate(`/live/${stream.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled streams */}
      {scheduledStreams.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            예정된 방송 ({scheduledStreams.length})
          </h2>
          <div className="space-y-3">
            {scheduledStreams.map(stream => (
              <StreamCard key={stream.id} stream={stream} onClick={() => navigate(`/live/${stream.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Ended streams */}
      {endedStreams.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-gray-500" />
            최근 종료된 방송 ({endedStreams.length})
          </h2>
          <div className="space-y-3">
            {endedStreams.map(stream => (
              <StreamCard key={stream.id} stream={stream} onClick={() => navigate(`/live/${stream.id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
