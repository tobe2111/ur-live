import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { getTossPayments } from '@/lib/toss-preload'
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
  onBeforePayment?: (orderId: string) => Promise<void>
  onPaymentSuccess: (orderId: string, paymentKey: string, amount: number) => void
  onPaymentError: (error: string) => void
}

type KeyType = 'widget' | 'general'

/**
 * 🛡️ 2026-05-22 v4 영구 — widget 키 + general 키 자동 분기.
 *
 * 사용자 신고: "API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 결제위젯 연동 키는 지원하지 않습니다."
 *   원인: TOSS_CLIENT_KEY = '_wt_' (결제위젯 키) 인데 payment() V2 가 거부.
 *
 * 해결: 키 type 자동 감지 + API 분기.
 *   - 'wt' → widgets() API + in-page 위젯 렌더 (variantKey 'DEFAULT' / 'AGREEMENT' fallback)
 *   - 'gck' / 'ck' / unknown → payment() V2 redirect
 *
 * UI: CheckoutOrderSummary 가 이미 결제 정보 표시 — 본 컴포넌트는 결제하기 버튼만 (사용자 요청).
 *   widget 키 → 위젯 mount point + 버튼.
 *   general 키 → 버튼만 (간단한 안내 1줄).
 */
function detectKeyType(key: string): KeyType {
  return /_wt_|_widget_/i.test(key) ? 'widget' : 'general'
}

export function TossPaymentWidget({
  userId,
  clientKey,
  cartItems,
  totalAmount,
  shippingFee: _shippingFee,
  onBeforePayment,
  onPaymentSuccess: _onPaymentSuccess,
  onPaymentError
}: TossPaymentWidgetProps) {
  const { t } = useTranslation()
  const [tossPayments, setTossPayments] = useState<TossPayments | null>(null)
  const [keyType, setKeyType] = useState<KeyType>('general')
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showPaymentBlocked, setShowPaymentBlocked] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasInitialized = useRef(false)
  const widgetsRef = useRef<{
    setAmount: (a: { currency: string; value: number }) => Promise<void>
    renderPaymentMethods: (p: { selector: string; variantKey?: string }) => Promise<void>
    renderAgreement: (p: { selector: string; variantKey?: string }) => Promise<void>
    requestPayment: (p: { orderId: string; orderName: string; successUrl: string; failUrl: string }) => Promise<void>
  } | null>(null)
  const widgetsRendered = useRef(false)

  // 1️⃣ SDK 로드 + 키 type 판별.
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) return

    if (!clientKey || typeof clientKey !== 'string') {
      const msg = '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요. (TOSS_CLIENT_KEY 누락)'
      setErrorMessage(msg)
      setLoadingState('error')
      onPaymentError(msg)
      return
    }

    const type = detectKeyType(clientKey)
    setKeyType(type)

    let cancelled = false
    ;(async () => {
      try {
        const sdk = await getTossPayments(clientKey)
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
          : t('payment.initError', { defaultValue: '결제 초기화 실패' })
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    })()
    return () => { cancelled = true }
  }, [userId, clientKey, cartItems, onPaymentError, t])

  useEffect(() => {
    return () => { hasInitialized.current = false; widgetsRendered.current = false }
  }, [])

  // 2️⃣ widget 키 → in-page widgets() 렌더 (variant fallback).
  useEffect(() => {
    if (!tossPayments || keyType !== 'widget' || loadingState !== 'ready' || widgetsRendered.current) return

    let cancelled = false
    ;(async () => {
      try {
        const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
        const customerKey = `user_${sanitizedUserId}`.substring(0, 50)
        const sdk = tossPayments as unknown as {
          widgets: (p: { customerKey: string }) => typeof widgetsRef.current
        }
        const widgets = sdk.widgets({ customerKey })
        if (!widgets) throw new Error('widgets() returned null')
        await widgets.setAmount({ currency: 'KRW', value: Math.round(totalAmount) })

        const tryRender = async (method: 'renderPaymentMethods' | 'renderAgreement', selector: string, preferred: string) => {
          try { await widgets[method]({ selector, variantKey: preferred }); return } catch { /* */ }
          try { await widgets[method]({ selector }); return } catch { /* */ }
        }

        await tryRender('renderPaymentMethods', '#toss-payment-method', 'DEFAULT')
        await tryRender('renderAgreement', '#toss-agreement', 'AGREEMENT')

        if (!cancelled) {
          widgetsRef.current = widgets
          widgetsRendered.current = true
        }
      } catch (err: unknown) {
        if (cancelled) return
        if (import.meta.env.DEV) console.error('[TossPayments widgets] 렌더 실패:', err)
        const msg = '결제 위젯 로드 실패. 페이지를 새로고침해주세요.'
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    })()
    return () => { cancelled = true }
  }, [tossPayments, keyType, loadingState, userId, totalAmount, onPaymentError])

  const handlePayment = useCallback(async () => {
    if (!tossPayments || loadingState !== 'ready' || isProcessing) return

    try {
      setIsProcessing(true)

      const orderId = generateOrderId(userId)
      const orderName = cartItems.length === 1
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      if (onBeforePayment) {
        await onBeforePayment(orderId)
      }

      const successUrl = `${window.location.origin}/payment/success`
      const failUrl = `${window.location.origin}/payment/fail`

      if (keyType === 'widget' && widgetsRef.current) {
        await widgetsRef.current.requestPayment({ orderId, orderName, successUrl, failUrl })
      } else {
        const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
        const customerKey = `user_${sanitizedUserId}`.substring(0, 50)
        const payment = tossPayments.payment({ customerKey })
        await payment.requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: Math.round(totalAmount) },
          orderId,
          orderName,
          successUrl,
          failUrl,
          customerEmail: getUserEmail() || undefined,
          customerName: getUserNameSync() || undefined,
        })
      }
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[TossPayments] 결제 요청 실패:', err)
      setIsProcessing(false)
      const errObj = err as Record<string, unknown> | undefined
      if (errObj?.code === 'USER_CANCEL') return
      if (errObj?.code === 'INVALID_ORDER_ID') {
        onPaymentError(t('payment.errors.orderNumberInvalid'))
        return
      }
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
  }, [tossPayments, keyType, loadingState, isProcessing, userId, cartItems, totalAmount, onBeforePayment, onPaymentError, t])

  return (
    <div className="space-y-3">
      {/* 🛡️ 2026-05-22 사용자 요청: CheckoutOrderSummary 가 이미 결제 정보 표시 — 중복 박스 제거.
            widget 키 → 위젯 mount point + 결제하기 버튼.
            general 키 → 결제하기 버튼만. */}
      {keyType === 'widget' && (
        <>
          <div id="toss-payment-method" className="min-h-[180px] bg-white rounded-lg border border-gray-200" />
          <div id="toss-agreement" className="min-h-[60px] bg-white rounded-lg border border-gray-200" />
        </>
      )}

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
