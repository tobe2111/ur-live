import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getTossPayments } from '@/lib/toss-preload'
import { generateOrderId } from '@/utils/orderIdGenerator'
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
  /** Called before requestPayment — DB 에 PENDING 주문 미리 생성 */
  onBeforePayment?: (orderId: string) => Promise<void>
  onPaymentSuccess: (orderId: string, paymentKey: string, amount: number) => void
  onPaymentError: (error: string) => void
}

/**
 * 🛡️ 2026-05-23 v6 (dual-mode 복원 — 사용자 진단 결과 반영):
 *
 * /toss-debug 진단으로 확인된 사실:
 *   - 운영자 키 = `_gck_` (API 개별 연동 키), NOT widget 키
 *   - widgets() API 는 gck 키에서 silent fail (빈 UI 렌더 → 무한 로딩 증상)
 *   - payment() V2 가 gck 키 전용 → CheckoutPage 가 이걸 써야 함
 *
 * 키 type 자동 분기:
 *   - gck 키 → payment() V2 redirect (Toss 호스팅 페이지로 이동)
 *   - widget 키 (_ck_/_wt_) → widgets() API inline (in-page 결제 수단 선택)
 *
 * UI:
 *   - gck 모드: "결제하기" 버튼만 (인라인 UI 없음 — 클릭 시 Toss redirect)
 *   - widget 모드: 인라인 위젯 + 결제하기 버튼
 *
 * env variantKey (widget 모드 전용):
 *   - VITE_TOSS_VARIANT_PAYMENT (default 'DEFAULT')
 *   - VITE_TOSS_VARIANT_AGREEMENT (default 'AGREEMENT')
 */
const VARIANT_PAYMENT = (import.meta.env.VITE_TOSS_VARIANT_PAYMENT as string) || 'DEFAULT'
const VARIANT_AGREEMENT = (import.meta.env.VITE_TOSS_VARIANT_AGREEMENT as string) || 'AGREEMENT'

export function TossPaymentWidget({
  userId,
  clientKey,
  cartItems,
  totalAmount,
  shippingFee: _shippingFee,
  onBeforePayment,
  onPaymentSuccess: _onPaymentSuccess,
  onPaymentError,
}: TossPaymentWidgetProps) {
  const { t } = useTranslation()
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showPaymentBlocked, setShowPaymentBlocked] = useState(false)
  const hasInitialized = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetsRef = useRef<any>(null)

  // 1️⃣ SDK 로드 + 키 type 분기 + 위젯 렌더 (필요한 경우).
  useEffect(() => {
    if (!userId || cartItems.length === 0 || hasInitialized.current) return

    if (!clientKey || typeof clientKey !== 'string') {
      const msg = '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요. (TOSS_CLIENT_KEY 누락)'
      setErrorMessage(msg)
      setLoadingState('error')
      onPaymentError(msg)
      return
    }

    let cancelled = false
    hasInitialized.current = true

    // 단계별 timeout (silent hang 방어).
    const STEP_TIMEOUT_MS = 8000
    const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error(`[TIMEOUT:${label}] ${STEP_TIMEOUT_MS}ms 초과`)), STEP_TIMEOUT_MS),
        ),
      ])

    ;(async () => {
      try {
        const tossPayments = await withTimeout(getTossPayments(clientKey), 'SDK_LOAD')
        if (cancelled) return

        const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
        const customerKey = `user_${sanitizedUserId}`.substring(0, 50)

        // widgets() API + in-page 렌더 (단일 경로).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const widgets = (tossPayments as any).widgets({ customerKey })
        if (!widgets) throw new Error('widgets() returned null')

        await withTimeout(widgets.setAmount({ currency: 'KRW', value: Math.round(totalAmount) }), 'SET_AMOUNT')

        const tryRender = async (
          method: 'renderPaymentMethods' | 'renderAgreement',
          selector: string,
          preferred: string,
        ) => {
          try { await withTimeout(widgets[method]({ selector, variantKey: preferred }), `${method}:${preferred}`); return } catch { /* fallback */ }
          await withTimeout(widgets[method]({ selector }), `${method}:default`)
        }
        await tryRender('renderPaymentMethods', '#toss-payment-method', VARIANT_PAYMENT)
        await tryRender('renderAgreement', '#toss-agreement', VARIANT_AGREEMENT)

        if (cancelled) return
        widgetsRef.current = widgets
        setLoadingState('ready')
      } catch (err: unknown) {
        if (cancelled) return
        console.error('[TossPaymentWidget] init/render failed:', err)
        const raw = err instanceof Error ? err.message : String(err)
        const baseMsg = /TIMEOUT/i.test(raw)
          ? '결제 위젯 로딩이 지연됩니다. 페이지를 새로고침해주세요.'
          : /not.*found|404|variant/i.test(raw)
          ? `결제 위젯 설정 — variantKey 미일치 가능성. 운영자: Toss 콘솔의 실제 variantKey 와 일치하는 VITE_TOSS_VARIANT_PAYMENT / VITE_TOSS_VARIANT_AGREEMENT env 설정 필요.`
          : /widget.*key|클라이언트 키|개별 연동 키/i.test(raw)
          ? '결제 시스템 키 type 오류 — 관리자에게 문의해주세요.'
          : t('payment.initError', { defaultValue: '결제 초기화 실패' })
        const msg = `${baseMsg}\n\n[SDK 원본]: ${raw.slice(0, 200)}`
        setErrorMessage(msg)
        setLoadingState('error')
        onPaymentError(msg)
      }
    })()

    return () => { cancelled = true }
  }, [userId, clientKey, cartItems, totalAmount, onPaymentError, t])

  useEffect(() => {
    return () => { hasInitialized.current = false }
  }, [])

  // 2️⃣ amount 변경 시 반영.
  useEffect(() => {
    if (loadingState !== 'ready' || !widgetsRef.current) return
    widgetsRef.current.setAmount({ currency: 'KRW', value: Math.round(totalAmount) }).catch(() => null)
  }, [totalAmount, loadingState])

  const handlePayment = useCallback(async () => {
    if (loadingState !== 'ready' || isProcessing) return

    try {
      setIsProcessing(true)

      const orderId = generateOrderId(userId)
      const orderName = cartItems.length === 1
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      if (onBeforePayment) {
        await onBeforePayment(orderId)
      }

      // widgets.requestPayment() — Toss 가 method/amount 자동 (setAmount 이미 호출).
      if (!widgetsRef.current) throw new Error('widgets 인스턴스 없음')
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
      // requestPayment 가 redirect — 아래 라인 실행 안 됨.
    } catch (err: unknown) {
      console.error('[TossPaymentWidget] requestPayment failed:', err)
      setIsProcessing(false)
      const errObj = err as Record<string, unknown> | undefined
      if (errObj?.code === 'USER_CANCEL') return
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
  }, [loadingState, isProcessing, userId, cartItems, onBeforePayment, onPaymentError, t, totalAmount])

  return (
    <div className="space-y-3">
      <div id="toss-payment-method" className="min-h-[180px] bg-white rounded-lg border border-gray-200 overflow-hidden" />
      <div id="toss-agreement" className="min-h-[60px] bg-white rounded-lg border border-gray-200 overflow-hidden" />

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
        {loadingState === 'error' && t('payment.errors.systemError', { defaultValue: '결제 시스템 오류' })}
        {loadingState === 'ready' && !isProcessing && '결제하기'}
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
              <p className="text-sm font-medium text-red-800 whitespace-pre-wrap">{errorMessage}</p>
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
