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
import { formatNumber } from '@/utils/format'
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
import OrderDetailModal from './seller-orders/OrderDetailModal'
import { StatusBadge, useStatusText, nextStatusOf } from './seller-orders/statusHelpers'
import type { Order } from './seller-orders/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / parseShippingAddress / status 헬퍼 / 주문 상세 모달
//   을 ./seller-orders/ 디렉토리로 추출.

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

  // 🛡️ status 헬퍼 / formatPrice 는 ./seller-orders/statusHelpers 로 이동.
  const getStatusText = useStatusText()

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
                          <td className="px-6 py-4 text-sm text-right text-gray-900">{formatNumber(order.total_amount)}{t('common.won')}</td>
                          <td className="px-6 py-4 text-center"><StatusBadge status={order.status} /></td>
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

      {/* Order Detail Modal — extracted to ./seller-orders/OrderDetailModal */}
      {showDetail && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          updating={updating}
          trackingForm={trackingForm}
          onTrackingFormChange={setTrackingForm}
          onClose={() => setShowDetail(false)}
          onStatusChange={handleStatusChange}
          onTrackingSubmit={handleTrackingSubmit}
        />
      )}
    </SellerLayout>
  )
}
