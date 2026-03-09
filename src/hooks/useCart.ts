import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CartItem {
  id: string
  product_id: string
  product_name: string
  product_image: string
  price: number
  quantity: number
  selected_options?: string[]
  stock_quantity?: number
}

export interface Cart {
  items: CartItem[]
  total_price: number
  total_quantity: number
}

// 🎯 장바구니 조회 Hook
export function useCart() {
  return useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      console.log('[useCart] 🛒 장바구니 데이터 조회 중...')
      const response = await api.get('/api/cart')
      console.log('[useCart] 📡 API 전체 응답:', response)
      console.log('[useCart] 📡 response.data:', response.data)
      console.log('[useCart] 📡 response.data.data:', response.data.data)
      console.log('[useCart] 📡 response.data.items:', response.data.items)
      
      // ✅ API 응답 구조 확인 후 올바른 경로 반환
      const cartData = response.data.data || response.data
      console.log('[useCart] ✅ 최종 장바구니 데이터:', cartData)
      console.log('[useCart] ✅ items 배열:', cartData?.items)
      console.log('[useCart] ✅ items 길이:', cartData?.items?.length)
      
      return cartData as Cart
    },
    staleTime: 0, // ✅ 항상 최신 데이터 가져오기 (캐시 사용 안 함)
    gcTime: 5 * 60 * 1000,   // 5분 후 메모리 해제
    refetchOnMount: 'always', // ✅ 컴포넌트 마운트 시 항상 새로고침
    refetchOnWindowFocus: true, // ✅ 윈도우 포커스 시 새로고침
  })
}

// 🎯 장바구니에 상품 추가 (낙관적 업데이트)
export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { product_id: string; quantity?: number; options?: string[] }) => {
      const response = await api.post('/api/cart', payload)
      return response.data
    },

    // 낙관적 업데이트: 서버 응답 전에 UI 먼저 업데이트
    onMutate: async (payload) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['cart'] })
      
      // 이전 데이터 백업 (롤백용)
      const previousCart = queryClient.getQueryData<Cart>(['cart'])
      
      // 낙관적 업데이트
      queryClient.setQueryData<Cart>(['cart'], (old) => {
        if (!old) return old
        
        return {
          ...old,
          items: [
            ...old.items,
            {
              id: `temp-${Date.now()}`,
              product_id: payload.product_id,
              product_name: 'Loading...',
              product_image: '',
              price: 0,
              quantity: payload.quantity || 1,
              selected_options: payload.options,
            },
          ],
          total_quantity: old.total_quantity + (payload.quantity || 1),
        }
      })
      
      return { previousCart }
    },

    // 에러 발생 시 롤백
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart)
      }
      console.error('❌ 장바구니 추가 실패:', err)
    },

    // 성공 시 서버 데이터로 갱신
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

// 🎯 장바구니 수량 변경
export function useUpdateCartQuantity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await api.patch(`/api/cart/${itemId}`, { quantity })
      return response.data
    },

    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] })
      const previousCart = queryClient.getQueryData<Cart>(['cart'])

      queryClient.setQueryData<Cart>(['cart'], (old) => {
        if (!old) return old

        return {
          ...old,
          items: old.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          ),
        }
      })

      return { previousCart }
    },

    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

// 🎯 장바구니 아이템 삭제
export function useRemoveFromCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await api.delete(`/api/cart/${itemId}`)
      return response.data
    },

    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] })
      const previousCart = queryClient.getQueryData<Cart>(['cart'])

      queryClient.setQueryData<Cart>(['cart'], (old) => {
        if (!old) return old

        return {
          ...old,
          items: old.items.filter((item) => item.id !== itemId),
        }
      })

      return { previousCart }
    },

    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

// 🎯 장바구니 전체 비우기
export function useClearCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete('/api/cart')
      return response.data
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

// 🎯 장바구니 옵션 변경
export function useUpdateCartOption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, optionId }: { itemId: string; optionId: number }) => {
      const response = await api.put(`/api/cart/${itemId}`, { option_id: optionId })
      return response.data
    },

    onMutate: async ({ itemId, optionId }) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] })
      const previousCart = queryClient.getQueryData<Cart>(['cart'])

      queryClient.setQueryData<Cart>(['cart'], (old) => {
        if (!old) return old

        return {
          ...old,
          items: old.items.map((item) =>
            item.id === itemId ? { ...item, option_id: optionId } : item
          ),
        }
      })

      return { previousCart }
    },

    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart)
      }
      console.error('❌ 옵션 변경 실패:', err)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
