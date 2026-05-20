import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
// 🛡️ 2026-05-20: SDK 2.x 부터 `TossPayments` named export 제거 — 인스턴스 타입은 SDK 반환값에서 추출.
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
type TossPayments = Awaited<ReturnType<typeof loadTossPayments>>
import { generateOrderId } from '@/utils/orderIdGenerator'
import { getUserEmail, getUserNameSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'
import { isFeatureBlocked } from '@/lib/in-app-warning'
import InAppFeatureBlockedModal from '@/components/InAppFeatureBlockedModal'

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
  // 🛡️ 2026-05-19 v6 (영구 해결): widgets API → payment API redirect.
  //   widgets API 는 Toss 콘솔에 variant 등록이 필수 (variantKey=DEFAULT/widgetA 모두 404 사고).
  //   payment API 는 variant 의존성 ZERO — Toss 호스팅 페이지로 redirect 후 결제 완료 시 successUrl 복귀.
  //   ⚠️ 인페이지 카드 폼 UI 가 사라지지만, "더 이상 문제 발생 안 됨" (사용자 요청) 우선.
  const [tossPayments, setTossPayments] = useState<TossPayments | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showPaymentBlocked, setShowPaymentBlocked] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasInitialized = useRef(false)

  // 1️⃣ SDK 로드 (V2, redirect 방식).
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) return

    let cancelled = false
    ;(async () => {
      try {
        const sdk = await loadTossPayments(clientKey)
        if (cancelled) return
        setTossPayments(sdk)
        setLoadingState('ready')
        hasInitialized.current = true
      } catch (err: unknown) {
        if (cancelled) return
        if (import.meta.env.DEV) console.error('[TossPayments] 초기화 실패:', err)
        const errMsg = err instanceof Error ? err.message : ''
        const msg = errMsg.includes('network')
          ? t('payment.errors.networkError')
          : errMsg.includes('auth') || errMsg.includes('400')
            ? t('payment.errors.authError')
            : t('payment.initError', { defaultValue: '결제 초기화 실패' })
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    })()
    return () => { cancelled = true }
  }, [userId, clientKey, cartItems, onPaymentError, t])

  // 언마운트 시 초기화 플래그 리셋
  useEffect(() => {
    return () => {
      hasInitialized.current = false
    }
  }, [])

  // 🛡️ 2026-05-19 v6: widgets render useEffect 제거 (payment API 사용).
  //   variantKey 의존성 ZERO. Toss 호스팅 페이지로 redirect 방식.
  //   기존: #payment-method / #agreement 인라인 위젯 렌더 → 콘솔 등록 누락 시 404.
  //   현재: SDK 로드만, click 시 tossPayments.payment().requestPayment() → redirect.

  // 4️⃣ 결제 요청 — 🛡️ 2026-05-19 v6: payment() API (redirect, variant 의존성 ZERO).
  const handlePayment = useCallback(async () => {
    if (!tossPayments || loadingState !== 'ready' || isProcessing) return

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

      // payment API — Toss 호스팅 결제 페이지로 redirect.
      const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
      const customerKey = `user_${sanitizedUserId}`.substring(0, 50)
      const payment = tossPayments.payment({ customerKey })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: Math.round(totalAmount) },
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
        onPaymentError(t('payment.errors.orderNumberInvalid'))
        return
      }
      // 🛡️ 2026-04-30 v2: 인앱 webview 에서 popup 차단 시 외부 브라우저 유도.
      //   try-first 패턴 — 에러 발생 후에 분류 (사전 차단 X).
      //   POPUP_BLOCKED / window.open / blocked 메시지 조합 매칭.
      const errMsg = String(errObj?.message || '')
      const errCode = String(errObj?.code || '')
      const isPopupErr = /popup|window\.open|blocked|차단/i.test(errMsg) || errCode === 'POPUP_BLOCKED'
      if (isPopupErr) {
        const blocked = await isFeatureBlocked('popup')
        if (blocked) {
          setShowPaymentBlocked(true)
          return
        }
      }
      onPaymentError((errObj?.message as string) || t('payment.requestError', { defaultValue: '결제 요청 실패' }))
    }
  }, [tossPayments, loadingState, isProcessing, userId, cartItems, totalAmount, onBeforePayment, onPaymentError, t])

  return (
    <div className="space-y-4">
      {/* 🛡️ 2026-05-19 v6: payment API (redirect 방식) — 인라인 카드 폼 없음.
          결제 클릭 시 Toss 호스팅 페이지로 이동 → 카드/계좌이체/페이 선택 → 완료 후 돌아옴. */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-[15px] font-bold text-gray-900 mb-3">결제 정보</p>
        <div className="space-y-2 text-[14px]">
          <div className="flex justify-between text-gray-600">
            <span>주문 상품</span>
            <span className="text-gray-900 font-medium">
              {cartItems.length === 1 ? cartItems[0].product_name : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100 text-gray-900">
            <span className="font-semibold">최종 결제 금액</span>
            <span className="text-[18px] font-extrabold text-rose-600">{formatNumber(totalAmount)}원</span>
          </div>
        </div>
        <p className="text-[12px] text-gray-500 mt-4 leading-relaxed">
          🔒 결제하기 버튼을 누르면 안전한 Toss 결제 페이지로 이동합니다. 카드/계좌이체/카카오페이 등 모든 결제 수단을 선택하실 수 있습니다.
        </p>
      </div>

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
        {loadingState === 'error' && t('payment.errors.systemError')}
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

      {showPaymentBlocked && <InAppFeatureBlockedModal feature="popup" onClose={() => setShowPaymentBlocked(false)} />}
    </div>
  )
}
