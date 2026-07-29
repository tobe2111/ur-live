/**
 * 🤝 셀러(매장) — 에이전시 위임 관리 (3단 위임 모델, 2026-07-10)
 *   설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3 (셀프형/승인형/완전위임형 + 불변원칙 3종)
 *   백엔드: src/features/seller/api/seller-delegation.routes.ts
 *     GET  /api/seller/delegation                    — 내 위임 관계 + 위임 가능 에이전시
 *     POST /api/seller/delegation/:agencyId/grant    — {mode:'approval'|'full'} (grant 는 매장만)
 *     POST /api/seller/delegation/:agencyId/revoke   — 회수 (🔒 불변원칙 #2 — 언제든, 조건 없이)
 *
 * 🔒 불변 원칙(§4.3) UI 반영:
 *   ① 투명성 — promo 지출 내역은 /seller/promo-spend 에서 항상 조회 가능(완전위임형이어도) 안내.
 *   ② 회수권 — '위임 회수' 버튼은 위임 중이면 조건 없이 항상 노출.
 *   ③ 유어딜은 캡·투명성 가드만 — 값·승인·분배엔 관여하지 않음.
 *   분배 엔진은 8월 활성 예정 — 지금은 위임 관계 설정만 (배너 고지).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
  Handshake, ShieldCheck, Eye, Undo2, RefreshCw, CalendarClock, Store, ArrowRight,
} from 'lucide-react'
import { formatNumber } from '@/utils/format'

// ─── 응답 shape (seller-delegation.routes.ts GET / 와 1:1) ───────────────────
interface DelegationRow {
  id: number
  agency_id: number
  agency_name: string | null
  mode: string // 'self' | 'approval' | 'full'
  granted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}
interface AvailableAgency {
  agency_id: number
  agency_name: string | null
  reason: string // 'introduced_by_agency'
}
interface DelegationData {
  delegations: DelegationRow[]
  available_to_delegate: AvailableAgency[]
}

type GrantMode = 'approval' | 'full'

export default function SellerAgencyDelegationPage() {
  const { t } = useTranslation()
  const [acting, setActing] = useState<number | null>(null)

  const q = useApiQuery<DelegationData>(
    ['seller', 'agency-delegation'], '/api/seller/delegation',
    { select: (r: any) => (r?.success ? r.data : { delegations: [], available_to_delegate: [] }) },
  )
  const delegations = q.data?.delegations ?? []
  const available = q.data?.available_to_delegate ?? []

  // §4.3 3단 모드 배지 — AgencyDelegationsPage 와 동일 팔레트
  function modeBadge(mode: string | null): { label: string; cls: string } {
    if (mode === 'approval') {
      return { label: t('seller.delegation.modeApproval', { defaultValue: '승인형' }), cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    }
    if (mode === 'full') {
      return { label: t('seller.delegation.modeFull', { defaultValue: '완전위임형' }), cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
    return { label: t('seller.delegation.modeSelf', { defaultValue: '미위임(셀프)' }), cls: 'bg-gray-100 text-gray-600 border-gray-200' }
  }

  const agencyLabel = (name: string | null, id: number) =>
    name || `${t('seller.delegation.agencyFallback', { defaultValue: '에이전시' })} #${id}`

  // ─── grant — confirm 에서 모드 의미(§4.3 표)를 설명한 뒤 POST ────────────────
  async function grant(agencyId: number, agencyName: string | null, mode: GrantMode) {
    if (acting != null) return
    const title = mode === 'full'
      ? t('seller.delegation.confirmFullTitle', { defaultValue: '완전위임형으로 위임할까요?' })
      : t('seller.delegation.confirmApprovalTitle', { defaultValue: '승인형으로 위임할까요?' })
    const body = mode === 'full'
      ? t('seller.delegation.confirmFullBody', { defaultValue: '완전위임형: 에이전시가 promo 총액·인플 분배율을 설정하면 즉시 발효됩니다(매장 승인 불필요). promo 지출 내역은 항상 조회할 수 있고, 위임은 언제든 회수할 수 있습니다.' })
      : t('seller.delegation.confirmApprovalBody', { defaultValue: '승인형(기본·권장): 에이전시가 promo 총액·인플 분배율을 제안하고, 발효는 매장(나)의 승인 시에만 됩니다. 위임은 언제든 회수할 수 있습니다.' })
    const ok = await confirmDialog({ title: `${agencyLabel(agencyName, agencyId)} — ${title}`, message: body })
    if (!ok) return
    setActing(agencyId)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.post(`/api/seller/delegation/${agencyId}/grant`, { mode },
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(t('seller.delegation.grantSuccess', { defaultValue: '위임이 설정되었습니다' }))
        q.refetch()
      } else {
        toast.error(r.data?.error || t('seller.delegation.grantFailed', { defaultValue: '위임 설정에 실패했습니다' }))
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.delegation.grantFailed', { defaultValue: '위임 설정에 실패했습니다' }))
    } finally {
      setActing(null)
    }
  }

  // ─── revoke — 🔒 불변원칙 #2: 조건 없이 항상 가능 ──────────────────────────
  async function revoke(agencyId: number, agencyName: string | null) {
    if (acting != null) return
    const ok = await confirmDialog({
      title: `${agencyLabel(agencyName, agencyId)} — ${t('seller.delegation.confirmRevokeTitle', { defaultValue: '위임을 회수할까요?' })}`,
      message: t('seller.delegation.confirmRevokeBody', { defaultValue: '회수 즉시 셀프 모드로 전환됩니다(조건 없음). 이후 에이전시 설정은 자동 발효되지 않습니다.' }),
      danger: true,
    })
    if (!ok) return
    setActing(agencyId)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.post(`/api/seller/delegation/${agencyId}/revoke`, {},
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(t('seller.delegation.revokeSuccess', { defaultValue: '위임을 회수했습니다 (셀프 전환)' }))
        q.refetch()
      } else {
        toast.error(r.data?.error || t('seller.delegation.revokeFailed', { defaultValue: '위임 회수에 실패했습니다' }))
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.delegation.revokeFailed', { defaultValue: '위임 회수에 실패했습니다' }))
    } finally {
      setActing(null)
    }
  }

  // grant/모드전환 버튼 짝 — 활성 모드는 비활성 처리
  function grantButtons(agencyId: number, agencyName: string | null, currentMode: string | null) {
    const delegated = currentMode === 'approval' || currentMode === 'full'
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={acting != null || currentMode === 'approval'}
          onClick={() => grant(agencyId, agencyName, 'approval')}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Handshake className="h-3 w-3" />
          {delegated
            ? t('seller.delegation.switchToApproval', { defaultValue: '승인형으로 전환' })
            : t('seller.delegation.grantApproval', { defaultValue: '승인형으로 위임' })}
          <span className="rounded-full bg-white/20 px-1.5 text-[9px]">
            {t('seller.delegation.recommendedBadge', { defaultValue: '기본·권장' })}
          </span>
        </button>
        <button
          type="button"
          disabled={acting != null || currentMode === 'full'}
          onClick={() => grant(agencyId, agencyName, 'full')}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Handshake className="h-3 w-3" />
          {delegated
            ? t('seller.delegation.switchToFull', { defaultValue: '완전위임형으로 전환' })
            : t('seller.delegation.grantFull', { defaultValue: '완전위임형으로 위임' })}
        </button>
        {/* 🔒 불변원칙 #2 (회수권) — 위임 중이면 조건 없이 항상 노출 */}
        {delegated && (
          <button
            type="button"
            disabled={acting != null}
            onClick={() => revoke(agencyId, agencyName)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-500 bg-white px-3.5 py-1.5 text-xs font-extrabold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3 w-3" />
            {t('seller.delegation.revoke', { defaultValue: '위임 회수' })}
          </button>
        )}
      </div>
    )
  }

  return (
    <SellerLayout title={t('seller.delegation.title', { defaultValue: '매장 위임' })}>
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.delegation.title', { defaultValue: '매장 위임' })}
          subtitle={t('seller.delegation.subtitle', { defaultValue: '에이전시에게 promo 관리(총액·인플 분배율)를 얼마나 위임할지 설정합니다 — 회수는 언제든 가능합니다' })}
          icon={<Handshake className="h-5 w-5" />}
        />

        {/* 8월 분배 엔진 예고 배너 */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            {t('seller.delegation.engineBanner', { defaultValue: '분배 엔진은 8월 활성 예정 — 지금은 위임 관계 설정만 제공됩니다.' })}
          </p>
        </div>

        {/* 🔒 불변원칙 #1 (투명성) 안내 + promo 지출 링크 */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-blue-800">
                {t('seller.delegation.transparencyTitle', { defaultValue: '투명성 원칙' })}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-blue-700">
                {t('seller.delegation.transparencyBody', { defaultValue: '위임과 무관하게 promo 지출 내역은 항상 여기(내 promo 지출)에서 조회할 수 있습니다 — 완전위임형이어도.' })}
              </p>
              <Link
                to="/seller/promo-spend"
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
              >
                {t('seller.delegation.viewPromoSpend', { defaultValue: '내 promo 지출 보기' })}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* 내 위임 관계 */}
        {q.isLoading ? (
          <DashboardLoading />
        ) : q.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-bold text-red-700">
              {t('seller.delegation.loadFailed', { defaultValue: '위임 관계를 불러오지 못했습니다' })}
            </p>
            <p className="mt-1 text-xs text-red-500">
              {t('seller.delegation.loadFailedDesc', { defaultValue: '네트워크 상태를 확인한 뒤 다시 시도해주세요.' })}
            </p>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('seller.delegation.retry', { defaultValue: '재시도' })}
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-900">
                  {t('seller.delegation.listTitle', { defaultValue: '내 위임 관계' })} ({formatNumber(delegations.length)})
                </h2>
                <button
                  type="button"
                  onClick={() => q.refetch()}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t('common.refresh', { defaultValue: '새로고침' })}
                </button>
              </div>
              {delegations.length === 0 && available.length === 0 ? (
                <DashboardEmptyState
                  icon={<Store className="h-7 w-7" />}
                  title={t('seller.delegation.empty', { defaultValue: '위임 관계가 없어요' })}
                  description={t('seller.delegation.emptyDesc', { defaultValue: '나를 영입한 에이전시가 생기면 여기에서 위임할 수 있습니다.' })}
                />
              ) : delegations.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-400">
                  {t('seller.delegation.noneYet', { defaultValue: '아직 설정된 위임이 없습니다 — 아래 위임 가능한 에이전시에서 시작하세요.' })}
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {delegations.map((d) => {
                    const badge = modeBadge(d.mode)
                    return (
                      <div key={d.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-[140px] flex-1 text-sm font-bold text-gray-900">
                            {agencyLabel(d.agency_name, d.agency_id)}
                          </p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {d.granted_at && (
                            <span>
                              {t('seller.delegation.grantedAt', { defaultValue: '위임일' })}{' '}
                              {new Date(d.granted_at).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                          {d.revoked_at && (
                            <span className={d.granted_at ? 'ml-2' : ''}>
                              {t('seller.delegation.revokedAt', { defaultValue: '회수일' })}{' '}
                              {new Date(d.revoked_at).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </p>
                        <div className="mt-2.5">
                          {grantButtons(d.agency_id, d.agency_name, d.mode)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 위임 가능한 에이전시 (영입 관계인데 위임 행 없음) */}
            {available.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h2 className="text-sm font-bold text-gray-900">
                    {t('seller.delegation.availableTitle', { defaultValue: '위임 가능한 에이전시' })}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {t('seller.delegation.availableDesc', { defaultValue: '나를 영입한 에이전시입니다 — 모드를 선택해 위임할 수 있습니다.' })}
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {available.map((a) => (
                    <div key={a.agency_id} className="px-4 py-3">
                      <p className="text-sm font-bold text-gray-900">{agencyLabel(a.agency_name, a.agency_id)}</p>
                      <div className="mt-2.5">
                        {grantButtons(a.agency_id, a.agency_name, null)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 위임 모드 안내 (§4.3 3단 표 요약) + 불변원칙 #3 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-gray-900">
            {t('seller.delegation.guideTitle', { defaultValue: '위임 모드 안내' })}
          </h2>
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-gray-600">
            <li>
              <strong className="text-gray-900">{t('seller.delegation.modeSelf', { defaultValue: '미위임(셀프)' })}</strong>
              {' — '}
              {t('seller.delegation.guideSelf', { defaultValue: 'promo 총액·인플 분배율 모두 매장이 직접 세팅, 즉시 발효.' })}
            </li>
            <li>
              <strong className="text-blue-700">{t('seller.delegation.modeApproval', { defaultValue: '승인형' })}</strong>
              {' — '}
              {t('seller.delegation.guideApproval', { defaultValue: '에이전시가 제안하고, 발효는 매장 승인 시. 위임하되 매장이 최종 게이트 (기본·권장).' })}
            </li>
            <li>
              <strong className="text-emerald-700">{t('seller.delegation.modeFull', { defaultValue: '완전위임형' })}</strong>
              {' — '}
              {t('seller.delegation.guideFull', { defaultValue: '에이전시가 세팅하고 즉시 발효(매장 승인 불필요). 관리 전권을 위임한 경우.' })}
            </li>
          </ul>
          <div className="mt-3 flex items-start gap-2 border-t border-gray-100 pt-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-[11px] leading-relaxed text-gray-500">
              {t('seller.delegation.platformGuardNote', { defaultValue: '유어딜은 캡·투명성 가드만 제공합니다 — 값·승인·분배에는 관여하지 않습니다.' })}
            </p>
          </div>
        </div>
      </div>
    </SellerLayout>
  )
}
