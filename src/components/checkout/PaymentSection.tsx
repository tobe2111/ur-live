import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { showErrorToast } from '@/lib/errorHandler'
import { getUserFriendlyError } from '@/lib/errorHandler'
import { toast } from '@/hooks/useToast'
import { isKorea } from '@/config/region'
import { CartItem } from '@/types/cart'
import { ShippingAddress } from './checkout-types'

// 🔥 Region-based lazy loading for payment components
const TossPaymentWidget = lazy(() =>
  import('@/components/payments/TossPaymentWidget').then(m => ({ default: m.TossPaymentWidget }))
)
const StripeCheckout = lazy(() =>
  import('@/components/payments/StripeCheckout').then(m => ({ default: m.StripeCheckout }))
)

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

interface PaymentSectionProps {
  userId: string
  cartItems: CartItem[]
  selectedAddress: ShippingAddress | null
  dealBalance: number
  dealToUse: number
  totalBeforeDeal: number
  totalAmount: number
  totalShippingFee: number
  couponId: number | null
  couponDiscount: number
  isDirectPurchase: boolean
  onDealToUseChange: (value: number) => void
  onBeforePayment: (orderId: string) => Promise<void>
}

export function PaymentSection({
  userId,
  cartItems,
  selectedAddress,
  dealBalance,
  dealToUse,
  totalBeforeDeal,
  totalAmount,
  totalShippingFee,
  couponId,
  couponDiscount,
  isDirectPurchase,
  onDealToUseChange,
  onBeforePayment,
}: PaymentSectionProps) {
  const navigate = useNavigate()

  const handleDealFullPayment = async () => {
    if (!selectedAddress) { toast.error('배송지를 선택해주세요'); return }
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    if (isDirectPurchase) sessionStorage.setItem('directPurchase', 'true')
    const res = await api.post('/api/points/pay', {
      order_number: orderNumber,
      total_amount: totalAmount,
      items: cartItems.map(item => ({
        product_id: String(item.product_id),
        product_name: item.product_name || '상품',
        quantity: item.quantity,
        price: item.price_snapshot ?? item.price ?? 0,
        seller_id: item.seller_id ? String(item.seller_id) : undefined,
      })),
      shipping: {
        name: selectedAddress.recipient_name,
        phone: selectedAddress.phone,
        postal_code: selectedAddress.postal_code,
        address1: selectedAddress.address,
        address2: selectedAddress.address_detail || '',
      },
    })
    if (res.data.success) {
      if (couponId && couponDiscount > 0) {
        api.post('/api/coupons/use', {
          coupon_id: couponId,
          order_id: res.data.data?.order_id || 0,
          discount_amount: couponDiscount,
        }).catch(() => { toast.error('쿠폰 적용에 실패했습니다') })
      }
      navigate(`/payment/success?orderId=${orderNumber}&method=deal&amount=${totalAmount}`)
    } else {
      toast.error(res.data.error || '결제 실패')
    }
  }

  return (
    <section className="bg-white px-5 py-4">
      <h2 className="text-[15px] font-bold text-gray-900 mb-3">결제 수단</h2>

      {/* 결제 방법 탭 (현재 toss only) */}
      <div className="flex gap-2 mb-4">
        <button
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-gray-900 bg-gray-900 text-white"
        >
          카드/간편결제
        </button>
      </div>

      {/* 딜 포인트 */}
      <div className="bg-white border-t border-gray-100 px-5 py-5 mb-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-gray-900">딜 포인트</h3>
          <span className="text-[13px] text-gray-500">
            보유 <span className="font-bold text-pink-500">{dealBalance.toLocaleString()}</span>딜
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={dealToUse || ''}
            onChange={e => {
              const v = Math.min(Math.max(0, Number(e.target.value)), Math.min(dealBalance, totalBeforeDeal))
              onDealToUseChange(v)
            }}
            placeholder="사용할 딜 입력"
            aria-label="사용할 딜 포인트 입력"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 text-right font-medium placeholder:text-gray-400"
          />
          <button
            onClick={() => onDealToUseChange(Math.min(dealBalance, totalBeforeDeal))}
            className="px-4 py-3 bg-gray-900 text-white rounded-lg text-xs font-bold shrink-0"
          >
            전액사용
          </button>
        </div>
        {dealToUse > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-gray-500">상품 금액</span>
              <span className="text-gray-700">{totalBeforeDeal.toLocaleString()}원</span>
            </div>
            <div className="flex items-center justify-between text-[13px] mt-1">
              <span className="text-pink-500 font-medium">딜 포인트 차감</span>
              <span className="text-pink-500 font-bold">-{dealToUse.toLocaleString()}딜</span>
            </div>
            <div className="border-t border-gray-200 mt-2 pt-2 flex items-center justify-between">
              <span className="text-[13px] font-bold text-gray-900">카드 결제 금액</span>
              <span className="text-[15px] font-bold text-gray-900">{Math.max(0, totalAmount).toLocaleString()}원</span>
            </div>
          </div>
        )}
      </div>

      {/* 결제 버튼 영역 */}
      {dealToUse >= totalBeforeDeal ? (
        /* 딜 전액 결제 */
        <DealFullPaymentButton
          totalAmount={totalAmount}
          disabled={!selectedAddress}
          onPay={handleDealFullPayment}
        />
      ) : isKorea() ? (
        /* 한국: Toss Payments */
        <Suspense fallback={<PaymentLoadingFallback message="결제 수단 불러오는 중..." />}>
          <TossPaymentWidget
            userId={userId}
            clientKey={clientKey}
            cartItems={cartItems}
            totalAmount={Math.max(0, totalAmount)}
            shippingFee={totalShippingFee}
            onBeforePayment={onBeforePayment}
            onPaymentSuccess={(orderId, paymentKey, amount) => {
              navigate(`/payment/success?orderId=${orderId}&paymentKey=${paymentKey}&amount=${amount}`)
            }}
            onPaymentError={(error) => {
              if (import.meta.env.DEV) console.error('[CheckoutPage] 결제 실패:', error)
              showErrorToast(error)
            }}
          />
        </Suspense>
      ) : (
        /* 글로벌: Stripe */
        <Suspense fallback={<PaymentLoadingFallback message="Loading payment method..." />}>
          <StripeCheckout
            userId={userId}
            cartItems={cartItems}
            totalAmount={Math.max(0, totalAmount)}
            shippingFee={totalShippingFee}
            onPaymentSuccess={(orderId, paymentIntentId, amount) => {
              navigate(`/payment/success?orderId=${orderId}&paymentIntentId=${paymentIntentId}&amount=${amount}`)
            }}
            onPaymentError={(error) => {
              if (import.meta.env.DEV) console.error('[CheckoutPage] Payment failed:', error)
              showErrorToast(error)
            }}
          />
        </Suspense>
      )}
    </section>
  )
}

// ─── Internal sub-components ──────────────────────────────────────────────────

interface DealFullPaymentButtonProps {
  totalAmount: number
  disabled: boolean
  onPay: () => Promise<void>
}

function DealFullPaymentButton({ totalAmount, disabled, onPay }: DealFullPaymentButtonProps) {
  const [payingWithDeals, setPayingWithDeals] = useState(false)

  const handleClick = async () => {
    setPayingWithDeals(true)
    try {
      await onPay()
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err, '딜 결제 실패'))
    } finally {
      setPayingWithDeals(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={payingWithDeals || disabled}
      className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-red-500 text-white text-base font-bold disabled:opacity-40"
    >
      {payingWithDeals ? '처리 중...' : `${totalAmount.toLocaleString()}딜로 결제`}
    </button>
  )
}

interface PaymentLoadingFallbackProps {
  message: string
}

function PaymentLoadingFallback({ message }: PaymentLoadingFallbackProps) {
  return (
    <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
      <p>{message}</p>
    </div>
  )
}
