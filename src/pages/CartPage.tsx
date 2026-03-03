import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Minus, Plus, X, ChevronLeft, AlertCircle, CheckCircle, Settings } from 'lucide-react'
import { requireLogin, getUserId, isLoggedIn } from '@/utils/auth'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import OptionSelectModal from '@/components/OptionSelectModal'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url?: string
  quantity: number
  price_snapshot: number
  option_id?: number
  option_value?: string
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

  const isConfirm = type === 'confirm'
  const isError = type === 'error'
  const isSuccess = type === 'success'

  const getIcon = () => {
    if (isSuccess) return <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={1.5} />
    if (isError) return <AlertCircle className="w-12 h-12 text-red-500" strokeWidth={1.5} />
    return <AlertCircle className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          {getIcon()}
        </div>

        {title && (
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
            {title}
          </h3>
        )}

        <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
          {message}
        </p>

        <div className={`flex gap-3 ${isConfirm ? 'flex-row' : 'flex-col'}`}>
          {isConfirm ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onConfirm?.()
                  onClose()
                }}
                className="flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm"
              >
                확인
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  
  const [optionModal, setOptionModal] = useState<{
    isOpen: boolean
    cartItemId?: number
    productId?: number
    productName?: string
    currentOptionId?: number
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
    setModal({
      isOpen: true,
      title,
      message,
      type,
    })
  }

  const showConfirm = (message: string, onConfirm: () => void, title?: string) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
    })
  }

  const closeModal = () => {
    setModal({
      isOpen: false,
      message: '',
    })
  }

  useEffect(() => {
    // 🧹 JWT/레거시 토큰 URL 파라미터 자동 정리
    const jwtParams = ['access_token', 'refresh_token', 'userId', 'userEmail', 'userName', 'firebase_token']
    const hasJwtTokens = jwtParams.some(param => searchParams.has(param))
    
    if (hasJwtTokens) {
      console.warn('[CartPage] ⚠️ JWT 토큰 URL 파라미터 감지 - 자동 정리')
      setSearchParams(new URLSearchParams(), { replace: true })
      
      // localStorage 정리
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userEmail')
      
      console.log('[CartPage] ✅ JWT 파라미터 정리 완료')
    }
    
    loadCart()
  }, [])

  async function loadCart() {
    try {
      if (!isLoggedIn()) {
        requireLogin(navigate, '장바구니를 보려면 로그인이 필요합니다.')
        return
      }
      
      const userId = getUserId()
      if (!userId) {
        requireLogin(navigate, '장바구니를 보려면 로그인이 필요합니다.')
        return
      }

      const response = await api.get(`/api/cart`)
      const items = response.data?.data || []
      setCartItems(items)
      setSelectedIds(new Set(items.map((item: CartItem) => item.id)))
      
      localStorage.setItem('hasCartItems', items.length > 0 ? 'true' : 'false')
    } catch (error) {
      console.error('Failed to load cart:', error)
      showAlert('장바구니를 불러오는데 실패했습니다.', 'error', '오류')
    } finally {
      setLoading(false)
    }
  }

  const allSelected = cartItems.length > 0 && selectedIds.size === cartItems.length

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(cartItems.map((item) => item.id)))
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

  async function updateQuantity(cartItemId: number, delta: number) {
    const item = cartItems.find(i => i.id === cartItemId)
    if (!item) return
    
    const newQuantity = item.quantity + delta
    if (newQuantity < 1) return
    if (updating) return

    setUpdating(true)
    try {
      await api.put(`/api/cart/${cartItemId}`, { quantity: newQuantity })
      await loadCart()
    } catch (error: any) {
      console.error('Failed to update quantity:', error)
      showAlert(
        error.response?.data?.error || '수량 변경에 실패했습니다.',
        'error',
        '수량 변경 실패'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function removeItem(cartItemId: number) {
    if (updating) return

    showConfirm(
      '이 상품을 장바구니에서 삭제하시겠습니까?',
      async () => {
        setUpdating(true)
        try {
          await api.delete(`/api/cart/${cartItemId}`)
          await loadCart()
          showAlert('상품이 삭제되었습니다.', 'success', '삭제 완료')
        } catch (error: any) {
          console.error('Failed to remove item:', error)
          showAlert(
            error.response?.data?.error || '상품 삭제에 실패했습니다.',
            'error',
            '삭제 실패'
          )
        } finally {
          setUpdating(false)
        }
      },
      '상품 삭제'
    )
  }

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

  const handleOptionChange = async (optionId: number, optionValue: string) => {
    if (!optionModal.cartItemId || updating) return

    setUpdating(true)
    try {
      await api.put(`/api/cart/${optionModal.cartItemId}`, { option_id: optionId })
      await loadCart()
      showAlert('옵션이 변경되었습니다.', 'success', '변경 완료')
    } catch (error: any) {
      console.error('Failed to change option:', error)
      showAlert(
        error.response?.data?.error || '옵션 변경에 실패했습니다.',
        'error',
        '변경 실패'
      )
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
          for (const id of selectedIds) {
            await api.delete(`/api/cart/${id}`)
          }
          await loadCart()
          showAlert('선택한 상품이 삭제되었습니다.', 'success', '삭제 완료')
        } catch (error: any) {
          console.error('Failed to delete selected:', error)
          showAlert(
            error.response?.data?.error || '상품 삭제에 실패했습니다.',
            'error',
            '삭제 실패'
          )
        } finally {
          setUpdating(false)
        }
      },
      '선택 삭제'
    )
  }, [selectedIds])

  const { totalItems, subtotal } = useMemo(() => {
    let count = 0
    let sum = 0
    for (const item of cartItems) {
      if (selectedIds.has(item.id)) {
        count += item.quantity
        sum += item.price_snapshot * item.quantity
      }
    }
    return { totalItems: count, subtotal: sum }
  }, [cartItems, selectedIds])

  const shippingFee = subtotal >= 100000 ? 0 : 3000
  const total = subtotal + shippingFee

  const formatNumber = (n: number): string => {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  const handleCheckout = () => {
    if (selectedIds.size === 0) {
      showAlert('상품을 선택해주세요.', 'alert', '알림')
      return
    }

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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-900 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center text-gray-900"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="text-base font-bold tracking-tight text-gray-900">
          장바구니
        </h1>
        <div className="h-8 w-8" aria-hidden="true" />
      </header>

      {/* Select All / Delete Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            className="h-[18px] w-[18px] rounded-full border-gray-400 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
          />
          <span className="text-xs font-medium text-gray-900">
            전체선택
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="text-xs font-medium text-gray-600 underline-offset-2 transition-colors hover:text-gray-900 hover:underline"
          >
            선택 삭제
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-sm text-gray-500">
              장바구니가 비어있습니다.
            </p>
          </div>
        ) : (
          <div>
            {cartItems.map((item, index) => (
              <div key={item.id}>
                {/* Cart Item */}
                <div className="relative flex items-start gap-3 py-5 px-4">
                  {/* Checkbox */}
                  <div className="flex items-center pt-4">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="h-[18px] w-[18px] rounded-full border-gray-400 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          {item.option_value ? '옵션: ' + item.option_value : '일반 상품'}
                        </p>
                        <p className="mt-0.5 text-sm font-bold leading-snug text-gray-900 truncate">
                          {item.product_name}
                        </p>
                        {item.image_url && (
                          <img 
                            src={item.image_url} 
                            alt={item.product_name}
                            className="mt-2 w-16 h-16 object-cover rounded"
                          />
                        )}
                        
                        {/* 옵션 변경 버튼 */}
                        <button
                          onClick={() => openOptionModal(item)}
                          disabled={updating}
                          className="mt-2 flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                        >
                          <Settings className="h-3 w-3" strokeWidth={1.5} />
                          <span className="font-medium">옵션 변경</span>
                        </button>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={updating}
                        className="absolute top-5 right-4 flex h-5 w-5 items-center justify-center text-gray-400 transition-colors hover:text-gray-900 disabled:opacity-50"
                        aria-label={`Remove ${item.product_name}`}
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    {/* Quantity & Price Row */}
                    <div className="mt-2 flex items-center justify-between">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-0 border border-gray-200 rounded">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={item.quantity <= 1 || updating}
                          className="flex h-7 w-7 items-center justify-center text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-30"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                        <span className="flex h-7 w-7 items-center justify-center text-xs font-medium text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={updating}
                          className="flex h-7 w-7 items-center justify-center text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>

                      {/* Price */}
                      <p className="text-sm font-bold tracking-tight text-gray-900">
                        {formatNumber(item.price_snapshot * item.quantity)}
                        <span className="text-xs font-medium ml-0.5">원</span>
                      </p>
                    </div>
                  </div>
                </div>

                {index < cartItems.length - 1 && (
                  <Separator className="mx-4 w-auto" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary + CTA */}
      {cartItems.length > 0 && (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white">
          {/* Summary */}
          <div className="border-t border-gray-200 bg-white px-4 py-5">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wide text-gray-500">
                  전체 상품
                </span>
                <span className="text-xs font-medium text-gray-900">
                  {totalItems}개
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wide text-gray-500">
                  상품가
                </span>
                <span className="text-xs font-medium text-gray-900">
                  {formatNumber(subtotal)}
                  <span className="ml-0.5">원</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wide text-gray-500">
                  배송비
                </span>
                <span className="text-xs font-medium text-gray-900">
                  {shippingFee === 0 ? "무료" : formatNumber(shippingFee) + "원"}
                </span>
              </div>
            </div>

            <div className="my-4 h-[1px] bg-gray-200" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tracking-wide text-gray-900">
                총 합계
              </span>
              <span className="text-lg font-bold tracking-tight text-gray-900">
                {formatNumber(total)}
                <span className="text-xs font-medium ml-0.5">원</span>
              </span>
            </div>
          </div>

          {/* Order Button */}
          <div className="px-4 pb-6">
            <button
              onClick={handleCheckout}
              disabled={selectedIds.size === 0 || updating}
              className="w-full rounded-md bg-gray-900 py-4 text-sm font-bold tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              주문하기
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Option Select Modal */}
      <OptionSelectModal
        isOpen={optionModal.isOpen}
        onClose={closeOptionModal}
        productId={optionModal.productId!}
        productName={optionModal.productName || ''}
        currentOptionId={optionModal.currentOptionId}
        currentOptionValue={optionModal.currentOptionValue}
        onOptionSelected={handleOptionChange}
      />
    </div>
  )
}
