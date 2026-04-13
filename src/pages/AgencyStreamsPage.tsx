import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { Play, Users, Clock, Radio } from 'lucide-react'

interface Stream {
  id: number
  title: string
  status: string
  viewer_count: number
  started_at: string | null
  seller_id: number
  seller_business_name: string
  seller_name: string
}

function StreamStatusBadge({ status }: { status: string }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 text-xs bg-rose-100 text-rose-600 px-2.5 py-1 rounded-full font-semibold">
      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
      LIVE
    </span>
  )
  if (status === 'ended') return (
    <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">종료</span>
  )
  return (
    <span className="text-xs bg-amber-100 text-amber-600 px-2.5 py-1 rounded-full">예정</span>
  )
}

export default function AgencyStreamsPage() {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'live' | 'ended'>('all')

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    api.get('/api/agency/streams', { headers })
      .then(r => setStreams(r.data.data || []))
      .catch(() => navigate('/agency/login', { replace: true }))
      .finally(() => setLoading(false))
  }, [token])

  const filtered = filter === 'all' ? streams : streams.filter(s => s.status === filter)
  const liveCount = streams.filter(s => s.status === 'live').length

  return (
    <AgencyLayout title="라이브 현황">
      {/* Live summary */}
      {liveCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-rose-700">현재 {liveCount}개 라이브 방송 진행 중</p>
            <p className="text-xs text-rose-500 mt-0.5">
              총 시청자: {streams.filter(s => s.status === 'live').reduce((sum, s) => sum + (s.viewer_count || 0), 0).toLocaleString()}명
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-5 py-4 border-b border-gray-100">
          {([['all', '전체'], ['live', 'LIVE'], ['ended', '종료']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === val
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {val === 'live' && liveCount > 0 && (
                <span className="ml-1.5 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">{liveCount}</span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">{filtered.length}개</span>
        </div>

        {/* Stream grid */}
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">라이브 방송이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    s.status === 'live' ? 'bg-rose-100' : 'bg-gray-100'
                  }`}>
                    <Play className={`w-4 h-4 ${s.status === 'live' ? 'text-rose-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.title || '무제 방송'}</p>
                    <p className="text-xs text-gray-400">{s.seller_business_name || s.seller_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-3 flex-shrink-0">
                  {s.status === 'live' && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="w-3.5 h-3.5" />
                      {(s.viewer_count || 0).toLocaleString()}
                    </div>
                  )}
                  {s.started_at && (
                    <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(s.started_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  <StreamStatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
