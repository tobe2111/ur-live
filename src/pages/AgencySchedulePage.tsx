import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { Calendar, Play, Clock, Loader2 } from 'lucide-react'

export default function AgencySchedulePage() {
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }

  useEffect(() => {
    api.get('/api/agency/schedule', { headers })
      .then(r => { if (r.data.success) setStreams(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <AgencyLayout title="방송 스케줄">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">방송 스케줄</h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : streams.length === 0 ? (
          <div className="text-center py-12 text-gray-500">예정된 방송이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {streams.map((s: any) => {
              const isLive = s.status === 'live'
              const schedDate = s.scheduled_at ? new Date(s.scheduled_at) : null
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isLive ? 'bg-red-50' : 'bg-blue-50'}`}>
                    {isLive ? <Play className="w-5 h-5 text-red-500" /> : <Clock className="w-5 h-5 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isLive ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                        {isLive ? 'LIVE' : '예정'}
                      </span>
                      <span className="text-xs text-gray-500">{s.seller_name}</span>
                    </div>
                    <p className="font-medium text-gray-900 text-sm truncate">{s.title}</p>
                    {schedDate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {schedDate.toLocaleString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <a href={`/live/${s.id}`} target="_blank" className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                    보기
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
