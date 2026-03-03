import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'

interface StripeCheckoutProps {
  userId: string
  cartItems: Array<{
    id: number
    product_id: number
    product_name: string
    product_image_url?: string
    quantity: number
    price: number
  }>
  totalAmount: number
  shippingFee: number
  onPaymentSuccess: (orderId: string, paymentIntentId: string, amount: number) => void
  onPaymentError: (error: string) => void
}

// Stripe Publishable Key
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_STRIPE_KEY'

// Stripe 인스턴스 로드 (앱 전체에서 한 번만 로드)
let stripePromise: Promise<Stripe | null> | null = null

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_KEY)
  }
  return stripePromise
}

// 내부 결제 폼 컴포넌트
function CheckoutForm({
  userId,
  cartItems,
  totalAmount,
  shippingFee,
  onPaymentSuccess,
  onPaymentError
}: StripeCheckoutProps) {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // 1️⃣ Payment Intent 생성 (백엔드 API 호출)
  useEffect(() => {
    async function createPaymentIntent() {
      try {
        console.log('[Stripe] Payment Intent 생성 요청')

        const finalAmount = totalAmount + shippingFee

        // TODO: 실제 백엔드 API 호출로 교체
        // const response = await axios.post('/api/payment/stripe/create-intent', {
        //   amount: finalAmount,
        //   userId,
        //   cartItems
        // })
        // setClientSecret(response.data.clientSecret)

        // 임시: 테스트용 client_secret (실제 프로덕션에서는 백엔드에서 생성)
        console.warn('[Stripe] ⚠️ 테스트 모드: 실제 Payment Intent가 필요합니다')
        onPaymentError(t('payment.stripeSetupRequired') || 'Stripe 백엔드 설정이 필요합니다')

      } catch (err: any) {
        console.error('[Stripe] ❌ Payment Intent 생성 실패:', err)
        onPaymentError(err?.message || t('payment.initError') || '결제 초기화 실패')
      }
    }

    if (userId && cartItems.length > 0) {
      createPaymentIntent()
    }
  }, [userId, cartItems, totalAmount, shippingFee, onPaymentError, t])

  // 2️⃣ 결제 요청 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      onPaymentError(t('payment.widgetNotReady') || '결제 위젯이 준비되지 않았습니다')
      return
    }

    if (isProcessing) {
      return
    }

    try {
      setIsProcessing(true)
      console.log('[Stripe] 결제 요청 시작')

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`
        },
        redirect: 'if_required'
      })

      if (error) {
        console.error('[Stripe] ❌ 결제 실패:', error)
        onPaymentError(error.message || t('payment.requestError') || '결제 요청 실패')
        setIsProcessing(false)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('[Stripe] ✅ 결제 성공:', paymentIntent.id)
        const orderId = `order_${Date.now()}_${userId}`
        onPaymentSuccess(orderId, paymentIntent.id, totalAmount + shippingFee)
      }
    } catch (err: any) {
      console.error('[Stripe] ❌ 결제 요청 실패:', err)
      setIsProcessing(false)
      onPaymentError(err?.message || t('payment.requestError') || '결제 요청 실패')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Payment Element */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {clientSecret ? (
          <PaymentElement />
        ) : (
          <div className="min-h-[200px] flex items-center justify-center text-gray-500">
            {t('payment.loading') || '결제 정보 로딩 중...'}
          </div>
        )}
      </div>

      {/* 결제하기 버튼 */}
      <button
        type="submit"
        disabled={!stripe || !clientSecret || isProcessing}
        className={`
          w-full py-4 rounded-lg font-bold text-white text-lg
          ${!stripe || !clientSecret || isProcessing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
        `}
      >
        {isProcessing
          ? t('payment.processing') || 'Processing...'
          : t('payment.pay') || `Pay $${((totalAmount + shippingFee) / 100).toFixed(2)}`
        }
      </button>
    </form>
  )
}

// 메인 컴포넌트 (Elements Provider 래핑)
export function StripeCheckout(props: StripeCheckoutProps) {
  const stripePromise = getStripePromise()

  // clientSecret이 필요하므로 실제로는 백엔드에서 받아와야 함
  // 여기서는 구조만 제공
  const options = {
    // clientSecret: 'pi_xxx_secret_xxx', // 백엔드에서 받아온 값
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#2563eb'
      }
    }
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm {...props} />
    </Elements>
  )
}
