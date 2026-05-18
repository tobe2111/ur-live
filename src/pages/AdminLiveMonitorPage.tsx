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

interface AdminAlert {
  id: number
  kind: string
  title: string
  body: string | null
  created_at: string
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
  // 🛡️ 2026-05-18: 일괄 삭제 — 종료된 방송 row 선택 상태.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  // 🛡️ 2026-05-13 (Phase C): 어드민 실시간 알람 — 이전 snapshot 과 비교해서 이벤트 감지.
  //   감지 이벤트: (1) 새 라이브 시작 (2) 라이브 종료 (3) 시청자 급감 (>50% drop)
  const prevLiveRef = useRef<LiveStream[]>([])
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  // 🛡️ 2026-05-13 (안정성 #3): OME health / 운영 알람 표시
  const [adminAlerts, setAdminAlerts] = useState<AdminAlert[]>([])
  const adminAlertsRef = useRef<AdminAlert[]>([])
  // 사운드 (브라우저 자체 API — 추가 자산 없음, 비용 0)
  const playAlert = (freq: number = 880) => {
    try {
      const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + 0.5)
    } catch { /* AudioContext unavailable — silent fail */ }
  }
  const sendBrowserNotification = (title: string, body: string) => {
    if (!notifyEnabled || Notification.permission !== 'granted') return
    try { new Notification(title, { body, icon: '/favicon.ico' }) } catch { /* noop */ }
  }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadData()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) {
          loadLive()
          loadAlerts()  // 🛡️ 2026-05-13 (#3): OME health alerts 도 같은 주기로 폴링
        }
      }, 10000)
      const onVisible = () => { if (!document.hidden && autoRefresh) { loadLive(); loadAlerts() } }
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
    await Promise.all([loadLive(), loadHistory(), loadAlerts()])
    setLoading(false)
  }

  async function loadLive() {
    try {
      const res = await api.get('/api/admin/live-monitor', h)
      if (res.data.success) {
        const newList = (res.data.data || []) as LiveStream[]
        // 🛡️ 2026-05-13 (Phase C): snapshot 비교 → 이벤트 감지 + 알람
        const prev = prevLiveRef.current
        if (prev.length > 0) {  // 첫 로드 X (전체 라이브를 신규로 잘못 알람 X)
          const prevIds = new Set(prev.map(s => s.id))
          const newIds = new Set(newList.map(s => s.id))
          // (1) 새 라이브 시작
          for (const s of newList) {
            if (!prevIds.has(s.id)) {
              toast.success(`🔴 새 라이브 시작: ${s.seller_name} — ${s.title}`, { duration: 6000 })
              playAlert(880)
              sendBrowserNotification('🔴 새 라이브 시작', `${s.seller_name}: ${s.title}`)
            }
          }
          // (2) 라이브 사라짐 (종료)
          for (const s of prev) {
            if (!newIds.has(s.id)) {
              toast(`방송 종료: ${s.seller_name} — ${s.title}`, { duration: 4000 })
              playAlert(440)  // 낮은 음
            }
          }
          // (3) 시청자 급감 (50% drop + 동일 stream)
          for (const cur of newList) {
            const before = prev.find(p => p.id === cur.id)
            if (!before) continue
            if (before.viewer_count >= 20 && cur.viewer_count < before.viewer_count * 0.5) {
              toast.error(`⚠️ 시청자 급감: ${cur.title} (${before.viewer_count} → ${cur.viewer_count})`, { duration: 8000 })
              playAlert(220)
              sendBrowserNotification('⚠️ 시청자 급감', `${cur.title}: ${before.viewer_count} → ${cur.viewer_count}`)
            }
          }
        }
        prevLiveRef.current = newList
        setLiveStreams(newList)
      }
    } catch {}
  }

  // 🛡️ Phase C: 브라우저 알림 권한 요청 (사용자 명시적 액션 후)
  async function requestNotifyPermission() {
    if (!('Notification' in window)) {
      toast.error('이 브라우저는 알림을 지원하지 않습니다')
      return
    }
    if (Notification.permission === 'granted') {
      setNotifyEnabled(true)
      toast.success('알림이 활성화됐습니다')
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setNotifyEnabled(true)
      toast.success('알림이 활성화됐습니다 — 새 라이브 시작 / 시청자 급감 시 알림')
    } else {
      toast.error('알림 권한이 거부됐습니다. 브라우저 설정에서 허용해주세요.')
    }
  }

  async function loadHistory() {
    try {
      const res = await api.get('/api/admin/live-monitor/history?days=7', h)
      if (res.data.success) setHistory(res.data.data || [])
    } catch {}
  }

  // 🛡️ 2026-05-13 (안정성 #3): OME health alerts + 운영 알람 로드 (라이브 폴링 주기에 함께)
  async function loadAlerts() {
    try {
      const res = await api.get('/api/admin/alerts', h)
      if (res.data.success) {
        const newAlerts: AdminAlert[] = res.data.data || []
        const prevIds = new Set(adminAlertsRef.current.map(a => a.id))
        for (const a of newAlerts) {
          if (!prevIds.has(a.id)) {
            // 새 알람 → 사운드 + 브라우저 알림
            playAlert(165)  // 가장 낮은 음 — 시스템 alert 강조
            sendBrowserNotification(`🚨 ${a.title}`, a.body || '')
            toast.error(`🚨 ${a.title}: ${a.body || ''}`, { duration: 12_000 })
          }
        }
        adminAlertsRef.current = newAlerts
        setAdminAlerts(newAlerts)
      }
    } catch { /* fail-soft */ }
  }

  async function resolveAlert(id: number) {
    try {
      await api.post(`/api/admin/alerts/${id}/resolve`, {}, h)
      setAdminAlerts(prev => prev.filter(a => a.id !== id))
    } catch { /* ignore */ }
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

  // 🛡️ 2026-05-18: 일괄 삭제 — 체크된 row 들을 한번에 soft-delete.
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === history.length && history.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(history.map((s) => s.id)))
    }
  }
  async function bulkDelete() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    if (!confirm(`선택한 ${ids.length}개 방송을 메인 노출에서 일괄 삭제하시겠습니까?\n\n· 소프트 삭제 (이력/매출은 보존)\n· 메인/홈/다시보기 피드에서 즉시 제거됩니다`)) return
    setBulkDeleting(true)
    try {
      const res = await api.delete('/api/admin/live-monitor/bulk', { ...h, data: { ids } })
      if (res.data.success) {
        toast.success(res.data.message || `${res.data.deleted}건 삭제됨`)
        setSelectedIds(new Set())
        loadData()
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '일괄 삭제 실패')
    } finally {
      setBulkDeleting(false)
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
            <div className="flex items-center gap-2">
              {/* 🛡️ 2026-05-13 (Phase C): 브라우저 알림 토글 */}
              <button onClick={requestNotifyPermission}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  notifyEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}
                title="새 라이브 시작 / 시청자 급감 시 브라우저 알림 + 사운드">
                🔔 {notifyEnabled ? '알림 ON' : '알림 OFF'}
              </button>
              <button onClick={() => setAutoRefresh(!autoRefresh)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
                {autoRefresh ? '자동 갱신 ON' : '자동 갱신 OFF'}
              </button>
            </div>
          }
        />
      {/* 🛡️ 2026-05-13 (안정성 #3): 운영 알람 배너 — OME 다운 / 시스템 이슈 즉시 표시 */}
      {adminAlerts.length > 0 && (
        <div className="space-y-2">
          {adminAlerts.map(a => (
            <div key={a.id} className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
              <div className="text-2xl">🚨</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-800">{a.title}</p>
                {a.body && <p className="text-xs text-red-600 mt-1">{a.body}</p>}
                <p className="text-[10px] text-red-400 mt-1.5">{new Date(a.created_at).toLocaleString('ko-KR')}</p>
              </div>
              <button onClick={() => resolveAlert(a.id)}
                className="text-xs text-red-700 hover:text-red-900 font-semibold underline underline-offset-2 shrink-0">
                해결됨
              </button>
            </div>
          ))}
        </div>
      )}
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">최근 종료된 방송 (7일)</h2>
              {/* 🛡️ 2026-05-18: 일괄 삭제 액션 바 — 1건 이상 선택 시 노출. */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">{selectedIds.size}건 선택됨</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                  >
                    선택 해제
                  </button>
                  <button
                    type="button"
                    onClick={bulkDelete}
                    disabled={bulkDeleting}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3 h-3" /> {bulkDeleting ? '삭제 중...' : `${selectedIds.size}건 일괄 삭제`}
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">최근 종료된 방송이 없습니다</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {/* 🛡️ 2026-05-18: 전체 선택 체크박스 — 모든 row 선택/해제. */}
                        <th className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={history.length > 0 && selectedIds.size === history.length}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < history.length
                            }}
                            onChange={toggleSelectAll}
                            aria-label="전체 선택"
                            className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                          />
                        </th>
                        {['ID', '제목', '셀러', '시청자', '시작일', '종료일', '액션'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map(s => {
                        const checked = selectedIds.has(s.id)
                        return (
                          <tr key={s.id} className={`hover:bg-gray-50 ${checked ? 'bg-red-50/40' : ''}`}>
                            <td className="px-3 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelect(s.id)}
                                aria-label={`"${s.title}" 선택`}
                                className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                              />
                            </td>
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
                        )
                      })}
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
