/**
 * useBeforePayment — 결제 전 주문 생성 훅.
 *
 * CheckoutPage TD-018 final-pass: handleBeforePayment 로직을 훅으로 분리하여
 * CheckoutPage 메인 파일 크기를 줄임. 상태 접근은 클로저로 유지.
 */
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { addBreadcrumb } from '@/lib/sentry'
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

      // 🛡️ 2026-05-24: 멀티-seller 시 discount 비례 분배 — Toss amount mismatch 영구 fix.
      //   이전: 각 seller order 마다 'discount_amount: full sum' 전송 →
      //     각 order 의 total_amount 가 잘못 계산 (음수 clamp 등) →
      //     server SUM ≠ client amount → "결제 금액이 일치하지 않습니다".
      //   이후: seller 별 subtotal 비율로 discount 분배 + 마지막 seller 가 rounding 잔액 흡수
      //     → SUM(per-seller total_amount) === client totalAmount.
      const groupList = Object.values(sellerGroups)
      const totalSubtotal = groupList.reduce((s, g) => s + g.subtotal, 0) || 1  // /0 방지
      const totalDiscountSum = (couponDiscount || 0) + (totalGroupBuyDiscount || 0) + (dealToUse || 0)
      const totalDealSum = dealToUse || 0
      let distributedDiscount = 0
      let distributedDeal = 0
      let distributedCoupon = 0
      let distributedGroupBuy = 0
      const lastIdx = groupList.length - 1

      for (let i = 0; i < groupList.length; i++) {
        const group = groupList[i]
        const isLast = i === lastIdx
        // 비례 분배 — 마지막 group 은 잔액 흡수 (rounding error 차단).
        const ratio = group.subtotal / totalSubtotal
        const groupDiscount = isLast
          ? Math.max(0, totalDiscountSum - distributedDiscount)
          : Math.floor(totalDiscountSum * ratio)
        const groupDeal = isLast
          ? Math.max(0, totalDealSum - distributedDeal)
          : Math.floor(totalDealSum * ratio)
        const groupCoupon = isLast
          ? Math.max(0, (couponDiscount || 0) - distributedCoupon)
          : Math.floor((couponDiscount || 0) * ratio)
        const groupGroupBuy = isLast
          ? Math.max(0, (totalGroupBuyDiscount || 0) - distributedGroupBuy)
          : Math.floor((totalGroupBuyDiscount || 0) * ratio)
        distributedDiscount += groupDiscount
        distributedDeal += groupDeal
        distributedCoupon += groupCoupon
        distributedGroupBuy += groupGroupBuy

        const groupShippingFee = (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold)
          ? 0 : group.shipping_fee
        addBreadcrumb('order', 'creating', {
          orderId, sellerId: group.seller_id, itemCount: group.items.length,
          subtotal: group.subtotal, shipping: groupShippingFee, discount: groupDiscount, deal: groupDeal,
          total: group.subtotal + groupShippingFee - groupDiscount,
        })
        let response
        try {
          response = await api.post('/api/orders', {
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
            // 🛡️ 비례 분배된 값 전송 (이전: full sum 통째로).
            coupon_discount: groupCoupon || undefined,
            discount_amount: groupDiscount,
            deal_used: groupDeal || undefined,
          })
        } catch (apiErr: unknown) {
          // 🛡️ 2026-05-23: 500 에러 시 server 의 _debug + _tag 필드 surface — stage 즉시 식별.
          const ax = apiErr as { response?: { status?: number; data?: { error?: string; _debug?: string; _tag?: string; code?: string } } }
          const status = ax?.response?.status
          const data = ax?.response?.data
          const debugInfo = data ? `[${data._tag || '?'}] ${data._debug || data.error || ''}`.slice(0, 300) : ''
          console.error(`[useBeforePayment] /api/orders ${status} | ${debugInfo}`)
          // /api/_errors/log 로 자동 보고 (telemetry — /admin/errors 에서 확인)
          try {
            const body = JSON.stringify({
              message: `/api/orders ${status}: ${debugInfo}`,
              type: 'order_create_error',
              url: window.location.pathname,
              user_id: localStorage.getItem('user_id'),
            })
            if (navigator.sendBeacon) {
              navigator.sendBeacon('/api/_errors/log', new Blob([body], { type: 'application/json' }))
            } else {
              fetch('/api/_errors/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
            }
          } catch { /* ignore */ }
          // 사용자에게 _debug 포함 에러 throw → toast 에 표시됨
          throw new Error(`${data?.error || t('payment.errors.orderCreateFailed')}\n${debugInfo}`)
        }
        if (!response.data.success) throw new Error(response.data.error || t('payment.errors.orderCreateFailed'))
        // 💸 2026-06-17: 쿠폰은 서버가 주문 생성 시 권위 재계산 + coupon_uses UNIQUE 로 1회 소비한다.
        //   (handlePayWithDeals 와 동일 — 별도 /coupons/use 호출 폐지. 이중 소비/409 방지.)
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  return { handleBeforePayment, isSubmittingRef }
}
