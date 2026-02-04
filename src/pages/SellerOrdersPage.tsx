import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
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
  FileText
} from 'lucide-react'

interface Order {
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
}

export default function SellerOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [updating, setUpdating] = useState(false)

  const [trackingForm, setTrackingForm] = useState({
    courier: '',
    tracking_number: ''
  })

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setError('')

    try {
      const session = JSON.parse(localStorage.getItem('sellerSession') || '{}')
      const sessionToken = session.token

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const response = await axios.get('/api/seller/orders', {
        headers: { 'X-Session-Token': sessionToken }
      })

      if (response.data.success) {
        setOrders(response.data.data)
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error)
      setError('주문 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(orderNo: string, newStatus: string) {
    if (!confirm(`주문 상태를 "${getStatusText(newStatus)}"(으)로 변경하시겠습니까?`)) {
      return
    }

    setUpdating(true)
    setError('')

    try {
      const session = JSON.parse(localStorage.getItem('sellerSession') || '{}')
      const sessionToken = session.token

      const response = await axios.patch(
        `/api/seller/orders/${orderNo}/status`,
        { status: newStatus },
        { headers: { 'X-Session-Token': sessionToken } }
      )

      if (response.data.success) {
        alert('주문 상태가 변경되었습니다.')
        loadOrders()
        if (selectedOrder && selectedOrder.order_number === orderNo) {
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

  async function handleTrackingSubmit(e: React.FormEvent, orderNo: string) {
    e.preventDefault()
    setUpdating(true)
    setError('')

    try {
      const session = JSON.parse(localStorage.getItem('sellerSession') || '{}')
      const sessionToken = session.token

      const response = await axios.put(
        `/api/seller/orders/${orderNo}/tracking`,
        trackingForm,
        { headers: { 'X-Session-Token': sessionToken } }
      )

      if (response.data.success) {
        alert('송장번호가 등록되었습니다.')
        setTrackingForm({ courier: '', tracking_number: '' })
        loadOrders()
        if (selectedOrder && selectedOrder.order_number === orderNo) {
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

  function getStatusText(status: string) {
    switch (status) {
      case 'PAY_COMPLETE': return '결제완료'
      case 'PREPARING': return '상품준비중'
      case 'SHIPPING': return '배송중'
      case 'DELIVERED': return '배송완료'
      case 'CANCELLED': return '주문취소'
      default: return status
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'PAY_COMPLETE':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">결제완료</Badge>
      case 'PREPARING':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">상품준비중</Badge>
      case 'SHIPPING':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">배송중</Badge>
      case 'DELIVERED':
        return <Badge className="bg-green-100 text-green-800 border-green-200">배송완료</Badge>
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 border-red-200">주문취소</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  function getNextStatus(currentStatus: string): string | null {
    switch (currentStatus) {
      case 'PAY_COMPLETE': return 'PREPARING'
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/seller')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>판매자 대시보드로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">주문 관리</h1>
          </div>
          <p className="text-gray-600 mt-2">
            주문 상태를 관리하고 배송 정보를 입력할 수 있습니다.
          </p>
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
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          /* Orders List */
          <div className="bg-white rounded-lg shadow-sm border">
            {orders.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">주문이 없습니다.</p>
                <p className="text-sm text-gray-500">새 주문이 들어오면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
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
                    {orders.map((order) => (
                      <tr key={order.order_number} className="hover:bg-gray-50">
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
                          {new Date(order.created_at).toLocaleString('ko-KR')}
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
                        {new Date(selectedOrder.created_at).toLocaleString('ko-KR')}
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
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">수령인</p>
                      <p className="font-medium">{selectedOrder.shipping_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">연락처</p>
                      <p className="font-medium">{selectedOrder.shipping_phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">배송지 주소</p>
                      <p className="font-medium">{selectedOrder.shipping_address}</p>
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
                </div>

                {/* Amount Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">결제 정보</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>주문금액</span>
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
                        <input
                          type="text"
                          value={trackingForm.courier}
                          onChange={(e) => setTrackingForm({ ...trackingForm, courier: e.target.value })}
                          placeholder="예: CJ대한통운, 우체국택배"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
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
    </div>
  )
}
