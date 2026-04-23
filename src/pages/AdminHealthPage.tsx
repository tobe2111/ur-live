import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
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
    <AdminLayout title="시스템 상태">
      <SEO title="시스템 상태" description="실시간 시스템 헬스 모니터링" url="/admin/health" noindex />
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="시스템 상태"
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
