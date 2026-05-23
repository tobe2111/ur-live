/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 결제 수단 + Toss/Stripe 마운트.
 *
 * - 결제 수단 선택 탭 (현재는 toss 단일)
 * - 딜 전액 결제 버튼 (totalAmount === 0 일 때 분기)
 * - 한국: TossPaymentWidget / 글로벌: StripeCheckout
 *
 * 핵심 결제 처리 콜백 (onPaymentSuccess / onBeforePayment) 은 부모에서 props 로 전달.
 */
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'
import { isKorea } from '@/config/region'
import { showErrorToast } from '@/lib/errorHandler'
import { CartItem } from '@/types/cart'
import DealPointsSection from './DealPointsSection'

const TossPaymentWidget = lazy(() =>
  import('@/components/payments/TossPaymentWidget').then(m => ({ default: m.TossPaymentWidget }))
)
const StripeCheckout = lazy(() =>
  import('@/components/payments/StripeCheckout').then(m => ({ default: m.StripeCheckout }))
)

interface Props {
  // 결제 수단
  paymentMethod: 'toss' | 'deal'
  setPaymentMethod: (m: 'toss' | 'deal') => void
  // 🛡️ 2026-05-21: 교환권 (deal_only=1) 만 담긴 주문 — 토스 옵션 숨김, 100% 딜.
  dealOnly?: boolean
  // 딜 포인트
  dealBalance: number
  dealToUse: number
  setDealToUse: (v: number) => void
  totalBeforeDeal: number
  totalAmount: number
  // 딜 전액 결제
  payingWithDeals: boolean
  onPayWithDeals: () => Promise<void>
  // 외부 위젯 props
  userId: string
  cartItems: CartItem[]
  totalShippingFee: number
  clientKey: string
  selectedAddressOk: boolean
  onBeforePayment: (orderId: string) => Promise<void>
  onTossPaymentSuccess: (orderId: string, paymentKey: string, amount: number) => void
  onStripePaymentSuccess: (orderId: string, paymentIntentId: string, amount: number) => void
}

export default function PaymentSection({
  paymentMethod: _paymentMethod, setPaymentMethod: _setPaymentMethod,
  dealOnly = false,
  dealBalance, dealToUse, setDealToUse, totalBeforeDeal, totalAmount,
  payingWithDeals, onPayWithDeals,
  userId, cartItems, totalShippingFee, clientKey, selectedAddressOk,
  onBeforePayment, onTossPaymentSuccess, onStripePaymentSuccess,
}: Props) {
  const { t } = useTranslation()
  // 교환권만 담겼으면 결제 수단 선택 탭 자체 숨김 + 딜 잔액 부족 시 충전 유도.
  const insufficientDeal = dealOnly && dealBalance < totalBeforeDeal
  return (
    <section className="bg-white dark:bg-[#0A0A0A] px-5 py-4">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{t('payment.section.title', { defaultValue: '결제 수단' })}</h2>

      {/* 🛡️ 2026-05-23: 사용자 지적 — redundant "카드/간편결제" 탭 제거.
          토스 결제위젯 자체가 카드/이체/카카오페이/네이버페이/토스페이 inline 선택 UI 제공.
          custom tab + Toss widget = 중복 → 위젯만 표시. */}
      {dealOnly && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-3 mb-4">
          <p className="text-[13px] font-bold text-blue-700 dark:text-blue-300">💎 딜 결제 전용</p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">교환권은 딜 포인트로만 구매할 수 있습니다. 휴대폰 MMS 로 즉시 발송됩니다.</p>
        </div>
      )}

      <DealPointsSection
        dealBalance={dealBalance}
        dealToUse={dealToUse}
        setDealToUse={setDealToUse}
        totalBeforeDeal={totalBeforeDeal}
        totalAmount={totalAmount}
      />

      {dealOnly && insufficientDeal && (
        <a
          href={`/points/charge?return=${encodeURIComponent('/checkout')}&amount=${Math.max(0, totalBeforeDeal - dealBalance)}`}
          className="block w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold text-center mb-3"
        >
          딜 잔액 부족 — {(totalBeforeDeal - dealBalance).toLocaleString()}딜 충전하기 →
        </a>
      )}

      {dealToUse >= totalBeforeDeal ? (
        /* 딜 전액 결제 */
        <button
          onClick={onPayWithDeals}
          disabled={payingWithDeals || !selectedAddressOk}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-red-500 text-white text-base font-bold disabled:opacity-40"
        >
          {payingWithDeals ? t('payment.section.processing', { defaultValue: '처리 중...' }) : t('payment.section.payWithDeals', { defaultValue: '{{amount}}딜로 결제', amount: formatNumber(totalAmount) })}
        </button>
      ) : dealOnly ? (
        /* 🛡️ 2026-05-21: 교환권만 담긴 주문 — 토스 위젯 금지. 딜 부족하면 위 충전 CTA 표시. */
        null
      ) : isKorea() ? (
        /* 한국: Toss Payments */
        <Suspense fallback={
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
            <p>{t('payment.section.loading', { defaultValue: '결제 수단 불러오는 중...' })}</p>
          </div>
        }>
          <TossPaymentWidget
            userId={userId}
            clientKey={clientKey}
            cartItems={cartItems}
            totalAmount={Math.max(0, totalAmount)}
            shippingFee={totalShippingFee}
            onBeforePayment={onBeforePayment}
            onPaymentSuccess={onTossPaymentSuccess}
            onPaymentError={(error) => {
              if (import.meta.env.DEV) console.error('[CheckoutPage] 결제 실패:', error)
              showErrorToast(error)
            }}
          />
        </Suspense>
      ) : (
        /* 글로벌: Stripe */
        <Suspense fallback={
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
            <p>Loading payment method...</p>
          </div>
        }>
          <StripeCheckout
            userId={userId}
            cartItems={cartItems}
            totalAmount={Math.max(0, totalAmount)}
            shippingFee={totalShippingFee}
            onPaymentSuccess={onStripePaymentSuccess}
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
