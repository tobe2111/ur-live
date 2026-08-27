/**
 * 🤝 셀러(매장) — 소개 파트너 우대 커미션 협업 deal (2026-07-10)
 *   백엔드(기존 — src/features/group-buy/api/marketing.routes.ts sellerApp, 마운트 /api/seller-marketing):
 *     GET  /api/seller-marketing/deals              — 내 deal 목록
 *     POST /api/seller-marketing/deals/propose      — {influencer_id, commission_pct, ends_at?, message?}
 *     POST /api/seller-marketing/deals/:id/respond  — {action:'accept'|'reject'} (인플 제안 + proposed 만)
 *
 * ⚠️ 커미션 % 상한(cap)은 서버가 platform_settings.max_influencer_commission_pct 로 검증 —
 *   초과 시 서버 오류 메시지(허용 범위 포함)를 그대로 노출한다.
 * ⚠️ 재원 카피 중립 유지 — 이 페이지엔 funding 정보 endpoint 가 없으므로 재원 주장 문구 금지.
 */
import { useState } from 'react'
import InfluencerPicker from './seller-influencer-deals/InfluencerPicker'
import { useTranslation } from 'react-i18next'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { getSellerToken } from '@/lib/seller-auth'
import { Handshake, RefreshCw, Send, Check, X, Info } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'

// ─── 응답 shape (marketing.routes.ts sellerApp GET /deals 와 1:1) ────────────
interface Deal {
  id: number
  influencer_id: string
  commission_pct: number
  starts_at: string | null
  ends_at: string | null
  status: string // 'proposed' | 'active' | 'rejected'
  proposed_by: string // 'seller' | 'influencer'
  message: string | null
  created_at: string
  responded_at: string | null
  // 🎬 WP-B 조건부 우대(콘텐츠 인증 시 발효)
  requires_content_proof?: number | null
  proof_url?: string | null
  proof_status?: string | null // 'pending' | 'submitted' | 'approved' | 'rejected'
}

export default function SellerInfluencerDealsPage() {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [responding, setResponding] = useState<number | null>(null)
  const [form, setForm] = useState({ influencer_id: '', commission_pct: '1.5', ends_at: '', message: '', requires_content_proof: false })

  // /api/seller-marketing prefix 는 api 인터셉터 자동 토큰 미주입 → 수동 헤더 (SellerMarketingPage 동일).
  const headers = { Authorization: `Bearer ${getSellerToken() || ''}` }
  const dealsQ = useApiQuery<Deal[]>(
    ['seller', 'influencer-deals'], '/api/seller-marketing/deals',
    { headers, select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const deals = dealsQ.data ?? []

  function statusBadge(status: string): { label: string; cls: string } {
    if (status === 'active') {
      return { label: t('seller.influencerDeals.statusActive', { defaultValue: '활성' }), cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
    if (status === 'rejected') {
      return { label: t('seller.influencerDeals.statusRejected', { defaultValue: '거절됨' }), cls: 'bg-red-100 text-red-700 border-red-200' }
    }
    return { label: t('seller.influencerDeals.statusProposed', { defaultValue: '제안됨' }), cls: 'bg-blue-100 text-blue-700 border-blue-200' }
  }

  async function submitPropose() {
    const influencerId = form.influencer_id.trim()
    const pct = Number(form.commission_pct)
    if (!influencerId || !/^[a-zA-Z0-9_\-:]{1,64}$/.test(influencerId)) {
      toast.error(t('seller.influencerDeals.invalidId', { defaultValue: '소개 파트너 ID 형식이 올바르지 않습니다' }))
      return
    }
    if (!Number.isFinite(pct) || pct <= 0) {
      toast.error(t('seller.influencerDeals.invalidPct', { defaultValue: '커미션 % 값이 올바르지 않습니다' }))
      return
    }
    setProposing(true)
    try {
      const r = await api.post('/api/seller-marketing/deals/propose', {
        influencer_id: influencerId,
        commission_pct: pct,
        ends_at: form.ends_at || undefined,
        message: form.message || undefined,
        requires_content_proof: form.requires_content_proof || undefined,
      }, { headers })
      if (r.data?.success) {
        toast.success(form.requires_content_proof
          ? t('seller.influencerDeals.proposeSuccessConditional', { defaultValue: '조건부 제안을 보냈습니다 — 상대가 콘텐츠를 게시하고 링크를 제출하면 검토 후 발효됩니다' })
          : t('seller.influencerDeals.proposeSuccess', { defaultValue: '제안을 보냈습니다 — 상대가 수락하면 활성화됩니다' }))
        setShowForm(false)
        setForm({ influencer_id: '', commission_pct: '1.5', ends_at: '', message: '', requires_content_proof: false })
        dealsQ.refetch()
      } else {
        // cap 초과 등 — 서버 메시지(허용 범위 포함) 그대로 노출
        toast.error(r.data?.error || t('seller.influencerDeals.proposeFailed', { defaultValue: '제안 발송에 실패했습니다' }))
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.influencerDeals.proposeFailed', { defaultValue: '제안 발송에 실패했습니다' }))
    } finally {
      setProposing(false)
    }
  }

  async function respond(deal: Deal, action: 'accept' | 'reject') {
    if (responding != null) return
    const ok = await confirmDialog({
      title: `${deal.influencer_id} · ${deal.commission_pct}%`,
      message: action === 'accept'
        ? t('seller.influencerDeals.confirmAccept', { defaultValue: '이 협업 제안을 수락할까요? 수락 시 우대 커미션이 즉시 활성화됩니다.' })
        : t('seller.influencerDeals.confirmReject', { defaultValue: '이 협업 제안을 거절할까요?' }),
      danger: action === 'reject',
    })
    if (!ok) return
    setResponding(deal.id)
    try {
      const r = await api.post(`/api/seller-marketing/deals/${deal.id}/respond`, { action }, { headers })
      if (r.data?.success) {
        toast.success(action === 'accept'
          ? t('seller.influencerDeals.respondAccepted', { defaultValue: '수락했습니다 — 우대 커미션이 활성화되었습니다' })
          : t('seller.influencerDeals.respondRejected', { defaultValue: '거절했습니다' }))
        dealsQ.refetch()
      } else {
        toast.error(r.data?.error || t('seller.influencerDeals.respondFailed', { defaultValue: '응답 처리에 실패했습니다' }))
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.influencerDeals.respondFailed', { defaultValue: '응답 처리에 실패했습니다' }))
    } finally {
      setResponding(null)
    }
  }

  // 🎬 WP-B: 인플이 제출한 콘텐츠 인증 검토 → 승인(발효) / 반려. 승인이 우대율 발효 트리거.
  async function reviewProof(deal: Deal, action: 'approve' | 'reject') {
    if (responding != null) return
    const ok = await confirmDialog({
      title: `${deal.influencer_id} · ${deal.commission_pct}%`,
      message: action === 'approve'
        ? t('seller.influencerDeals.confirmApproveProof', { defaultValue: '콘텐츠 게시를 확인했나요? 승인하면 우대 커미션이 발효됩니다 (이후 판매분부터 적용, 소급 없음).' })
        : t('seller.influencerDeals.confirmRejectProof', { defaultValue: '이 콘텐츠 인증을 반려할까요? 상대가 다시 제출할 수 있습니다.' }),
      danger: action === 'reject',
    })
    if (!ok) return
    setResponding(deal.id)
    try {
      const r = await api.post(`/api/seller-marketing/deals/${deal.id}/approve-proof`, { action }, { headers })
      if (r.data?.success) {
        toast.success(action === 'approve'
          ? t('seller.influencerDeals.proofApproved', { defaultValue: '승인했습니다 — 우대 커미션이 발효되었습니다' })
          : t('seller.influencerDeals.proofRejected', { defaultValue: '반려했습니다' }))
        dealsQ.refetch()
      } else {
        toast.error(r.data?.error || t('seller.influencerDeals.respondFailed', { defaultValue: '응답 처리에 실패했습니다' }))
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.influencerDeals.respondFailed', { defaultValue: '응답 처리에 실패했습니다' }))
    } finally {
      setResponding(null)
    }
  }

  return (
    <SellerLayout title={t('seller.influencerDeals.title', { defaultValue: '인플 협업' })}>
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.influencerDeals.title', { defaultValue: '인플 협업' })}
          subtitle={t('seller.influencerDeals.subtitle', { defaultValue: '소개해 줄 사람에게 우대 커미션을 제안하고, 받은 신청에 응답합니다' })}
          icon={<Handshake className="h-5 w-5" />}
        />

        {/* 적용 범위 안내 — 재원 주장 없이 중립 카피만 */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-[11px] leading-relaxed text-blue-700">
            {t('seller.influencerDeals.pinNote', { defaultValue: '우대 커미션은 소개(핀)로 팔린 건에만 적용됩니다.' })}
          </p>
        </div>

        {/* 제안 폼 (인라인 토글) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              {t('seller.influencerDeals.propose', { defaultValue: '우대 커미션 제안' })}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-gray-700"
            >
              <Send className="h-3 w-3" />
              {showForm
                ? t('seller.influencerDeals.closeForm', { defaultValue: '폼 닫기' })
                : t('seller.influencerDeals.openForm', { defaultValue: '새 제안 작성' })}
            </button>
          </div>
          {showForm && (
            <div className="mt-4 space-y-3">
              {/* 🔎 2026-08-27: `user_12345` 를 손으로 치던 입력을 검색으로 대체.
                  사장님이 남의 계정 ID 를 알 방법이 없어 이 화면은 쓸 수 없었다. */}
              <InfluencerPicker
                selectedId={form.influencer_id}
                headers={headers}
                onPick={(row) => setForm((f) => ({ ...f, influencer_id: row.user_id }))}
              />
              {form.influencer_id && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                  선택됨 · <span className="font-mono">{form.influencer_id}</span>
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t('seller.influencerDeals.commissionPct', { defaultValue: '우대 커미션 (%)' })}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={form.commission_pct}
                  onChange={(e) => setForm((f) => ({ ...f, commission_pct: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  {t('seller.influencerDeals.capNote', { defaultValue: '플랫폼 상한(cap)을 넘으면 서버에서 거부됩니다 — 오류 메시지에 허용 범위가 표시됩니다.' })}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t('seller.influencerDeals.endsAt', { defaultValue: '만료일 (선택)' })}
                </label>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t('seller.influencerDeals.message', { defaultValue: '메시지 (선택)' })}
                </label>
                <textarea
                  rows={2}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder={t('seller.influencerDeals.messagePlaceholder', { defaultValue: '협업 조건 등' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              {/* 🎬 WP-B: 콘텐츠 인증 조건 (opt-in — 미체크 시 기존 무조건부 흐름과 동일) */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.requires_content_proof}
                  onChange={(e) => setForm((f) => ({ ...f, requires_content_proof: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
                />
                <span className="text-[11px] leading-relaxed text-amber-800">
                  <b className="font-bold">{t('seller.influencerDeals.proofGateLabel', { defaultValue: '콘텐츠 게시 인증 시 발효' })}</b>
                  {' — '}
                  {t('seller.influencerDeals.proofGateDesc', { defaultValue: '상대가 콘텐츠(블로그/SNS)를 게시하고 링크를 제출한 뒤, 내가 확인·승인해야 우대 커미션이 발효됩니다. 승인 전 판매분은 기본 커미션이 적용됩니다.' })}
                </span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  {t('seller.influencerDeals.cancel', { defaultValue: '취소' })}
                </button>
                <button
                  type="button"
                  onClick={submitPropose}
                  disabled={proposing}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {proposing
                    ? t('seller.influencerDeals.sending', { defaultValue: '발송 중...' })
                    : t('seller.influencerDeals.send', { defaultValue: '제안 발송' })}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* deal 목록 */}
        {dealsQ.isLoading ? (
          <DashboardLoading />
        ) : dealsQ.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-bold text-red-700">
              {t('seller.influencerDeals.loadFailed', { defaultValue: '협업 deal 을 불러오지 못했습니다' })}
            </p>
            <p className="mt-1 text-xs text-red-500">
              {t('seller.influencerDeals.loadFailedDesc', { defaultValue: '네트워크 상태를 확인한 뒤 다시 시도해주세요.' })}
            </p>
            <button
              type="button"
              onClick={() => dealsQ.refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('seller.influencerDeals.retry', { defaultValue: '재시도' })}
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold text-gray-900">
                {t('seller.influencerDeals.listTitle', { defaultValue: '협업 deal' })} ({formatNumber(deals.length)})
              </h2>
              <button
                type="button"
                onClick={() => dealsQ.refetch()}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
              >
                <RefreshCw className="h-3 w-3" />
                {t('common.refresh', { defaultValue: '새로고침' })}
              </button>
            </div>
            {deals.length === 0 ? (
              <DashboardEmptyState
                icon={<Handshake className="h-7 w-7" />}
                title={t('seller.influencerDeals.empty', { defaultValue: '협업 deal 이 없습니다' })}
                description={t('seller.influencerDeals.emptyDesc', { defaultValue: '소개해 줄 사람에게 우대 커미션을 제안하거나, 받은 신청에 응답해보세요.' })}
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {deals.map((d) => {
                  const badge = statusBadge(d.status)
                  const canRespond = d.status === 'proposed' && d.proposed_by === 'influencer'
                  const isConditional = d.requires_content_proof === 1
                  const canReviewProof = isConditional && d.proof_status === 'submitted'
                  return (
                    <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-[170px] flex-1">
                        <p className="truncate font-mono text-sm font-medium text-gray-900">{d.influencer_id}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {d.commission_pct}%
                          {' · '}
                          {d.proposed_by === 'seller'
                            ? t('seller.influencerDeals.proposedByMe', { defaultValue: '내가 제안' })
                            : t('seller.influencerDeals.proposedByInfluencer', { defaultValue: '인플이 신청' })}
                          {' · '}
                          {t('seller.influencerDeals.createdAt', { defaultValue: '제안일' })}{' '}
                          {formatKSTDate(d.created_at)}
                          {d.ends_at && (
                            <>
                              {' · '}
                              {t('seller.influencerDeals.endsAtLabel', { defaultValue: '만료' })}{' '}
                              {new Date(d.ends_at).toLocaleDateString('ko-KR')}
                            </>
                          )}
                        </p>
                        {d.message && <p className="mt-0.5 truncate text-[10px] italic text-gray-600">&ldquo;{d.message}&rdquo;</p>}
                        {/* 🎬 WP-B: 조건부 딜 인증 상태 */}
                        {isConditional && d.status !== 'active' && (
                          <p className="mt-1 text-[10px] font-medium text-amber-700">
                            {d.proof_status === 'submitted'
                              ? t('seller.influencerDeals.proofSubmitted', { defaultValue: '📎 콘텐츠 인증 제출됨 — 검토 필요' })
                              : d.proof_status === 'rejected'
                                ? t('seller.influencerDeals.proofRejectedLabel', { defaultValue: '↩︎ 인증 반려됨 — 재제출 대기' })
                                : t('seller.influencerDeals.proofPending', { defaultValue: '⏳ 콘텐츠 게시·링크 제출 대기 중' })}
                            {d.proof_url && (
                              <>
                                {' · '}
                                <a href={d.proof_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">
                                  {t('seller.influencerDeals.viewProof', { defaultValue: '콘텐츠 보기 ↗' })}
                                </a>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {canReviewProof && (
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={responding != null}
                            onClick={() => reviewProof(d, 'approve')}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                          >
                            <Check className="h-3 w-3" />
                            {t('seller.influencerDeals.approveProof', { defaultValue: '인증 승인' })}
                          </button>
                          <button
                            type="button"
                            disabled={responding != null}
                            onClick={() => reviewProof(d, 'reject')}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            <X className="h-3 w-3" />
                            {t('seller.influencerDeals.rejectProof', { defaultValue: '반려' })}
                          </button>
                        </div>
                      )}
                      {canRespond && (
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={responding != null}
                            onClick={() => respond(d, 'accept')}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                          >
                            <Check className="h-3 w-3" />
                            {t('seller.influencerDeals.accept', { defaultValue: '수락' })}
                          </button>
                          <button
                            type="button"
                            disabled={responding != null}
                            onClick={() => respond(d, 'reject')}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            <X className="h-3 w-3" />
                            {t('seller.influencerDeals.reject', { defaultValue: '거절' })}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
