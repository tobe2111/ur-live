import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Order, OrderStatus, RefundRequest } from '@/types/order'

// 🎯 주문 상세 조회 + 실시간 추적
export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required')
      const response = await api.get(`/api/orders/${orderId}`)
      return response.data.data.order as Order
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,      // 30초마다 재조회
    refetchInterval: 30 * 1000, // 자동 폴링 (실시간 추적)
  })
}

// 🎯 내 주문 목록 조회
export function useMyOrders(params?: { status?: OrderStatus; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['my-orders', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())

      const url = `/api/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await api.get(url)
      return response.data.data.orders as Order[]
    },
    staleTime: 2 * 60 * 1000, // 2분간 캐시
  })
}

// 🎯 주문 취소 Mutation
export function useCancelOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post(`/api/orders/${orderId}/cancel`)
      return response.data
    },
    onSuccess: (_, orderId) => {
      // 해당 주문 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
    },
  })
}

// 🎯 환불 요청 Mutation
export function useRequestRefund() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: RefundRequest) => {
      const response = await api.post('/api/orders/refund', request)
      return response.data
    },
    onSuccess: (_, request) => {
      queryClient.invalidateQueries({ queryKey: ['order', request.order_id] })
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
    },
  })
}

// 🎯 배송 조회 (배송 중인 주문만)
export function useShippingOrders() {
  return useQuery({
    queryKey: ['shipping-orders'],
    queryFn: async () => {
      const response = await api.get('/api/orders?status=shipping')
      return response.data.data.orders as Order[]
    },
    staleTime: 1 * 60 * 1000,      // 1분간 캐시
    refetchInterval: 1 * 60 * 1000, // 1분마다 자동 갱신
  })
}
