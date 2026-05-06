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
  paymentMethod, setPaymentMethod,
  dealBalance, dealToUse, setDealToUse, totalBeforeDeal, totalAmount,
  payingWithDeals, onPayWithDeals,
  userId, cartItems, totalShippingFee, clientKey, selectedAddressOk,
  onBeforePayment, onTossPaymentSuccess, onStripePaymentSuccess,
}: Props) {
  const { t } = useTranslation()
  return (
    <section className="bg-white dark:bg-[#0A0A0A] px-5 py-4">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{t('payment.section.title', { defaultValue: '결제 수단' })}</h2>

      {/* 결제 방법 탭 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPaymentMethod('toss')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
            paymentMethod === 'toss'
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] text-gray-500 dark:text-gray-400'
          }`}
        >
          {t('payment.section.cardOrEasyPay', { defaultValue: '카드/간편결제' })}
        </button>
      </div>

      <DealPointsSection
        dealBalance={dealBalance}
        dealToUse={dealToUse}
        setDealToUse={setDealToUse}
        totalBeforeDeal={totalBeforeDeal}
        totalAmount={totalAmount}
      />

      {dealToUse >= totalBeforeDeal ? (
        /* 딜 전액 결제 */
        <button
          onClick={onPayWithDeals}
          disabled={payingWithDeals || !selectedAddressOk}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-red-500 text-white text-base font-bold disabled:opacity-40"
        >
          {payingWithDeals ? t('payment.section.processing', { defaultValue: '처리 중...' }) : t('payment.section.payWithDeals', { defaultValue: '{{amount}}딜로 결제', amount: formatNumber(totalAmount) })}
        </button>
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
