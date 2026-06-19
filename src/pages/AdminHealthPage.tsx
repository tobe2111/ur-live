import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { swallow } from '@/shared/utils/swallow'
import AdminLayout from '@/components/AdminLayout'
import { toast } from '@/hooks/useToast'
import { DashboardPageHeader } from '@/components/dashboard'
import SEO from '@/components/SEO'
import { Activity, RefreshCw, Database, Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

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
  return formatNumber(n)
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
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 10s 폴링 → useApiQuery refetchInterval.
  const { data: metrics = null, isLoading: loading, isError, dataUpdatedAt, refetch } = useApiQuery<Metrics | null>(
    ['admin', 'metrics'], '/api/admin/metrics',
    { select: (r: any) => (r?.success ? r.data : null), refetchInterval: 10_000 },
  )
  const error = isError ? '메트릭 조회 실패' : null
  const lastFetched = dataUpdatedAt ? new Date(dataUpdatedAt) : null
  const load = () => refetch()

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login')
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

        {/* 🛡️ 2026-06-01: DB 스키마 복구 (curl 없이 버튼 1회) */}
        <SchemaRepairSection />

        {/* 🏭 2026-06-05 (B2): 공구 정산 정합성 점검 (읽기 전용) */}
        <GroupBuySettlementAuditSection />

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

// 🛡️ 2026-06-01: DB 스키마 복구 섹션 — 신규 migration 컬럼/테이블 즉시 적용 (cron 은 매일 자동)
interface SchemaRepairResult {
  success: boolean
  error?: string
  _clientError?: string
  columns?: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }>
  tables?: Array<{ name: string; status: 'ok' | 'error'; error?: string }>
}

function SchemaRepairSection() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SchemaRepairResult | null>(null)
  // 🚚 2026-06-18: 빠른 진단/복구 (sellers 컬럼 한도로 전체 repair 가 67 오류·524 → 핵심 컬럼만/진단)
  const [quickRunning, setQuickRunning] = useState(false)
  const [quick, setQuick] = useState<{ present?: Record<string, boolean>; ran?: string[]; errors?: { step: string; error: string }[]; _err?: string } | null>(null)

  const runQuick = async () => {
    if (quickRunning) return
    setQuickRunning(true)
    setQuick(null)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/_internal/repair-schema-quick', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({})) as { present?: Record<string, boolean>; ran?: string[]; errors?: { step: string; error: string }[]; error?: string }
      if (!res.ok) {
        setQuick({ _err: (res.status === 401 || res.status === 403) ? '관리자 인증 필요 (다시 로그인 후 시도)' : `HTTP ${res.status}` })
        toast.error('빠른 복구 실패')
        return
      }
      setQuick({ present: data.present, ran: data.ran, errors: data.errors })
      toast.success('빠른 진단/복구 완료')
    } catch {
      setQuick({ _err: '네트워크 오류' })
      toast.error('빠른 복구 요청 실패')
    } finally {
      setQuickRunning(false)
    }
  }

  const run = async () => {
    if (running) return
    setRunning(true)
    setResult(null)
    try {
      const token = localStorage.getItem('admin_token')
      // 🏭 2026-06-05 (사용자 신고 — 버튼 눌러도 결과가 안 나옴): 토큰 없으면 세션 쿠키로 폴백
      //   (credentials:'include') + res.ok/success 검사. 기존엔 401/403 이어도 columns 없음 →
      //   added=0/errs=0 → "변경 없음" 으로 거짓 표시됐음.
      const res = await fetch('/api/_internal/repair-schema', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      let data: SchemaRepairResult
      try { data = (await res.json()) as SchemaRepairResult } catch { data = { success: false } }
      if (!res.ok || data.success === false) {
        const msg = data.error || (res.status === 401 || res.status === 403 ? '관리자 인증 필요 (다시 로그인 후 시도)' : `HTTP ${res.status}`)
        setResult({ success: false, _clientError: msg })
        toast.error(`스키마 복구 실패: ${msg}`)
        return
      }
      setResult(data)
      const added = data.columns?.filter((r) => r.status === 'added').length ?? 0
      const errs =
        (data.columns?.filter((r) => r.status === 'error').length ?? 0) +
        (data.tables?.filter((r) => r.status === 'error').length ?? 0)
      if (errs > 0) toast.error(`스키마 복구: ${errs}건 오류 — 상세 확인`)
      else toast.success(added > 0 ? `스키마 복구 완료: 컬럼 ${added}개 추가` : '스키마 최신 상태 (변경 없음)')
    } catch {
      setResult({ success: false, _clientError: '네트워크 오류 또는 응답 파싱 실패' })
      toast.error('스키마 복구 요청 실패')
    } finally {
      setRunning(false)
    }
  }

  const added = result?.columns?.filter((r) => r.status === 'added') ?? []
  const existsCount = result?.columns?.filter((r) => r.status === 'exists').length ?? 0
  const checkedCount = (result?.columns?.length ?? 0) + (result?.tables?.length ?? 0)
  const errs = [
    ...(result?.columns?.filter((r) => r.status === 'error').map((r) => `컬럼: ${r.desc} — ${r.error}`) ?? []),
    ...(result?.tables?.filter((r) => r.status === 'error').map((r) => `테이블: ${r.name} — ${r.error}`) ?? []),
  ]

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-gray-700" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">DB 스키마 복구</h2>
            <p className="text-xs text-gray-500">
              신규 배포의 누락 컬럼/테이블을 즉시 적용. (매일 새벽 3시 자동 실행되므로 평소엔 불필요)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runQuick}
            disabled={quickRunning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            title="핵심 컬럼만 빠르게 적용 + 존재 진단 (전체 복구가 524/오류일 때)"
          >
            {quickRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            {quickRunning ? '진단 중...' : '빠른 진단/복구'}
          </button>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            {running ? '실행 중...' : '지금 스키마 복구 (전체)'}
          </button>
        </div>
      </div>

      {quick && (
        <div className="mt-4 space-y-2 text-xs">
          {quick._err ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">⚠️ {quick._err}</div>
          ) : (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                🔎 컬럼 존재 진단 (기능 의존)
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(quick.present ?? {}).map(([k, v]) => (
                    <li key={k} className="font-mono">{v ? '✅' : '❌'} {k}</li>
                  ))}
                </ul>
              </div>
              {(quick.ran?.length ?? 0) > 0 && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                  실행: {quick.ran!.join(' · ')}
                </div>
              )}
              {(quick.errors?.length ?? 0) > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  오류: {quick.errors!.map((e) => `${e.step} (${e.error})`).join(' · ')}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2 text-xs">
          {result._clientError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              ⚠️ 실행 실패 — {result._clientError}
            </div>
          ) : errs.length === 0 ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
              ✅ 완료 — 확인 {checkedCount}개 · 추가 {added.length}개 · 기존 {existsCount}개
              {added.length === 0 && <span className="block text-green-600 mt-0.5">이미 최신 상태입니다 (추가할 항목 없음)</span>}
            </div>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              ⚠️ {errs.length}건 오류:
              <ul className="mt-1 list-disc pl-4">
                {errs.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {added.length > 0 && (
            <details className="text-gray-600">
              <summary className="cursor-pointer">추가된 컬럼 {added.length}개 보기</summary>
              <ul className="mt-1 list-disc pl-4">
                {added.map((r, i) => (
                  <li key={i}>{r.desc}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}

// 🏭 2026-06-05 (B2): 공구 정산 정합성 점검 — 읽기 전용 (ledger/donations 누락 집계, 돈 미변경)
interface GBAuditSample { order_number: string; payment_method: string; total_amount: number; created_at: string }
interface GBAuditData {
  period_days: number
  total_orders: number
  total_amount: number
  by_method: { method: string; n: number }[]
  missing_ledger: { available: boolean; n: number; samples: GBAuditSample[] }
  missing_donation: { available: boolean; n: number; samples: GBAuditSample[] }
}

function GroupBuySettlementAuditSection() {
  const [running, setRunning] = useState(false)
  const [res, setRes] = useState<GBAuditData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = async () => {
    if (running) return
    setRunning(true); setErr(null); setRes(null)
    try {
      const token = localStorage.getItem('admin_token')
      const r = await fetch('/api/admin/metrics/groupbuy-settlement-audit?days=30', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      const j = (await r.json()) as { success?: boolean; error?: string; data?: GBAuditData }
      if (!r.ok || !j.success || !j.data) {
        setErr(j.error || (r.status === 401 || r.status === 403 ? '관리자 인증 필요 (다시 로그인 후 시도)' : `HTTP ${r.status}`))
        return
      }
      setRes(j.data)
    } catch {
      setErr('점검 요청 실패 (네트워크/파싱)')
    } finally { setRunning(false) }
  }

  const won = (n: number) => `₩${(Number.isFinite(n) ? n : 0).toLocaleString('ko-KR')}`
  const missing = (res?.missing_ledger.n ?? 0) + (res?.missing_donation.n ?? 0)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-gray-700" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">공구 정산 정합성 점검 (읽기 전용)</h2>
            <p className="text-xs text-gray-500">최근 30일 공구(GB) 결제 중 ledger·정산기록(donations) 누락 건 집계. 돈/상태 미변경.</p>
          </div>
        </div>
        <button onClick={run} disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
          {running ? '점검 중...' : '정합성 점검'}
        </button>
      </div>

      {err && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠️ {err}</div>}

      {res && (
        <div className="mt-4 space-y-2 text-xs">
          <div className={`rounded-md border px-3 py-2 ${missing === 0 ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {missing === 0
              ? `✅ 정합 — 최근 ${res.period_days}일 공구 ${res.total_orders}건(${won(res.total_amount)}) 전부 ledger·정산기록 보유`
              : `⚠️ 누락 발견 — ledger ${res.missing_ledger.n}건 · 정산기록 ${res.missing_donation.n}건 (총 공구 ${res.total_orders}건 중)`}
          </div>
          <div className="text-gray-600">결제수단별: {res.by_method.map((m) => `${m.method} ${m.n}`).join(' · ') || '없음'}</div>
          {!res.missing_ledger.available && <div className="text-gray-400">· ledger_entries 테이블 없음 (점검 불가)</div>}
          {!res.missing_donation.available && <div className="text-gray-400">· donations 테이블 없음 (점검 불가)</div>}
          {res.missing_ledger.n > 0 && (
            <details className="text-gray-600">
              <summary className="cursor-pointer">ledger 누락 {res.missing_ledger.n}건 샘플</summary>
              <ul className="mt-1 list-disc pl-4">
                {res.missing_ledger.samples.map((s, i) => <li key={i}>{s.order_number} · {s.payment_method} · {won(s.total_amount)} · {s.created_at}</li>)}
              </ul>
            </details>
          )}
          {res.missing_donation.n > 0 && (
            <details className="text-gray-600">
              <summary className="cursor-pointer">정산기록 누락 {res.missing_donation.n}건 샘플</summary>
              <ul className="mt-1 list-disc pl-4">
                {res.missing_donation.samples.map((s, i) => <li key={i}>{s.order_number} · {s.payment_method} · {won(s.total_amount)} · {s.created_at}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
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
    if (!(await confirmDialog('이 webhook event 를 재처리 마킹하시겠습니까?'))) return
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
