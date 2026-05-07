/**
 * 🛡️ 2026-05-07: Admin 시스템 운영 모니터링 — Cron 실패 + 알림톡 실패 통합 뷰.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState, DashboardCard } from '@/components/dashboard'
import { Activity, AlertTriangle, RefreshCw, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface CronFailure {
  id: number
  job_name: string
  error_message: string
  severity: 'warning' | 'error' | 'critical'
  resolved: number
  created_at: string
}

interface AlimtalkFailure {
  id: number
  phone: string
  template_code: string
  message: string
  error: string | null
  retry_count: number
  max_retries: number
  next_retry_at: string
  resolved: number
  created_at: string
}

const SEVERITY_BADGE: Record<string, string> = {
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  critical: 'bg-purple-100 text-purple-700 border-purple-200',
}

export default function AdminSystemMonitoringPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'cron' | 'alimtalk'>('cron')
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<number | null>(null)

  const [cronFailures, setCronFailures] = useState<CronFailure[]>([])
  const [cronCounts, setCronCounts] = useState<Array<{ severity: string; cnt: number }>>([])

  const [alimtalkFailures, setAlimtalkFailures] = useState<AlimtalkFailure[]>([])
  const [alimtalkStats, setAlimtalkStats] = useState({ abandoned: 0, pending: 0, succeeded: 0 })

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'cron') {
        const res = await api.get(`/api/admin/cron-failures?resolved=${showResolved ? 1 : 0}`, auth)
        if (res.data?.success) {
          setCronFailures(res.data.data.items)
          setCronCounts(res.data.data.unresolved_counts)
        }
      } else {
        const res = await api.get(`/api/admin/alimtalk-failures?resolved=${showResolved ? 1 : 0}`, auth)
        if (res.data?.success) {
          setAlimtalkFailures(res.data.data.items)
          setAlimtalkStats(res.data.data.stats)
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn(e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [tab, showResolved])

  const resolveCron = async (id: number) => {
    setActing(id)
    try {
      await api.patch(`/api/admin/cron-failures/${id}/resolve`, {}, auth)
      toast.success('해결 처리 완료')
      load()
    } catch { toast.error('실패') } finally { setActing(null) }
  }

  const retryAlimtalk = async (id: number) => {
    setActing(id)
    try {
      const res = await api.post(`/api/admin/alimtalk-failures/${id}/retry`, {}, auth)
      toast.success(res.data?.message || '재시도 예약됨')
      load()
    } catch { toast.error('실패') } finally { setActing(null) }
  }

  return (
    <AdminLayout title="시스템 모니터링">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          icon={<Activity className="h-5 w-5" />}
          title="시스템 모니터링"
          subtitle="Cron job 실패 + 알림톡 발송 실패 자동 추적"
        />

        {/* 탭 */}
        <div className="flex gap-2">
          <button onClick={() => setTab('cron')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'cron' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            <AlertTriangle className="w-4 h-4" /> Cron 실패
            {cronCounts.reduce((s, c) => s + c.cnt, 0) > 0 && tab !== 'cron' && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {cronCounts.reduce((s, c) => s + c.cnt, 0)}
              </span>
            )}
          </button>
          <button onClick={() => setTab('alimtalk')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'alimtalk' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            <MessageSquare className="w-4 h-4" /> 알림톡 실패
            {alimtalkStats.pending + alimtalkStats.abandoned > 0 && tab !== 'alimtalk' && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {alimtalkStats.pending + alimtalkStats.abandoned}
              </span>
            )}
          </button>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
            해결됨 보기
          </label>
          <button onClick={load} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>

        {/* 통계 */}
        {tab === 'cron' && cronCounts.length > 0 && (
          <DashboardCard className="!p-3">
            <div className="flex flex-wrap gap-2">
              {cronCounts.map(c => (
                <span key={c.severity} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SEVERITY_BADGE[c.severity] || 'bg-gray-100'}`}>
                  {c.severity}: {c.cnt}건
                </span>
              ))}
            </div>
          </DashboardCard>
        )}
        {tab === 'alimtalk' && (
          <DashboardCard className="!p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">7일 성공</p>
                <p className="text-lg font-bold text-green-600">{alimtalkStats.succeeded}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">대기 중</p>
                <p className="text-lg font-bold text-amber-600">{alimtalkStats.pending}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">포기됨 (max 3회 초과)</p>
                <p className="text-lg font-bold text-red-600">{alimtalkStats.abandoned}</p>
              </div>
            </div>
          </DashboardCard>
        )}

        {/* 목록 */}
        {loading ? <DashboardLoading /> : tab === 'cron' ? (
          cronFailures.length === 0 ? (
            <DashboardEmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} title={showResolved ? '해결된 실패 없음' : '🎉 미해결 cron 실패 없음'} />
          ) : (
            <div className="space-y-2">
              {cronFailures.map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900">{f.job_name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${SEVERITY_BADGE[f.severity]}`}>
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 break-words">{f.error_message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(f.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    {!f.resolved && (
                      <button onClick={() => resolveCron(f.id)} disabled={acting === f.id}
                        className="shrink-0 px-3 py-1.5 bg-green-100 text-green-700 rounded text-[11px] font-bold disabled:opacity-50">
                        {acting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '해결'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          alimtalkFailures.length === 0 ? (
            <DashboardEmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} title={showResolved ? '성공한 발송 없음' : '🎉 미해결 알림톡 실패 없음'} />
          ) : (
            <div className="space-y-2">
              {alimtalkFailures.map(f => {
                const abandoned = f.retry_count >= f.max_retries && !f.resolved
                return (
                  <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-mono text-gray-900">{f.phone}</p>
                          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{f.template_code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            abandoned ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {f.retry_count}/{f.max_retries}회
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">{f.message}</p>
                        {f.error && <p className="text-[10px] text-red-500 mt-1">에러: {f.error}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">
                          생성: {new Date(f.created_at).toLocaleString('ko-KR')} · 다음 시도: {new Date(f.next_retry_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      {!f.resolved && (
                        <button onClick={() => retryAlimtalk(f.id)} disabled={acting === f.id}
                          className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-[11px] font-bold disabled:opacity-50">
                          {acting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '즉시 재시도'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </AdminLayout>
  )
}
