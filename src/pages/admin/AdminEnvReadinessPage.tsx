/**
 * 🔧 환경 준비상태 — 어드민 진단 페이지 (2026-06-29)
 *
 *   대표 질문 "다른 운영자/브라우저/장소에서 써도 문제없게 환경 세팅 다 됐어?" 에 대한
 *   *클릭 한 번* 답. /api/health/env-readiness(admin) 를 읽어 GREEN/RED + 누락 항목 표시.
 *   시크릿 값은 절대 안 받음(서버가 present 불리언만 반환) — 노출 0.
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { useQueryClient } from '@tanstack/react-query'
import AdminLayout from '@/components/AdminLayout'
import { DashboardLoadError } from '@/components/dashboard'
import SEO from '@/components/SEO'
import { CheckCircle2, XCircle, Loader2, ShieldAlert, RefreshCw } from 'lucide-react'

interface EnvItem { key: string; present: boolean; note: string }
interface EnvReadiness {
  ready: boolean
  db_ok: boolean
  summary: { blocking_missing: string[]; security_missing: string[] }
  groups: Record<string, EnvItem[]>
  environment: string
  region: string
  timestamp: string
}

const GROUP_META: Record<string, { title: string; desc: string }> = {
  blocking: { title: '필수 (없으면 로그인/서비스 깨짐)', desc: '하나라도 비면 모든 운영자가 영향받습니다.' },
  security: { title: '보안 (없으면 fail-open)', desc: '동작은 하지만 brute-force/봇/평문토큰 위험.' },
  perf: { title: '성능', desc: '없으면 느려지나 동작.' },
  payments: { title: '소비자 결제', desc: '도매몰(예치금)은 무관.' },
  optional: { title: '선택 기능', desc: '없으면 해당 기능만 자동 비활성(fail-soft).' },
}
const GROUP_ORDER = ['blocking', 'security', 'perf', 'payments', 'optional']

const QKEY = ['admin', 'env-readiness']

export default function AdminEnvReadinessPage() {
  const qc = useQueryClient()
  const adminAuth = { Authorization: `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('access_token')}` }
  const { data, isLoading, isError, error, refetch } = useApiQuery<EnvReadiness | null>(
    // 🛡️ 2026-07-01 (대표 "환경 상태 404"): 라우트는 /api/health/detailed 하위에 마운트됨
    //   (worker/index.ts: app.route('/api/health/detailed', healthRoutes) + healthRoutes.get('/env-readiness')).
    //   기존 '/api/health/env-readiness' 는 존재하지 않아 404 → 페이지 백지. 정확 경로로 교정.
    QKEY, '/api/health/detailed/env-readiness',
    {
      headers: adminAuth,
      select: (raw: unknown) => (raw as EnvReadiness) ?? null,
    },
  )

  return (
    <AdminLayout title="환경 준비상태">
      <SEO title="환경 준비상태" url="/admin/env-readiness" noindex />
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">
            Cloudflare 바인딩·시크릿이 설정됐는지 런타임 점검 — 다른 운영자/브라우저/장소에서도 정상 동작 여부.
          </p>
          <button onClick={() => { qc.invalidateQueries({ queryKey: QKEY }); refetch() }}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : isError ? (
          <DashboardLoadError error={error} onRetry={refetch} loginPath="/admin/login" label="환경 준비상태" />
        ) : !data ? (
          <p className="text-sm text-gray-400 text-center py-16">데이터가 없습니다.</p>
        ) : (
          <>
            {/* 종합 배지 */}
            <div className={`rounded-2xl p-5 mb-5 border ${data.ready ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3">
                {data.ready
                  ? <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
                  : <XCircle className="w-8 h-8 text-red-600 shrink-0" />}
                <div>
                  <p className={`text-lg font-bold ${data.ready ? 'text-green-800' : 'text-red-800'}`}>
                    {data.ready ? '환경 준비 완료 — 다른 운영자도 정상 사용 가능' : '필수 설정 누락 — 일부 운영자 로그인 불가'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {data.environment} · {data.region} · DB {data.db_ok ? '정상' : '연결 실패'}
                  </p>
                </div>
              </div>
              {data.summary.blocking_missing.length > 0 && (
                <p className="mt-3 text-sm text-red-700">⛔ 필수 누락: {data.summary.blocking_missing.join(', ')}</p>
              )}
              {data.summary.security_missing.length > 0 && (
                <p className="mt-1.5 text-sm text-amber-700 flex items-start gap-1">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" /> 보안 권장(미설정 시 fail-open): {data.summary.security_missing.join(', ')}
                </p>
              )}
            </div>

            {/* 그룹별 항목 */}
            <div className="space-y-4">
              {GROUP_ORDER.filter((g) => data.groups[g]?.length).map((g) => {
                const meta = GROUP_META[g]
                const items = data.groups[g]
                return (
                  <div key={g} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">{meta.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {items.map((it) => (
                        <li key={it.key} className="flex items-start gap-3 px-4 py-2.5">
                          {it.present
                            ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            : <XCircle className={`w-4 h-4 mt-0.5 shrink-0 ${g === 'blocking' ? 'text-red-500' : g === 'security' ? 'text-amber-500' : 'text-gray-300'}`} />}
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-gray-800 font-mono">{it.key}</p>
                            {it.note && <p className="text-[11px] text-gray-500 mt-0.5">{it.note}</p>}
                          </div>
                          <span className={`ml-auto text-[11px] font-bold whitespace-nowrap ${it.present ? 'text-green-600' : g === 'blocking' ? 'text-red-600' : g === 'security' ? 'text-amber-600' : 'text-gray-400'}`}>
                            {it.present ? '설정됨' : '미설정'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-4">
              ※ 시크릿 값은 서버가 전송하지 않습니다(설정 여부만 표시). 점검 시각 {new Date(data.timestamp).toLocaleString('ko-KR')}
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
