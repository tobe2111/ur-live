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
  // 🛡️ 2026-07-02 (쇼핑 전수조사 — 결제 금액 정합):
  //   quotedFees: 서버 배송비 견적(그룹별) — 주문 생성과 동일 계산이라 이 값을 보내야 총액 일치.
  //   expectedTotal: 클라가 Toss 에 청구할 금액 — 주문 생성 후 Σ(서버 total_amount) 와 대조,
  //   불일치면 생성된 주문을 즉시 취소하고 명확한 에러로 중단(불일치 결제를 Toss 승인 후
  //   confirm 400 으로 보내는 대신 승인 '전'에 차단 + 재고/쿠폰 원복).
  quotedFees: Record<string, number> | null
  expectedTotal: number
}

export function useBeforePayment(opts: UseBeforePaymentOptions) {
  const { t } = useTranslation()
  const isSubmittingRef = useRef(false)

  const handleBeforePayment = async (orderId: string): Promise<void> => {
    if (isSubmittingRef.current) throw new Error(t('payment.errors.paymentInProgress'))
    isSubmittingRef.current = true
    try {
      const { isMealVoucher, isDirectPurchase, selectedAddress, sellerGroups, groupBuyDiscounts, couponId, couponDiscount, totalGroupBuyDiscount, dealToUse, quotedFees, expectedTotal } = opts
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
      const totalDealSum = dealToUse || 0
      let distributedDeal = 0
      let distributedGroupBuy = 0
      const lastIdx = groupList.length - 1
      // 💸 2026-07-02 (쇼핑 전수조사): 쿠폰은 '최대 소계 그룹'에 전액 배정.
      //   서버 coupon_uses 가 UNIQUE(coupon_id, user_id) 라 비례 분배 시 첫 그룹만 소진 성공 →
      //   2번째 그룹부터 무음 0 → Σ(서버 total) ≠ 클라 청구액 → confirm 400 (멀티셀러+쿠폰 항상 실패).
      //   최대 그룹 배정은 min_order_amount(그룹 단위 검사) 통과 확률도 최대화. 잔여 불일치는
      //   아래 Σ 검증이 승인 전 차단.
      const couponGroupIdx = groupList.reduce((best, g, i) => (g.subtotal > groupList[best].subtotal ? i : best), 0)
      // 🛡️ 생성된 주문 추적 — Σ 검증 실패 시 전부 취소(재고/쿠폰 원복)하기 위함.
      const createdOrders: Array<{ id: string | number; total: number }> = []

      for (let i = 0; i < groupList.length; i++) {
        const group = groupList[i]
        const isLast = i === lastIdx
        // 비례 분배 — 마지막 group 은 잔액 흡수 (rounding error 차단).
        const ratio = group.subtotal / totalSubtotal
        const groupDeal = isLast
          ? Math.max(0, totalDealSum - distributedDeal)
          : Math.floor(totalDealSum * ratio)
        const groupCoupon = i === couponGroupIdx ? (couponDiscount || 0) : 0
        const groupGroupBuy = isLast
          ? Math.max(0, (totalGroupBuyDiscount || 0) - distributedGroupBuy)
          : Math.floor((totalGroupBuyDiscount || 0) * ratio)
        distributedDeal += groupDeal
        distributedGroupBuy += groupGroupBuy
        // 💸 그룹 할인 총액 = 컴포넌트 합 — 독립 비례분배(이전)는 합계가 컴포넌트 합과 어긋날 수 있었음.
        const groupDiscount = groupCoupon + groupDeal + groupGroupBuy

        // 🛡️ 2026-07-02: 배송비는 서버 견적(quotedFees) 우선 — 주문 생성과 동일 계산(비배송/무료배송/지역비).
        const quotedFee = quotedFees?.[String(group.seller_id)]
        const groupShippingFee = quotedFee != null
          ? quotedFee
          : (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold)
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
              // 🛡️ 2026-07-02 (쇼핑 전수조사): option_id 전달 → 서버가 옵션 가격 재계산 + 옵션 재고 차감.
              ...(item.option_id != null ? { option_id: Number(item.option_id) } : {}),
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
        const created = response.data.data as { id?: string | number; total_amount?: number } | undefined
        if (created?.id != null) {
          createdOrders.push({ id: created.id, total: Math.max(0, Math.floor(Number(created.total_amount ?? 0))) })
        }
      }

      // 💸 2026-07-02 (쇼핑 전수조사 — 결제 금액 정합 최종 방어선): Σ(서버 total_amount) ≠ 청구 예정액이면
      //   Toss 승인 '전'에 중단. 이전엔 이 불일치가 Toss 승인 후 /confirm 400 으로만 드러나
      //   사용자에게 원인 불명 결제 실패 + 재고/쿠폰 잠김을 남겼음. 여기서 즉시 주문 취소(미결제
      //   경로 — 재고/쿠폰 원복)하고 새로고침을 안내. 서버 값이 더 작아도(=더 싸게) 중단 —
      //   표시 금액과 다른 청구는 어느 방향이든 하지 않는다.
      const serverTotal = createdOrders.reduce((s, o) => s + o.total, 0)
      if (createdOrders.length > 0 && Number.isFinite(expectedTotal) && serverTotal !== Math.max(0, Math.floor(expectedTotal))) {
        addBreadcrumb('order', 'amount-mismatch-abort', { orderId, serverTotal, expectedTotal })
        await Promise.allSettled(createdOrders.map(o =>
          api.post(`/api/orders/${o.id}/cancel`, { reason: '결제 금액 불일치 자동 취소' })
        ))
        throw new Error(t('payment.errors.amountMismatchRetry', {
          defaultValue: '결제 금액이 변경되어 주문을 중단했어요. 가격/배송비가 갱신됐을 수 있으니 새로고침 후 다시 시도해주세요.',
        }))
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  return { handleBeforePayment, isSubmittingRef }
}
