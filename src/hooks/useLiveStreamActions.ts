import { useState, useCallback } from 'react'
import { useAddToCart, useChangeCurrentProduct } from './useLiveStream'

export interface LiveStreamActions {
  handleAddToCart: (productId: string, quantity?: number) => Promise<void>
  handleChangeProduct: (streamId: string, productId: string) => Promise<void>
  isAddingToCart: boolean
  isChangingProduct: boolean
}

// 🎯 라이브 스트림 액션 관리 Hook
export function useLiveStreamActions(streamId: string): LiveStreamActions {
  const addToCart = useAddToCart()
  const changeProduct = useChangeCurrentProduct()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isChangingProduct, setIsChangingProduct] = useState(false)

  const handleAddToCart = useCallback(async (productId: string, quantity: number = 1) => {
    try {
      setIsAddingToCart(true)
      await addToCart.mutateAsync({ productId, quantity, streamId })
    } catch (error) {
      console.error('❌ 장바구니 추가 실패:', error)
      throw error
    } finally {
      setIsAddingToCart(false)
    }
  }, [addToCart, streamId])

  const handleChangeProduct = useCallback(async (streamId: string, productId: string) => {
    try {
      setIsChangingProduct(true)
      await changeProduct.mutateAsync({ streamId, productId })
    } catch (error) {
      console.error('❌ 상품 변경 실패:', error)
      throw error
    } finally {
      setIsChangingProduct(false)
    }
  }, [changeProduct])

  return {
    handleAddToCart,
    handleChangeProduct,
    isAddingToCart,
    isChangingProduct,
  }
}
