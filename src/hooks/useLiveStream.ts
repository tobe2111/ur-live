import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface LiveStream {
  id: string
  title: string
  seller_name: string
  viewer_count: number
  status: 'live' | 'ended' | 'scheduled'
  thumbnail_url?: string
  stream_url?: string
  scheduled_at?: string
}

export interface StreamProduct {
  id: string
  name: string
  price: number
  image_url: string
  stock: number
}

// 🎯 라이브 스트림 목록 조회
export function useLiveStreams() {
  return useQuery({
    queryKey: ['live-streams'],
    queryFn: async () => {
      const response = await api.get('/api/streams')
      return response.data.data.streams as LiveStream[]
    },
    staleTime: 30 * 1000, // 30초마다 갱신 (실시간성)
    refetchInterval: 30 * 1000, // 자동 폴링
  })
}

// 🎯 특정 스트림 상세 조회
export function useLiveStream(streamId: string | undefined) {
  return useQuery({
    queryKey: ['live-stream', streamId],
    queryFn: async () => {
      if (!streamId) throw new Error('Stream ID is required')
      const response = await api.get(`/api/streams/${streamId}`)
      return response.data.data.stream as LiveStream
    },
    enabled: !!streamId,
    staleTime: 10 * 1000, // 10초마다 갱신
    refetchInterval: 10 * 1000,
  })
}

// 🎯 스트림 상품 목록 조회
export function useStreamProducts(streamId: string | undefined) {
  return useQuery({
    queryKey: ['stream-products', streamId],
    queryFn: async () => {
      if (!streamId) throw new Error('Stream ID is required')
      const response = await api.get(`/api/streams/${streamId}/products`)
      return response.data.data.products as StreamProduct[]
    },
    enabled: !!streamId,
    staleTime: 1 * 60 * 1000, // 1분간 캐시
  })
}

// 🎯 장바구니 추가 Mutation
export function useAddToCart() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: { productId: string; quantity: number; streamId?: string }) => {
      const response = await api.post('/api/cart', data)
      return response
    },
    onSuccess: () => {
      // 장바구니 캐시 무효화 (자동 재조회)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

// 🎯 현재 상품 변경 Mutation
export function useChangeCurrentProduct() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: { streamId: string; productId: string }) => {
      const response = await api.post(`/api/seller/streams/${data.streamId}/change-product`, {
        product_id: data.productId
      })
      return response
    },
    onSuccess: (_, variables) => {
      // 스트림 상세 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['live-stream', variables.streamId] })
    },
  })
}

// 🎯 라이브 스트림 전체 데이터 병렬 조회 (LivePageV2용 최적화)
export function useLiveStreamData(streamId: string | undefined) {
  const stream = useLiveStream(streamId)
  const products = useStreamProducts(streamId)
  
  return {
    stream: stream.data,
    products: products.data || [],
    isLoading: stream.isLoading || products.isLoading,
    isError: stream.isError || products.isError,
    error: stream.error || products.error,
  }
}
