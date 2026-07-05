/**
 * 🚦 2026-07-05: 운영 게이트 플래그 현황판 + cron heartbeat 탭 (1인 운영 관측 보강).
 *
 * - 게이트: 검증 대기 스위치(커미션 예산/쇼핑 원장/fee-resolver 등)가 env·platform_settings 에
 *   흩어져 있어 "뭐가 켜져 있는지" 볼 곳이 없었음 → 열람 전용 현황판 (값 변경은 여기서 안 함 —
 *   staging 검증(docs/STAGING_CHECKLIST.md) 전 실수 활성화 방지가 목적).
 * - heartbeat: safeCron 이 기록하는 cron_heartbeats 로 "cron 이 실제로 돌고 있는가"를 표시.
 *   침묵(stale) cron 은 상단에 빨간 배지 — 외부 감시는 uptime.yml(/api/_healthcheck/cron)이 담당.
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { DashboardCard, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { ShieldAlert, CheckCircle2, RefreshCw, HeartPulse } from 'lucide-react'

interface OpsGate {
  key: string
  kind: 'env' | 'setting'
  label: string
  default_value: string
  staging_ref: string | null
  value: string | null
  is_default: boolean
}

interface StaleEntry { name: string; label: string; max_gap_min: number; last_finished_at: string | null; age_min: number | null }

interface CronHealth {
  ok: boolean
  bootstrapping: boolean
  latest_heartbeat_at: string | null
  latest_age_min: number | null
  stale: StaleEntry[]
  missing: string[]
}

interface Heartbeat {
  cron_name: string
  last_status: string
  last_finished_at: string | null
  last_duration_ms: number | null
  last_error: string | null
  run_count: number
}

interface OpsStatusData {
  gates: OpsGate[]
  cron_health: CronHealth
  heartbeats: Heartbeat[]
  checklist_doc: string
}

const EMPTY: OpsStatusData = {
  gates: [],
  cron_health: { ok: true, bootstrapping: true, latest_heartbeat_at: null, latest_age_min: null, stale: [], missing: [] },
  heartbeats: [],
  checklist_doc: 'docs/STAGING_CHECKLIST.md',
}

function fmtAgo(datetime: string | null): string {
  if (!datetime) return '—'
  const iso = datetime.includes('T') ? datetime : datetime.replace(' ', 'T') + 'Z'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return datetime
  const min = Math.floor((Date.now() - t) / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`
  return `${Math.floor(min / (60 * 24))}일 전`
}

export default function OpsStatusTab() {
  const q = useApiQuery<OpsStatusData>(
    ['admin', 'ops-status'], '/api/admin/ops-status',
    { select: (r: any) => (r?.success ? (r.data as OpsStatusData) : EMPTY) },
  )
  const data = q.data ?? EMPTY

  if (q.isLoading) return <DashboardLoading />
  // iserror-check-ok: 아래 분기가 fetch 실패를 "게이트 전부 기본값"으로 위장하지 않게 명시 처리
  if (q.isError) {
    return (
      <DashboardCard className="!p-4">
        <p className="text-sm text-red-600 font-semibold">운영 현황을 불러오지 못했습니다 — 일시적 오류일 수 있어요.</p>
        <button onClick={() => q.refetch()} className="mt-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> 다시 시도
        </button>
      </DashboardCard>
    )
  }

  const { gates, cron_health: health, heartbeats } = data
  const activeGates = gates.filter(g => !g.is_default)
  const staleNames = new Set(health.stale.map(s => s.name))

  return (
    <div className="space-y-4">
      {/* Cron 침묵 요약 */}
      <DashboardCard className="!p-4">
        <div className="flex items-center gap-2 mb-2">
          <HeartPulse className={`w-4 h-4 ${health.ok ? 'text-green-600' : 'text-red-600'}`} />
          <p className="text-sm font-bold text-gray-900">Cron Heartbeat</p>
          {health.bootstrapping ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">기록 수집 중 (첫 실행 대기)</span>
          ) : health.ok ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">✓ 핵심 cron 전체 정상</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">✕ 침묵 감지 {health.stale.length}건</span>
          )}
        </div>
        {health.stale.length > 0 && (
          <div className="space-y-1 mb-2">
            {health.stale.map(s => (
              <p key={s.name} className="text-xs text-red-600">
                🔴 {s.label} (<code className="bg-red-50 px-1 rounded">{s.name}</code>) — {s.age_min != null ? `마지막 실행 ${s.age_min}분 전` : '실행 기록 없음 (트리거 누락 의심)'} (허용 {s.max_gap_min}분)
              </p>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-500">
          최신 heartbeat: {fmtAgo(health.latest_heartbeat_at)} · 외부 감시: uptime.yml 이 10분마다 <code>/api/_healthcheck/cron</code> 점검(침묵 시 GitHub 이슈+이메일)
        </p>
      </DashboardCard>

      {/* 게이트 플래그 현황 */}
      <DashboardCard className="!p-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-4 h-4 text-gray-700" />
          <p className="text-sm font-bold text-gray-900">운영 게이트 플래그</p>
          {activeGates.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">⚡ 활성 {activeGates.length}개</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">전부 기본값 (OFF)</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          ⚠️ <b>S# 표시 게이트는 staging 실결제 검증 전 활성 금지</b> — 시나리오·통과 기준: <code>docs/STAGING_CHECKLIST.md</code>
        </p>
        <div className="space-y-1.5">
          {gates.map(g => (
            <div key={g.key} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 pb-1.5">
              <div className="min-w-0">
                <span className="font-semibold text-gray-800">{g.label}</span>
                <span className="ml-1.5 text-gray-400">
                  <code className="bg-gray-100 px-1 rounded text-gray-600">{g.key}</code> · {g.kind === 'env' ? 'Cloudflare env' : 'platform_settings'}
                </span>
                {g.staging_ref && (
                  <span className="ml-1.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">검증 {g.staging_ref}</span>
                )}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                g.is_default
                  ? 'bg-gray-100 text-gray-600 border-gray-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
              }`}>
                {g.is_default ? `기본 (${g.default_value})` : `⚡ ${g.value}`}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Heartbeat 전체 목록 */}
      {heartbeats.length === 0 ? (
        <DashboardEmptyState icon={<CheckCircle2 className="h-7 w-7 text-gray-400" />} title="아직 heartbeat 기록 없음 — 다음 cron 실행부터 채워집니다" />
      ) : (
        <DashboardCard className="!p-4">
          <p className="text-sm font-bold text-gray-900 mb-2">Cron 실행 기록 ({heartbeats.length})</p>
          <div className="space-y-1">
            {heartbeats.map(h => (
              <div key={h.cron_name} className={`flex items-center justify-between gap-2 text-xs border-b border-gray-100 py-1 ${staleNames.has(h.cron_name) ? 'bg-red-50 -mx-1 px-1 rounded' : ''}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={h.last_status === 'ok' ? 'text-green-600' : 'text-red-600'}>{h.last_status === 'ok' ? '✓' : '✗'}</span>
                  <code className="text-gray-800 truncate">{h.cron_name}</code>
                  {h.last_error && <span className="text-red-500 truncate text-[10px]">{h.last_error}</span>}
                </div>
                <span className="shrink-0 text-gray-500">
                  {fmtAgo(h.last_finished_at)} · {h.last_duration_ms != null ? `${h.last_duration_ms}ms` : '—'} · {h.run_count}회
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}
    </div>
  )
}
