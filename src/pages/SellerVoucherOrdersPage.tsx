/**
 * 🛡️ 2026-05-19: 셀러 본인 — 받은/발송한 교환권 (KT Alpha) 이력.
 *
 *   /seller/voucher-orders 신규 페이지.
 *   여기서 캡처해서 KT Alpha 상용 Key 신청 첨부.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Gift, Phone, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'

interface VoucherOrder {
  id: number
  goods_code: string
  goods_name: string
  goods_image_url: string | null
  unit_price: number
  quantity: number
  total_amount: number
  recipient_phone: string
  status: string
  external_order_id: string | null
  failure_reason: string | null
  sent_at: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '대기', color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-3 h-3" /> },
  processing: { label: '발송 중', color: 'bg-blue-100 text-blue-700', icon: <Clock className="w-3 h-3" /> },
  sent: { label: '발송 완료', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: '실패', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: '취소', color: 'bg-gray-100 text-gray-500', icon: <XCircle className="w-3 h-3" /> },
  used: { label: '사용됨', color: 'bg-purple-100 text-purple-700', icon: <CheckCircle className="w-3 h-3" /> },
}

export default function SellerVoucherOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<VoucherOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) { navigate('/seller/login'); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get('/api/seller/voucher-orders', { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) setOrders(r.data.data || [])
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  const totalSent = orders.filter(o => o.status === 'sent').length
  const totalAmount = orders.filter(o => o.status === 'sent').reduce((s, o) => s + o.total_amount, 0)

  return (
    <SellerLayout title="발송 교환권">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="🎁 발송한 교환권 이력"
          subtitle="적립금으로 받은 기프티쇼 교환권 — 발송된 휴대폰으로 MMS 도착"
          icon={<Gift className="h-5 w-5" />}
        />

        {/* KPI */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">발송 성공</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalSent}건</p>
            <p className="text-[10px] text-gray-400">전체 {orders.length}건</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">누적 차감액</p>
            <p className="text-2xl font-extrabold text-pink-600 mt-1">₩{totalAmount.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">발송 성공 건 기준</p>
          </div>
        </div>

        {loading ? <DashboardLoading /> : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Gift className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">아직 발송한 교환권이 없습니다</p>
            <button onClick={() => navigate('/seller/settlements')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg hover:bg-pink-600">
              🎁 정산 페이지에서 교환권 받기 →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                    {['상품', '수량', '받는 번호', '차감액', '상태', '발송 일시', '주문 번호'].map(h => (
                      <th key={h} className="px-3 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((o) => {
                    const st = STATUS_LABELS[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-700', icon: null }
                    return (
                      <tr key={o.id} className="hover:bg-gray-50 text-xs">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {o.goods_image_url && (
                              <img src={o.goods_image_url} alt={o.goods_name} className="w-10 h-10 rounded object-cover" loading="lazy" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 line-clamp-1">{o.goods_name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{o.goods_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-700">{o.quantity}</td>
                        <td className="px-3 py-3 text-gray-700 font-mono">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {o.recipient_phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-pink-600">
                          ₩{o.total_amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${st.color}`}>
                            {st.icon} {st.label}
                          </span>
                          {o.status === 'failed' && o.failure_reason && (
                            <p className="text-[10px] text-red-600 mt-1 max-w-[200px] truncate" title={o.failure_reason}>
                              {o.failure_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-[11px]">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {o.sent_at ? new Date(o.sent_at).toLocaleString('ko-KR') : new Date(o.created_at).toLocaleString('ko-KR')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-[10px] font-mono">
                          {o.external_order_id || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900">
          ℹ️ 발송된 교환권은 MMS 로 받는 휴대폰에 도착합니다. 발송 후 환불 / 취소는 불가능합니다.
          매장에서 사용 시 코드 또는 바코드를 제시해주세요.
        </div>
      </div>
    </SellerLayout>
  )
}
