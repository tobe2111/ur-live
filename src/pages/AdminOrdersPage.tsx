import { useEffect, useState } from 'react'
import i18next from 'i18next'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import { isVoucherCategory, VOUCHER_CATEGORY_LABEL } from '@/shared/constants/voucher-categories'
import {
  Package, Truck, CheckCircle2, XCircle, Loader2, Eye,
  Calendar, User, Search, Filter, Download, ChevronLeft,
  ChevronRight, RefreshCw, Clock, DollarSign, Ticket, Store, ExternalLink
} from 'lucide-react'

// 🗂️ 2026-06-17: 주문 종류 구별 — 첫 상품 category 로 교환권/상품 분류.
//   ⚠️ 도매몰(B2B) 주문은 별도 wholesale_orders 테이블 → /admin/wholesale-orders (이 페이지엔 안 나옴).
function orderKind(category?: string | null): { label: string; sub: string; color: string; bg: string; icon: 'voucher' | 'product' } {
  if (isVoucherCategory(category)) {
    const m = category ? VOUCHER_CATEGORY_LABEL[category] : undefined
    return { label: '교환권', sub: m?.short || '', color: 'text-amber-700', bg: 'bg-amber-50', icon: 'voucher' }
  }
  return { label: '상품', sub: '', color: 'text-sky-700', bg: 'bg-sky-50', icon: 'product' }
}

// Module-scope t — uses i18next instance directly (for module-level constants below)
const t: (key: string, opts?: { defaultValue?: string; [k: string]: unknown }) => string = (key, opts) => i18next.t(key, opts as never) as unknown as string

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
  item_count?: number | null
  total_quantity?: number | null
  first_item_name?: string | null
  first_item_category?: string | null
  items?: OrderItem[]
}

// 🛡️ 2026-06-14: 개인정보 마스킹 — 운영자 목록에서 연락처 일부 가림 (상세 모달은 전체 표시).
function maskPhone(phone?: string | null): string {
  if (!phone) return '-'
  const d = phone.replace(/[^0-9]/g, '')
  if (d.length < 7) return phone
  // 010-1234-5678 → 010-****-5678
  if (d.length >= 10) return `${d.slice(0, 3)}-****-${d.slice(-4)}`
  return `${d.slice(0, 3)}-****`
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: '카드', 간편결제: '간편결제', easypay: '간편결제', 'EASY_PAY': '간편결제',
  CARD: '카드', transfer: '계좌이체', TRANSFER: '계좌이체', 가상계좌: '가상계좌',
  VIRTUAL_ACCOUNT: '가상계좌', virtual_account: '가상계좌', point: '딜 포인트', POINT: '딜 포인트',
  phone: '휴대폰', MOBILE_PHONE: '휴대폰', toss: '토스페이먼츠', kakaopay: '카카오페이', naverpay: '네이버페이',
}
function paymentMethodLabel(m?: string | null): string {
  if (!m) return '-'
  return PAYMENT_METHOD_LABELS[m] || PAYMENT_METHOD_LABELS[m.toLowerCase()] || m
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: t('admin.orders.k001', { defaultValue: '주문 접수' }),  color: 'text-amber-700',   bg: 'bg-amber-50' },
  PAID:       { label: t('admin.orders.k002', { defaultValue: '결제 완료' }),  color: 'text-blue-700',    bg: 'bg-blue-50' },
  DONE:       { label: t('admin.orders.k002', { defaultValue: '결제 완료' }),  color: 'text-blue-700',    bg: 'bg-blue-50' },
  PREPARING:  { label: t('admin.orders.k003', { defaultValue: '상품 준비' }),  color: 'text-indigo-700',  bg: 'bg-indigo-50' },
  SHIPPING:   { label: t('admin.orders.k004', { defaultValue: '배송 중' }),    color: 'text-purple-700',  bg: 'bg-purple-50' },
  DELIVERED:  { label: t('admin.orders.k005', { defaultValue: '배송 완료' }),  color: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED:  { label: t('admin.orders.k006', { defaultValue: '취소' }),       color: 'text-red-700',     bg: 'bg-red-50' },
  REFUNDED:   { label: t('admin.orders.k007', { defaultValue: '환불' }),       color: 'text-gray-600',    bg: 'bg-gray-100' },
  FAILED:     { label: t('admin.orders.k008', { defaultValue: '결제 실패' }),  color: 'text-red-700',     bg: 'bg-red-50' },
}

const NEXT_STATUS: Record<string, string> = {
  PENDING: 'DONE', DONE: 'PREPARING', PAID: 'PREPARING',
  PREPARING: 'SHIPPING', SHIPPING: 'DELIVERED',
}

const COURIER_OPTIONS = [
  { value: t('admin.orders.k009', { defaultValue: 'CJ대한통운' }), label: t('admin.orders.k009', { defaultValue: 'CJ대한통운' }) },
  { value: t('admin.orders.k010', { defaultValue: '로젠택배' }), label: t('admin.orders.k010', { defaultValue: '로젠택배' }) },
  { value: t('admin.orders.k011', { defaultValue: '옐로우캡' }), label: t('admin.orders.k011', { defaultValue: '옐로우캡' }) },
  { value: t('admin.orders.k012', { defaultValue: '우체국택배' }), label: t('admin.orders.k012', { defaultValue: '우체국택배' }) },
  { value: t('admin.orders.k013', { defaultValue: '한진택배' }), label: t('admin.orders.k013', { defaultValue: '한진택배' }) },
  { value: t('admin.orders.k014', { defaultValue: '롯데택배' }), label: t('admin.orders.k014', { defaultValue: '롯데택배' }) },
  { value: t('admin.orders.k015', { defaultValue: '드림택배' }), label: t('admin.orders.k015', { defaultValue: '드림택배' }) },
  { value: t('admin.orders.k016', { defaultValue: 'KGB택배' }), label: t('admin.orders.k016', { defaultValue: 'KGB택배' }) },
  { value: t('admin.orders.k017', { defaultValue: '대신택배' }), label: t('admin.orders.k017', { defaultValue: '대신택배' }) },
  { value: t('admin.orders.k018', { defaultValue: '일양로지스' }), label: t('admin.orders.k018', { defaultValue: '일양로지스' }) },
  { value: t('admin.orders.k019', { defaultValue: '경동택배' }), label: t('admin.orders.k019', { defaultValue: '경동택배' }) },
  { value: t('admin.orders.k020', { defaultValue: '천일택배' }), label: t('admin.orders.k020', { defaultValue: '천일택배' }) },
  { value: t('admin.orders.k021', { defaultValue: '합동택배' }), label: t('admin.orders.k021', { defaultValue: '합동택배' }) },
  { value: t('admin.orders.k022', { defaultValue: 'CVSnet편의점택배' }), label: t('admin.orders.k022', { defaultValue: 'CVSnet편의점택배' }) },
  { value: t('admin.orders.k023', { defaultValue: '우편발송' }), label: t('admin.orders.k023', { defaultValue: '우편발송' }) },
  { value: t('admin.orders.k024', { defaultValue: 'GTX로지스' }), label: t('admin.orders.k024', { defaultValue: 'GTX로지스' }) },
  { value: t('admin.orders.k025', { defaultValue: '건영택배' }), label: t('admin.orders.k025', { defaultValue: '건영택배' }) },
  { value: 'EMS', label: 'EMS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'USPS', label: 'USPS' },
]

const PAYMENT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  paid:    { label: t('admin.orders.k002', { defaultValue: '결제 완료' }), color: 'text-emerald-700', bg: 'bg-emerald-50' },
  pending: { label: t('admin.orders.k026', { defaultValue: '결제 대기' }), color: 'text-amber-700',   bg: 'bg-amber-50' },
  failed:  { label: t('admin.orders.k008', { defaultValue: '결제 실패' }), color: 'text-red-700',     bg: 'bg-red-50' },
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  // 🛡️ 2026-06-14: 대시보드 "미발송 주문" 등에서 ?status=PAID 진입 시 필터 초기값 반영.
  const initialStatus = (() => { try { const s = new URLSearchParams(window.location.search).get('status'); return s && STATUS_STYLES[s] ? s : 'ALL' } catch { return 'ALL' } })()
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [sellerFilter, setSellerFilter] = useState('ALL')
  // 🏁 2026-06-12 (전수조사): 전역검색 ?q= 소비.
  const initialQ = (() => { try { return new URLSearchParams(window.location.search).get('q') || '' } catch { return '' } })()
  const [searchQuery, setSearchQuery] = useState(initialQ)
  const [debouncedSearch, setDebouncedSearch] = useState(initialQ)
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (!localStorage.getItem('admin_token') && !localStorage.getItem('access_token')) navigate('/admin/login')
  }, [navigate])

  // 🛡️ 2026-05-27 (loading P1 — audit A): 검색 debounce 300ms (서버 fetch trigger).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // 🛡️ filter 변경 시 page 1 reset.
  useEffect(() => { setCurrentPage(1) }, [statusFilter, sellerFilter, debouncedSearch, dateFilter.start, dateFilter.end])

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (서버 페이지네이션 + 필터 key 반응형).
  const ordersQ = useApiQuery<{ rows: Order[]; total: number }>(
    ['admin', 'orders', currentPage, statusFilter, sellerFilter, debouncedSearch, dateFilter.start, dateFilter.end],
    '/api/admin/orders',
    {
      params: {
        page: currentPage, limit: itemsPerPage,
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(sellerFilter !== 'ALL' ? { seller_id: sellerFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(dateFilter.start ? { start_date: dateFilter.start } : {}),
        ...(dateFilter.end ? { end_date: dateFilter.end } : {}),
      },
      select: (r: any) => ({ rows: r?.success ? (r.data || []) : [], total: Number(r?.pagination?.total ?? (r?.data?.length || 0)) }),
    },
  )
  const orders = ordersQ.data?.rows ?? []
  const totalCount = ordersQ.data?.total ?? 0
  const loading = ordersQ.isLoading
  const error = ordersQ.isError ? t('admin.orders.k027', { defaultValue: '주문 목록을 불러올 수 없습니다.' }) : ''
  const loadOrders = () => ordersQ.refetch()

  const sellersQ = useApiQuery<Array<{ id: number; name: string }>>(['admin', 'orders-sellers'], '/api/admin/sellers', {
    select: (r: any) => (r?.success ? (r.data || []).map((s: { id: number; name?: string; username?: string; business_name?: string }) => ({ id: s.id, name: s.name || s.username || s.business_name || `Seller ${s.id}` })) : []),
  })
  const sellers = sellersQ.data ?? []

  // 서버 페이지네이션 — orders 가 이미 한 page. 클라 측 slice 불필요.
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const currentOrders = orders

  // 🗂️ 2026-06-17: 체크박스 다중 선택 → 일괄 주문 상태 변경 (PATCH /orders/bulk-status).
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  useEffect(() => {
    setSelectedNumbers((prev) => {
      if (prev.size === 0) return prev
      const valid = new Set(orders.map((o) => o.order_number))
      let changed = false; const next = new Set<string>()
      prev.forEach((n) => { if (valid.has(n)) next.add(n); else changed = true })
      return changed ? next : prev
    })
  }, [orders])
  const allSelected = currentOrders.length > 0 && selectedNumbers.size === currentOrders.length
  const someSelected = selectedNumbers.size > 0 && selectedNumbers.size < currentOrders.length
  function toggleSelect(n: string) {
    setSelectedNumbers((prev) => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s })
  }
  function toggleSelectAll() {
    setSelectedNumbers(allSelected ? new Set() : new Set(currentOrders.map((o) => o.order_number)))
  }
  async function bulkUpdateStatus(status: string) {
    if (selectedNumbers.size === 0) return
    const order_numbers = Array.from(selectedNumbers)
    if (!confirm(`선택한 ${order_numbers.length}건을 '${STATUS_STYLES[status]?.label || status}'(으)로 일괄 변경할까요?`)) return
    setBulkBusy(true)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const res = await api.patch('/api/admin/orders/bulk-status', { order_numbers, status }, { headers: { Authorization: `Bearer ${token}` } })
      const d = res.data?.data
      toast.success(`${d?.updated ?? 0}건 '${STATUS_STYLES[status]?.label || status}'(으)로 변경됨${(d?.skipped ?? 0) > 0 ? ` · ${d.skipped}건 건너뜀` : ''}`)
      setSelectedNumbers(new Set())
      loadOrders()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } }
      toast.error(err_.response?.data?.error || t('admin.orders.k030', { defaultValue: '일괄 변경에 실패했습니다.' }))
    } finally { setBulkBusy(false) }
  }

  async function viewOrderDetail(orderNumber: string) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get(`/api/admin/orders/${orderNumber}`, { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.success) { setSelectedOrder(response.data.data); setShowDetail(true) }
    } catch { toast.error(t('admin.orders.k029', { defaultValue: '주문 상세 정보를 불러올 수 없습니다.' })) }
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
      toast.error(err_.response?.data?.error || t('admin.orders.k030', { defaultValue: '상태 변경에 실패했습니다.' }))
    }
  }

  // 운송장 등록
  async function updateTracking(orderNumber: string, trackingNumber: string, shippingCompany: string) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.put(`/api/admin/orders/${orderNumber}/tracking`, { tracking_number: trackingNumber, shipping_company: shippingCompany }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(t('admin.orders.k031', { defaultValue: '운송장이 등록되었습니다.' }))
      loadOrders()
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, tracking_number: trackingNumber, courier: shippingCompany, status: 'SHIPPING' })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || t('admin.orders.k032', { defaultValue: '운송장 등록에 실패했습니다.' }))
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
    } catch { toast.error(t('admin.orders.k033', { defaultValue: '주문 내역 다운로드에 실패했습니다.' })) }
  }

  const orderStats = {
    total: totalCount,
    pending: orders.filter(o => o.status?.toUpperCase() === 'PENDING').length,
    shipped: orders.filter(o => o.status?.toUpperCase() === 'SHIPPING').length,
    delivered: orders.filter(o => o.status?.toUpperCase() === 'DELIVERED').length,
    cancelled: orders.filter(o => o.status?.toUpperCase() === 'CANCELLED').length,
    totalAmount: orders.reduce((s, o) => s + o.total_amount, 0),
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('admin.orders.k034', { defaultValue: '주문 목록을 불러오는 중...' })}</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout
      title={t('admin.orders.k035', { defaultValue: "주문 관리" })}
      headerRight={
        <>
          <button onClick={loadOrders} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
          <button onClick={exportOrders} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            <Download className="w-3.5 h-3.5" /> 엑셀
          </button>
          {/* 🛡️ 2026-05-25 (migration 0279): CSV 일괄 송장 */}
          <a href="/admin/shipping/bulk-tracking" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-pink-500 rounded-lg hover:bg-pink-600">
            📦 CSV 일괄 송장
          </a>
        </>
      }
    >
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={() => window.location.reload()} className="mt-3 block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{t('admin.orders.k036', { defaultValue: '다시 시도' })}</button>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('admin.orders.k037', { defaultValue: '전체' }), value: orderStats.total, color: 'text-gray-900' },
          { label: t('admin.orders.k001', { defaultValue: '주문 접수' }), value: orderStats.pending, color: 'text-amber-600' },
          { label: t('admin.orders.k004', { defaultValue: '배송 중' }), value: orderStats.shipped, color: 'text-purple-600' },
          { label: t('admin.orders.k005', { defaultValue: '배송 완료' }), value: orderStats.delivered, color: 'text-emerald-600' },
          { label: t('admin.orders.k006', { defaultValue: '취소' }), value: orderStats.cancelled, color: 'text-red-600' },
          { label: t('admin.orders.k038', { defaultValue: '총 매출' }), value: `₩${formatNumber(orderStats.totalAmount)}`, color: 'text-blue-600' },
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
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><Filter className="w-3.5 h-3.5 inline mr-1" />{t('admin.orders.k039', { defaultValue: '주문 상태' })}</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL">{t('admin.orders.k037', { defaultValue: '전체' })}</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><User className="w-3.5 h-3.5 inline mr-1" />{t('admin.orders.k040', { defaultValue: '판매자' })}</label>
            <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL">{t('admin.orders.k041', { defaultValue: '전체 판매자' })}</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><Calendar className="w-3.5 h-3.5 inline mr-1" />{t('admin.orders.k042', { defaultValue: '시작일' })}</label>
            <input type="date" value={dateFilter.start} onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5"><Calendar className="w-3.5 h-3.5 inline mr-1" />{t('admin.orders.k043', { defaultValue: '종료일' })}</label>
            <input type="date" value={dateFilter.end} onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5"><Search className="w-3.5 h-3.5 inline mr-1" />{t('admin.orders.k044', { defaultValue: '검색' })}</label>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('admin.orders.k045', { defaultValue: "주문번호, 고객명, 전화번호, 이메일" })} aria-label={t('admin.orders.k046', { defaultValue: "주문 검색" })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(statusFilter !== 'ALL' || sellerFilter !== 'ALL' || searchQuery || dateFilter.start || dateFilter.end) && (
          <button onClick={() => { setStatusFilter('ALL'); setSellerFilter('ALL'); setSearchQuery(''); setDateFilter({ start: '', end: '' }) }} className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <XCircle className="w-3.5 h-3.5" /> 필터 초기화
          </button>
        )}
      </div>

      {/* 🛡️ 2026-06-14: 검색/필터 적용 시 결과 건수 안내 */}
      {(debouncedSearch || statusFilter !== 'ALL' || sellerFilter !== 'ALL' || dateFilter.start || dateFilter.end) && (
        <div className="flex items-center gap-2 px-1">
          <Search className="w-3.5 h-3.5 text-blue-500" />
          <p className="text-xs text-gray-600">
            {debouncedSearch && <>‘<span className="font-semibold text-gray-900">{debouncedSearch}</span>’ </>}
            검색/필터 결과 <span className="font-semibold text-blue-600">{formatNumber(totalCount)}</span>건
          </p>
        </div>
      )}

      {/* 🗂️ 2026-06-17: 도매몰(B2B) 주문은 별도 테이블/페이지 안내 + 체크박스 일괄 상태변경 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Link to="/admin/wholesale-orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
          <Store className="w-3.5 h-3.5" /> 도매몰(B2B) 주문 보기 <ExternalLink className="w-3 h-3" />
        </Link>
        {selectedNumbers.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <span className="text-xs text-gray-600 font-medium">{selectedNumbers.size}건 선택됨</span>
            <button type="button" onClick={() => setSelectedNumbers(new Set())} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">선택 해제</button>
            <span className="text-xs text-gray-400">일괄 변경:</span>
            {['PREPARING', 'SHIPPING', 'DELIVERED'].map((st) => (
              <button key={st} type="button" onClick={() => bulkUpdateStatus(st)} disabled={bulkBusy}
                className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-md hover:bg-gray-800 disabled:opacity-50">
                {STATUS_STYLES[st]?.label || st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 주문 테이블 */}
      {/* 🛡️ 2026-06-14: 컬럼 상세화 — 주문번호/일시 / 고객(명·이메일·연락처마스킹) / 상품요약(수량) /
          판매자 / 결제수단 / 주문상태 / 결제상태 / 금액 / 배송(송장). 한눈에 "누가 무엇을 얼마에" 파악. */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleSelectAll} disabled={currentOrders.length === 0} aria-label="전체 선택"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40" />
                </th>
                {['주문 / 일시', '종류', '고객 정보', '주문 상품', '판매자', '결제수단', '주문 상태', '결제 상태', '배송', '금액', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentOrders.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-400">{t('admin.orders.k052', { defaultValue: '주문 내역이 없습니다.' })}</td></tr>
              ) : currentOrders.map(order => {
                const ss = STATUS_STYLES[order.status] || { label: order.status, color: 'text-gray-600', bg: 'bg-gray-100' }
                const ps = PAYMENT_STYLES[order.payment_status] || { label: order.payment_status, color: 'text-gray-600', bg: 'bg-gray-100' }
                const extraCount = (order.item_count ?? 0) > 1 ? (order.item_count ?? 1) - 1 : 0
                const productSummary = order.first_item_name
                  ? (extraCount > 0 ? `${order.first_item_name} 외 ${extraCount}건` : order.first_item_name)
                  : '-'
                const kind = orderKind(order.first_item_category)
                const checked = selectedNumbers.has(order.order_number)
                return (
                  <tr key={order.order_number} className={`hover:bg-gray-50 align-top ${checked ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-3 py-3 w-10">
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(order.order_number)}
                        aria-label={`${order.order_number} 선택`}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-gray-700">{order.order_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatKST(order.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${kind.bg} ${kind.color}`}>
                        {kind.icon === 'voucher' ? <Ticket className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                        {kind.label}{kind.sub ? `·${kind.sub}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs font-semibold text-gray-900">{order.shipping_name || order.user_name || '-'}</p>
                      {order.user_email && <p className="text-xs text-gray-400 truncate">{order.user_email}</p>}
                      <p className="text-xs text-gray-400">{maskPhone(order.shipping_phone)}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="text-xs text-gray-900 line-clamp-2">{productSummary}</p>
                      {(order.total_quantity ?? 0) > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">총 {formatNumber(order.total_quantity)}개 · {formatNumber(order.item_count || 0)}종</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[140px] truncate">{order.seller_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{paymentMethodLabel(order.payment_method)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ss.bg} ${ss.color}`}>{ss.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ps.bg} ${ps.color}`}>{ps.label}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[140px]">
                      {order.tracking_number ? (
                        <div className="text-[11px]">
                          <p className="text-gray-700 font-medium">{order.courier || '택배'}</p>
                          <p className="text-gray-400 font-mono truncate">{order.tracking_number}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-300">송장 미등록</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">₩{formatNumber(order.total_amount)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewOrderDetail(order.order_number)} className="p-1.5 rounded-lg hover:bg-gray-100" title="주문 상세 보기">
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
              전체 <span className="font-medium">{totalCount}</span>{t('admin.orders.k053', { defaultValue: '개 중' })} <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>-<span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + itemsPerPage, totalCount)}</span>개
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
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85dvh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{t('admin.orders.k054', { defaultValue: '주문 상세' })}</h3>
              <button onClick={() => setShowDetail(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <XCircle className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('admin.orders.k055', { defaultValue: '주문 정보' })}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    [t('admin.orders.k047', { defaultValue: '주문번호' }), selectedOrder.order_number],
                    [t('admin.orders.k048', { defaultValue: '주문일시' }), formatKST(selectedOrder.created_at)],
                    [t('admin.orders.k040', { defaultValue: '판매자' }), selectedOrder.seller_name],
                    [t('admin.orders.k056', { defaultValue: '결제 방법' }), paymentMethodLabel(selectedOrder.payment_method)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-gray-400">{k}</p>
                      <p className="font-medium text-gray-900 mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('admin.orders.k057', { defaultValue: '배송 정보' })}</h4>
                {(() => {
                  const addr = parseShippingAddress(selectedOrder.shipping_address, selectedOrder.shipping_zipcode, selectedOrder.shipping_address_detail)
                  return (
                    <div className="space-y-2 text-sm">
                      <div><p className="text-xs text-gray-400">{t('admin.orders.k058', { defaultValue: '받는 사람' })}</p><p className="font-medium text-gray-900">{selectedOrder.shipping_name}</p></div>
                      <div><p className="text-xs text-gray-400">{t('admin.orders.k059', { defaultValue: '연락처' })}</p><p className="font-medium text-gray-900">{selectedOrder.shipping_phone}</p></div>
                      {addr.postal_code && <div><p className="text-xs text-gray-400">{t('admin.orders.k060', { defaultValue: '우편번호' })}</p><p className="font-medium text-gray-900">{addr.postal_code}</p></div>}
                      <div><p className="text-xs text-gray-400">{t('admin.orders.k061', { defaultValue: '주소' })}</p><p className="font-medium text-gray-900">{addr.address1}{addr.address2 ? ` ${addr.address2}` : ''}</p></div>
                      {selectedOrder.tracking_number && <div><p className="text-xs text-gray-400">{t('admin.orders.k062', { defaultValue: '운송장' })}</p><p className="font-medium text-gray-900">{selectedOrder.courier} {selectedOrder.tracking_number}</p></div>}
                    </div>
                  )
                })()}
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('admin.orders.k063', { defaultValue: '주문 상품' })}</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {item.image_url && <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded-lg" loading="lazy" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                          <p className="text-xs text-gray-400">수량 {item.quantity}개</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">₩{formatNumber(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">{t('admin.orders.k064', { defaultValue: '총 결제 금액' })}</span>
                <span className="text-lg font-bold text-blue-600">₩{formatNumber(selectedOrder.total_amount)}</span>
              </div>

              {/* 주문 상태 변경 */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('admin.orders.k065', { defaultValue: '주문 처리' })}</h4>
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
                        const reason = prompt(t('admin.orders.k066', { defaultValue: '취소 사유를 입력해주세요:' }))
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
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t('admin.orders.k067', { defaultValue: '운송장 등록' })}</h4>
                  <form onSubmit={e => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement
                    const company = (form.elements.namedItem('courier') as unknown as HTMLSelectElement).value
                    const number = (form.elements.namedItem('tracking') as HTMLInputElement).value
                    if (company && number) updateTracking(selectedOrder.order_number, number, company)
                  }} className="flex gap-2">
                    <select name="courier" defaultValue={selectedOrder.courier || ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 flex-shrink-0">
                      <option value="">{t('admin.orders.k068', { defaultValue: '택배사 선택' })}</option>
                      {COURIER_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input name="tracking" type="text" defaultValue={selectedOrder.tracking_number || ''} placeholder="운송장 번호" className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 flex-1" />
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
