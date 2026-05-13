import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Radio, Eye, Clock, StopCircle, RefreshCw, ExternalLink, Trash2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'

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
  // 🛡️ 2026-05-07: 강화된 모니터링 필드
  total_messages?: number
  product_changes?: number
  total_revenue?: number
  duration_minutes?: number
  thumbnail_url?: string
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
  const { t } = useTranslation()
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
      intervalRef.current = setInterval(() => { if (!document.hidden) loadLive() }, 10000)
      const onVisible = () => { if (!document.hidden && autoRefresh) loadLive() }
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        document.removeEventListener('visibilitychange', onVisible)
      }
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
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '종료 실패')
    }
  }

  async function deleteStream(stream: { id: number; title: string }) {
    if (!confirm(`"${stream.title}" 방송을 메인 노출에서 삭제하시겠습니까?\n\n· 소프트 삭제 (이력/매출은 보존)\n· 메인/홈/다시보기 피드에서 즉시 제거됩니다`)) return
    try {
      const res = await api.delete(`/api/admin/live-monitor/${stream.id}`, h)
      if (res.data.success) {
        toast.success('방송이 삭제되었습니다')
        loadData()
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '삭제 실패')
    }
  }

  return (
    <AdminLayout title={t('admin.pages.liveMonitor')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.liveMonitor')}
          subtitle="진행 중인 라이브 방송 실시간 현황"
          icon={<Radio className="h-5 w-5" />}
          actions={
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
              <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
              {autoRefresh ? '자동 갱신 ON' : '자동 갱신 OFF'}
            </button>
          }
        />
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
                        src={stream.thumbnail_url || `https://img.youtube.com/vi/${stream.youtube_video_id}/mqdefault.jpg`}
                        alt="" className="w-full h-full object-cover" loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          // YouTube 영상 삭제/비공개 시 mqdefault 가 404 → hqdefault 또는 placeholder
                          if (img.src.includes('mqdefault.jpg')) {
                            img.src = `https://i.ytimg.com/vi/${stream.youtube_video_id}/hqdefault.jpg`
                          } else { img.style.display = 'none' }
                        }} />
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
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(stream.created_at)}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stream.viewer_count}명</span>
                      {stream.total_messages != null && stream.total_messages > 0 && (
                        <span className="flex items-center gap-1">💬 {formatNumber(stream.total_messages)}</span>
                      )}
                      {stream.product_changes != null && stream.product_changes > 0 && (
                        <span className="flex items-center gap-1">🔁 {stream.product_changes}회</span>
                      )}
                      {stream.total_revenue != null && stream.total_revenue > 0 && (
                        <span className="flex items-center gap-1 font-bold text-green-600">💰 {formatNumber(stream.total_revenue)}원</span>
                      )}
                    </div>
                    {stream.current_product_name && (
                      <div className="mt-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-700 truncate">{stream.current_product_name}</p>
                        {stream.current_product_price && (
                          <p className="text-xs font-bold text-red-500">{formatNumber(stream.current_product_price)}원</p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <a href={`/live/${stream.id}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100">
                        <ExternalLink className="w-3 h-3" /> 보기
                      </a>
                      <button onClick={() => forceEnd(stream)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-50 text-amber-600 text-xs font-medium rounded-lg hover:bg-amber-100">
                        <StopCircle className="w-3 h-3" /> 종료
                      </button>
                      <button onClick={() => deleteStream(stream)}
                        aria-label={`"${stream.title}" 방송 삭제`}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100">
                        <Trash2 className="w-3 h-3" />
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
                        {['ID', '제목', '셀러', '시청자', '시작일', '종료일', '액션'].map(h => (
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
                          <td className="px-4 py-3 text-xs">
                            <button onClick={() => deleteStream(s)}
                              aria-label={`"${s.title}" 다시보기 삭제`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 font-medium rounded-md hover:bg-red-100">
                              <Trash2 className="w-3 h-3" /> 삭제
                            </button>
                          </td>
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
      </div>
    </AdminLayout>
  )
}
