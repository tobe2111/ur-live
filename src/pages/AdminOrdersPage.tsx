import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { formatKST } from '@/utils/date'
import {
  Package, Truck, CheckCircle2, XCircle, Loader2, Eye,
  Calendar, User, Search, Filter, Download, ChevronLeft,
  ChevronRight, RefreshCw, Clock, DollarSign
} from 'lucide-react'

interface OrderItem {
  id: number
  product_id: number
  product_name: string
  image_url: string | null
  quantity: number
  price: number
}

interface Order {
  id: number
  order_number: string
  user_id: number
  user_name: string
  user_email: string
  seller_id: number
  seller_name: string
  total_amount: number
  status: string
  payment_status: string
  payment_method: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_address_detail: string
  shipping_zipcode: string
  courier: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: '주문 접수',  color: 'text-amber-700',   bg: 'bg-amber-50' },
  PAID:       { label: '결제 완료',  color: 'text-blue-700',    bg: 'bg-blue-50' },
  DONE:       { label: '결제 완료',  color: 'text-blue-700',    bg: 'bg-blue-50' },
  PREPARING:  { label: '상품 준비',  color: 'text-indigo-700',  bg: 'bg-indigo-50' },
  SHIPPING:   { label: '배송 중',    color: 'text-purple-700',  bg: 'bg-purple-50' },
  DELIVERED:  { label: '배송 완료',  color: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED:  { label: '취소',       color: 'text-red-700',     bg: 'bg-red-50' },
  REFUNDED:   { label: '환불',       color: 'text-gray-600',    bg: 'bg-gray-100' },
  FAILED:     { label: '결제 실패',  color: 'text-red-700',     bg: 'bg-red-50' },
}

const NEXT_STATUS: Record<string, string> = {
  PENDING: 'DONE', DONE: 'PREPARING', PAID: 'PREPARING',
  PREPARING: 'SHIPPING', SHIPPING: 'DELIVERED',
}

const COURIER_OPTIONS = [
  { value: 'CJ대한통운', label: 'CJ대한통운' },
  { value: '로젠택배', label: '로젠택배' },
  { value: '옐로우캡', label: '옐로우캡' },
  { value: '우체국택배', label: '우체국택배' },
  { value: '한진택배', label: '한진택배' },
  { value: '롯데택배', label: '롯데택배' },
  { value: '드림택배', label: '드림택배' },
  { value: 'KGB택배', label: 'KGB택배' },
  { value: '대신택배', label: '대신택배' },
  { value: '일양로지스', label: '일양로지스' },
  { value: '경동택배', label: '경동택배' },
  { value: '천일택배', label: '천일택배' },
  { value: '합동택배', label: '합동택배' },
  { value: 'CVSnet편의점택배', label: 'CVSnet편의점택배' },
  { value: '우편발송', label: '우편발송' },
  { value: 'GTX로지스', label: 'GTX로지스' },
  { value: '건영택배', label: '건영택배' },
  { value: 'EMS', label: 'EMS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'USPS', label: 'USPS' },
]

const PAYMENT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  paid:    { label: '결제 완료', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  pending: { label: '결제 대기', color: 'text-amber-700',   bg: 'bg-amber-50' },
  failed:  { label: '결제 실패', color: 'text-red-700',     bg: 'bg-red-50' },
}

function parseShippingAddress(address: string, zipcode?: string, detail?: string): { postal_code: string; address1: string; address2: string } {
  if (!address) return { postal_code: zipcode || '', address1: '', address2: detail || '' }
  try {
    const parsed = JSON.parse(address)
    return {
      postal_code: parsed.postal_code || parsed.zipcode || zipcode || '',
      address1: parsed.address1 || parsed.address || '',
      address2: parsed.address2 || parsed.detail || detail || '',
    }
  } catch {
    return { postal_code: zipcode || '', address1: address, address2: detail || '' }
  }
}

export default function AdminOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sellerFilter, setSellerFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [sellers, setSellers] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => { loadOrders(); loadSellers() }, [])
  useEffect(() => { filterOrders() }, [orders, statusFilter, sellerFilter, searchQuery, dateFilter])

  async function loadOrders() {
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      if (!token) { navigate('/admin/login'); return }
      const response = await api.get('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.success) setOrders(response.data.data)
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number } };
      setError('주문 목록을 불러올 수 없습니다.')
      if (err_.response?.status === 401) navigate('/admin/login')
    } finally { setLoading(false) }
  }

  async function loadSellers() {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get('/api/admin/sellers', { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.success) {
        setSellers(response.data.data.map((s: { id: number; name?: string; username?: string; business_name?: string }) => ({ id: s.id, name: s.name || s.username || s.business_name || `Seller ${s.id}` })))
      }
    } catch { /* silent */ }
  }

  function filterOrders() {
    let result = [...orders]
    if (statusFilter !== 'ALL') result = result.filter(o => o.status === statusFilter)
    if (sellerFilter !== 'ALL') result = result.filter(o => o.seller_id === parseInt(sellerFilter))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        o.shipping_name.toLowerCase().includes(q) ||
        o.shipping_phone.includes(q) ||
        o.user_email?.toLowerCase().includes(q)
      )
    }
    if (dateFilter.start) result = result.filter(o => new Date(o.created_at) >= new Date(dateFilter.start))
    if (dateFilter.end) {
      const end = new Date(dateFilter.end); end.setHours(23, 59, 59, 999)
      result = result.filter(o => new Date(o.created_at) <= end)
    }
    setFilteredOrders(result); setCurrentPage(1)
  }

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage)

  async function viewOrderDetail(orderNumber: string) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get(`/api/admin/orders/${orderNumber}`, { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.success) { setSelectedOrder(response.data.data); setShowDetail(true) }
    } catch { toast.error('주문 상세 정보를 불러올 수 없습니다.') }
  }

  // 주문 상태 변경
  async function updateOrderStatus(orderNumber: string, newStatus: string, cancelReason?: string) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.patch(`/api/admin/orders/${orderNumber}/status`, { status: newStatus, cancel_reason: cancelReason }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(`주문 상태가 ${STATUS_STYLES[newStatus]?.label || newStatus}(으)로 변경되었습니다.`)
      loadOrders()
      if (selectedOrder?.order_number === orderNumber) {
        setSelectedOrder({ ...selectedOrder, status: newStatus })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '상태 변경에 실패했습니다.')
    }
  }

  // 운송장 등록
  async function updateTracking(orderNumber: string, trackingNumber: string, shippingCompany: string) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.put(`/api/admin/orders/${orderNumber}/tracking`, { tracking_number: trackingNumber, shipping_company: shippingCompany }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('운송장이 등록되었습니다.')
      loadOrders()
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, tracking_number: trackingNumber, courier: shippingCompany, status: 'SHIPPING' })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '운송장 등록에 실패했습니다.')
    }
  }

  async function exportOrders() {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get('/api/admin/orders/export', {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: statusFilter !== 'ALL' ? statusFilter : undefined, seller_id: sellerFilter !== 'ALL' ? sellerFilter : undefined, start_date: dateFilter.start || undefined, end_date: dateFilter.end || undefined },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link); link.click(); link.remove()
    } catch { toast.error('주문 내역 다운로드에 실패했습니다.') }
  }

  const orderStats = {
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    shipped: filteredOrders.filter(o => o.status === 'shipped').length,
    delivered: filteredOrders.filter(o => o.status === 'delivered').length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    totalAmount: filteredOrders.reduce((s, o) => s + o.total_amount, 0),
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">주문 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout
      title="주문 관리"
      headerRight={
        <>
          <button onClick={loadOrders} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
          <button onClick={exportOrders} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            <Download className="w-3.5 h-3.5" /> 엑셀
          </button>
        </>
      }
    >
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={() => window.location.reload()} className="mt-3 block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">다시 시도</button>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '전체', value: orderStats.total, color: 'text-gray-900' },
          { label: '주문 접수', value: orderStats.pending, color: 'text-amber-600' },
          { label: '배송 중', value: orderStats.shipped, color: 'text-purple-600' },
          { label: '배송 완료', value: orderStats.delivered, color: 'text-emerald-600' },
          { label: '취소', value: orderStats.cancelled, color: 'text-red-600' },
          { label: '총 매출', value: `₩${orderStats.totalAmount.toLocaleString()}`, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><Filter className="w-3.5 h-3.5 inline mr-1" />주문 상태</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL">전체</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><User className="w-3.5 h-3.5 inline mr-1" />판매자</label>
            <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL">전체 판매자</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><Calendar className="w-3.5 h-3.5 inline mr-1" />시작일</label>
            <input type="date" value={dateFilter.start} onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><Calendar className="w-3.5 h-3.5 inline mr-1" />종료일</label>
            <input type="date" value={dateFilter.end} onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5"><Search className="w-3.5 h-3.5 inline mr-1" />검색</label>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="주문번호, 고객명, 전화번호, 이메일" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(statusFilter !== 'ALL' || sellerFilter !== 'ALL' || searchQuery || dateFilter.start || dateFilter.end) && (
          <button onClick={() => { setStatusFilter('ALL'); setSellerFilter('ALL'); setSearchQuery(''); setDateFilter({ start: '', end: '' }) }} className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <XCircle className="w-3.5 h-3.5" /> 필터 초기화
          </button>
        )}
      </div>

      {/* 주문 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                {['주문번호', '주문일시', '판매자', '고객명', '주문 상태', '결제 상태', '금액', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">주문 내역이 없습니다.</td></tr>
              ) : currentOrders.map(order => {
                const ss = STATUS_STYLES[order.status] || { label: order.status, color: 'text-gray-600', bg: 'bg-gray-100' }
                const ps = PAYMENT_STYLES[order.payment_status] || { label: order.payment_status, color: 'text-gray-600', bg: 'bg-gray-100' }
                return (
                  <tr key={order.order_number} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">{order.order_number}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatKST(order.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{order.seller_name}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900">{order.shipping_name}</p>
                      <p className="text-xs text-gray-400">{order.shipping_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ss.bg} ${ss.color}`}>{ss.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ps.bg} ${ps.color}`}>{ps.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">₩{order.total_amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewOrderDetail(order.order_number)} className="p-1.5 rounded-lg hover:bg-gray-100">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              전체 <span className="font-medium">{filteredOrders.length}</span>개 중 <span className="font-medium">{startIndex + 1}</span>-<span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredOrders.length)}</span>개
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i
                if (p < 1) p = 1
                if (p > totalPages) return null
                return (
                  <button key={i} onClick={() => setCurrentPage(p)} className={`w-8 h-8 text-xs rounded-lg font-medium ${currentPage === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
                )
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 주문 상세 모달 */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">주문 상세</h3>
              <button onClick={() => setShowDetail(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XCircle className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">주문 정보</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['주문번호', selectedOrder.order_number],
                    ['주문일시', formatKST(selectedOrder.created_at)],
                    ['판매자', selectedOrder.seller_name],
                    ['결제 방법', selectedOrder.payment_method || '-'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-gray-400">{k}</p>
                      <p className="font-medium text-gray-900 mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">배송 정보</h4>
                {(() => {
                  const addr = parseShippingAddress(selectedOrder.shipping_address, selectedOrder.shipping_zipcode, selectedOrder.shipping_address_detail)
                  return (
                    <div className="space-y-2 text-sm">
                      <div><p className="text-xs text-gray-400">받는 사람</p><p className="font-medium text-gray-900">{selectedOrder.shipping_name}</p></div>
                      <div><p className="text-xs text-gray-400">연락처</p><p className="font-medium text-gray-900">{selectedOrder.shipping_phone}</p></div>
                      {addr.postal_code && <div><p className="text-xs text-gray-400">우편번호</p><p className="font-medium text-gray-900">{addr.postal_code}</p></div>}
                      <div><p className="text-xs text-gray-400">주소</p><p className="font-medium text-gray-900">{addr.address1}{addr.address2 ? ` ${addr.address2}` : ''}</p></div>
                      {selectedOrder.tracking_number && <div><p className="text-xs text-gray-400">운송장</p><p className="font-medium text-gray-900">{selectedOrder.courier} {selectedOrder.tracking_number}</p></div>}
                    </div>
                  )
                })()}
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">주문 상품</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {item.image_url && <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded-lg" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                          <p className="text-xs text-gray-400">수량 {item.quantity}개</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">₩{(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">총 결제 금액</span>
                <span className="text-lg font-bold text-blue-600">₩{selectedOrder.total_amount.toLocaleString()}</span>
              </div>

              {/* 주문 상태 변경 */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">주문 처리</h4>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS[selectedOrder.status] && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.order_number, NEXT_STATUS[selectedOrder.status])}
                      className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      {STATUS_STYLES[NEXT_STATUS[selectedOrder.status]]?.label || NEXT_STATUS[selectedOrder.status]}(으)로 변경
                    </button>
                  )}
                  {!['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => {
                        const reason = prompt('취소 사유를 입력해주세요:')
                        if (reason) updateOrderStatus(selectedOrder.order_number, 'CANCELLED', reason)
                      }}
                      className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                    >
                      주문 취소
                    </button>
                  )}
                </div>
              </div>

              {/* 운송장 등록 */}
              {['DONE', 'PAID', 'PREPARING'].includes(selectedOrder.status) && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">운송장 등록</h4>
                  <form onSubmit={e => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement
                    const company = (form.elements.namedItem('courier') as unknown as HTMLSelectElement).value
                    const number = (form.elements.namedItem('tracking') as HTMLInputElement).value
                    if (company && number) updateTracking(selectedOrder.order_number, number, company)
                  }} className="flex gap-2">
                    <select name="courier" defaultValue={selectedOrder.courier || ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-shrink-0">
                      <option value="">택배사 선택</option>
                      {COURIER_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input name="tracking" type="text" defaultValue={selectedOrder.tracking_number || ''} placeholder="운송장 번호" className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1" />
                    <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex-shrink-0">
                      <Truck className="w-3.5 h-3.5 inline mr-1" />등록
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
