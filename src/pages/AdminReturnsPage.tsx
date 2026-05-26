/**
 * 🛡️ 2026-05-25: 어드민 반품 검수 페이지 (/admin/returns).
 *
 * 모든 반품 목록 + status 필터 + 검수 / 환불 액션.
 * tracker.delivery 기반 회수 송장 추적 모달 통합.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import TrackingModal from '@/components/shipping/TrackingModal'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import { ChevronDown, ChevronUp, Loader2, RefreshCw, RotateCw } from 'lucide-react'

interface ReturnRecord {
  id: number
  order_id: number | null
  order_number: string | null
  status: string
  reason: string
  detail_reason: string | null
  return_shipping_company: string | null
  return_tracking_number: string | null
  inspection_result: string | null
  refund_amount: number | null
  requested_at: string
  approved_at: string | null
  shipped_at: string | null
  received_at: string | null
  inspected_at: string | null
  refunded_at: string | null
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  seller_name: string | null
  order_total: number | null
  order_status: string | null
}

const STATUS_OPTIONS: Array<{ key: string; label: string; color: string }> = [
  { key: '', label: '전체', color: 'bg-gray-100 text-gray-700' },
  { key: 'requested', label: '요청', color: 'bg-blue-100 text-blue-700' },
  { key: 'approved', label: '승인', color: 'bg-purple-100 text-purple-700' },
  { key: 'shipped', label: '회수 발송', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'received', label: '수령', color: 'bg-pink-100 text-pink-700' },
  { key: 'inspected', label: '검수 완료', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'refunded', label: '환불 완료', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'rejected', label: '반려', color: 'bg-red-100 text-red-700' },
]

export default function AdminReturnsPage() {
  const { t } = useTranslation()
  const [returns, setReturns] = useState<ReturnRecord[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('requested')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [trackingTarget, setTrackingTarget] = useState<{ carrier: string; number: string } | null>(null)

  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    loadReturns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function loadReturns() {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const res = await api.get(`/api/returns/admin${params}`, h)
      if (res.data?.success) {
        setReturns(res.data.data || [])
        setCounts(res.data.counts || {})
      } else {
        toast.error(res.data?.error || '목록 불러오기 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '목록 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: number) {
    if (!confirm('이 반품을 승인하시겠습니까? (사용자가 회수 송장 등록 가능 상태로 전환)')) return
    try {
      await api.put(`/api/returns/${id}/approve`, {}, h)
      toast.success('승인되었습니다')
      loadReturns()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '승인 실패')
    }
  }

  async function handleReject(id: number) {
    const reason = prompt('반려 사유를 입력하세요:')
    if (!reason) return
    try {
      await api.put(`/api/returns/${id}/reject`, { reason }, h)
      toast.success('반려되었습니다')
      loadReturns()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '반려 실패')
    }
  }

  async function handleInspect(id: number, result: 'approved' | 'rejected') {
    const notes = prompt(`검수 ${result === 'approved' ? '승인' : '반려'} — 메모 (선택):`)
    if (notes === null) return
    try {
      await api.put(`/api/returns/${id}/inspect`, { inspection_result: result, inspection_notes: notes }, h)
      toast.success('검수 처리되었습니다')
      loadReturns()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '검수 실패')
    }
  }

  async function handleRefund(id: number) {
    if (!confirm('환불 처리하시겠습니까? (취소 불가)')) return
    try {
      await api.put(`/api/returns/${id}/refund`, {}, h)
      toast.success('환불 처리되었습니다')
      loadReturns()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '환불 실패')
    }
  }

  function getStatusBadge(status: string) {
    const opt = STATUS_OPTIONS.find(o => o.key === status)
    return opt ? opt : { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  return (
    <AdminLayout title="반품 검수">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="반품 검수"
          subtitle={`총 ${formatNumber(Object.values(counts).reduce((a, b) => a + b, 0))}건 · 처리 대기 ${formatNumber((counts.requested || 0) + (counts.received || 0))}건`}
          icon={<RotateCw className="h-5 w-5" />}
          actions={
            <button onClick={loadReturns} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              <RefreshCw className="w-3.5 h-3.5" /> 새로고침
            </button>
          }
        />

        {/* status 필터 탭 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {opt.label}
              {opt.key && counts[opt.key] > 0 && (
                <span className="ml-1 opacity-80">({counts[opt.key]})</span>
              )}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : returns.length === 0 ? (
            <p className="py-20 text-center text-gray-500">해당 상태의 반품이 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-gray-700">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3 font-semibold">주문</th>
                  <th className="px-4 py-3 font-semibold">사용자</th>
                  <th className="px-4 py-3 font-semibold">셀러</th>
                  <th className="px-4 py-3 font-semibold">사유</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">요청일</th>
                  <th className="px-4 py-3 font-semibold text-center">액션</th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => {
                  const badge = getStatusBadge(r.status)
                  const isExpanded = expandedId === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 font-mono">#{r.id}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.color}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.order_number || `#${r.order_id}`}
                          {r.order_total && <div className="text-[10px] text-gray-400">{formatNumber(r.order_total)}원</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.user_name || '-'}
                          {r.user_email && <div className="text-[10px] text-gray-400">{r.user_email}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.seller_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                          <div className="truncate">{r.reason}</div>
                          {r.detail_reason && <div className="text-[10px] text-gray-500 truncate">{r.detail_reason}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatKST(r.requested_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : r.id)}
                              className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="space-y-3">
                              {/* 회수 송장 */}
                              {r.return_tracking_number && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <p className="text-xs font-bold text-gray-700 mb-1">📦 회수 송장</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-mono">{r.return_shipping_company} · {r.return_tracking_number}</span>
                                    <button
                                      onClick={() => setTrackingTarget({ carrier: r.return_shipping_company!, number: r.return_tracking_number! })}
                                      className="text-xs text-pink-500 font-bold"
                                    >
                                      📦 추적 →
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* 검수 / 환불 결과 */}
                              {r.inspection_result && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200 text-xs">
                                  <strong>검수 결과:</strong> {r.inspection_result === 'approved' ? '✅ 승인' : '❌ 반려'}
                                </div>
                              )}
                              {r.refund_amount && (
                                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 text-xs text-emerald-700">
                                  💰 환불 완료: {formatNumber(r.refund_amount)}원
                                </div>
                              )}

                              {/* 액션 버튼들 */}
                              <div className="flex flex-wrap gap-2">
                                {r.status === 'requested' && (
                                  <>
                                    <button onClick={() => handleApprove(r.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-purple-500 rounded hover:bg-purple-600">
                                      ✓ 승인
                                    </button>
                                    <button onClick={() => handleReject(r.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded hover:bg-red-600">
                                      ✕ 반려
                                    </button>
                                  </>
                                )}
                                {r.status === 'received' && (
                                  <>
                                    <button onClick={() => handleInspect(r.id, 'approved')} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">
                                      검수 통과
                                    </button>
                                    <button onClick={() => handleInspect(r.id, 'rejected')} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded hover:bg-red-600">
                                      검수 반려
                                    </button>
                                  </>
                                )}
                                {r.status === 'inspected' && r.inspection_result === 'approved' && (
                                  <button onClick={() => handleRefund(r.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 rounded hover:bg-emerald-600">
                                    💰 환불 처리
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {trackingTarget && (
          <TrackingModal
            carrier={trackingTarget.carrier}
            trackingNumber={trackingTarget.number}
            title="반품 회수 추적"
            onClose={() => setTrackingTarget(null)}
          />
        )}
      </div>
    </AdminLayout>
  )
}

import { Fragment } from 'react'
