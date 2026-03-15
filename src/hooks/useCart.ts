import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CartItem, Cart } from '@/types/cart'
import { getCartItemPrice } from '@/types/cart'

// ✅ 공통 타입 re-export (하위 호환성 유지)
export type { CartItem, Cart } from '@/types/cart'

// 🎯 장바구니 조회 Hook
export function useCart() {
  return useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      console.log('[useCart] 🛒 장바구니 데이터 조회 중...')
      const response = await api.get('/api/cart')
      console.log('[useCart] 📡 API 전체 응답:', JSON.stringify(response.data, null, 2))
      
      // ✅ API 응답 구조 파싱
      let items: CartItem[] = []
      
      // Case 1: {success: true, data: Array} → 표준 응답 구조
      if (response.data?.success && response.data?.data && Array.isArray(response.data.data)) {
        console.log('[useCart] 📦 Case 1: Standard API response {success:true, data:Array}')
        items = response.data.data
      } 
      // Case 2: {items: Array, ...} → 직접 items 필드
      else if (response.data?.items && Array.isArray(response.data.items)) {
        console.log('[useCart] 📦 Case 2: Direct items field')
        items = response.data.items
      } 
      // Case 3: response.data 자체가 Array
      else if (Array.isArray(response.data)) {
        console.log('[useCart] 📦 Case 3: response.data is Array')
        items = response.data
      }
      // Case 4: response.data.data만 존재
      else if (response.data?.data && Array.isArray(response.data.data)) {
        console.log('[useCart] 📦 Case 4: Nested data field')
        items = response.data.data
      }
      else {
        console.warn('[useCart] ⚠️ Unknown cart structure, using empty array')
        items = []
      }
      
      // 총 금액 계산 (price_snapshot 우선, 없으면 price)
      const total_price = items.reduce((sum, item) => sum + (getCartItemPrice(item) * item.quantity), 0)
      const total_quantity = items.reduce((sum, item) => sum + item.quantity, 0)
      
      const cartData: Cart = {
        items,
        total_price,
        total_quantity
      }
      
      console.log('[useCart] ✅ 최종 장바구니 데이터:', {
        items_count: cartData.items.length,
        total_price: cartData.total_price,
        total_quantity: cartData.total_quantity,
        first_item: cartData.items[0]
      })
      
      return cartData
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
      // ✅ BUG #6 FIX: Server exposes PUT /api/cart/:id, not PATCH.
      // Using api.patch() here resulted in 404/405 errors on every quantity change.
      const response = await api.put(`/api/cart/${itemId}`, { quantity })
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
// ✅ BUG #13 FIX: The server exposes POST /api/cart/clear, not DELETE /api/cart.
// api.delete('/api/cart') returned 404 because no such route exists.
export function useClearCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/cart/clear')
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
