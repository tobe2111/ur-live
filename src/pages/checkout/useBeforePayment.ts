/**
 * useBeforePayment — 결제 전 주문 생성 훅.
 *
 * CheckoutPage TD-018 final-pass: handleBeforePayment 로직을 훅으로 분리하여
 * CheckoutPage 메인 파일 크기를 줄임. 상태 접근은 클로저로 유지.
 */
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { captureError, addBreadcrumb } from '@/lib/sentry'
import type { CartItem } from '@/types/cart'
import type { ShippingAddress, SellerGroup } from './types'

interface UseBeforePaymentOptions {
  isMealVoucher: boolean
  isDirectPurchase: boolean
  selectedAddress: ShippingAddress | null
  sellerGroups: Record<number, SellerGroup>
  groupBuyDiscounts: Record<number, { percent: number; tier: unknown }>
  couponId: number | null
  couponDiscount: number
  totalGroupBuyDiscount: number
  dealToUse: number
}

export function useBeforePayment(opts: UseBeforePaymentOptions) {
  const { t } = useTranslation()
  const isSubmittingRef = useRef(false)

  const handleBeforePayment = async (orderId: string): Promise<void> => {
    if (isSubmittingRef.current) throw new Error(t('payment.errors.paymentInProgress'))
    isSubmittingRef.current = true
    try {
      const { isMealVoucher, isDirectPurchase, selectedAddress, sellerGroups, groupBuyDiscounts, couponId, couponDiscount, totalGroupBuyDiscount, dealToUse } = opts
      if (!isMealVoucher && !selectedAddress) throw new Error(t('payment.errors.selectAddress'))
      if (isDirectPurchase) sessionStorage.setItem('directPurchase', 'true')
      else sessionStorage.removeItem('directPurchase')

      const shippingAddress = isMealVoucher ? {
        postal_code: '00000',
        address1: t('checkoutPage.voucherAddress'),
        address2: '',
        country: 'KR',
        recipient_name: t('checkoutPage.voucherRecipient'),
      } : {
        postal_code: selectedAddress!.postal_code,
        address1: selectedAddress!.address,
        address2: selectedAddress!.address_detail || '',
        country: 'KR',
        recipient_name: selectedAddress!.recipient_name,
      }

      for (const group of Object.values(sellerGroups)) {
        const groupShippingFee = (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold)
          ? 0 : group.shipping_fee
        addBreadcrumb('order', 'creating', { orderId, sellerId: group.seller_id, itemCount: group.items.length, total: group.subtotal + groupShippingFee })
        const response = await api.post('/api/orders', {
          seller_id: group.seller_id ? String(group.seller_id) : '',
          order_number: orderId,
          items: group.items.map((item: CartItem) => ({
            product_id: String(item.product_id),
            quantity: item.quantity,
            ...(item.option_value ? { options: { value: item.option_value } } : {}),
          })),
          shipping_address: shippingAddress,
          shipping_name: isMealVoucher ? t('checkoutPage.voucherRecipient') : selectedAddress!.recipient_name,
          shipping_phone: isMealVoucher ? '' : selectedAddress!.phone,
          shipping_fee: groupShippingFee,
          idempotency_key: `${orderId}_${group.seller_id}`,
          referrer_id: (() => {
            const ref = localStorage.getItem('affiliate_ref')
            const expires = localStorage.getItem('affiliate_ref_expires')
            if (ref && expires && Date.now() < Number(expires)) return ref
            const cookie = document.cookie.match(/affiliate_ref=([^;]+)/)
            return cookie?.[1] || undefined
          })(),
          group_buy_discounts: groupBuyDiscounts,
          coupon_id: couponId || undefined,
          coupon_discount: couponDiscount || undefined,
          discount_amount: (couponDiscount || 0) + (totalGroupBuyDiscount || 0) + (dealToUse || 0),
          deal_used: dealToUse || undefined,
        })
        if (!response.data.success) throw new Error(response.data.error || t('payment.errors.orderCreateFailed'))
        if (couponId && couponDiscount > 0 && response.data.data?.order_id) {
          try {
            await api.post('/api/coupons/use', { coupon_id: couponId, order_id: response.data.data.order_id, discount_amount: couponDiscount })
          } catch (couponErr) {
            captureError(couponErr as Error, { context: 'CheckoutPage.couponUse', couponId })
          }
        }
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  return { handleBeforePayment, isSubmittingRef }
}
