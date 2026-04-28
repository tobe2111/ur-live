import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { swallow } from '@/shared/utils/swallow'
import AdminLayout from '@/components/AdminLayout'
import { toast } from '@/hooks/useToast'
import { DashboardPageHeader } from '@/components/dashboard'
import SEO from '@/components/SEO'
import { Activity, RefreshCw } from 'lucide-react'

interface Metrics {
  active_streams: number | null
  orders_last_5min: number | null
  payments_last_5min: number | null
  stuck_pending_orders: number | null
  failed_webhooks_last_hour: number | null
  active_users_5min: number | null
  timestamp: string
  cold_start?: boolean
}

type Severity = 'ok' | 'warn' | 'crit'

function severityClasses(sev: Severity): string {
  if (sev === 'crit') return 'bg-red-50 border-red-300 text-red-700'
  if (sev === 'warn') return 'bg-amber-50 border-amber-300 text-amber-700'
  return 'bg-green-50 border-green-300 text-green-700'
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString()
}

function MetricCard({
  label,
  value,
  severity,
  hint,
}: {
  label: string
  value: number | null | undefined
  severity: Severity
  hint?: string
}) {
  return (
    <div className={`rounded-lg border p-4 ${severityClasses(severity)}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{fmt(value)}</div>
      {hint && <div className="mt-1 text-xs text-gray-600">{hint}</div>}
    </div>
  )
}

export default function AdminHealthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await api.get('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data?.success) {
        setMetrics(res.data.data)
        setError(null)
        setLastFetched(new Date())
      } else {
        setError(res.data?.error || '메트릭 조회 실패')
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login')
      return
    }
    load()
    intervalRef.current = setInterval(load, 10_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stuckSeverity: Severity = !metrics
    ? 'ok'
    : (metrics.stuck_pending_orders ?? 0) > 10
    ? 'crit'
    : (metrics.stuck_pending_orders ?? 0) > 5
    ? 'warn'
    : 'ok'

  const failedSeverity: Severity = !metrics
    ? 'ok'
    : (metrics.failed_webhooks_last_hour ?? 0) > 5
    ? 'crit'
    : (metrics.failed_webhooks_last_hour ?? 0) > 0
    ? 'warn'
    : 'ok'

  return (
    <AdminLayout title={t('admin.pages.health')}>
      <SEO title={t('admin.pages.health')} description="실시간 시스템 헬스 모니터링" url="/admin/health" noindex />
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.health')}
          subtitle={`10초마다 자동 갱신 · 마지막 갱신: ${lastFetched ? lastFetched.toLocaleTimeString('ko-KR') : '—'}`}
          icon={<Activity className="h-5 w-5" />}
          actions={
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              새로고침
            </button>
          }
        />

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !metrics ? (
          <div className="text-sm text-gray-500">로딩 중...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="라이브 중인 방송"
              value={metrics?.active_streams}
              severity="ok"
              hint="live_streams.status='live'"
            />
            <MetricCard
              label="주문 (최근 5분)"
              value={metrics?.orders_last_5min}
              severity="ok"
              hint="orders.created_at > -5min"
            />
            <MetricCard
              label="결제 확정 (최근 5분)"
              value={metrics?.payments_last_5min}
              severity="ok"
              hint="status IN (PAID, DONE)"
            />
            <MetricCard
              label="지연 주문 (PENDING > 5분)"
              value={metrics?.stuck_pending_orders}
              severity={stuckSeverity}
              hint={stuckSeverity === 'crit' ? '⚠ 10건 초과 — 결제 시스템 점검' : '정상 < 5'}
            />
            <MetricCard
              label="실패한 웹훅 (1시간)"
              value={metrics?.failed_webhooks_last_hour}
              severity={failedSeverity}
              hint={failedSeverity !== 'ok' ? '⚠ Toss/Stripe 연동 점검' : '정상'}
            />
            <MetricCard
              label="활성 유저 (최근 5분)"
              value={metrics?.active_users_5min}
              severity="ok"
              hint="user_sessions DISTINCT"
            />
          </div>
        )}

        {/* 🛡️ 2026-04-26 M7: Webhook 실패 상세 + 재시도 (TD-009) */}
        <WebhookFailuresSection />

        {metrics?.timestamp && (
          <div className="mt-6 text-xs text-gray-500">
            서버 타임스탬프: {metrics.timestamp}
            {metrics.cold_start ? ' · cold start' : ''}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

// 🛡️ 2026-04-26 M7 (TD-009): Webhook 실패 상세 섹션
interface WebhookFailureStats {
  total: number
  by_source: { source: string; count: number }[]
  by_event_type: { event_type: string; count: number }[]
  escalated: number
}

interface WebhookEvent {
  id: string
  source: string
  event_type: string
  status: string
  toss_order_id?: string
  order_number?: string
  error_message?: string
  created_at: string
}

function WebhookFailuresSection() {
  const [stats, setStats] = useState<WebhookFailureStats | null>(null)
  const [recent, setRecent] = useState<WebhookEvent[]>([])
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const adminToken = localStorage.getItem('admin_token')

  const load = () => {
    setLoading(true)
    api.get(`/api/admin/metrics/webhook-failures?hours=${hours}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    })
      .then(r => {
        if (r.data?.success) {
          setStats(r.data.data.stats)
          setRecent(r.data.data.recent || [])
        }
      })
      .catch(swallow('admin-health:load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hours])

  const retry = async (id: string) => {
    if (!confirm('이 webhook event 를 재처리 마킹하시겠습니까?')) return
    try {
      await api.post(`/api/admin/metrics/webhook-failures/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      toast.success('재처리 큐에 추가됨')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '재시도 실패')
    }
  }

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">📡 Webhook 실패 (TD-009)</h3>
        <select value={hours} onChange={e => setHours(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-900">
          <option value={1}>1시간</option>
          <option value={24}>24시간</option>
          <option value={72}>3일</option>
          <option value={168}>7일</option>
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-3">불러오는 중...</p>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className={`rounded-xl p-3 ${stats.total > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className="text-xs text-gray-600 font-bold">총 실패</p>
                <p className="text-2xl font-extrabold text-gray-900">{stats.total}</p>
              </div>
              <div className={`rounded-xl p-3 ${stats.escalated > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-600 font-bold">escalated (retry≥3)</p>
                <p className="text-2xl font-extrabold text-red-600">{stats.escalated}</p>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <p className="text-xs text-gray-600 font-bold">소스</p>
                <p className="text-xs text-gray-700 mt-1 line-clamp-2">
                  {stats.by_source.map(s => `${s.source}(${s.count})`).join(' · ') || '-'}
                </p>
              </div>
            </div>
          )}

          {recent.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">실패 이벤트 없음 ✓</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {recent.map(r => (
                <div key={r.id} className={`text-xs p-2 rounded border ${
                  r.status === 'FAILED' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-gray-900">{r.event_type}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{r.source}</span>
                      {r.toss_order_id && (
                        <>
                          <span className="text-gray-400 mx-1">·</span>
                          <span className="font-mono text-gray-600">{r.toss_order_id}</span>
                        </>
                      )}
                    </div>
                    {r.status === 'FAILED' && (
                      <button onClick={() => retry(r.id)}
                        className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200 font-bold">
                        재처리
                      </button>
                    )}
                  </div>
                  {r.error_message && (
                    <p className="text-[10px] text-red-600 mt-1 line-clamp-2">{r.error_message}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleString('ko-KR')}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
