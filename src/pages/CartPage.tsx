import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import OptionSelectModal from '@/components/OptionSelectModal'
import { useCart, useUpdateCartQuantity, useRemoveFromCart, useUpdateCartOption } from '@/hooks/useCart'
import { CartHeader } from '@/components/cart/CartHeader'
import { CartItemComponent } from '@/components/cart/CartItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { EmptyCart } from '@/components/cart/EmptyCart'
import { ShoppingCart, ChevronRight, Store, X } from 'lucide-react'
import type { CartItem } from '@/types/cart'
import { getCartItemPrice } from '@/types/cart'
import { formatNumber } from '@/utils/format'
import CustomModal from './cart/CustomModal'

// 🛡️ 2026-05-02: TD-018 분할 — CustomModal 을 ./cart/CustomModal 로 추출.
//   CustomModal 내부에서 쓰던 lucide 아이콘 (AlertCircle, CheckCircle, Info) 은
//   해당 파일로 이동. 본체에서 X 아이콘은 헤더 닫기 버튼에서 계속 사용.

/** 로그인 여부를 localStorage로 동기 확인 (Firebase user 기준) */
function isUserLoggedIn(): boolean {
  return localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')
}

export default function CartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const loggedIn = isUserLoggedIn()

  // 비로그인 상태: v4 clean white design
  if (!loggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#0A0A0A]">
        <SEO title={t('cart.seoTitle')} description={t('cart.seoDesc')} url="/cart" noindex />
        <div className="sticky top-0 z-10 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="ur-content-narrow flex items-center justify-between px-4 py-3">
            <button type="button" onClick={() => navigate(-1)} aria-label={t('notifications.back')} className="w-9 h-9 flex items-center justify-center">
              <X className="h-5 w-5 text-gray-900 dark:text-white" aria-hidden="true" />
            </button>
            <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white">{t('cart.title')}</h1>
            <div className="w-9" />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="w-20 h-20 bg-gray-50 dark:bg-[#121212] rounded-full flex items-center justify-center">
            <ShoppingCart className="h-10 w-10 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[16px] font-bold text-gray-900 dark:text-white">{t('common.loginRequired')}</p>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">{t('cart.loginRequired')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/login?returnUrl=${encodeURIComponent('/cart')}`)}
            className="w-full max-w-xs rounded-xl bg-gray-900 py-3.5 text-[14px] font-bold text-white hover:bg-gray-800 active:scale-[0.98] transition-all"
          >
            {t('common.loginButton')}
          </button>
          <button onClick={() => navigate('/')} className="text-[13px] text-gray-500 dark:text-gray-400 underline">
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
  const { t } = useTranslation()
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

  useEffect(() => { document.title = t('cart.docTitle') }, [t])

  useEffect(() => {
    // 🧹 JWT/레거시 토큰 URL 파라미터 자동 정리
    const jwtParams = ['access_token', 'refresh_token', 'userId', 'userEmail', 'userName', 'firebase_token']
    const hasJwtTokens = jwtParams.some(param => searchParams.has(param))

    if (hasJwtTokens) {
      if (import.meta.env.DEV) console.warn('[CartPage] ⚠️ JWT 토큰 URL 파라미터 감지 - 자동 정리')
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
  // ✅ UX H14 FIX: localStorage hasCartItems 제거 (React Query 캐시가 신뢰 가능 소스)
  useEffect(() => {
    if (cartItems.length > 0) {
      setSelectedIds(new Set(cartItems.map((item: CartItem) => item.id as string | number)))
    }
  }, [cartItems])

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
    const stock = item.product_stock
    if (stock !== undefined && stock !== null && newQuantity > stock) return
    if (updating) return

    setUpdating(true)
    try {
      await updateQuantityMutation.mutateAsync({
        itemId: String(cartItemId),
        quantity: newQuantity
      })
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to update quantity:', error)
      const msg = error instanceof Error ? error.message : t('cart.quantityChangeFailed')
      showAlert(msg, 'error', t('cart.qtyChangeFailedTitle'))
    } finally {
      setUpdating(false)
    }
  }, [cartItems, updating, updateQuantityMutation])

  // 🎯 React Query mutation으로 아이템 삭제
  const removeItem = useCallback(async (cartItemId: number | string) => {
    if (updating) return

    showConfirm(
      t('cart.deleteConfirmMsg'),
      async () => {
        setUpdating(true)
        try {
          await removeItemMutation.mutateAsync(String(cartItemId))
          showAlert(t('cart.deleteConfirmTitle'), 'success', t('cart.deleteConfirmTitle'))
        } catch (error: unknown) {
          if (import.meta.env.DEV) console.error('Failed to remove item:', error)
          const msg = error instanceof Error ? error.message : t('cart.deleteFailed')
          showAlert(msg, 'error', t('cart.deleteFailed'))
        } finally {
          setUpdating(false)
        }
      },
      t('cart.deleteConfirmTitle')
    )
  }, [updating, removeItemMutation, t, showAlert, showConfirm])

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
      showAlert(t('cart.optionChangedMsg'), 'success', t('cart.changeCompleteTitle'))
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to change option:', error)
      const msg = error instanceof Error ? error.message : t('cart.optionChangeFailed')
      showAlert(msg, 'error', t('cart.changeFailedTitle'))
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
          showAlert(t('cart.deleteSelected'), 'success', t('cart.deleteSelected'))
        } catch (error: unknown) {
          if (import.meta.env.DEV) console.error('Failed to delete selected:', error)
          const msg = error instanceof Error ? error.message : t('cart.deleteFailed')
          showAlert(msg, 'error', t('cart.deleteFailed'))
        } finally {
          setUpdating(false)
        }
      },
      t('cart.deleteSelected')
    )
  }, [selectedIds, removeItemMutation])

  // 셀러별 그룹화 (v4 seller grouped style)
  const sellerGroups = useMemo(() => {
    return cartItems.reduce((groups, item) => {
      const sellerId = Number(item.seller_id) || 0
      if (!groups[sellerId]) {
        groups[sellerId] = {
          seller_id: sellerId,
          seller_name: item.seller_name || t('cart.fallbackSeller'),
          items: [] as CartItem[],
          subtotal: 0,
          shipping_fee: item.shipping_fee || 3000,
          free_shipping_threshold: item.free_shipping_threshold || 0,
        }
      }
      groups[sellerId].items.push(item)
      groups[sellerId].subtotal += (getCartItemPrice(item) * item.quantity)
      return groups
    }, {} as Record<number, {
      seller_id: number
      seller_name: string
      items: CartItem[]
      subtotal: number
      shipping_fee: number
      free_shipping_threshold: number
    }>)
  }, [cartItems])

  const { totalItems, subtotal, shippingFee } = useMemo(() => {
    let count = 0
    let sum = 0

    // 🛡️ 2026-05-19: 판매 종료 (product_is_active=0) 상품은 자동 제외 — 사용자 의도 무관하게
    //   결제 흐름에서 빠짐 (백엔드도 차단하지만 프론트 calc 도 정합).
    const isAvailable = (item: CartItem) => item.product_is_active === undefined || Number(item.product_is_active) === 1

    // 선택된 상품들 (판매 종료 자동 제외)
    const selectedItems = cartItems.filter(item => selectedIds.has(item.id) && isAvailable(item))

    // 셀러별로 그룹화
    const selectedSellerGroups = selectedItems.reduce((groups, item) => {
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
      items: CartItem[]
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
    const totalShippingFee = Object.values(selectedSellerGroups).reduce((total, group) => {
      // 🛡️ 2026-05-19 (사용자 신고): 교환권 (deal_only=1) 은 휴대폰 발송 → 배송비 불요.
      //   그룹의 모든 item 이 deal_only=1 이면 무료.
      const allVoucher = group.items.length > 0 && group.items.every(i => Number((i as { deal_only?: number }).deal_only) === 1)
      if (allVoucher) return total
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
      showAlert(t('cart.selectProductsFirst'), 'alert', t('cart.alertTitle'))
      return
    }

    // 토스 SDK 프리로드 (체크아웃 진입 전)
    import('@tosspayments/tosspayments-sdk').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
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
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0A0A0A]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-900 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">{t('cart.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F4F4]">
      <SEO title={t('cart.seoTitle')} description={t('cart.seoDesc')} url="/cart" noindex />

      {/* v4 Header + Select All */}
      <CartHeader
        itemCount={cartItems.length}
        allSelected={allSelected}
        selectedCount={selectedIds.size}
        onToggleSelectAll={toggleSelectAll}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Empty State or Cart Items */}
      {cartItems.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <main className="ur-content-narrow w-full flex-1 pb-32">
            {/* v4 Seller Group Cards */}
            {Object.values(sellerGroups).map((group) => {
              const groupAllSelected = group.items.every(item => selectedIds.has(item.id))
              const freeShipThreshold = group.free_shipping_threshold
              const remaining = freeShipThreshold > 0 ? freeShipThreshold - group.subtotal : 0
              const shippingProgress = freeShipThreshold > 0
                ? Math.min(100, (group.subtotal / freeShipThreshold) * 100)
                : 0

              return (
                <div key={group.seller_id} className="mt-2 bg-white dark:bg-[#0A0A0A]">
                  {/* Seller header with checkbox + badge + name + chevron */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-[#1A1A1A]">
                    <span
                      onClick={() => {
                        const ids = group.items.map(i => i.id as string | number)
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (groupAllSelected) {
                            ids.forEach(id => next.delete(id))
                          } else {
                            ids.forEach(id => next.add(id))
                          }
                          return next
                        })
                      }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 cursor-pointer transition-colors ${
                        groupAllSelected
                          ? 'bg-pink-500 border-pink-500'
                          : 'bg-white dark:bg-[#0A0A0A] border-gray-300 dark:border-[#3A3A3A]'
                      }`}
                    >
                      {groupAllSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Store size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white truncate">
                        {group.seller_name}
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                  </div>

                  {/* v4 Free shipping progress bar (pink) */}
                  {freeShipThreshold > 0 && remaining > 0 && (
                    <div className="mx-4 mt-3 px-3 py-2.5 bg-[#FDF2F8] rounded-lg">
                      <p className="text-[12px] text-pink-600 font-medium mb-1.5">
                        {formatNumber(remaining)}원 더 담으면 무료배송!
                      </p>
                      <div className="w-full h-1.5 bg-pink-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-500 rounded-full transition-all"
                          style={{ width: `${shippingProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {freeShipThreshold > 0 && remaining <= 0 && (
                    <div className="mx-4 mt-3 px-3 py-2 bg-[#FDF2F8] rounded-lg">
                      <p className="text-[12px] text-pink-600 font-semibold">{t('cart.freeShipping')}</p>
                    </div>
                  )}

                  {/* Product items */}
                  <div className="px-4 py-3 space-y-4">
                    {group.items.map((item) => (
                      <CartItemComponent
                        key={item.id}
                        item={{
                          ...item,
                          id: Number(item.id),
                          product_id: Number(item.product_id),
                          price_snapshot: item.price_snapshot ?? item.price ?? 0,
                          option_id: item.option_id != null ? Number(item.option_id) : undefined,
                        }}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={toggleSelect}
                        onUpdateQuantity={updateQuantity}
                        onRemove={removeItem}
                        onOpenOption={openOptionModal}
                        isUpdating={updating}
                      />
                    ))}
                  </div>

                  {/* Seller group shipping info — 🛡️ 2026-05-19: 교환권 그룹은 배송비 unused. */}
                  {(() => {
                    const allVoucher = group.items.length > 0 && group.items.every(i => Number((i as { deal_only?: number }).deal_only) === 1)
                    return (
                      <div className="mx-4 mb-3 pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex justify-between text-[12px]">
                        <span className="text-gray-400 dark:text-gray-500">{allVoucher ? '발송' : t('cart.shippingFee')}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {allVoucher
                            ? <span className="text-amber-600">🎁 휴대폰 즉시 발송 (무료)</span>
                            : freeShipThreshold > 0 && group.subtotal >= freeShipThreshold
                              ? <span className="text-pink-500">{t('cart.free')}</span>
                              : `${formatNumber(group.shipping_fee)}원`}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )
            })}

            {/* v4 Summary section */}
            <div className="mt-2 bg-white dark:bg-[#0A0A0A] px-4 py-4">
              <CartSummary
                totalItems={totalItems}
                subtotal={subtotal}
                shippingFee={shippingFee}
                total={total}
              />
            </div>
          </main>

          {/* v4 Bottom fixed CTA: "N원 주문하기" (bg-gray-900 text-white rounded-xl) */}
          {/* 🛡️ 2026-05-04: PC xl+ 사이드바 (224px) 우측부터 시작하도록 xl:left-56 추가. */}
          <div className="fixed bottom-0 left-0 right-0 xl:left-56 z-20 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] safe-bottom">
            <div className="ur-content-narrow px-4 py-3">
              <button
                onClick={handleCheckout}
                disabled={selectedIds.size === 0 || updating}
                className="w-full py-3.5 bg-gray-900 text-white text-[15px] font-bold rounded-xl disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {selectedIds.size === 0 ? t('cart.selectProductsFirst') : t('cart.placeOrder', { amount: formatNumber(total) })}
              </button>
            </div>
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
