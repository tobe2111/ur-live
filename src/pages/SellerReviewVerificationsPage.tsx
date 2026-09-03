/**
 * 🗺️ 2026-07-02 (대표 "카카오맵 리뷰 게이미피케이션 — 매장에서 확인"): 매장 리뷰 확인 큐.
 *
 * 손님이 이용권 사용 후 카카오맵 후기를 쓰고 인증(URL/스크린샷)을 제출하면, 매장 사장님이
 * 이 화면에서 실제 후기를 확인하고 승인/거절한다. 승인 시 손님에게 보너스 딜 + 동네 리뷰어
 * 점수(레벨)가 지급된다. 어드민 큐(AdminKakaoReviewsPage)는 샘플링 감사용 상위 권한으로 병행.
 * 설계: docs/design/kakao-review-gamification.md
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, ExternalLink, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import SellerVoucherTabs from '@/components/seller/SellerVoucherTabs'
import { DashboardPageHeader } from '@/components/dashboard'
import { formatKST } from '@/utils/date'

type Submission = {
  id: number
  voucher_id: number
  review_url: string
  bonus_amount: number
  status: 'submitted' | 'paid' | 'rejected'
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  product_name: string | null
  restaurant_name: string | null
}

const TABS = ['submitted', 'paid', 'rejected'] as const

function authHeaders() {
  const token = localStorage.getItem('seller_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function SellerReviewVerificationsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<(typeof TABS)[number]>('submitted')
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/api/seller/review-verifications?status=${status}`, { headers: authHeaders() })
      setRows(res.data?.success ? (res.data.data || []) : [])
      if (!res.data?.success) toast.error(res.data?.error || t('common.error', { defaultValue: '오류가 발생했습니다' }))
    } catch {
      setRows([])
      toast.error(t('seller.reviewVerify.loadError', { defaultValue: '목록을 불러오지 못했어요' }))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { load(tab) }, [tab, load])

  const approve = async (id: number) => {
    setBusyId(id)
    try {
      const res = await api.post(`/api/seller/review-verifications/${id}/approve`, {}, { headers: authHeaders() })
      if (res.data?.success) {
        toast.success(t('seller.reviewVerify.approvedToast', { defaultValue: '확인 완료 — 손님에게 보너스와 리뷰 점수가 지급됐어요' }))
        setRows((prev) => prev.filter((r) => r.id !== id))
      } else toast.error(res.data?.error || t('common.error', { defaultValue: '오류가 발생했습니다' }))
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('common.error', { defaultValue: '오류가 발생했습니다' }))
    } finally { setBusyId(null) }
  }

  const reject = async (id: number) => {
    const reason = rejectReason.trim()
    if (!reason) { toast.error(t('seller.reviewVerify.reasonRequired', { defaultValue: '거절 사유를 입력해주세요' })); return }
    setBusyId(id)
    try {
      const res = await api.post(`/api/seller/review-verifications/${id}/reject`, { reason }, { headers: authHeaders() })
      if (res.data?.success) {
        toast.success(t('seller.reviewVerify.rejectedToast', { defaultValue: '거절 처리됐어요' }))
        setRows((prev) => prev.filter((r) => r.id !== id))
        setRejectingId(null); setRejectReason('')
      } else toast.error(res.data?.error || t('common.error', { defaultValue: '오류가 발생했습니다' }))
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('common.error', { defaultValue: '오류가 발생했습니다' }))
    } finally { setBusyId(null) }
  }

  const tabLabel = (s: string) =>
    s === 'submitted' ? t('seller.reviewVerify.tabPending', { defaultValue: '확인 대기' })
    : s === 'paid' ? t('seller.reviewVerify.tabPaid', { defaultValue: '지급 완료' })
    : t('seller.reviewVerify.tabRejected', { defaultValue: '거절' })

  const isImage = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || url.includes('/api/media/')
  const ocrPassed = (r: Submission) => (r.admin_notes || '').startsWith('OCR 자동검증 통과')

  return (
    <SellerLayout title={t('seller.reviewVerify.title', { defaultValue: '카카오맵 리뷰 확인' })}>
      {/* 🎟️ 2026-09-03 대표 — 이용권 일을 한 페이지처럼: nav 는 하나, 여기서 탭 이동. */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4"><SellerVoucherTabs /></div>
      <DashboardPageHeader
        icon={<Star className="w-5 h-5" />}
        title={t('seller.reviewVerify.title', { defaultValue: '카카오맵 리뷰 확인' })}
        subtitle={t('seller.reviewVerify.subtitle', { defaultValue: '이용권을 쓴 손님이 남긴 카카오맵 후기를 확인해주세요. 확인 시 손님에게 보너스 딜 + 동네 리뷰어 점수가 지급됩니다.' })}
      />

      <div className="flex gap-1.5 mb-4">
        {TABS.map((s) => (
          <button key={s} onClick={() => setTab(s)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${tab === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            {tabLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">
            {tab === 'submitted'
              ? t('seller.reviewVerify.emptyPending', { defaultValue: '확인 대기 중인 리뷰 인증이 없어요' })
              : t('seller.reviewVerify.empty', { defaultValue: '내역이 없어요' })}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{r.restaurant_name || r.product_name || `#${r.voucher_id}`}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{r.product_name} · {formatKST(r.created_at)}</p>
                  {ocrPassed(r) && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      <Sparkles className="w-3 h-3" />{t('seller.reviewVerify.ocrPassed', { defaultValue: '자동검증 통과 (참고)' })}
                    </span>
                  )}
                </div>
                <a href={r.review_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-700 hover:border-gray-400">
                  <ExternalLink className="w-3.5 h-3.5" />{t('seller.reviewVerify.openReview', { defaultValue: '인증 보기' })}
                </a>
              </div>

              {isImage(r.review_url) && (
                <img src={r.review_url} alt="review proof" loading="lazy" className="mt-3 max-h-56 rounded-xl border border-gray-100 object-contain" />
              )}

              {tab === 'submitted' && (
                rejectingId === r.id ? (
                  <div className="mt-3 flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={200}
                      placeholder={t('seller.reviewVerify.reasonPlaceholder', { defaultValue: '거절 사유 (손님에게 전달됩니다)' })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-500" />
                    <button onClick={() => reject(r.id)} disabled={busyId === r.id}
                      className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50">
                      {t('seller.reviewVerify.rejectConfirm', { defaultValue: '거절 확정' })}
                    </button>
                    <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-600">
                      {t('common.cancel', { defaultValue: '취소' })}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => approve(r.id)} disabled={busyId === r.id}
                      className="ur-btn ur-btn-md ur-btn-primary inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {t('seller.reviewVerify.approve', { defaultValue: '확인 (보너스 지급)' })}
                    </button>
                    <button onClick={() => setRejectingId(r.id)} disabled={busyId === r.id}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:border-gray-400 disabled:opacity-50">
                      <XCircle className="w-4 h-4" />{t('seller.reviewVerify.reject', { defaultValue: '거절' })}
                    </button>
                  </div>
                )
              )}

              {tab !== 'submitted' && r.admin_notes && !ocrPassed(r) && (
                <p className="mt-2 text-[11px] text-gray-500">{r.admin_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-gray-400 leading-relaxed">
        {t('seller.reviewVerify.footNote', { defaultValue: '보너스는 후기 별점·내용과 무관하게 방문 인증에 대해 지급됩니다. 운영팀이 승인 내역을 샘플링 감사할 수 있어요.' })}
      </p>
    </SellerLayout>
  )
}
