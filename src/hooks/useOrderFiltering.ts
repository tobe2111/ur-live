import { useState, useMemo } from 'react'

interface OrderLike {
  id: number | string
  status: string
  order_number?: string
  created_at?: string
  shipping_name?: string
  shipping_phone?: string
  [key: string]: unknown
}

interface OrderFilters {
  status: string
  search: string
  dateStart: string
  dateEnd: string
}

/**
 * 주문 필터링/검색/페이지네이션 공통 훅
 * AdminOrdersPage, SellerOrdersPage, MyOrdersPage에서 공유
 */
export function useOrderFiltering<T extends OrderLike>(orders: T[], pageSize = 20) {
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'ALL',
    search: '',
    dateStart: '',
    dateEnd: '',
  })
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = useMemo(() => {
    let result = [...orders]

    // 상태 필터
    if (filters.status !== 'ALL') {
      result = result.filter(o => o.status?.toUpperCase() === filters.status.toUpperCase())
    }

    // 검색
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      result = result.filter(o =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.shipping_name || '').toLowerCase().includes(q) ||
        (o.shipping_phone || '').includes(q)
      )
    }

    // 날짜 필터
    if (filters.dateStart) {
      result = result.filter(o => (o.created_at || '') >= filters.dateStart)
    }
    if (filters.dateEnd) {
      result = result.filter(o => (o.created_at || '') <= filters.dateEnd + 'T23:59:59')
    }

    return result
  }, [orders, filters])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const updateFilter = (key: keyof OrderFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const resetFilters = () => {
    setFilters({ status: 'ALL', search: '', dateStart: '', dateEnd: '' })
    setCurrentPage(1)
  }

  return {
    filters,
    updateFilter,
    resetFilters,
    filtered,
    paged,
    currentPage,
    setCurrentPage,
    totalPages,
    totalCount: filtered.length,
  }
}
