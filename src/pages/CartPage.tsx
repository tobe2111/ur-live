import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import OptionSelectModal from '@/components/OptionSelectModal'
import { useCart, useUpdateCartQuantity, useRemoveFromCart, useUpdateCartOption } from '@/hooks/useCart'
import { CartHeader } from '@/components/cart/CartHeader'
import { CartItemComponent } from '@/components/cart/CartItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { EmptyCart } from '@/components/cart/EmptyCart'
import { AlertCircle, CheckCircle, X, Info, ShoppingCart } from 'lucide-react'
import type { CartItem } from '@/types/cart'
import { getCartItemPrice } from '@/types/cart'

/** 로그인 여부를 localStorage로 동기 확인 (Firebase user 기준) */
function isUserLoggedIn(): boolean {
  const userType = localStorage.getItem('user_type')
  const lastLoginUid = localStorage.getItem('lastLoginUid')
  return userType === 'user' && !!lastLoginUid
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message: string
  type?: 'alert' | 'confirm' | 'error' | 'success'
}

function CustomModal({ isOpen, onClose, onConfirm, title, message, type = 'alert' }: ModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-500" />
      case 'confirm':
        return <Info className="h-12 w-12 text-blue-500" />
      default:
        return <Info className="h-12 w-12 text-gray-400" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-[#121212] p-6 shadow-xl">
        <div className="mb-4 flex justify-center">{getIcon()}</div>
        {title && <h2 className="mb-2 text-center text-lg font-bold text-white">{title}</h2>}
        <p className="mb-6 text-center text-sm text-gray-600">{message}</p>
        <div className="flex gap-2">
          {type === 'confirm' && (
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#333] bg-[#121212] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#0A0A0A]"
            >
              취소
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm()
              onClose()
            }}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  const navigate = useNavigate()
  const loggedIn = isUserLoggedIn()

  // 비로그인 상태: 장바구니 페이지는 보여주되 로그인 유도 UI 표시
  if (!loggedIn) {
    return (
      <div className="flex flex-col bg-[#0A0A0A]">
        <div className="flex items-center justify-between border-b bg-[#121212] px-4 py-4">
          <button onClick={() => navigate(-1)} className="text-gray-600">
            <X className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold">장바구니</h1>
          <div className="w-6" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <ShoppingCart className="h-20 w-20 text-gray-300" />
          <div>
            <p className="text-lg font-semibold text-gray-100">로그인이 필요합니다</p>
            <p className="mt-2 text-sm text-gray-500">장바구니를 이용하려면 로그인해 주세요</p>
          </div>
          <button
            onClick={() => navigate(`/login?returnUrl=${encodeURIComponent('/cart')}`)}
            className="w-full max-w-xs rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            로그인하기
          </button>
          <button onClick={() => navigate('/')} className="text-sm text-gray-500 underline">
            쇼핑 계속하기
          </button>
        </div>
      </div>
    )
  }

  // 로그인된 경우: 기존 장바구니 렌더링
  return <CartPageContent />
}

function CartPageContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // 🎯 React Query 훅 사용 (refetchOnMount로 항상 최신 데이터 가져오기)
  const { data: cartData, isLoading: loading, refetch } = useCart()
  const updateQuantityMutation = useUpdateCartQuantity()
  const removeItemMutation = useRemoveFromCart()
  const updateOptionMutation = useUpdateCartOption()
  
  const cartItems = cartData?.items || []
  const [updating, setUpdating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  
  const [optionModal, setOptionModal] = useState<{
    isOpen: boolean
    cartItemId?: string | number
    productId?: string | number
    productName?: string
    currentOptionId?: number | string
    currentOptionValue?: string
  }>({
    isOpen: false,
  })

  const [modal, setModal] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'alert' | 'confirm' | 'error' | 'success'
    onConfirm?: () => void
  }>({
    isOpen: false,
    message: '',
  })

  const showAlert = (message: string, type: 'alert' | 'error' | 'success' = 'alert', title?: string) => {
    setModal({ isOpen: true, title, message, type })
  }

  const showConfirm = (message: string, onConfirm: () => void, title?: string) => {
    setModal({ isOpen: true, title, message, type: 'confirm', onConfirm })
  }

  const closeModal = () => {
    setModal({ isOpen: false, message: '' })
  }

  useEffect(() => { document.title = '장바구니 - 유어딜' }, [])

  useEffect(() => {
    // 🧹 JWT/레거시 토큰 URL 파라미터 자동 정리
    const jwtParams = ['access_token', 'refresh_token', 'userId', 'userEmail', 'userName', 'firebase_token']
    const hasJwtTokens = jwtParams.some(param => searchParams.has(param))
    
    if (hasJwtTokens) {
      console.warn('[CartPage] ⚠️ JWT 토큰 URL 파라미터 감지 - 자동 정리')
      setSearchParams(new URLSearchParams(), { replace: true })
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userEmail')
    }

    // ✅ ProtectedRoute가 /cart를 이미 보호함 → 여기서 requireLogin 불필요 (중복 리다이렉트 방지)
    // React Query가 자동으로 데이터 로딩
    refetch()
  }, [])
  
  // 🔄 장바구니 데이터 로딩 시 선택 상태 초기화
  useEffect(() => {
    if (cartItems.length > 0) {
      setSelectedIds(new Set(cartItems.map((item: CartItem) => item.id as string | number)))
      localStorage.setItem('hasCartItems', 'true')
    } else {
      localStorage.setItem('hasCartItems', 'false')
    }
  }, [cartItems])

  // ✅ loadCart 함수 삭제 - React Query가 자동 처리

  const allSelected = cartItems.length > 0 && selectedIds.size === cartItems.length

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(cartItems.map((item) => item.id as string | number)))
    }
  }, [allSelected, cartItems])

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 🎯 React Query mutation으로 수량 변경
  const updateQuantity = useCallback(async (cartItemId: number | string, delta: number) => {
    const item = cartItems.find(i => String(i.id) === String(cartItemId))
    if (!item) return

    const newQuantity = item.quantity + delta
    if (newQuantity < 1) return
    const stock = (item as any).product_stock
    if (stock !== undefined && newQuantity > stock) return
    if (updating) return

    setUpdating(true)
    try {
      await updateQuantityMutation.mutateAsync({
        itemId: String(cartItemId),
        quantity: newQuantity
      })
    } catch (error: any) {
      console.error('Failed to update quantity:', error)
      showAlert(error.response?.data?.error || '수량 변경에 실패했습니다.', 'error', '수량 변경 실패')
    } finally {
      setUpdating(false)
    }
  }, [cartItems, updating, updateQuantityMutation])

  // 🎯 React Query mutation으로 아이템 삭제
  const removeItem = useCallback(async (cartItemId: number | string) => {
    if (updating) return

    showConfirm(
      '이 상품을 장바구니에서 삭제하시겠습니까?',
      async () => {
        setUpdating(true)
        try {
          await removeItemMutation.mutateAsync(String(cartItemId))
          showAlert('상품이 삭제되었습니다.', 'success', '삭제 완료')
        } catch (error: any) {
          console.error('Failed to remove item:', error)
          showAlert(error.response?.data?.error || '상품 삭제에 실패했습니다.', 'error', '삭제 실패')
        } finally {
          setUpdating(false)
        }
      },
      '상품 삭제'
    )
  }, [updating, removeItemMutation])

  const openOptionModal = (item: CartItem) => {
    setOptionModal({
      isOpen: true,
      cartItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      currentOptionId: item.option_id,
      currentOptionValue: item.option_value,
    })
  }

  const closeOptionModal = () => {
    setOptionModal({ isOpen: false })
  }

  // 🎯 React Query mutation으로 옵션 변경
  const handleOptionChange = async (optionId: number, optionValue: string) => {
    if (!optionModal.cartItemId || updating) return

    setUpdating(true)
    try {
      await updateOptionMutation.mutateAsync({
        itemId: String(optionModal.cartItemId),
        optionId
      })
      showAlert('옵션이 변경되었습니다.', 'success', '변경 완료')
    } catch (error: any) {
      console.error('Failed to change option:', error)
      showAlert(error.response?.data?.error || '옵션 변경에 실패했습니다.', 'error', '변경 실패')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return

    showConfirm(
      `선택한 ${selectedIds.size}개의 상품을 삭제하시겠습니까?`,
      async () => {
        setUpdating(true)
        try {
          // 🎯 병렬 삭제로 성능 개선
          await Promise.all(
            Array.from(selectedIds).map(id => 
              removeItemMutation.mutateAsync(String(id))
            )
          )
          showAlert('선택한 상품이 삭제되었습니다.', 'success', '삭제 완료')
        } catch (error: any) {
          console.error('Failed to delete selected:', error)
          showAlert(error.response?.data?.error || '상품 삭제에 실패했습니다.', 'error', '삭제 실패')
        } finally {
          setUpdating(false)
        }
      },
      '선택 삭제'
    )
  }, [selectedIds, removeItemMutation])

  const { totalItems, subtotal, shippingFee } = useMemo(() => {
    let count = 0
    let sum = 0
    
    // 선택된 상품들
    const selectedItems = cartItems.filter(item => selectedIds.has(item.id))
    
    // 셀러별로 그룹화
    const sellerGroups = selectedItems.reduce((groups, item) => {
      const sellerId = item.seller_id || 0
      if (!groups[sellerId]) {
        groups[sellerId] = {
          items: [],
          subtotal: 0,
          shipping_fee: item.shipping_fee || 3000,
          free_shipping_threshold: item.free_shipping_threshold || 0,
        }
      }
      groups[sellerId].items.push(item)
      groups[sellerId].subtotal += (getCartItemPrice(item) * item.quantity)
      return groups
    }, {} as Record<string | number, {
      items: any[]
      subtotal: number
      shipping_fee: number
      free_shipping_threshold: number
    }>)
    
    // 전체 상품 개수 및 소계 계산
    for (const item of selectedItems) {
      count += item.quantity
      sum += (getCartItemPrice(item) * item.quantity)
    }
    
    // 셀러별 배송비 계산
    const totalShippingFee = Object.values(sellerGroups).reduce((total, group) => {
      // 무료배송 기준액이 설정되어 있고, 해당 셀러의 소계가 기준액 이상이면 배송비 0원
      if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) {
        return total
      }
      return total + group.shipping_fee
    }, 0)
    
    return { totalItems: count, subtotal: sum, shippingFee: totalShippingFee }
  }, [cartItems, selectedIds])

  const total = subtotal + shippingFee

  const handleCheckout = () => {
    if (selectedIds.size === 0) {
      showAlert('상품을 선택해주세요.', 'alert', '알림')
      return
    }

    // 토스 SDK 프리로드 (체크아웃 진입 전)
    import('@tosspayments/tosspayments-sdk').catch(() => {})
    const selectedItems = cartItems.filter(item => selectedIds.has(item.id))
    navigate('/checkout', { 
      state: { 
        cartItems: selectedItems,
        fromCart: true
      } 
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-900 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-[#0A0A0A]">
      {/* 🎯 분리된 Header 컴포넌트 */}
      <CartHeader
        itemCount={cartItems.length}
        allSelected={allSelected}
        selectedCount={selectedIds.size}
        onToggleSelectAll={toggleSelectAll}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* 🎯 Empty State 또는 Cart Items */}
      {cartItems.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          {/* Cart Items */}
          <div className="flex-1 p-4 space-y-3">
            {cartItems.map((item) => (
              <CartItemComponent
                key={item.id}
                item={item as any}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={toggleSelect}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onOpenOption={openOptionModal}
                isUpdating={updating}
              />
            ))}
          </div>

          {/* 🎯 분리된 Summary 컴포넌트 */}
          <div className="sticky bottom-0 bg-[#121212] border-t border-[#1A1A1A] p-4 space-y-4">
            <CartSummary
              totalItems={totalItems}
              subtotal={subtotal}
              shippingFee={shippingFee}
              total={total}
            />
            
            <button
              onClick={handleCheckout}
              disabled={selectedIds.size === 0 || updating}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {selectedIds.size === 0 ? '상품을 선택해주세요' : `${totalItems}개 상품 주문하기`}
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <OptionSelectModal
        isOpen={optionModal.isOpen}
        onClose={closeOptionModal}
        productId={optionModal.productId as number}
        productName={optionModal.productName as string}
        currentOptionId={optionModal.currentOptionId as number | undefined}
        currentOptionValue={optionModal.currentOptionValue}
        onOptionSelected={handleOptionChange}
      />
    </div>
  )
}
