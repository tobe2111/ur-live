/**
 * 🆕 2026-06-29 fee-resolver 검증 페이지 — 새 수수료 규칙(그림자 기록) ↔ 현행 실제 정산 **나란히 비교**.
 *
 *   목적: authoritative 전환(리졸버가 실제 정산을 대체) **전에** 대표가 스테이징/운영에서
 *   "새 규칙이 현행과 얼마나 다른가"를 주문별·합계로 눈으로 확인. 읽기 전용(돈 안 건드림).
 *
 *   사용 순서:
 *     1) (스테이징) FEE_RESOLVER_ENABLED='true' 설정 → 결제 발생 → order_fee_breakdown 에 그림자 기록 쌓임
 *     2) 이 페이지에서 새 규칙 vs 현행 합계/주문별 차이 확인
 *     3) 차이가 의도대로면 authoritative 전환(별도 작업, 잠긴 결제파일 — 대표 승인)
 *
 *   데이터: GET /api/admin/fee-breakdown/compare (admin-fee-breakdown.routes.ts).
 */
import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { DashboardPageHeader } from '@/components/dashboard'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon } from '@/utils/format'
import { Scale, AlertTriangle, ArrowRight } from 'lucide-react'

interface CompareRow {
  order_id: number
  order_number: string
  seller_id: number | null
  seller_name: string
  ownership: string
  order_total: number
  created_at: string | null
  new_platform: number
  new_agency: number
  new_platform_net: number
  new_promo: number
  new_supply: number
  new_owner_net: number
  cur_commission_rate: number
  cur_platform: number
  cur_agency: number
  cur_influencer: number
  cur_supply: number
  cur_affiliate: number
  cur_platform_net: number
  delta_platform: number
  delta_agency: number
  delta_platform_net: number
}

interface Totals {
  order_count: number
  order_total: number
  new_platform: number
  new_agency: number
  new_platform_net: number
  new_supply: number
  new_owner_net: number
  cur_platform: number
  cur_agency: number
  cur_influencer: number
  cur_supply: number
  cur_affiliate: number
  cur_platform_net: number
  delta_platform: number
  delta_agency: number
  delta_platform_net: number
}

interface CompareResponse {
  success: boolean
  resolver_enabled: boolean
  shadow_table_exists: boolean
  rows: CompareRow[]
  totals: Totals
  note: string
}

/** 차이 금액 — 양수=빨강(새 규칙이 더 큼), 음수=초록(새 규칙이 더 작음), 0=회색. */
function Delta({ v }: { v: number }) {
  if (!v) return <span className="text-gray-400">±0</span>
  const up = v > 0
  return (
    <span className={up ? 'text-red-600' : 'text-emerald-600'}>
      {up ? '+' : '−'}{formatWon(Math.abs(v))}
    </span>
  )
}

function SummaryCard({ label, cur, neo, delta, hint }: {
  label: string; cur: number; neo: number; delta: number; hint?: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        <div className="flex-1">
          <p className="text-[10px] text-gray-400">현행</p>
          <p className="font-bold text-gray-700">{formatWon(cur)}</p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] text-gray-400">새 규칙</p>
          <p className="font-bold text-gray-900">{formatWon(neo)}</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 text-sm font-bold">
        차이 <Delta v={delta} />
      </div>
      {hint && <p className="mt-1 text-[10px] text-gray-400 leading-tight">{hint}</p>}
    </div>
  )
}

export default function AdminFeeBreakdownComparePage() {
  const { data, isLoading, isError, refetch } = useApiQuery<CompareResponse>(
    ['admin', 'fee-breakdown', 'compare'],
    '/api/admin/fee-breakdown/compare',
    { params: { limit: 500 }, select: (r) => r as CompareResponse },
  )

  const rows = data?.rows || []
  const totals = data?.totals
  const resolverOn = !!data?.resolver_enabled
  const hasShadow = !!data?.shadow_table_exists && rows.length > 0

  return (
    <AdminLayout title="수수료 규칙 비교">
      <SEO title="수수료 규칙 비교 — Admin" />
      <DashboardPageHeader
        icon={<Scale className="w-5 h-5" />}
        title="fee-resolver 검증 — 새 규칙 vs 현행 정산"
        subtitle="그림자 기록(order_fee_breakdown) ↔ 실제 정산을 주문별·합계로 비교 (읽기 전용)"
      />

      {/* 안내 */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
        <p className="font-bold text-sm">📖 이 화면은 무엇인가요?</p>
        <p>
          새 수수료 규칙(플랫폼 3P 5%/1P 0% · 에이전시 1%/24개월)을 <strong>실제 정산에 적용하기 전</strong>,
          현행 정산과 얼마나 달라지는지 <strong>계산만 해서</strong> 나란히 보여줍니다. 이 화면은 어떤 돈도 이동시키지 않습니다.
        </p>
        <ol className="list-decimal list-inside space-y-0.5 mt-1">
          <li>스테이징에서 <code className="font-mono bg-blue-100 px-1 rounded">FEE_RESOLVER_ENABLED=true</code> 설정</li>
          <li>결제를 발생시키면 그림자 기록이 쌓임 → 여기서 비교 확인</li>
          <li>차이가 의도대로면 → authoritative 전환(별도 작업, 잠긴 결제파일, 대표 승인 필요)</li>
        </ol>
      </div>

      {/* 리졸버 OFF / 데이터 없음 경고 */}
      {!isLoading && !hasShadow && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold mb-0.5">아직 비교할 그림자 기록이 없습니다.</p>
            <p className="text-xs leading-relaxed">
              {data?.note || (resolverOn
                ? '리졸버는 켜졌으나 아직 결제가 발생하지 않았습니다.'
                : 'FEE_RESOLVER_ENABLED 가 꺼져 있습니다. 스테이징에서 켜고 결제를 발생시키면 기록이 쌓입니다.')}
            </p>
            <p className="text-[11px] mt-1">
              리졸버 상태: <strong className={resolverOn ? 'text-emerald-700' : 'text-gray-500'}>
                {resolverOn ? 'ON (그림자 기록 중)' : 'OFF'}
              </strong>
            </p>
          </div>
        </div>
      )}

      {isError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center justify-between">
          <span>데이터를 불러오지 못했습니다.</span>
          <button onClick={() => refetch()} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
            다시 시도
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>}

      {/* 합계 요약 카드 */}
      {hasShadow && totals && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">
              합계 — 그림자 기록 {totals.order_count.toLocaleString()}건 (총 결제 {formatWon(totals.order_total)})
            </p>
            <span className="text-[11px] text-emerald-700">리졸버 ON</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <SummaryCard
              label="① 플랫폼 수수료 (떼는 금액)"
              cur={totals.cur_platform} neo={totals.new_platform} delta={totals.delta_platform}
              hint="현행: total×커미션율 / 새: 3P 5%·1P 0%"
            />
            <SummaryCard
              label="② 에이전시 매장영입"
              cur={totals.cur_agency} neo={totals.new_agency} delta={totals.delta_agency}
              hint="현행: 2%+₩30k 무제한 / 새: 1%·24개월·플랫폼 내 분배"
            />
            <SummaryCard
              label="③ 플랫폼 순이익 (영입 지급 후)"
              cur={totals.cur_platform_net} neo={totals.new_platform_net} delta={totals.delta_platform_net}
              hint="현행: 커미션−에이전시−영입자 / 새: platform−agency"
            />
          </div>

          {/* 모델 차이 주석 */}
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-600 leading-relaxed">
            <strong className="text-gray-700">⚠️ 모델 차이 해석 주의:</strong>{' '}
            영입자(인플) 인센티브는 <strong>현행=플랫폼 비용</strong>(순이익에서 차감)이지만{' '}
            <strong>새 모델=주인 자율 promo</strong>(플랫폼 비용 아님)라 ③ 플랫폼 순이익 산식이 다릅니다.{' '}
            그림자 기록은 supply/promo 를 아직 계산하지 않아(0), 핵심 비교는 ①플랫폼·②에이전시입니다.{' '}
            현행 영입자 합계 {formatWon(totals.cur_influencer)} · 현행 핀추천(affiliate) 합계 {formatWon(totals.cur_affiliate)} · 현행 공급가 합계 {formatWon(totals.cur_supply)}.
          </div>

          {/* 주문별 비교 테이블 */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-medium">주문</th>
                  <th className="px-3 py-2 text-left font-medium">셀러</th>
                  <th className="px-2 py-2 text-center font-medium">소유</th>
                  <th className="px-3 py-2 text-right font-medium">결제액</th>
                  <th className="px-3 py-2 text-right font-medium bg-gray-100">플랫폼<br/>현행</th>
                  <th className="px-3 py-2 text-right font-medium bg-gray-100">플랫폼<br/>새</th>
                  <th className="px-3 py-2 text-right font-medium">에이전시<br/>현행</th>
                  <th className="px-3 py-2 text-right font-medium">에이전시<br/>새</th>
                  <th className="px-3 py-2 text-right font-medium bg-gray-100">순이익<br/>차이</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.order_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-700">{r.order_number}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{r.seller_name}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.ownership === '1P' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>{r.ownership}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">{formatWon(r.order_total)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 bg-gray-50/50">{formatWon(r.cur_platform)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900 bg-gray-50/50">{formatWon(r.new_platform)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatWon(r.cur_agency)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{formatWon(r.new_agency)}</td>
                    <td className="px-3 py-2 text-right font-bold bg-gray-50/50"><Delta v={r.delta_platform_net} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold text-gray-800 border-t-2 border-gray-200">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>합계 ({totals.order_count.toLocaleString()}건)</td>
                  <td className="px-3 py-2 text-right">{formatWon(totals.order_total)}</td>
                  <td className="px-3 py-2 text-right">{formatWon(totals.cur_platform)}</td>
                  <td className="px-3 py-2 text-right">{formatWon(totals.new_platform)}</td>
                  <td className="px-3 py-2 text-right">{formatWon(totals.cur_agency)}</td>
                  <td className="px-3 py-2 text-right">{formatWon(totals.new_agency)}</td>
                  <td className="px-3 py-2 text-right"><Delta v={totals.delta_platform_net} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">
            빨강 = 새 규칙이 더 큼 / 초록 = 새 규칙이 더 작음. 최근 {rows.length.toLocaleString()}건 표시(최대 500).
          </p>
        </>
      )}
    </AdminLayout>
  )
}
