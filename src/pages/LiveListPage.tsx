import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Radio, Clock, Play, ChevronRight } from 'lucide-react'
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
  created_at?: string
}

export default function LiveListPage() {
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = '라이브 - 유어딜' }, [])

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/streams?status=live'),
      api.get('/api/streams?status=scheduled'),
      api.get('/api/streams?status=ended&limit=10'),
    ]).then(([liveRes, scheduledRes, endedRes]) => {
      if (liveRes.status === 'fulfilled' && liveRes.value.data.success) setLiveStreams(liveRes.value.data.data || [])
      if (scheduledRes.status === 'fulfilled' && scheduledRes.value.data.success) setScheduledStreams(scheduledRes.value.data.data || [])
      if (endedRes.status === 'fulfilled' && endedRes.value.data.success) setEndedStreams(endedRes.value.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const getThumb = (s: LiveStream) =>
    s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg` : null

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasNoContent = liveStreams.length === 0 && scheduledStreams.length === 0 && endedStreams.length === 0

  if (hasNoContent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#121212] flex items-center justify-center mb-4">
          <Radio className="w-8 h-8 text-gray-600" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">현재 진행 중인 라이브가 없습니다</h2>
        <p className="text-sm text-gray-500">곧 새로운 라이브가 시작됩니다</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 space-y-7 pb-24">
      {/* 실시간 라이브 */}
      {liveStreams.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-base font-bold text-white">지금 라이브</h2>
            <span className="text-xs text-red-400 font-bold">{liveStreams.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {liveStreams.map(s => (
              <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="text-left active:scale-[0.97] transition-transform">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#121212]">
                  {getThumb(s) ? <img src={getThumb(s)!} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-md shadow-lg shadow-red-500/30">
                    <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-white">LIVE</span>
                  </div>
                  {s.viewer_count !== undefined && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                      <Eye className="h-3 w-3 text-white" />
                      <span className="text-[10px] text-white font-medium">{s.viewer_count}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {s.seller_name && <p className="text-[10px] text-white/70 mb-0.5">@{s.seller_name}</p>}
                    <p className="text-[12px] font-bold text-white line-clamp-2">{s.title}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 예정된 방송 */}
      {scheduledStreams.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-blue-400" />
            <h2 className="text-base font-bold text-white">예정된 방송</h2>
            <span className="text-xs text-blue-400 font-bold">{scheduledStreams.length}</span>
          </div>
          <div className="space-y-2">
            {scheduledStreams.map(s => (
              <button key={s.id} onClick={() => navigate(`/live/${s.id}`)}
                className="w-full flex items-center gap-3 p-3 bg-[#121212] rounded-xl text-left active:scale-[0.98] transition-transform border border-[#1A1A1A]">
                <div className="w-16 h-20 rounded-lg overflow-hidden bg-[#1A1A1A] shrink-0">
                  {getThumb(s) ? <img src={getThumb(s)!} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-400/50" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium">예정</span>
                  <p className="text-sm font-semibold text-white mt-1 line-clamp-1">{s.title}</p>
                  {s.seller_name && <p className="text-xs text-gray-500 mt-0.5">@{s.seller_name}</p>}
                  {s.scheduled_at && (
                    <p className="text-xs text-blue-400 mt-1">
                      {new Date(s.scheduled_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 최근 종료 */}
      {endedStreams.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Play className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-bold text-white">다시보기</h2>
            <span className="text-xs text-gray-500 font-bold">{endedStreams.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {endedStreams.map(s => (
              <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="text-left active:scale-[0.97] transition-transform">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#121212]">
                  {getThumb(s) ? <img src={getThumb(s)!} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-gray-700/80 px-2 py-0.5 rounded-md">
                    <Play className="h-2.5 w-2.5 text-white" />
                    <span className="text-[10px] font-bold text-white">다시보기</span>
                  </div>
                </div>
                <div className="mt-2 px-0.5">
                  <p className="text-[12px] font-medium text-white line-clamp-2">{s.title}</p>
                  {s.seller_name && <p className="text-[10px] text-gray-500 mt-0.5">@{s.seller_name}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
