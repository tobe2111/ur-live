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
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasInitialized = useRef(false)

  // 1️⃣ SDK 초기화 및 인스턴스 생성
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) {
      return
    }

    async function fetchPaymentWidgets() {
      try {
        console.log('[TossPayments] 초기화 시작')

        // ✅ Wait for SDK to load with retry mechanism
        let retries = 0
        const maxRetries = 30 // 3 seconds
        
        while (typeof window.PaymentWidget === 'undefined' && retries < maxRetries) {
          console.log(`[TossPayments] SDK 로딩 대기 중... (${retries + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 100))
          retries++
        }

        if (typeof window.PaymentWidget === 'undefined') {
          throw new Error('TossPayments SDK failed to load after 3 seconds')
        }

        // ✅ Sanitize userId to meet TossPayments requirements
        // CustomerKey format: 영문 대소문자, 숫자, 특수문자('-', '_', '=', '.', '@')로 2~50자
        // Remove any invalid characters and ensure proper format
        
        // Ensure userId is a string
        const userIdString = String(userId || '')
        
        if (!userIdString) {
          throw new Error('userId is required but was empty')
        }
        
        const sanitizedUserId = userIdString
          .replace(/[^a-zA-Z0-9\-_=.@]/g, '') // Remove invalid characters
          .substring(0, 44) // Ensure we have room for 'user_' prefix (max 50 chars total)
        
        if (sanitizedUserId.length < 2) {
          throw new Error(`userId "${userIdString}" is too short after sanitization`)
        }
        
        const customerKey = `user_${sanitizedUserId}`
        
        console.log('[TossPayments] CustomerKey:', customerKey, 'Length:', customerKey.length)
        
        const widgetsInstance = window.PaymentWidget(TOSS_CLIENT_KEY, customerKey)
        console.log('[TossPayments] ✅ 인스턴스 생성 완료')

        setWidgets(widgetsInstance)
        hasInitialized.current = true
      } catch (err: any) {
        console.error('[TossPayments] ❌ 초기화 실패:', err)
        
        // Enhanced error handling
        let userFriendlyError = t('payment.initError') || '결제 초기화 실패'
        
        if (err.message?.includes('network') || err.message?.includes('ERR_NETWORK')) {
          userFriendlyError = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'
        } else if (err.message?.includes('400') || err.message?.includes('auth')) {
          userFriendlyError = '인증 오류가 발생했습니다. 페이지를 새로고침해주세요.'
        } else if (err.message?.includes('SDK failed to load')) {
          userFriendlyError = '결제 시스템을 불러오지 못했습니다. 페이지를 새로고침해주세요.'
        } else if (err.message?.includes('CustomerKey')) {
          userFriendlyError = '사용자 인증 정보가 올바르지 않습니다. 다시 로그인해주세요.'
        }
        
        setErrorMessage(userFriendlyError)
        setLoadingState('error')
        onPaymentError(userFriendlyError)
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
            setLoadingState('ready')
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

      // ✅ Generate Toss Payments compliant orderId
      const orderId = generateOrderId(userId)
      console.log('[TossPayments] ✅ Generated orderId:', orderId, 'Length:', orderId.length)
      
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
        disabled={loadingState !== 'ready' || isProcessing}
        className={`
          w-full py-4 rounded-lg font-bold text-white text-lg transition-all
          ${loadingState !== 'ready' || isProcessing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
        `}
      >
        {loadingState === 'loading' && (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            결제 시스템 로딩 중...
          </span>
        )}
        {loadingState === 'error' && '결제 시스템 오류 (새로고침 필요)'}
        {loadingState === 'ready' && !isProcessing && `${(totalAmount + shippingFee).toLocaleString()}원 결제하기`}
        {loadingState === 'ready' && isProcessing && (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            결제 진행 중...
          </span>
        )}
      </button>

      {/* Error state UI */}
      {loadingState === 'error' && errorMessage && (
        <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium underline"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
