/**
 * 🛡️ 2026-05-25 (Phase 2 잔여): 본인 반품 목록 + 회수 송장 추적.
 *
 * /my-returns
 *
 * - 반품 상태별 표시 (requested → approved → shipped → received → inspected → refunded)
 * - shipped 상태인 반품: 회수 송장 추적 모달 (carrier + tracking_number)
 * - approved 상태: 회수 송장 등록 inline form
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import TrackingModal from '@/components/shipping/TrackingModal'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { useMyReturns, useApplyReturnTracking, type ReturnRecord } from '@/hooks/queries/useMyReturns'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  requested: { label: '요청', color: 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200' },
  approved: { label: '승인 (회수 송장 등록 필요)', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  shipped: { label: '회수 발송', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  received: { label: '수령 완료', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  inspected: { label: '검수 완료', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  refunded: { label: '환불 완료', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: '취소', color: 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500' },
}

export default function MyReturnsPage() {
  const { t } = useTranslation()
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query. 송장 등록 후 캐시만 갱신(재요청 X).
  const { data: returns = [], isLoading: loading, isError } = useMyReturns()
  const applyTracking = useApplyReturnTracking()
  const error = isError ? '반품 목록을 불러올 수 없습니다' : null
  const [trackingTarget, setTrackingTarget] = useState<{ carrier: string; number: string } | null>(null)

  return (
    <>
      <SEO title={t('returns.title', { defaultValue: '내 반품' })} noindex />
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white pb-24">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">↩️ {t('returns.title', { defaultValue: '내 반품' })}</h1>
            <Link to="/my-orders" className="text-sm text-pink-500 dark:text-pink-400 hover:underline">
              {t('returns.backToOrders', { defaultValue: '주문 목록' })}
            </Link>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">{error}</p>
          ) : returns.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">📦</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('returns.empty', { defaultValue: '반품 내역이 없습니다' })}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {returns.map((r) => {
                const status = STATUS_LABEL[r.status] || STATUS_LABEL.requested
                const canTrack = r.status === 'shipped' || r.status === 'received'
                  ? Boolean(r.return_shipping_company && r.return_tracking_number)
                  : false
                return (
                  <article key={r.id} className="bg-gray-50 dark:bg-[#121212] rounded-xl p-4 border border-gray-100 dark:border-[#1A1A1A]">
                    <header className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.color}`}>{status.label}</span>
                      <time className="text-[11px] text-gray-400">{new Date(r.requested_at).toLocaleDateString('ko-KR')}</time>
                    </header>

                    <p className="text-sm font-medium mb-1">주문 {r.order_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">사유: {r.reason}</p>
                    {r.detail_reason && <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{r.detail_reason}</p>}

                    {r.refund_amount && r.refunded_at && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                        ✓ {formatNumber(r.refund_amount)}원 환불됨
                      </p>
                    )}

                    {/* 회수 송장 정보 */}
                    {r.return_tracking_number && (
                      <div className="mt-3 bg-white dark:bg-[#0A0A0A] rounded-lg p-3 border border-gray-100 dark:border-[#1A1A1A]">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">회수 송장</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono">
                            {r.return_shipping_company} · {r.return_tracking_number}
                          </span>
                          {canTrack && (
                            <button
                              onClick={() => setTrackingTarget({
                                carrier: r.return_shipping_company!,
                                number: r.return_tracking_number!,
                              })}
                              className="text-xs text-pink-500 dark:text-pink-400 font-bold hover:underline"
                            >
                              📦 추적 →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* approved 상태 — 회수 송장 등록 inline */}
                    {r.status === 'approved' && !r.return_tracking_number && (
                      <ShippingForm returnId={r.id} onSubmitted={(carrier, number) => {
                        applyTracking(r.id, carrier, number)
                      }} />
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {trackingTarget && (
          <TrackingModal
            carrier={trackingTarget.carrier}
            trackingNumber={trackingTarget.number}
            title={t('returns.trackingTitle', { defaultValue: '반품 회수 추적' })}
            onClose={() => setTrackingTarget(null)}
          />
        )}
      </div>
    </>
  )
}

function ShippingForm({ returnId, onSubmitted }: { returnId: number; onSubmitted: (carrier: string, number: string) => void }) {
  const { t } = useTranslation()
  const [carrier, setCarrier] = useState('')
  const [number, setNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const carrierTrim = carrier.trim()
    const numberTrim = number.trim().replace(/\s+/g, '')
    if (!carrierTrim || !numberTrim) {
      toast.error('택배사와 송장번호를 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.put(`/api/returns/${returnId}/shipping`, {
        shipping_company: carrierTrim,
        tracking_number: numberTrim,
      })
      if (res.data?.success) {
        toast.success('회수 송장이 등록되었습니다')
        onSubmitted(carrierTrim, numberTrim)
      } else {
        toast.error(res.data?.error || '등록 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
      <p className="text-xs font-bold text-blue-700 dark:text-blue-200 mb-2">📮 회수 송장 등록 필요</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="text"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="택배사 (예: cj, 한진, kr_post)"
          className="px-2 py-1.5 text-xs bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
        />
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^0-9-]/g, ''))}
          placeholder="송장번호"
          className="px-2 py-1.5 text-xs bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg font-mono"
        />
      </div>
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
      >
        {submitting ? '등록 중...' : t('returns.submitShipping', { defaultValue: '회수 송장 등록' })}
      </button>
    </div>
  )
}
