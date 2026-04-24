import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatKST } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardCard } from '@/components/dashboard'
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
import type { OrderItem, Order } from '@/components/seller/orders/seller-orders-types'
import { parseShippingAddress } from '@/components/seller/orders/seller-orders-helpers'

export default function SellerOrdersPage() {
  const { t } = useTranslation()
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
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to load orders:', error)
      setError(t('seller.orderListLoadFailed'))
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
      toast.info(t('seller.noExportOrders'))
      return
    }

    const headers = [t('seller.orderNumber'), t('seller.buyer'), t('seller.phone'), t('seller.address'), t('seller.orderAmount'), t('seller.orderStatus'), t('seller.paymentStatus'), t('seller.courier'), t('seller.trackingNumber'), t('seller.orderDate')]
    const rows = filteredOrders.map(order => [
      order.order_number,
      order.shipping_name,
      order.shipping_phone,
      order.shipping_address,
      order.total_amount,
      getStatusText(order.status),
      order.payment_status === 'completed' ? 'Paid' : order.payment_status,
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
    link.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  async function handleStatusChange(orderNumber: string, newStatus: string) {
    if (!confirm(t('seller.confirmStatusChange', { status: getStatusText(newStatus) }))) {
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
        toast.success(t('seller.statusChanged'))
        loadOrders()
        if (selectedOrder && selectedOrder.order_number === orderNumber) {
          setShowDetail(false)
          setSelectedOrder(null)
        }
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to update status:', error)
      setError(error_.response?.data?.error || t('seller.statusChangeFailed'))
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
        toast.success(t('seller.trackingRegistered'))
        setTrackingForm({ courier: '', tracking_number: '' })
        loadOrders()
        if (selectedOrder && selectedOrder.order_number === orderNumber) {
          setShowDetail(false)
          setSelectedOrder(null)
        }
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to update tracking:', error)
      setError(error_.response?.data?.error || t('seller.trackingRegisterFailed'))
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
        toast.success(response.data.message || t('seller.bulkChangeDone', { count: ids.length }))
        setSelectedIds(new Set())
        setBulkStatus('')
        loadOrders()
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || t('seller.bulkChangeFailed'))
    } finally {
      setBulkLoading(false)
    }
  }, [bulkStatus, selectedIds])

  function getStatusText(status: string) {
    switch (status) {
      case 'PAY_COMPLETE': case 'PAID': case 'DONE': return t('seller.statusDone')
      case 'PENDING': case 'AWAITING_PAYMENT': return t('seller.statusPending')
      case 'PREPARING': return t('seller.statusPreparing')
      case 'SHIPPING': return t('seller.statusShipping')
      case 'DELIVERED': return t('seller.statusDelivered')
      case 'CANCELLED': return t('seller.statusCancelled')
      case 'REFUNDED': return t('common.refunded')
      case 'FAILED': return status
      default: return status
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'PAY_COMPLETE': case 'PAID': case 'DONE':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{t('seller.statusDone')}</Badge>
      case 'PENDING': case 'AWAITING_PAYMENT':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{t('seller.statusPending')}</Badge>
      case 'PREPARING':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{t('seller.statusPreparing')}</Badge>
      case 'SHIPPING':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{t('seller.statusShipping')}</Badge>
      case 'DELIVERED':
        return <Badge className="bg-green-100 text-green-800 border-green-200">{t('seller.statusDelivered')}</Badge>
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 border-red-200">{t('seller.statusCancelled')}</Badge>
      case 'REFUNDED':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{t('common.refunded')}</Badge>
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
    <SellerLayout title={t('seller.orders')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 129: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.orders')}
          subtitle={t('seller.totalFiltered', { total: orders.length, filtered: filteredOrders.length })}
          icon={<Package className="h-5 w-5" />}
          actions={
            <Button
              onClick={exportToCSV}
              className="h-9 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t('seller.csvDownload')}
            </Button>
          }
        />

        {/* Filters */}
        <DashboardCard title={t('seller.filterLabel')} actions={<Filter className="h-4 w-4 text-gray-400" />}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">{t('common.all')}</option>
                <option value="PAY_COMPLETE">{t('seller.statusDone')}</option>
                <option value="PREPARING">{t('seller.statusPreparing')}</option>
                <option value="SHIPPING">{t('seller.statusShipping')}</option>
                <option value="DELIVERED">{t('seller.statusDelivered')}</option>
                <option value="CANCELLED">{t('seller.statusCancelled')}</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.search')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('seller.searchPlaceholder')}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.startDate')}
              </label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.endDate')}
              </label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                {t('seller.resetFilters')}
              </Button>
            </div>
          )}
        </DashboardCard>

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
                      ? t('seller.noMatchingOrders') 
                      : t('seller.noOrdersYet')}
                  </p>
                  <p className="text-sm text-gray-500">{t('seller.newOrdersWillAppear')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* 일괄 처리 바 */}
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b border-blue-200">
                      <span className="text-sm font-medium text-blue-700">{t('seller.selectedCount', { count: selectedIds.size })}</span>
                      <select
                        value={bulkStatus}
                        onChange={e => setBulkStatus(e.target.value)}
                        className="text-sm border border-blue-300 rounded-lg px-2 py-1.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">{t('common.status')}</option>
                        <option value="PREPARING">{t('seller.statusPreparing')}</option>
                        <option value="SHIPPING">{t('seller.statusShipping')}</option>
                        <option value="DELIVERED">{t('seller.statusDelivered')}</option>
                        <option value="CANCELLED">{t('seller.statusCancelled')}</option>
                      </select>
                      <button
                        onClick={handleBulkStatusChange}
                        disabled={!bulkStatus || bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {t('seller.bulkChange')}
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        {t('seller.deselectAll')}
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('seller.orderNumberHeader')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('seller.ordererHeader')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('seller.orderAmountHeader')}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('seller.orderStatusHeader')}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('seller.paymentStatusHeader')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('seller.orderDateHeader')}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('seller.detailHeader')}</th>
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
                          <td className="px-6 py-4 text-sm text-right text-gray-900">{formatPrice(order.total_amount)}{t('common.won')}</td>
                          <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={order.payment_status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800'}>
                              {order.payment_status === 'completed' ? t('seller.statusDone') : order.payment_status}
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
                  {t('seller.paginationInfo', { start: startIndex + 1, end: Math.min(endIndex, filteredOrders.length), total: filteredOrders.length })}
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
                <h2 className="text-2xl font-bold text-gray-900">{t('seller.orderDetail')}</h2>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('seller.orderInfoSection')}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.orderNumberHeader')}</p>
                      <p className="font-mono font-medium">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.orderDateHeader')}</p>
                      <p className="font-medium">
                        {formatKST(selectedOrder.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.orderStatusHeader')}</p>
                      <div>{getStatusBadge(selectedOrder.status)}</div>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.paymentStatusHeader')}</p>
                      <div>
                        <Badge className={selectedOrder.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {selectedOrder.payment_status === 'completed' ? t('seller.statusDone') : selectedOrder.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('seller.shippingInfoSection')}</h3>
                  {(() => {
                    const addr = parseShippingAddress(selectedOrder.shipping_address)
                    return (
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.recipient')}</p>
                      <p className="font-medium">{selectedOrder.shipping_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.contactNumber')}</p>
                      <p className="font-medium">{selectedOrder.shipping_phone}</p>
                    </div>
                    {addr.postal_code && (
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.postalCode')}</p>
                      <p className="font-medium">{addr.postal_code}</p>
                    </div>
                    )}
                    <div>
                      <p className="text-gray-500 mb-1">{t('seller.addressField')}</p>
                      <p className="font-medium">{addr.address1}{addr.address2 ? ` ${addr.address2}` : ''}</p>
                    </div>
                    {selectedOrder.courier && selectedOrder.tracking_number && (
                      <>
                        <div>
                          <p className="text-gray-500 mb-1">{t('seller.courierLabel')}</p>
                          <p className="font-medium">{selectedOrder.courier}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">{t('seller.trackingNumberLabel')}</p>
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('seller.orderProductsSection')}</h3>
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
                            <p className="text-sm text-gray-500 mt-1">{t('seller.quantityLabel')}: {item.quantity}{t('common.count')}</p>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              {formatPrice(item.price * item.quantity)}{t('common.won')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amount Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('seller.paymentInfoSection')}</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t('seller.totalOrderAmount')}</span>
                      <span className="text-blue-600">{formatPrice(selectedOrder.total_amount)}{t('common.won')}</span>
                    </div>
                  </div>
                </div>

                {/* Status Change */}
                {getNextStatus(selectedOrder.status) && (
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('seller.statusChangeSection')}</h3>
                    <Button
                      onClick={() => handleStatusChange(selectedOrder.order_number, getNextStatus(selectedOrder.status)!)}
                      disabled={updating}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {updating ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t('seller.processingStatus')}
                        </span>
                      ) : (
                        t('seller.changeStatusTo', { status: getStatusText(getNextStatus(selectedOrder.status)!) })
                      )}
                    </Button>
                  </div>
                )}

                {/* Tracking Number Form */}
                {selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('seller.shippingInfoInput')}</h3>
                    <form onSubmit={(e) => handleTrackingSubmit(e, selectedOrder.order_number)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('seller.courierLabel')} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={trackingForm.courier}
                          onChange={(e) => setTrackingForm({ ...trackingForm, courier: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="">{t('seller.selectCourier')}</option>
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
                          {t('seller.trackingNumberLabel')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={trackingForm.tracking_number}
                          onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })}
                          placeholder={t('seller.trackingNumberPlaceholder')}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                            {t('seller.registeringTracking')}
                          </span>
                        ) : (
                          t('seller.registerTracking')
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
                  {t('common.close')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
