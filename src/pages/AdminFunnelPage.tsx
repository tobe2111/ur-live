/**
 * 🆕 2026-06-29 (대표 — "먼저 분석하고 결정"): 소비자 퍼널/이탈 대시보드.
 *
 *   경량 계측(funnel_events)을 집계해 **실제 이탈률**을 표시 → 유어딜 정체성/플로우 결정 근거.
 *   데이터: GET /api/admin/funnel (funnel.routes.ts). 개인정보 0(익명 fid).
 */
import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { DashboardPageHeader } from '@/components/dashboard'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatNumber } from '@/utils/format'
import { Activity } from 'lucide-react'

interface FunnelResponse {
  success: boolean
  days: number
  totals: Record<string, { cnt: number; users: number }>
  funnel: { login_wall_to_success: number; checkout_to_payment: number; empty_region_rate: number }
  dau: Record<string, number>
  byDay: Array<{ day: string; event: string; cnt: number; users: number }>
  note: string
}

const EVENT_LABEL: Record<string, string> = {
  app_open: '앱 진입(세션)',
  login_wall_shown: '로그인 벽 노출',
  login_succeeded: '로그인 성공',
  checkout_started: '결제 시작',
  payment_succeeded: '결제 완료',
  empty_region_shown: '빈 지역 노출',
}
const EVENT_ORDER = ['app_open', 'login_wall_shown', 'login_succeeded', 'checkout_started', 'payment_succeeded', 'empty_region_shown']

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminFunnelPage() {
  const { data, isLoading, isError, refetch } = useApiQuery<FunnelResponse>(
    ['admin', 'funnel'],
    '/api/admin/funnel',
    { params: { days: 14 }, select: (r) => r as FunnelResponse },
  )

  const totals = data?.totals || {}
  const funnel = data?.funnel
  const dau = data?.dau || {}
  const t = (e: string) => totals[e]?.cnt || 0
  const hasData = EVENT_ORDER.some((e) => t(e) > 0)

  // 일자별 DAU (최근순)
  const dauDays = Object.entries(dau).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14)
  const maxDau = Math.max(1, ...Object.values(dau))

  return (
    <AdminLayout title="소비자 퍼널">
      <SEO title="소비자 퍼널 — Admin" />
      <DashboardPageHeader
        icon={<Activity className="w-5 h-5" />}
        title="소비자 퍼널 · 이탈 대시보드"
        subtitle="최근 14일 · 익명 계측(개인정보 0) · 유어딜 정체성 결정 근거"
      />

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
        <p className="font-bold text-sm mb-1">📖 이 화면은?</p>
        <p>사용자가 <strong>어디서 이탈하는지</strong>를 실제 이벤트로 측정합니다. 계측을 방금 심었으니 <strong>데이터가 쌓이는 데 며칠</strong> 걸려요. 숫자가 충분해지면 "동네딜 vs 링크샵" 정체성 결정을 감이 아니라 근거로 하실 수 있습니다.</p>
      </div>

      {isError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center justify-between">
          <span>데이터를 불러오지 못했습니다.</span>
          <button onClick={() => refetch()} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium">다시 시도</button>
        </div>
      )}
      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>}

      {!isLoading && !hasData && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          아직 쌓인 데이터가 없습니다. 계측을 방금 배포했다면 사용자 트래픽이 발생한 뒤(수 시간~며칠) 여기에 나타납니다.
        </div>
      )}

      {hasData && (
        <>
          {/* 핵심 전환율 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <Stat
              label="① 로그인 벽 통과율"
              value={`${funnel?.login_wall_to_success ?? 0}%`}
              sub={`벽 노출 ${formatNumber(t('login_wall_shown'))} → 성공 ${formatNumber(t('login_succeeded'))}`}
            />
            <Stat
              label="② 결제 완료(이용권)"
              value={formatNumber(t('payment_succeeded'))}
              sub={`결제 시작 ${formatNumber(t('checkout_started'))}건 대비 (경로 상이 주의)`}
            />
            <Stat
              label="③ 빈 지역 노출률"
              value={`${funnel?.empty_region_rate ?? 0}%`}
              sub={`앱진입 대비 "우리 동네 없네" (${formatNumber(t('empty_region_shown'))}건)`}
            />
          </div>

          {/* 이벤트 총합 */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-5">
            <h2 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-800">이벤트 총합 (14일)</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">이벤트</th>
                  <th className="px-4 py-2 text-right font-medium">발생</th>
                  <th className="px-4 py-2 text-right font-medium">고유 사용자</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {EVENT_ORDER.map((e) => (
                  <tr key={e} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{EVENT_LABEL[e]}</td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{formatNumber(t(e))}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatNumber(totals[e]?.users || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 일자별 DAU */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <h2 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-800">일자별 활성 사용자 (DAU · 세션 기준)</h2>
            <div className="p-4 space-y-1.5">
              {dauDays.length === 0 && <p className="text-xs text-gray-400">데이터 없음</p>}
              {dauDays.map(([day, n]) => (
                <div key={day} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-500 font-mono">{day.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full" style={{ width: `${Math.round((n / maxDau) * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right font-bold text-gray-900">{formatNumber(n)}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[10px] text-gray-400">{data?.note}</p>
        </>
      )}
    </AdminLayout>
  )
}
