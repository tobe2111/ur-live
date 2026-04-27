import React, { useState } from 'react'
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
    id: string | number
    product_id: string | number
    product_name: string
    product_image_url?: string
    image_url?: string
    quantity: number
    price?: number
    price_snapshot?: number
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

  // 2️⃣ 결제 요청 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      onPaymentError(t('payment.widgetNotReady', { defaultValue: '결제 위젯이 준비되지 않았습니다' }))
      return
    }

    if (isProcessing) {
      return
    }

    try {
      setIsProcessing(true)

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`
        },
        redirect: 'if_required'
      })

      if (error) {
        if (import.meta.env.DEV) console.error('[Stripe] ❌ 결제 실패:', error)
        onPaymentError(error.message || t('payment.requestError', { defaultValue: '결제 요청 실패' }))
        setIsProcessing(false)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        const orderId = `order_${Date.now()}_${userId}`
        onPaymentSuccess(orderId, paymentIntent.id, totalAmount + shippingFee)
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[Stripe] ❌ 결제 요청 실패:', err)
      setIsProcessing(false)
      onPaymentError(err?.message || t('payment.requestError', { defaultValue: '결제 요청 실패' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Payment Element */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <PaymentElement />
      </div>

      {/* 결제하기 버튼 */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className={`
          w-full py-4 rounded-lg font-bold text-white text-lg
          ${!stripe || isProcessing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
        `}
      >
        {isProcessing
          ? t('payment.processing', { defaultValue: 'Processing...' })
          : t('payment.pay') || `Pay $${((totalAmount + shippingFee) / 100).toFixed(2)}`
        }
      </button>
    </form>
  )
}

// 메인 컴포넌트 (Elements Provider 래핑)
export function StripeCheckout(props: StripeCheckoutProps) {
  const stripePromise = getStripePromise()
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const { t } = useTranslation()

  // Payment Intent 생성
  React.useEffect(() => {
    async function createPaymentIntent() {
      try {
        const finalAmount = Math.round((props.totalAmount + props.shippingFee) * 100) // Convert to cents

        const response = await fetch('/api/payment/stripe/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: finalAmount,
            currency: 'usd',
            metadata: {
              userId: props.userId,
              itemCount: props.cartItems.length
            }
          })
        })

        const data = await response.json() as any
        if (data.success && data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          throw new Error(data.error || 'Failed to create payment intent')
        }
      } catch (err: any) {
        if (import.meta.env.DEV) console.error('[Stripe] Payment Intent 생성 실패:', err)
        props.onPaymentError(err?.message || t('payment.initError'))
      }
    }

    if (props.userId && props.cartItems.length > 0) {
      createPaymentIntent()
    }
  }, [props.userId, props.cartItems, props.totalAmount, props.shippingFee, t])

  // clientSecret이 없으면 로딩 표시
  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
        <p>{t('payment.loading', { defaultValue: 'Loading payment...' })}</p>
      </div>
    )
  }

  const options = {
    clientSecret,
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
