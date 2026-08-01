/**
 * 🛡️ 2026-05-22: 정책 SSOT 대시보드 (read-only 시각화).
 *
 * 표시:
 *   - REFUND_POLICY / COMMISSION_DEFAULTS / TAX_POLICY / TIME_CONSTANTS
 *   - 동적 platform_settings DB 값 (현재 적용중 — fallback 상수와 비교)
 *
 * 변경 방법:
 *   ① 정적 정책 → `src/shared/constants/policy.ts` 수정 + PR
 *   ② 동적 정책 → `/admin/payouts` 에서 platform_settings 편집
 *
 * 이 페이지는 읽기 전용 — 어드민이 "지금 어떤 정책이 적용 중인지" 한눈에 확인용.
 */

import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { DashboardPageHeader } from '@/components/dashboard'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { POLICY_SECTIONS, type PolicyRow } from './admin-policy/policy-rows'
import { ShieldCheck, ExternalLink } from 'lucide-react'

interface DynamicSetting {
  key: string
  value: string
}

function PolicyTable({ title, rows }: {
  title: string
  rows: Array<{ key: string; value: string | number; unit?: string; desc?: string; dynamic?: string }>
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <h2 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-800">
        {title}
      </h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-4 py-2 text-left font-medium w-1/3">키</th>
            <th className="px-4 py-2 text-right font-medium w-1/6">현재 값</th>
            <th className="px-4 py-2 text-left font-medium">설명</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.key}</td>
              <td className="px-4 py-2 text-right">
                <span className="font-bold text-gray-900">
                  {typeof r.value === 'number' ? r.value.toLocaleString() : r.value}
                </span>
                {r.unit && <span className="ml-1 text-xs text-gray-500">{r.unit}</span>}
                {r.dynamic && (
                  <div className="text-[10px] text-blue-600 mt-0.5">
                    동적 적용중: <strong>{r.dynamic}</strong>
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-gray-600">{r.desc || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function AdminPolicyDashboardPage() {
  // 🛡️ 2026-06-10: 수동 useState+useEffect+api.get → useApiQuery (RQ SSOT).
  //   인증=api 인터셉터 자동(admin_token). 에러 시 data 없음 → 기존 swallow 와 동일하게 fallback 상수만 표시.
  const { data: dynamicSettings = {}, isLoading } = useApiQuery<Record<string, string>>(
    ['admin', 'policy-dashboard', 'commission-rates'],
    '/api/admin/payouts/commission-rates',
    {
      select: (raw) => {
        const data = (raw as { data?: Record<string, unknown> })?.data || {}
        return {
          platform_fee_pct: String(data.platform_fee_pct ?? ''),
          seller_commission_pct: String(data.seller_commission_pct ?? ''),
          agency_share_pct: String(data.agency_share_pct ?? ''),
          influencer_intro_share_pct: String(data.influencer_intro_share_pct ?? ''),
        }
      },
    },
  )
  const loaded = !isLoading

  return (
    <AdminLayout title="정책 대시보드">
      <SEO title="정책 대시보드 — Admin" />
      <DashboardPageHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="정책 SSOT 대시보드"
        subtitle="환불 / 수수료 / 세금 / 시간 상수 — 지금 적용 중인 값 확인용 (읽기 전용)"
      />

      {/* 🛡️ 2026-07-01 (대표 "여기서 수정 가능해야 하는 거 아냐?"): 이 화면은 '현재 적용값'을 한눈에 보는
          읽기 전용 뷰어 — 편집은 항목별 실제 편집 페이지에서. 어디서 바꾸는지 크게 안내 + 바로가기 버튼. */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">📖</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">이 화면은 <span className="underline">읽기 전용</span>입니다 — 값은 여기서 못 바꿔요</p>
            <p className="text-xs text-amber-800 mt-0.5">
              지금 어떤 정책이 적용 중인지 한눈에 보는 용도예요. 실제 변경은 항목별 편집 페이지에서 합니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/admin/payouts"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700">
                ✏️ 수수료율 편집하기 (정산 센터)
              </a>
              <a href="/admin/commission-settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                정산 마진 설정
              </a>
              <a href="/admin/platform-settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                플랫폼 설정
              </a>
            </div>
            <ul className="mt-3 list-disc list-inside space-y-0.5 text-[11px] text-amber-700">
              <li><strong>수수료 비율</strong>(동적): 위 <strong>수수료율 편집</strong> 버튼 → platform_settings 값 변경 → 이 화면에도 반영</li>
              <li><strong>환불/시간 상수</strong>(정적): 코드 <code className="font-mono">src/shared/constants/policy.ts</code> 수정 + 배포 필요</li>
              <li><strong>원천징수율</strong>: 한국 세법(소득세법 §127) 고정 — 3.3%(사업소득) / 8.8%(기타소득)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {POLICY_SECTIONS.map((sec) => (
          <PolicyTable
            key={sec.source}
            title={sec.title}
            rows={sec.rows.map((r: PolicyRow) => ({
              ...r,
              // 어드민이 platform_settings 로 덮어쓴 값이 있으면 "현재 적용값"으로 겹쳐 보여 준다.
              dynamic: r.dynamicKey && dynamicSettings[r.dynamicKey] ? `${dynamicSettings[r.dynamicKey]}%` : undefined,
              desc: r.retired ? `${r.desc} · ⛔ ${r.retired}` : r.desc,
            }))}
          />
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
        <p className="font-bold mb-2 text-gray-700">관련 페이지</p>
        <div className="grid grid-cols-2 gap-2">
          <a href="/admin/payouts" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/payouts (수수료 비율 편집)
          </a>
          <a href="/admin/withholding" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/withholding (원천징수 / 지급조서)
          </a>
          <a href="/admin/disputes" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/disputes (분쟁 관리)
          </a>
          <a href="/admin/health" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/health (시스템 헬스)
          </a>
        </div>
        {!loaded && <p className="mt-2 text-gray-400">동적 정책 로딩중…</p>}
      </div>
    </AdminLayout>
  )
}
