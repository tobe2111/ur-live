import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// 🔥 Toss Payments V1 SDK (window.PaymentWidget 전역 함수 방식)
declare global {
  interface Window {
    PaymentWidget: (clientKey: string, customerKey: string) => any
  }
}

interface TossPaymentWidgetProps {
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
  onPaymentSuccess: (orderId: string, paymentKey: string, amount: number) => void
  onPaymentError: (error: string) => void
}

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

export function TossPaymentWidget({
  userId,
  cartItems,
  totalAmount,
  shippingFee,
  onPaymentSuccess,
  onPaymentError
}: TossPaymentWidgetProps) {
  const { t } = useTranslation()
  const [widgets, setWidgets] = useState<any>(null)
  const [isRendered, setIsRendered] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const hasInitialized = useRef(false)

  // 1️⃣ SDK 초기화 및 인스턴스 생성
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) {
      return
    }

    async function fetchPaymentWidgets() {
      try {
        console.log('[TossPayments] 초기화 시작')

        if (typeof window.PaymentWidget === 'undefined') {
          console.warn('[TossPayments] SDK가 로드되지 않음. 스크립트 확인 필요.')
          return
        }

        const customerKey = `user_${userId}`
        const widgetsInstance = window.PaymentWidget(TOSS_CLIENT_KEY, customerKey)
        console.log('[TossPayments] ✅ 인스턴스 생성 완료')

        setWidgets(widgetsInstance)
        hasInitialized.current = true
      } catch (err) {
        console.error('[TossPayments] ❌ 초기화 실패:', err)
        onPaymentError(t('payment.initError') || '결제 초기화 실패')
      }
    }

    fetchPaymentWidgets()
  }, [userId, cartItems, onPaymentError, t])

  // 2️⃣ 결제 UI 렌더링
  useEffect(() => {
    if (!widgets || isRendered) {
      return
    }

    async function renderPaymentWidgets() {
      try {
        console.log('[TossPayments] UI 렌더링 시작')

        const finalAmount = totalAmount + shippingFee

        // DOM 요소 확인 (최대 2초 대기)
        let attempts = 0
        const checkElement = setInterval(() => {
          const paymentMethodEl = document.getElementById('payment-method')
          const agreementEl = document.getElementById('agreement')

          if (paymentMethodEl && agreementEl) {
            clearInterval(checkElement)
            console.log('[TossPayments] ✅ DOM 요소 발견!')

            // 결제 UI 렌더링
            widgets.renderPaymentMethods(
              '#payment-method',
              { value: finalAmount },
              { variantKey: 'DEFAULT' }
            )

            widgets.renderAgreement('#agreement', { variantKey: 'AGREEMENT' })

            console.log('[TossPayments] ✅ UI 렌더링 완료')
            setIsRendered(true)
          }

          attempts++
          if (attempts > 20) {
            clearInterval(checkElement)
            console.error('[TossPayments] ❌ DOM 요소를 찾을 수 없음')
            onPaymentError(t('payment.renderError') || 'UI 렌더링 실패')
          }
        }, 100)
      } catch (err) {
        console.error('[TossPayments] ❌ 렌더링 실패:', err)
        onPaymentError(t('payment.renderError') || 'UI 렌더링 실패')
      }
    }

    renderPaymentWidgets()
  }, [widgets, isRendered, totalAmount, shippingFee, onPaymentError, t])

  // 3️⃣ 결제 요청 함수
  const handlePayment = async () => {
    if (!widgets) {
      onPaymentError(t('payment.widgetNotReady') || '결제 위젯이 준비되지 않았습니다')
      return
    }

    if (isProcessing) {
      return
    }

    try {
      setIsProcessing(true)
      console.log('[TossPayments] 결제 요청 시작')

      const orderId = `order_${Date.now()}_${userId}`
      const orderName = cartItems.length === 1
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      const finalAmount = totalAmount + shippingFee

      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: `user_${userId}@example.com`,
        customerName: `고객${userId}`
      })

      // successUrl로 리다이렉트됨 (onPaymentSuccess는 리다이렉트 후 호출)
    } catch (err: any) {
      console.error('[TossPayments] ❌ 결제 요청 실패:', err)
      setIsProcessing(false)
      onPaymentError(err?.message || t('payment.requestError') || '결제 요청 실패')
    }
  }

  return (
    <div className="space-y-6">
      {/* 결제 수단 선택 */}
      <div id="payment-method" className="min-h-[300px] bg-white rounded-lg border border-gray-200 p-4" />

      {/* 이용약관 동의 */}
      <div id="agreement" className="min-h-[100px] bg-white rounded-lg border border-gray-200 p-4" />

      {/* 결제하기 버튼 */}
      <button
        onClick={handlePayment}
        disabled={!isRendered || isProcessing}
        className={`
          w-full py-4 rounded-lg font-bold text-white text-lg
          ${!isRendered || isProcessing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
        `}
      >
        {isProcessing
          ? t('payment.processing') || '결제 진행 중...'
          : t('payment.pay') || `${(totalAmount + shippingFee).toLocaleString()}원 결제하기`
        }
      </button>

      {/* Toss Payments SDK 로드 */}
      {!hasInitialized.current && (
        <script src="https://js.tosspayments.com/v1/payment-widget" async />
      )}
    </div>
  )
}
