import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { Radio, Eye, Clock, StopCircle, RefreshCw, ExternalLink } from 'lucide-react'

interface LiveStream {
  id: number
  title: string
  seller_name: string
  seller_id: number
  youtube_video_id: string
  viewer_count: number
  created_at: string
  current_product_name?: string
  current_product_price?: number
}

interface EndedStream {
  id: number
  title: string
  seller_name: string
  youtube_video_id: string
  viewer_count: number
  created_at: string
  updated_at: string
}

function formatDuration(startDate: string): string {
  const diff = Date.now() - new Date(startDate).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

export default function AdminLiveMonitorPage() {
  const navigate = useNavigate()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [history, setHistory] = useState<EndedStream[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadData()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadLive, 10000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh])

  async function loadData() {
    await Promise.all([loadLive(), loadHistory()])
    setLoading(false)
  }

  async function loadLive() {
    try {
      const res = await api.get('/api/admin/live-monitor', h)
      if (res.data.success) setLiveStreams(res.data.data || [])
    } catch {}
  }

  async function loadHistory() {
    try {
      const res = await api.get('/api/admin/live-monitor/history?days=7', h)
      if (res.data.success) setHistory(res.data.data || [])
    } catch {}
  }

  async function forceEnd(stream: LiveStream) {
    if (!confirm(`"${stream.title}" 방송을 강제 종료하시겠습니까?`)) return
    try {
      const res = await api.patch(`/api/admin/live-monitor/${stream.id}/end`, {}, h)
      if (res.data.success) {
        toast.success('방송이 종료되었습니다')
        loadData()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || '종료 실패')
    }
  }

  return (
    <AdminLayout title="라이브 모니터링" headerRight={
      <div className="flex items-center gap-2">
        <button onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
          <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
          {autoRefresh ? '자동 갱신 ON' : '자동 갱신 OFF'}
        </button>
      </div>
    }>
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* 라이브 방송 카드 */}
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-900">진행 중인 라이브 ({liveStreams.length}개)</h2>
          </div>

          {liveStreams.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Radio className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">현재 진행 중인 라이브가 없습니다</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveStreams.map(stream => (
                <div key={stream.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* 썸네일 */}
                  {stream.youtube_video_id && (
                    <div className="relative aspect-video bg-gray-100">
                      <img
                        src={`https://img.youtube.com/vi/${stream.youtube_video_id}/mqdefault.jpg`}
                        alt="" className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-white">LIVE</span>
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded-full">
                        <Eye className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-bold text-white">{stream.viewer_count}</span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{stream.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{stream.seller_name}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(stream.created_at)}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stream.viewer_count}명</span>
                    </div>
                    {stream.current_product_name && (
                      <div className="mt-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-700 truncate">{stream.current_product_name}</p>
                        {stream.current_product_price && (
                          <p className="text-xs font-bold text-red-500">{stream.current_product_price.toLocaleString()}원</p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <a href={`/live/${stream.id}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100">
                        <ExternalLink className="w-3 h-3" /> 보기
                      </a>
                      <button onClick={() => forceEnd(stream)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100">
                        <StopCircle className="w-3 h-3" /> 종료
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 최근 종료된 방송 */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">최근 종료된 방송 (7일)</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">최근 종료된 방송이 없습니다</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {['ID', '제목', '셀러', '시청자', '시작일', '종료일'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500">{s.id}</td>
                          <td className="px-4 py-3 text-xs text-gray-900 font-medium">{s.title}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{s.seller_name}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{s.viewer_count || 0}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.created_at).toLocaleString('ko-KR')}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{s.updated_at ? new Date(s.updated_at).toLocaleString('ko-KR') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
