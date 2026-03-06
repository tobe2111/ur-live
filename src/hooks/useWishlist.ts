import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Product } from './useProduct'

export interface WishlistItem {
  id: string
  product_id: string
  product: Product
  added_at: string
}

// 🎯 위시리스트 조회 Hook
export function useWishlist() {
  return useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const response = await api.get('/api/wishlist')
      return response.data.data.items as WishlistItem[]
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시
    gcTime: 30 * 60 * 1000,   // 30분 후 메모리 해제
  })
}

// 🎯 위시리스트 토글 (추가/제거) - 낙관적 업데이트
export function useToggleWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId: string) => {
      const response = await api.post('/api/wishlist/toggle', { product_id: productId })
      return response.data
    },

    // 낙관적 업데이트
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist'] })
      const previousWishlist = queryClient.getQueryData<WishlistItem[]>(['wishlist'])

      queryClient.setQueryData<WishlistItem[]>(['wishlist'], (old) => {
        if (!old) return old

        // 이미 있으면 제거, 없으면 추가
        const exists = old.find((item) => item.product_id === productId)
        if (exists) {
          return old.filter((item) => item.product_id !== productId)
        } else {
          return [
            ...old,
            {
              id: `temp-${Date.now()}`,
              product_id: productId,
              product: {} as Product, // 실제 데이터는 서버에서 받음
              added_at: new Date().toISOString(),
            },
          ]
        }
      })

      return { previousWishlist }
    },

    onError: (err, variables, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(['wishlist'], context.previousWishlist)
      }
      console.error('❌ 위시리스트 토글 실패:', err)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
    },
  })
}

// 🎯 위시리스트에서 상품 제거
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId: string) => {
      const response = await api.delete(`/api/wishlist/${productId}`)
      return response.data
    },

    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist'] })
      const previousWishlist = queryClient.getQueryData<WishlistItem[]>(['wishlist'])

      queryClient.setQueryData<WishlistItem[]>(['wishlist'], (old) => {
        if (!old) return old
        return old.filter((item) => item.product_id !== productId)
      })

      return { previousWishlist }
    },

    onError: (err, variables, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(['wishlist'], context.previousWishlist)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
    },
  })
}

// 🎯 위시리스트 전체 비우기
export function useClearWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete('/api/wishlist')
      return response.data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
    },
  })
}

// 🎯 특정 상품이 위시리스트에 있는지 확인 (헬퍼 함수)
export function useIsInWishlist(productId: string) {
  const { data: wishlist } = useWishlist()
  return wishlist?.some((item) => item.product_id === productId) ?? false
}
