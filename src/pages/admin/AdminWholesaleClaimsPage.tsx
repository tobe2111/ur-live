import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { AlertTriangle, Loader2, X, RotateCcw, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

// 🏭 BIZ-1 (2026-06-08) 어드민 도매 클레임(RMA) 검수 — 판매사 발의 하자/오배송 신고 처리.
//   approve(승인) 시 실제 환불은 기존 강제환불 엔드포인트(/api/admin/distributor/orders/:id/refund)로 집행.
//   reject/resolve 는 정산 HOLD 해제(성숙 재개). 라이트 고정 테마.

interface ClaimRow {
  id: number
  wholesale_order_id: number
  wholesale_order_item_id: number | null
  distributor_seller_id: number
  supplier_id: number | null
  reason_code: string
  reason_text: string | null
  evidence_url: string | null
  status: string
  admin_memo: string | null
  created_at: string
  resolved_at: string | null
  distributor_name: string | null
  distributor_username: string | null
  supplier_name: string | null
  order_subtotal: number | null
  order_refunded: number | null
  order_status: string | null
}

const STATUS: Record<string, { t: string; c: string }> = {
  open: { t: '접수', c: 'bg-amber-50 text-amber-700' },
  reviewing: { t: '검토중', c: 'bg-blue-50 text-blue-700' },
  approved: { t: '승인(환불)', c: 'bg-emerald-50 text-emerald-700' },
  rejected: { t: '반려', c: 'bg-rose-50 text-rose-700' },
  resolved: { t: '해결', c: 'bg-gray-100 text-gray-600' },
}
const REASON: Record<string, string> = {
  defective: '불량/하자', wrong_item: '오배송', damaged: '파손', shortage: '수량부족', other: '기타',
}
const FILTERS = ['', 'open', 'reviewing', 'approved', 'rejected', 'resolved']

export default function AdminWholesaleClaimsPage() {
  const navigate = useNavigate()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const [status, setStatus] = useState('')
  const [detail, setDetail] = useState<ClaimRow | null>(null)
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: claims = [], isLoading: loading, refetch } = useApiQuery<ClaimRow[]>(
    ['admin', 'wholesale-claims', status], '/api/wholesale/admin/claims',
    { params: status ? { status } : {}, headers: h.headers, select: (r: any) => (r?.success ? r.claims || [] : []) },
  )

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  function open(claim: ClaimRow) { setDetail(claim); setMemo(claim.admin_memo || '') }

  async function act(action: 'reviewing' | 'approve' | 'reject' | 'resolve') {
    if (!detail) return
    const labels: Record<string, string> = { reviewing: '검토중으로 변경', approve: '승인(환불 진행)', reject: '반려', resolve: '무환불 해결' }
    if (action !== 'reviewing') {
      if (!(await confirmDialog({ message: `클레임 #${detail.id} 을(를) "${labels[action]}" 처리할까요?`, danger: action === 'reject' }))) return
    }
    setBusy(true)
    try {
      const r = await api.patch(`/api/wholesale/admin/claims/${detail.id}`, { action, admin_memo: memo.trim() }, h)
      if (!r.data?.success) { toast.error(r.data?.error || '처리 실패'); return }
      toast.success(`${labels[action]} 완료`)
      // approve 시 실제 환불은 별도 집행 — 어드민에게 환불 실행 여부 확인.
      if (r.data?.requires_refund && detail.order_status && ['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(detail.order_status)) {
        if (await confirmDialog({ message: `이어서 주문 #${detail.wholesale_order_id} 을(를) 강제 전액환불 할까요? 되돌릴 수 없습니다.`, danger: true })) {
          const rr = await api.post(`/api/admin/distributor/orders/${detail.wholesale_order_id}/refund`, { reason: `클레임 #${detail.id} 승인 환불` }, h)
          if (rr.data?.success) toast.success('환불 처리됨')
          else toast.error(rr.data?.error || '환불 실패 — 도매 주문 페이지에서 재시도하세요')
        }
      }
      setDetail(null)
      refetch()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류')
    } finally { setBusy(false) }
  }

  const terminal = (s: string) => ['approved', 'rejected', 'resolved'].includes(s)

  return (
    <AdminLayout title="도매 클레임">
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader icon={<AlertTriangle className="w-5 h-5" />} title="도매 클레임(RMA) 검수" subtitle="판매사 발의 하자/오배송/수량부족 신고 처리 + 정산 보류 관리" />

        <div className="flex flex-wrap items-center gap-2 my-4">
          {FILTERS.map(f => (
            <button key={f || 'all'} onClick={() => setStatus(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
              {f ? (STATUS[f]?.t || f) : '전체'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : claims.length === 0 ? (
          <p className="text-center text-gray-400 py-20">클레임이 없습니다.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2.5 px-4 font-medium">클레임</th>
                  <th className="py-2.5 px-4 font-medium">주문</th>
                  <th className="py-2.5 px-4 font-medium">판매사</th>
                  <th className="py-2.5 px-4 font-medium">공급자</th>
                  <th className="py-2.5 px-4 font-medium">사유</th>
                  <th className="py-2.5 px-4 font-medium">상태</th>
                  <th className="py-2.5 px-4 font-medium">일자</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(cl => (
                  <tr key={cl.id} onClick={() => open(cl)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="py-2.5 px-4 text-gray-700">#{cl.id}</td>
                    <td className="py-2.5 px-4 text-gray-700">#{cl.wholesale_order_id}</td>
                    <td className="py-2.5 px-4 text-gray-900">{cl.distributor_name || cl.distributor_username || `#${cl.distributor_seller_id}`}</td>
                    <td className="py-2.5 px-4 text-gray-600">{cl.supplier_name || (cl.supplier_id ? `#${cl.supplier_id}` : '혼합/미지정')}</td>
                    <td className="py-2.5 px-4 text-gray-600">{REASON[cl.reason_code] || cl.reason_code}</td>
                    <td className="py-2.5 px-4"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[cl.status]?.c || 'bg-gray-100 text-gray-600'}`}>{STATUS[cl.status]?.t || cl.status}</span></td>
                    <td className="py-2.5 px-4 text-gray-500">{new Date(cl.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 상세 + 처리 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">클레임 #{detail.id}</h3>
              <button onClick={() => setDetail(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="text-sm text-gray-600 space-y-1.5 mb-4">
              <div>주문 <b className="text-gray-900">#{detail.wholesale_order_id}</b> · 주문상태 {detail.order_status || '-'} · 결제 {formatWon(Number(detail.order_subtotal) || 0)} · 환불 {formatWon(Number(detail.order_refunded) || 0)}</div>
              <div>판매사 <b className="text-gray-900">{detail.distributor_name || detail.distributor_username || `#${detail.distributor_seller_id}`}</b></div>
              <div>공급자 {detail.supplier_name || (detail.supplier_id ? `#${detail.supplier_id}` : '혼합/미지정')}</div>
              <div>사유 <b className="text-gray-900">{REASON[detail.reason_code] || detail.reason_code}</b>{detail.wholesale_order_item_id ? ` · 항목 #${detail.wholesale_order_item_id}` : ' · 주문 전체'}</div>
            </div>

            {detail.reason_text && (
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-3 whitespace-pre-wrap">{detail.reason_text}</div>
            )}
            {detail.evidence_url && (
              <a href={detail.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 mb-4">
                <ExternalLink className="w-4 h-4" /> 증빙 보기
              </a>
            )}

            <label className="block text-xs font-medium text-gray-600 mb-1.5 mt-2">관리자 메모</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} maxLength={1000} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-4 resize-none"
              placeholder="처리 사유/조치 내용" />

            {terminal(detail.status) ? (
              <p className="text-sm text-gray-500">이미 <b>{STATUS[detail.status]?.t}</b> 처리된 클레임입니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.status === 'open' && (
                  <button onClick={() => act('reviewing')} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">검토중</button>
                )}
                <button onClick={() => act('approve')} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} 승인 + 환불
                </button>
                <button onClick={() => act('resolve')} disabled={busy} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">무환불 해결</button>
                <button onClick={() => act('reject')} disabled={busy} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">반려</button>
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-3">승인 시 정산 보류 유지 + 강제환불 집행. 반려/해결 시 정산 보류 해제(정상 지급 재개).</p>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
