import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk'
import { generateOrderId } from '@/utils/orderIdGenerator'
import { getUserEmail, getUserNameSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'

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
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null)
  const [isRendered, setIsRendered] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasInitialized = useRef(false)
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null)

  // 1️⃣ SDK 초기화 (V2 위젯)
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) {
      return
    }

    let cancelled = false

    async function initWidgets() {
      try {
        const sanitizedUserId = String(userId)
          .replace(/[^a-zA-Z0-9\-_=.@]/g, '')
          .substring(0, 44)

        // customerKey: user_ prefix 포함하여 Toss 최소 길이(2자) 충족
        const customerKey = `user_${sanitizedUserId}`.substring(0, 50)

        const tossPayments = await loadTossPayments(clientKey)
        const widgetsInstance = tossPayments.widgets({ customerKey })

        if (cancelled) return

        widgetsRef.current = widgetsInstance
        setWidgets(widgetsInstance)
        hasInitialized.current = true
      } catch (err: unknown) {
        if (cancelled) return
        if (import.meta.env.DEV) console.error('[TossPayments] 초기화 실패:', err)
        const errMsg = err instanceof Error ? err.message : ''
        const msg = errMsg.includes('network')
          ? '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'
          : errMsg.includes('auth') || errMsg.includes('400')
            ? '인증 오류가 발생했습니다. 페이지를 새로고침해주세요.'
            : t('payment.initError', { defaultValue: '결제 초기화 실패' })
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    }

    initWidgets()

    return () => {
      cancelled = true
    }
  }, [userId, clientKey, cartItems, onPaymentError, t])

  // 언마운트 시 위젯 DOM 정리
  useEffect(() => {
    return () => {
      widgetsRef.current = null
      hasInitialized.current = false
    }
  }, [])

  // 2️⃣ 결제 UI 렌더링 (V2: setAmount → renderPaymentMethods → renderAgreement)
  useEffect(() => {
    if (!widgets || isRendered) {
      return
    }

    async function renderWidgets() {
      if (!widgets) return
      try {
        // 🛡️ 2026-04-28 버그 fix: CheckoutPage 가 이미 shipping/coupon/deal 모두 적용된
        //   최종 totalAmount 를 전달함. 이전 코드 'totalAmount + shippingFee' 는
        //   shipping 이중 합산 → 토스에 잘못된 금액 전달 + 결제 버튼 표시 inflated.
        const finalAmount = totalAmount

        // DOM 요소가 존재할 때까지 대기 (최대 3초)
        let attempts = 0
        while (!document.getElementById('payment-method') && attempts < 30) {
          await new Promise(r => setTimeout(r, 100))
          attempts++
        }
        if (!document.getElementById('payment-method')) {
          throw new Error('결제 UI 영역을 찾을 수 없습니다. 페이지를 새로고침해주세요.')
        }

        // 결제 금액 설정 (KRW, 정수)
        await widgets.setAmount({ currency: 'KRW', value: Math.round(finalAmount) })

        // 결제 수단 UI 렌더링
        await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'widgetA'
        })

        // 이용약관 동의 UI 렌더링
        await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT'
        })

        setIsRendered(true)
        setLoadingState('ready')
      } catch (err: unknown) {
        if (import.meta.env.DEV) console.error('[TossPayments] 렌더링 실패:', err)
        const msg = t('payment.renderError', { defaultValue: 'UI 렌더링 실패' })
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    }

    renderWidgets()
  }, [widgets, isRendered, totalAmount, shippingFee, onPaymentError, t])

  // 3️⃣ 금액 변경 시 위젯 금액 업데이트 — totalAmount 가 이미 final (shipping 포함)
  useEffect(() => {
    if (!widgets || !isRendered) return
    const finalAmount = Math.round(totalAmount)
    widgets.setAmount({ currency: 'KRW', value: finalAmount }).catch((err: unknown) => {
      if (import.meta.env.DEV) console.error('[TossPayments] 금액 업데이트 실패:', err)
    })
  }, [totalAmount, isRendered, widgets])

  // 4️⃣ 결제 요청
  const handlePayment = useCallback(async () => {
    if (!widgets || loadingState !== 'ready' || isProcessing) return

    try {
      setIsProcessing(true)

      const orderId = generateOrderId(userId)

      const orderName = cartItems.length === 1
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      // 결제 전 주문 생성 (DB에 먼저 저장 → Toss 리다이렉트 전 주문 보장)
      if (onBeforePayment) {
        await onBeforePayment(orderId)
      }

      // Toss 위젯 결제 요청 (리다이렉트 방식)
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: getUserEmail() || undefined,
        customerName: getUserNameSync() || undefined,
      })

      // 리다이렉트 방식이므로 이 아래 코드는 실행되지 않음
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[TossPayments] 결제 요청 실패:', err)
      setIsProcessing(false)
      const errObj = err as Record<string, unknown> | undefined
      // 사용자가 결제를 직접 취소한 경우 에러 표시하지 않음
      if (errObj?.code === 'USER_CANCEL') return
      // INVALID_ORDER_ID: orderId 형식 오류
      if (errObj?.code === 'INVALID_ORDER_ID') {
        onPaymentError('주문번호 형식이 올바르지 않습니다. 페이지를 새로고침해주세요.')
        return
      }
      onPaymentError((errObj?.message as string) || t('payment.requestError', { defaultValue: '결제 요청 실패' }))
    }
  }, [widgets, loadingState, isProcessing, userId, cartItems, onBeforePayment, onPaymentError, t])

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
        {loadingState === 'ready' && !isProcessing && `${formatNumber(totalAmount)}원 결제하기`}
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
