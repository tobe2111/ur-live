import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatKST } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  FileText,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight
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
  id: string
  order_number: string
  user_name: string
  total_amount: number
  status: string
  payment_status: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  courier: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

function parseShippingAddress(address: string, detail?: string): { postal_code: string; address1: string; address2: string } {
  if (!address) return { postal_code: '', address1: '', address2: detail || '' }
  try {
    const parsed = JSON.parse(address)
    return {
      postal_code: parsed.postal_code || parsed.zipcode || '',
      address1: parsed.address1 || parsed.address || '',
      address2: parsed.address2 || parsed.detail || detail || '',
    }
  } catch {
    return { postal_code: '', address1: address, address2: detail || '' }
  }
}

export default function SellerOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [trackingForm, setTrackingForm] = useState({
    courier: '',
    tracking_number: ''
  })

  // 일괄 처리
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, statusFilter, searchQuery, dateFilter])

  async function loadOrders() {
    setLoading(true)
    setError('')

    try {
      if (!localStorage.getItem('seller_token')) {
        navigate('/seller/login')
        return
      }

      const response = await api.get('/api/seller/orders')

      if (response.data.success) {
        // API는 data 또는 orders 키로 응답할 수 있음
        setOrders(response.data.data || response.data.orders || [])
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error)
      setError('주문 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  function filterOrders() {
    let result = [...orders]

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(order => order.status === statusFilter)
    }

    // Search filter (order number, customer name, phone)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(order => 
        order.order_number.toLowerCase().includes(query) ||
        order.shipping_name.toLowerCase().includes(query) ||
        order.shipping_phone.includes(query)
      )
    }

    // Date filter
    if (dateFilter.start) {
      const startDate = new Date(dateFilter.start)
      result = result.filter(order => new Date(order.created_at) >= startDate)
    }
    if (dateFilter.end) {
      const endDate = new Date(dateFilter.end)
      endDate.setHours(23, 59, 59, 999) // End of day
      result = result.filter(order => new Date(order.created_at) <= endDate)
    }

    setFilteredOrders(result)
    setCurrentPage(1) // Reset to first page when filters change
  }

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentOrders = filteredOrders.slice(startIndex, endIndex)

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // CSV Export
  function exportToCSV() {
    if (filteredOrders.length === 0) {
      toast.info('내보낼 주문이 없습니다.')
      return
    }

    const headers = ['주문번호', '주문자', '전화번호', '주소', '주문금액', '주문상태', '결제상태', '택배사', '송장번호', '주문일시']
    const rows = filteredOrders.map(order => [
      order.order_number,
      order.shipping_name,
      order.shipping_phone,
      order.shipping_address,
      order.total_amount,
      getStatusText(order.status),
      order.payment_status === 'completed' ? '결제완료' : order.payment_status,
      order.courier || '',
      order.tracking_number || '',
      formatKST(order.created_at)
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `주문목록_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  async function handleStatusChange(orderNumber: string, newStatus: string) {
    if (!confirm(`주문 상태를 "${getStatusText(newStatus)}"(으)로 변경하시겠습니까?`)) {
      return
    }

    setUpdating(true)
    setError('')

    try {
      // order_number 대신 id를 사용 (API가 둘 다 지원)
      const response = await api.patch(
        `/api/seller/orders/${orderNumber}/status`,
        { status: newStatus }
      )

      if (response.data.success) {
        toast.success('주문 상태가 변경되었습니다.')
        loadOrders()
        if (selectedOrder && selectedOrder.order_number === orderNumber) {
          setShowDetail(false)
          setSelectedOrder(null)
        }
      }
    } catch (error: any) {
      console.error('Failed to update status:', error)
      setError(error.response?.data?.error || '상태 변경에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  async function handleTrackingSubmit(e: React.FormEvent, orderNumber: string) {
    e.preventDefault()
    setUpdating(true)
    setError('')

    try {
      const response = await api.put(
        `/api/seller/orders/${orderNumber}/tracking`,
        trackingForm
      )

      if (response.data.success) {
        toast.success('송장번호가 등록되었습니다.')
        setTrackingForm({ courier: '', tracking_number: '' })
        loadOrders()
        if (selectedOrder && selectedOrder.order_number === orderNumber) {
          setShowDetail(false)
          setSelectedOrder(null)
        }
      }
    } catch (error: any) {
      console.error('Failed to update tracking:', error)
      setError(error.response?.data?.error || '송장번호 등록에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  // 체크박스 토글
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === currentOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(currentOrders.map(o => o.id.toString())))
    }
  }

  // 일괄 상태 변경
  const handleBulkStatusChange = useCallback(async () => {
    if (!bulkStatus || selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds).map(Number)
      const response = await api.patch('/api/seller/orders/bulk-status', { order_ids: ids, status: bulkStatus })
      if (response.data.success) {
        toast.success(response.data.message || `${ids.length}건 상태 변경 완료`)
        setSelectedIds(new Set())
        setBulkStatus('')
        loadOrders()
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || '일괄 처리에 실패했습니다.')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkStatus, selectedIds])

  function getStatusText(status: string) {
    switch (status) {
      case 'PAY_COMPLETE': case 'PAID': case 'DONE': return '결제완료'
      case 'PENDING': case 'AWAITING_PAYMENT': return '결제대기'
      case 'PREPARING': return '상품준비중'
      case 'SHIPPING': return '배송중'
      case 'DELIVERED': return '배송완료'
      case 'CANCELLED': return '주문취소'
      case 'REFUNDED': return '환불완료'
      case 'FAILED': return '결제실패'
      default: return status
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'PAY_COMPLETE': case 'PAID': case 'DONE':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">결제완료</Badge>
      case 'PENDING': case 'AWAITING_PAYMENT':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">결제대기</Badge>
      case 'PREPARING':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">상품준비중</Badge>
      case 'SHIPPING':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">배송중</Badge>
      case 'DELIVERED':
        return <Badge className="bg-green-100 text-green-800 border-green-200">배송완료</Badge>
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 border-red-200">주문취소</Badge>
      case 'REFUNDED':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">환불완료</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  function getNextStatus(currentStatus: string): string | null {
    switch (currentStatus) {
      case 'PAY_COMPLETE': case 'PAID': case 'DONE': return 'PREPARING'
      case 'PREPARING': return 'SHIPPING'
      case 'SHIPPING': return 'DELIVERED'
      default: return null
    }
  }

  function formatPrice(price: number) {
    return price.toLocaleString('ko-KR')
  }

  function viewOrderDetail(order: Order) {
    setSelectedOrder(order)
    setShowDetail(true)
    if (order.courier && order.tracking_number) {
      setTrackingForm({
        courier: order.courier,
        tracking_number: order.tracking_number
      })
    } else {
      setTrackingForm({ courier: '', tracking_number: '' })
    }
  }

  return (
    <SellerLayout title="주문 관리">
      <div className="max-w-7xl mx-auto">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Package className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">주문 관리</h1>
                <p className="text-sm text-gray-500 mt-1">
                  전체 {orders.length}건 / 필터링 {filteredOrders.length}건
                </p>
              </div>
            </div>
            <Button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              CSV 다운로드
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">필터</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주문 상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">전체</option>
                <option value="PAY_COMPLETE">결제완료</option>
                <option value="PREPARING">상품준비중</option>
                <option value="SHIPPING">배송중</option>
                <option value="DELIVERED">배송완료</option>
                <option value="CANCELLED">주문취소</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="주문번호, 주문자명, 전화번호"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일
              </label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일
              </label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Reset Filters */}
          {(statusFilter !== 'ALL' || searchQuery || dateFilter.start || dateFilter.end) && (
            <div className="mt-4">
              <Button
                onClick={() => {
                  setStatusFilter('ALL')
                  setSearchQuery('')
                  setDateFilter({ start: '', end: '' })
                }}
                variant="outline"
                size="sm"
              >
                필터 초기화
              </Button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Orders List */}
            <div className="bg-white rounded-lg shadow-sm border">
              {currentOrders.length === 0 ? (
                <div className="text-center py-20">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    {filteredOrders.length === 0 && orders.length > 0 
                      ? '필터 조건에 맞는 주문이 없습니다.' 
                      : '주문이 없습니다.'}
                  </p>
                  <p className="text-sm text-gray-500">새 주문이 들어오면 여기에 표시됩니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* 일괄 처리 바 */}
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b border-blue-200">
                      <span className="text-sm font-medium text-blue-700">{selectedIds.size}건 선택됨</span>
                      <select
                        value={bulkStatus}
                        onChange={e => setBulkStatus(e.target.value)}
                        className="text-sm border border-blue-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">상태 선택</option>
                        <option value="PREPARING">준비중</option>
                        <option value="SHIPPING">배송중</option>
                        <option value="DELIVERED">배송완료</option>
                        <option value="CANCELLED">취소</option>
                      </select>
                      <button
                        onClick={handleBulkStatusChange}
                        disabled={!bulkStatus || bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        일괄 변경
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        선택 해제
                      </button>
                    </div>
                  )}
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === currentOrders.length && currentOrders.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-blue-600"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문자</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">주문금액</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">주문상태</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">결제상태</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문일시</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상세</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentOrders.map((order) => (
                        <tr
                          key={order.order_number}
                          className={`hover:bg-gray-50 ${selectedIds.has(order.id.toString()) ? 'bg-blue-50/50' : ''}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.id.toString())}
                              onChange={() => toggleSelect(order.id.toString())}
                              className="rounded border-gray-300 text-blue-600"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-gray-900">{order.order_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div>{order.shipping_name}</div>
                            <div className="text-xs text-gray-400">{order.shipping_phone}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">{formatPrice(order.total_amount)}원</td>
                          <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={order.payment_status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800'}>
                              {order.payment_status === 'completed' ? '결제완료' : order.payment_status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatKST(order.created_at)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => viewOrderDetail(order)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} / 전체 {filteredOrders.length}건
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i
                    if (pageNum > totalPages) return null
                    return (
                      <Button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                  <Button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">주문 상세</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Order Info */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">주문 정보</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">주문번호</p>
                      <p className="font-mono font-medium">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">주문일시</p>
                      <p className="font-medium">
                        {formatKST(selectedOrder.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">주문상태</p>
                      <div>{getStatusBadge(selectedOrder.status)}</div>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">결제상태</p>
                      <div>
                        <Badge className={selectedOrder.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {selectedOrder.payment_status === 'completed' ? '결제완료' : selectedOrder.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">배송 정보</h3>
                  {(() => {
                    const addr = parseShippingAddress(selectedOrder.shipping_address)
                    return (
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">받는 사람</p>
                      <p className="font-medium">{selectedOrder.shipping_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">연락처</p>
                      <p className="font-medium">{selectedOrder.shipping_phone}</p>
                    </div>
                    {addr.postal_code && (
                    <div>
                      <p className="text-gray-500 mb-1">우편번호</p>
                      <p className="font-medium">{addr.postal_code}</p>
                    </div>
                    )}
                    <div>
                      <p className="text-gray-500 mb-1">주소</p>
                      <p className="font-medium">{addr.address1}{addr.address2 ? ` ${addr.address2}` : ''}</p>
                    </div>
                    {selectedOrder.courier && selectedOrder.tracking_number && (
                      <>
                        <div>
                          <p className="text-gray-500 mb-1">택배사</p>
                          <p className="font-medium">{selectedOrder.courier}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">송장번호</p>
                          <p className="font-mono font-medium">{selectedOrder.tracking_number}</p>
                        </div>
                      </>
                    )}
                  </div>
                    )
                  })()}
                </div>

                {/* Order Items */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">주문 상품</h3>
                    <div className="space-y-3">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          {/* Product Image */}
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                            {item.image_url ? (
                              <img 
                                src={item.image_url} 
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image'
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                No Image
                              </div>
                            )}
                          </div>
                          
                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                            <p className="text-sm text-gray-500 mt-1">수량: {item.quantity}개</p>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              {formatPrice(item.price * item.quantity)}원
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amount Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">결제 정보</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>총 주문금액</span>
                      <span className="text-blue-600">{formatPrice(selectedOrder.total_amount)}원</span>
                    </div>
                  </div>
                </div>

                {/* Status Change */}
                {getNextStatus(selectedOrder.status) && (
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">상태 변경</h3>
                    <Button
                      onClick={() => handleStatusChange(selectedOrder.order_number, getNextStatus(selectedOrder.status)!)}
                      disabled={updating}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {updating ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          처리 중...
                        </span>
                      ) : (
                        `"${getStatusText(getNextStatus(selectedOrder.status)!)}"(으)로 변경`
                      )}
                    </Button>
                  </div>
                )}

                {/* Tracking Number Form */}
                {selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">배송 정보 입력</h3>
                    <form onSubmit={(e) => handleTrackingSubmit(e, selectedOrder.order_number)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          택배사 <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={trackingForm.courier}
                          onChange={(e) => setTrackingForm({ ...trackingForm, courier: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="">택배사 선택</option>
                          <option value="CJ대한통운">CJ대한통운</option>
                          <option value="로젠택배">로젠택배</option>
                          <option value="옐로우캡">옐로우캡</option>
                          <option value="우체국택배">우체국택배</option>
                          <option value="한진택배">한진택배</option>
                          <option value="롯데택배">롯데택배</option>
                          <option value="드림택배">드림택배</option>
                          <option value="KGB택배">KGB택배</option>
                          <option value="대신택배">대신택배</option>
                          <option value="일양로지스">일양로지스</option>
                          <option value="경동택배">경동택배</option>
                          <option value="천일택배">천일택배</option>
                          <option value="합동택배">합동택배</option>
                          <option value="CVSnet편의점택배">CVSnet편의점택배</option>
                          <option value="우편발송">우편발송</option>
                          <option value="GTX로지스">GTX로지스</option>
                          <option value="건영택배">건영택배</option>
                          <option value="EMS">EMS</option>
                          <option value="DHL">DHL</option>
                          <option value="FedEx">FedEx</option>
                          <option value="UPS">UPS</option>
                          <option value="USPS">USPS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          송장번호 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={trackingForm.tracking_number}
                          onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })}
                          placeholder="예: 123456789012"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={updating}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {updating ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            등록 중...
                          </span>
                        ) : (
                          '송장번호 등록'
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 pt-4 border-t">
                <Button
                  onClick={() => setShowDetail(false)}
                  className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
