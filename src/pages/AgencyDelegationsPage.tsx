/**
 * 🤝 에이전시 — 매장 위임(3단 위임 모델) + promo 투명성 조회 (2026-07-10)
 *   설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3 (셀프형/승인형/완전위임형 + 불변원칙 3종)
 *   백엔드: src/features/agency/api/agency-delegation.routes.ts (GET / · GET promo-summary · POST request-mode)
 *
 * ⚠️ 읽기 + 요청만 — 위임 grant/revoke 는 매장 권한(유어딜은 관여 X). 분배 엔진은 8월 flip 과 함께.
 *   재원 프레이밍은 promo-summary 의 funding_source 로 게이트:
 *   'platform'(현행 기본) 동안엔 절대 owner-펀딩 문구를 노출하지 않는다.
 */
import { useState, useCallback } from 'react'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
  Store, ShieldCheck, Eye, Undo2, ChevronDown, ChevronUp, RefreshCw, Send, CalendarClock,
} from 'lucide-react'
import { formatWon, formatNumber, safeNum } from '@/utils/format'

// ─── 응답 shape (agency-delegation.routes.ts 와 1:1) ─────────────────────────
interface DelegationStore {
  seller_id: number
  business_name: string | null
  name: string | null
  status: string | null
  delegation_mode: string | null // 'self' | 'approval' | 'full' | null(위임 행 없음)
  granted_at: string | null
  revoked_at: string | null
  promo_products: number
  max_promo_pct: number | null   // products.referral_commission_rate MAX — 0~0.5 fraction
  delegation_label: string
}

interface PromoSummary {
  seller_id: number
  window_days: number
  measured_promo_sum: number
  measured_promo_count: number
  shadow_promo_sum: number
  shadow_promo_count: number
  funding_source: string // 'platform'(현행 기본) | 'owner'
}

// ─── 위임 모드 배지 — §4.3 3단 (null/'self' = 미위임(셀프)) ───────────────────
function modeBadge(mode: string | null): { label: string; cls: string } {
  if (mode === 'approval') return { label: '승인형', cls: 'bg-tone-info-bg text-tone-info' }
  if (mode === 'full') return { label: '완전위임형', cls: 'bg-tone-ok-bg text-tone-ok' }
  return { label: '미위임(셀프)', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
}

// referral_commission_rate 는 0~0.5 fraction (SellerMealVoucherNewPage/AdminProductsPage 컨벤션:
// 표시 시 ×100 — AdminProductsPage 의 `rate*1000/10` 반올림과 동일하게 소수 1자리).
function promoPctLabel(v: number | null | undefined): string {
  const n = safeNum(v)
  if (n <= 0) return '—'
  return `${Math.round(n * 1000) / 10}%`
}

export default function AgencyDelegationsPage() {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<Record<number, PromoSummary>>({})
  const [summaryLoading, setSummaryLoading] = useState<Record<number, boolean>>({})
  const [summaryError, setSummaryError] = useState<Record<number, boolean>>({})
  const [requesting, setRequesting] = useState<number | null>(null)

  // select 가 { list, funding } 를 반환하므로 제네릭도 동일 형태(이전 DelegationStore[] 는 타입 불일치 — tsc 에러).
  const storesQ = useApiQuery<{ list: DelegationStore[]; funding: string }>(
    ['agency', 'delegation-stores'], '/api/agency/delegation',
    { select: (r: any) => (r?.success ? { list: r.data || [], funding: r.funding_source || 'platform' } : { list: [], funding: 'platform' }) },
  )
  const stores: DelegationStore[] = storesQ.data?.list ?? []

  const fetchSummary = useCallback(async (sellerId: number) => {
    setSummaryLoading(prev => ({ ...prev, [sellerId]: true }))
    setSummaryError(prev => ({ ...prev, [sellerId]: false }))
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.get(`/api/agency/delegation/stores/${sellerId}/promo-summary`,
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success && r.data.data) {
        setSummaries(prev => ({ ...prev, [sellerId]: r.data.data as PromoSummary }))
      } else {
        setSummaryError(prev => ({ ...prev, [sellerId]: true }))
      }
    } catch {
      setSummaryError(prev => ({ ...prev, [sellerId]: true }))
    } finally {
      setSummaryLoading(prev => ({ ...prev, [sellerId]: false }))
    }
  }, [])

  // funding_source: 목록 응답이 직접 제공. 미확인이면 'platform'(라이브 현행 기본) 취급 —
  // 요구사항: platform 동안 owner-펀딩 프레이밍 절대 금지 → unknown 도 중립 카피.
  const fundingSource = storesQ.data?.funding ?? 'platform'
  const ownerFunded = fundingSource === 'owner'

  function toggleExpand(sellerId: number) {
    const next = expanded === sellerId ? null : sellerId
    setExpanded(next)
    if (next != null && !summaries[next] && !summaryLoading[next]) fetchSummary(next)
  }

  async function requestMode(sellerId: number, mode: 'approval' | 'full') {
    if (requesting != null) return
    const label = mode === 'full' ? '완전위임형' : '승인형'
    const ok = await confirmDialog(
      `${label} 위임을 요청할까요?\n\n요청은 매장에 알림으로만 전달되며, 발효는 매장 승인(grant) 시에만 됩니다. 유어딜은 관여하지 않습니다.`,
    )
    if (!ok) return
    setRequesting(sellerId)
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.post(`/api/agency/delegation/stores/${sellerId}/request-mode`, { mode },
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(r.data.message || '위임 요청 알림을 매장에 보냈습니다. 발효는 매장 승인 시에만 됩니다.')
      } else {
        toast.error(r.data?.error || '위임 요청에 실패했습니다')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '위임 요청에 실패했습니다')
    } finally {
      setRequesting(null)
    }
  }

  return (
    <AgencyLayout title="매장 위임">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="매장 위임"
          subtitle="매장별 promo 관리 위임 모드(승인형/완전위임형)와 소개비 지출 투명성을 조회하고, 위임을 요청합니다"
          icon={<Store className="h-5 w-5" />}
        />

        {/* 8월 활성 예고 배너 */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            <strong>분배 엔진은 8월 활성 예정</strong> — 지금은 위임 관계·투명성 조회만 제공됩니다.
          </p>
        </div>

        {/* 재원 프레이밍 — funding_source 게이트 (platform 동안 owner 문구 절대 금지) */}
        {ownerFunded ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-bold text-emerald-800">
              커미션 재원: 매장 promo (매장 95% 안) — 유어딜 5% 무관
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">
              에이전시 수수료는 매장 promo 마진에서 매장-인플 조율로 배분됩니다. 유어딜은 캡·투명성 가드만 제공합니다.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold text-gray-700">
              재원 전환(8월 flip) 전 — 현재는 플랫폼 부담 구조입니다
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
              전환 후에는 커미션 재원이 매장 promo(매장 95% 안)로 이동합니다. 아래 실측/그림자 비교는 그 전환 검증용입니다.
            </p>
          </div>
        )}

        {/* 불변원칙 3종 (§4.3 — 어느 모드에서도 유어딜이 강제) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">위임 불변원칙 — 어느 모드에서도</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-[11px] leading-relaxed text-gray-600">
                <strong className="text-gray-900">투명성</strong> — 매장은 자기 promo 지출 내역을 항상 조회할 수 있습니다 (완전위임형이어도).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[11px] leading-relaxed text-gray-600">
                <strong className="text-gray-900">회수권</strong> — 매장은 위임을 언제든 회수할 수 있습니다. 회수 시 진행 중 설정은 매장 승인 대기로 강등됩니다.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-[11px] leading-relaxed text-gray-600">
                <strong className="text-gray-900">유어딜은 캡·투명성 가드만</strong> — 값·승인·분배에는 관여하지 않습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 매장 리스트 */}
        {storesQ.isLoading ? (
          <DashboardLoading />
        ) : storesQ.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-bold text-red-700">매장 위임 목록을 불러오지 못했습니다</p>
            <p className="mt-1 text-xs text-red-500">네트워크 상태를 확인한 뒤 다시 시도해주세요.</p>
            <button
              type="button"
              onClick={() => storesQ.refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 재시도
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold text-gray-900">내 매장 ({formatNumber(stores.length)}곳)</h2>
              <button
                type="button"
                onClick={() => storesQ.refetch()}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
              >
                <RefreshCw className="h-3 w-3" /> 새로고침
              </button>
            </div>
            {stores.length === 0 ? (
              <DashboardEmptyState
                icon={<Store className="h-7 w-7" />}
                title="위임 조회 가능한 매장이 없어요"
                description="영입(입점)한 매장 또는 위임 관계가 있는 매장이 여기에 표시됩니다."
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {stores.map(s => {
                  const badge = modeBadge(s.delegation_mode)
                  const isOpen = expanded === s.seller_id
                  const summary = summaries[s.seller_id]
                  return (
                    <div key={s.seller_id}>
                      {/* 매장 행 (클릭 → promo 요약 확장) */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(s.seller_id)}
                        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-[180px] flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            {s.business_name || s.name || `#${s.seller_id}`}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {s.status ? `상태 ${s.status}` : ''}
                            {s.granted_at && s.delegation_mode && (s.delegation_mode === 'approval' || s.delegation_mode === 'full')
                              ? ` · 위임 ${new Date(s.granted_at).toLocaleDateString('ko-KR')}` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">promo 상품</p>
                          <p className={`text-sm font-bold ${s.promo_products > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                            {formatNumber(s.promo_products)}개
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">최대 promo</p>
                          <p className="text-sm font-bold text-gray-900">{promoPctLabel(s.max_promo_pct)}</p>
                        </div>
                        {isOpen
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </button>

                      {/* 확장 패널 — 최근 90일 소개비 (실측 vs 그림자) + 위임 요청 */}
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                          {summaryLoading[s.seller_id] ? (
                            <p className="py-2 text-center text-xs text-gray-400">promo 요약 불러오는 중…</p>
                          ) : summaryError[s.seller_id] ? (
                            <div className="py-2 text-center">
                              <p className="text-xs font-bold text-red-600">promo 요약을 불러오지 못했습니다</p>
                              <button
                                type="button"
                                onClick={() => fetchSummary(s.seller_id)}
                                className="mt-2 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                              >
                                <RefreshCw className="h-3 w-3" /> 재시도
                              </button>
                            </div>
                          ) : summary ? (
                            <>
                              <p className="mb-2 text-[11px] font-bold text-gray-500">
                                최근 {formatNumber(summary.window_days)}일 소개비 (promo)
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-gray-200 bg-white p-3">
                                  <p className="text-[10px] font-bold text-gray-500">실측 (라이브 적립)</p>
                                  <p className="mt-1 text-lg font-extrabold text-gray-900">{formatWon(summary.measured_promo_sum)}</p>
                                  <p className="text-[10px] text-gray-400">{formatNumber(summary.measured_promo_count)}건 · 유효분(환불/회수 제외)</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-3">
                                  <p className="text-[10px] font-bold text-gray-500">그림자 기록 (기록 전용)</p>
                                  <p className="mt-1 text-lg font-extrabold text-gray-900">{formatWon(summary.shadow_promo_sum)}</p>
                                  <p className="text-[10px] text-gray-400">{formatNumber(summary.shadow_promo_count)}건 · 실정산 아님</p>
                                </div>
                              </div>
                              <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
                                실측 = 실제 적립 경로의 소개비 유효분 · 그림자 = 새 수수료 규칙(fee-resolver)의 기록 전용 계산.
                                두 값의 비교는 8월 재원 전환 전 정합성 검증용입니다.
                              </p>
                            </>
                          ) : (
                            <p className="py-2 text-center text-xs text-gray-400">promo 요약 데이터가 없습니다</p>
                          )}

                          {/* 위임 요청 — grant 는 매장만 (유어딜은 관여하지 않음) */}
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <p className="mb-2 text-[11px] font-bold text-gray-500">위임 요청</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={requesting != null || s.delegation_mode === 'approval'}
                                onClick={() => requestMode(s.seller_id, 'approval')}
                                className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Send className="h-3 w-3" /> 승인형 요청
                              </button>
                              <button
                                type="button"
                                disabled={requesting != null || s.delegation_mode === 'full'}
                                onClick={() => requestMode(s.seller_id, 'full')}
                                className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Send className="h-3 w-3" /> 완전위임형 요청
                              </button>
                              <p className="text-[10px] text-gray-400">
                                발효는 매장 승인 시에만 됩니다 (유어딜은 관여하지 않음).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 모드 설명 (§4.3 3단 표 요약) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-gray-900">위임 모드 안내</h2>
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-gray-600">
            <li><strong className="text-gray-900">미위임(셀프)</strong> — promo 총액·인플 분배율 모두 매장이 직접 세팅, 즉시 발효.</li>
            <li><strong className="text-blue-700">승인형 (기본)</strong> — 에이전시가 제안하고, 발효는 매장 승인 시. 위임하되 매장이 최종 게이트.</li>
            <li><strong className="text-emerald-700">완전위임형</strong> — 에이전시가 세팅하고 즉시 발효(매장 승인 불필요). 매장이 관리 전권을 위임한 경우.</li>
          </ul>
        </div>
      </div>
    </AgencyLayout>
  )
}
