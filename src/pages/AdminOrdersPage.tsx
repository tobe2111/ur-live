import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
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
  ChevronRight,
  RefreshCw
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

export default function AdminOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sellerFilter, setSellerFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Sellers list for filter
  const [sellers, setSellers] = useState<Array<{id: number, name: string}>>([])

  useEffect(() => {
    loadOrders()
    loadSellers()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, statusFilter, sellerFilter, searchQuery, dateFilter])

  async function loadOrders() {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const userType = localStorage.getItem('user_type')
      
      if (!token || userType !== 'admin') {
        navigate('/admin/login')
        return
      }

      const response = await api.get('/api/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.data.success) {
        setOrders(response.data.data)
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error)
      setError('주문 목록을 불러올 수 없습니다.')
      if (error.response?.status === 401) {
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadSellers() {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get('/api/admin/sellers', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.data.success) {
        setSellers(response.data.data.map((s: any) => ({
          id: s.id,
          name: s.name || s.username || s.business_name || `Seller ${s.id}`
        })))
      }
    } catch (error) {
      console.error('Failed to load sellers:', error)
    }
  }

  function filterOrders() {
    let result = [...orders]

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(order => order.status === statusFilter)
    }

    // Seller filter
    if (sellerFilter !== 'ALL') {
      result = result.filter(order => order.seller_id === parseInt(sellerFilter))
    }

    // Search filter (order number, customer name, phone, email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(order => 
        order.order_number.toLowerCase().includes(query) ||
        order.shipping_name.toLowerCase().includes(query) ||
        order.shipping_phone.includes(query) ||
        order.user_email?.toLowerCase().includes(query)
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

  async function viewOrderDetail(orderNumber: string) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get(`/api/admin/orders/${orderNumber}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.data.success) {
        setSelectedOrder(response.data.data)
        setShowDetail(true)
      }
    } catch (error) {
      console.error('Failed to load order detail:', error)
      toast.error('주문 상세 정보를 불러올 수 없습니다.')
    }
  }

  async function exportOrders() {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get('/api/admin/orders/export', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          seller_id: sellerFilter !== 'ALL' ? sellerFilter : undefined,
          start_date: dateFilter.start || undefined,
          end_date: dateFilter.end || undefined
        },
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to export orders:', error)
      toast.error('주문 내역 다운로드에 실패했습니다.')
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    }

    const labels: Record<string, string> = {
      pending: '주문 접수',
      confirmed: '주문 확인',
      shipped: '배송 중',
      delivered: '배송 완료',
      cancelled: '취소',
      refunded: '환불'
    }

    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    )
  }

  function getPaymentStatusBadge(paymentStatus: string) {
    if (paymentStatus === 'paid') {
      return <Badge className="bg-green-100 text-green-800">결제 완료</Badge>
    }
    if (paymentStatus === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-800">결제 대기</Badge>
    }
    if (paymentStatus === 'failed') {
      return <Badge className="bg-red-100 text-red-800">결제 실패</Badge>
    }
    return <Badge className="bg-gray-100 text-gray-800">{paymentStatus}</Badge>
  }

  // Statistics
  const stats = {
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
    shipped: filteredOrders.filter(o => o.status === 'shipped').length,
    delivered: filteredOrders.filter(o => o.status === 'delivered').length,
    cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    totalAmount: filteredOrders.reduce((sum, o) => sum + o.total_amount, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">주문 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => loadOrders()}>다시 시도</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
                <p className="text-sm text-gray-600">전체 주문 목록 및 관리</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => loadOrders()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
              <Button
                onClick={exportOrders}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                엑셀 다운로드
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">전체 주문</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">주문 접수</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">주문 확인</p>
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">배송 중</p>
            <p className="text-2xl font-bold text-purple-600">{stats.shipped}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">배송 완료</p>
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">취소</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">총 매출</p>
            <p className="text-2xl font-bold text-green-600">₩{stats.totalAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                주문 상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">전체</option>
                <option value="pending">주문 접수</option>
                <option value="confirmed">주문 확인</option>
                <option value="shipped">배송 중</option>
                <option value="delivered">배송 완료</option>
                <option value="cancelled">취소</option>
                <option value="refunded">환불</option>
              </select>
            </div>

            {/* Seller Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                판매자
              </label>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">전체 판매자</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                시작일
              </label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                종료일
              </label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              검색 (주문번호, 고객명, 전화번호, 이메일)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색어를 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clear Filters */}
          {(statusFilter !== 'ALL' || sellerFilter !== 'ALL' || searchQuery || dateFilter.start || dateFilter.end) && (
            <div className="mt-4">
              <Button
                onClick={() => {
                  setStatusFilter('ALL')
                  setSellerFilter('ALL')
                  setSearchQuery('')
                  setDateFilter({start: '', end: ''})
                }}
                variant="outline"
                size="sm"
              >
                <XCircle className="w-4 h-4 mr-2" />
                필터 초기화
              </Button>
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문일시
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    판매자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    고객명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    결제 상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      주문 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((order) => (
                    <tr key={order.order_number} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(order.created_at).toLocaleString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.seller_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.shipping_name}</div>
                        <div className="text-xs text-gray-500">{order.shipping_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPaymentStatusBadge(order.payment_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₩{order.total_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Button
                          onClick={() => viewOrderDetail(order.order_number)}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  이전
                </Button>
                <span className="text-sm text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  다음
                </Button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    전체 <span className="font-medium">{filteredOrders.length}</span>개 중{' '}
                    <span className="font-medium">{startIndex + 1}</span>-
                    <span className="font-medium">{Math.min(endIndex, filteredOrders.length)}</span>개 표시
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowDetail(false)}></div>

            <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              {/* Modal Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">주문 상세 정보</h3>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                {/* Order Info */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">주문 정보</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">주문번호</p>
                      <p className="font-medium">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">주문일시</p>
                      <p className="font-medium">{new Date(selectedOrder.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">판매자</p>
                      <p className="font-medium">{selectedOrder.seller_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">주문 상태</p>
                      <p>{getStatusBadge(selectedOrder.status)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">결제 상태</p>
                      <p>{getPaymentStatusBadge(selectedOrder.payment_status)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">결제 방법</p>
                      <p className="font-medium">{selectedOrder.payment_method || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">고객 정보</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">고객명</p>
                      <p className="font-medium">{selectedOrder.user_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">이메일</p>
                      <p className="font-medium">{selectedOrder.user_email || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Shipping Info */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">배송 정보</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-600">받는 사람</p>
                      <p className="font-medium">{selectedOrder.shipping_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">연락처</p>
                      <p className="font-medium">{selectedOrder.shipping_phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">배송 주소</p>
                      <p className="font-medium">
                        [{selectedOrder.shipping_zipcode}] {selectedOrder.shipping_address} {selectedOrder.shipping_address_detail}
                      </p>
                    </div>
                    {selectedOrder.courier && (
                      <div>
                        <p className="text-gray-600">택배사</p>
                        <p className="font-medium">{selectedOrder.courier}</p>
                      </div>
                    )}
                    {selectedOrder.tracking_number && (
                      <div>
                        <p className="text-gray-600">운송장 번호</p>
                        <p className="font-medium">{selectedOrder.tracking_number}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">주문 상품</h4>
                    <div className="space-y-3">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-gray-600">수량: {item.quantity}개</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">₩{(item.price * item.quantity).toLocaleString()}</p>
                            <p className="text-xs text-gray-600">개당 ₩{item.price.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">결제 금액</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>총 결제 금액</span>
                      <span className="text-blue-600">₩{selectedOrder.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-end">
                  <Button onClick={() => setShowDetail(false)} variant="outline">
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
