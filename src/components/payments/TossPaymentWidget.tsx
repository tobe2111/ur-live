import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { generateOrderId } from '@/utils/orderIdGenerator'
import { getUserEmail, getUserNameSync } from '@/utils/auth'

interface TossPaymentWidgetProps {
  userId: string
  clientKey: string
  cartItems: Array<{
    id: string | number
    product_id: string | number
    product_name: string
    product_image?: string
    product_image_url?: string
    image_url?: string
    quantity: number
    price?: number
    price_snapshot?: number
  }>
  totalAmount: number
  shippingFee: number
  /** Called before requestPayment — use this to create the order in the DB */
  onBeforePayment?: (orderId: string) => Promise<void>
  onPaymentSuccess: (orderId: string, paymentKey: string, amount: number) => void
  onPaymentError: (error: string) => void
}

export function TossPaymentWidget({
  userId,
  clientKey,
  cartItems,
  totalAmount,
  shippingFee,
  onBeforePayment,
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

  // 1️⃣ SDK 초기화 (V2)
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) {
      return
    }

    async function initWidgets() {
      try {
        const sanitizedUserId = String(userId)
          .replace(/[^a-zA-Z0-9\-_=.@]/g, '')
          .substring(0, 44)

        if (sanitizedUserId.length < 2) {
          throw new Error('userId is too short after sanitization')
        }

        const customerKey = `user_${sanitizedUserId}`

        const tossPayments = await loadTossPayments(clientKey)
        const widgetsInstance = tossPayments.widgets({ customerKey })

        setWidgets(widgetsInstance)
        hasInitialized.current = true
      } catch (err: any) {
        console.error('[TossPayments] 초기화 실패:', err)
        const msg = err.message?.includes('network')
          ? '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'
          : err.message?.includes('auth') || err.message?.includes('400')
            ? '인증 오류가 발생했습니다. 페이지를 새로고침해주세요.'
            : t('payment.initError') || '결제 초기화 실패'
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    }

    initWidgets()
  }, [userId, clientKey, cartItems, onPaymentError, t])

  // 2️⃣ 결제 UI 렌더링 (V2: setAmount → renderPaymentMethods → renderAgreement)
  useEffect(() => {
    if (!widgets || isRendered) {
      return
    }

    async function renderWidgets() {
      try {
        const finalAmount = totalAmount + shippingFee

        await widgets.setAmount({ currency: 'KRW', value: finalAmount })

        await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT'
        })

        await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT'
        })

        setIsRendered(true)
        setLoadingState('ready')
      } catch (err: any) {
        console.error('[TossPayments] 렌더링 실패:', err)
        const msg = t('payment.renderError') || 'UI 렌더링 실패'
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    }

    renderWidgets()
  }, [widgets, isRendered, totalAmount, shippingFee, onPaymentError, t])

  // 3️⃣ 금액 변경 시 위젯 업데이트
  useEffect(() => {
    if (!widgets || !isRendered) return
    const finalAmount = totalAmount + shippingFee
    widgets.setAmount({ currency: 'KRW', value: finalAmount }).catch((err: any) => {
      console.error('[TossPayments] 금액 업데이트 실패:', err)
    })
  }, [totalAmount, shippingFee, isRendered, widgets])

  // 4️⃣ 결제 요청
  const handlePayment = async () => {
    if (!widgets || loadingState !== 'ready' || isProcessing) return

    try {
      setIsProcessing(true)

      const orderId = generateOrderId(userId)

      const orderName = cartItems.length === 1
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      // 결제 전 주문 생성 (DB에 먼저 저장)
      if (onBeforePayment) {
        await onBeforePayment(orderId)
      }

      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: getUserEmail() || undefined,
        customerName: getUserNameSync() || undefined
      })

      // 리다이렉트 방식 → 이 아래 코드는 실행되지 않음
    } catch (err: any) {
      console.error('[TossPayments] 결제 요청 실패:', err)
      setIsProcessing(false)
      if (err?.code === 'USER_CANCEL') return
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
