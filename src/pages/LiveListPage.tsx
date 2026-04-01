import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Eye, Radio } from 'lucide-react'
import api from '@/lib/api'

interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  status: string
  seller_name?: string
  current_product?: { name: string; price: number } | null
}

export default function LiveListPage() {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/streams?status=live')
      .then(r => {
        if (r.data.success) setStreams(r.data.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Radio className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">현재 진행 중인 라이브 방송이 없습니다</h2>
        <p className="text-sm text-gray-500">곧 새로운 라이브가 시작됩니다</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
        라이브 방송 ({streams.length})
      </h2>
      <div className="space-y-3">
        {streams.map(stream => (
          <button
            key={stream.id}
            onClick={() => navigate(`/live/${stream.id}`)}
            className="w-full flex gap-3 p-3 bg-white rounded-xl border border-gray-100 text-left active:scale-[0.98] transition-transform"
          >
            {/* 썸네일 */}
            <div className="w-24 h-32 rounded-lg overflow-hidden bg-gray-200 shrink-0 relative">
              {stream.youtube_video_id ? (
                <img
                  src={`https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
              )}
              <div className="absolute top-1 left-1 flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded">
                <span className="h-1 w-1 bg-white rounded-full animate-pulse" />
                <span className="text-[8px] font-bold text-white">LIVE</span>
              </div>
            </div>

            {/* 정보 */}
            <div className="flex-1 min-w-0 py-1">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{stream.title}</p>
              {stream.seller_name && (
                <p className="text-xs text-gray-500 mt-1">@{stream.seller_name}</p>
              )}
              {stream.current_product && (
                <div className="mt-2 px-2 py-1 bg-red-50 rounded-lg inline-block">
                  <p className="text-xs font-bold text-red-600">
                    {stream.current_product.name} ₩{stream.current_product.price.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
