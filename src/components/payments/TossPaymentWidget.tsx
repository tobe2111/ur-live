import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getTossPayments } from '@/lib/toss-preload'
import { generateOrderId } from '@/utils/orderIdGenerator'

// SDK 의 widgets() 반환 type — 공식 SDK 타입을 그대로 사용 (impromptu 재정의 X).
type TossWidgets = ReturnType<Awaited<ReturnType<typeof getTossPayments>>['widgets']>
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
 * 🛡️ 2026-05-23 v5 (토스 공식 V2 결제위젯 — 단일 경로):
 *
 * 사용자 환경:
 *   - 교환권 → 딜 차감 (토스 X)
 *   - 충전 / 상품 / 공구 → 토스 결제위젯 (in-page 카드/계좌이체/카카오페이 선택 UI)
 *   - TOSS_CLIENT_KEY = '_wt_' (결제위젯 연동 키)
 *
 * 영구 해결 — Toss V2 결제위젯 단일 경로 (사용자 명령 "이상적이고 영구적"):
 *   1) tossPayments.widgets({ customerKey }) — widget instance
 *   2) widgets.setAmount({ currency, value })
 *   3) widgets.renderPaymentMethods({ selector, variantKey: 'DEFAULT' })
 *   4) widgets.renderAgreement({ selector, variantKey: 'AGREEMENT' })
 *   5) 결제하기 버튼 클릭 → widgets.requestPayment({ orderId, orderName, successUrl, failUrl })
 *      → 사용자 선택한 결제 수단 (카드/이체/카카오페이/네이버페이/토스페이 등) Toss 처리
 *      → successUrl 로 redirect → confirm endpoint
 *
 * payment() V2 redirect 경로 제거 — Toss 공식 가이드 기준 단일 방식 통일.
 * 운영자 액션: Toss 콘솔 → 결제위젯 → '내 위젯' 에 variantKey='DEFAULT' / 'AGREEMENT' 등록.
 */

const VARIANT_PAYMENT = 'DEFAULT'
const VARIANT_AGREEMENT = 'AGREEMENT'

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
  const widgetsRef = useRef<TossWidgets | null>(null)

  // 1️⃣ SDK 로드 + widgets() 인스턴스 + in-page 위젯 렌더 (한 번에).
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

    ;(async () => {
      try {
        const tossPayments = await getTossPayments(clientKey)
        if (cancelled) return

        const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
        const customerKey = `user_${sanitizedUserId}`.substring(0, 50)
        const widgets = tossPayments.widgets({ customerKey })
        if (!widgets) throw new Error('widgets() returned null — clientKey 가 결제위젯 키가 아닐 가능성')

        await widgets.setAmount({ currency: 'KRW', value: Math.round(totalAmount) })

        // variantKey fallback: 'DEFAULT' 시도 → 실패 시 variantKey 생략 (SDK 기본).
        const tryRender = async (
          method: 'renderPaymentMethods' | 'renderAgreement',
          selector: string,
          preferred: string,
        ) => {
          try { await widgets[method]({ selector, variantKey: preferred }); return } catch { /* fallback */ }
          await widgets[method]({ selector })
        }
        await tryRender('renderPaymentMethods', '#toss-payment-method', VARIANT_PAYMENT)
        await tryRender('renderAgreement', '#toss-agreement', VARIANT_AGREEMENT)

        if (cancelled) return
        widgetsRef.current = widgets
        setLoadingState('ready')
      } catch (err: unknown) {
        if (cancelled) return
        if (import.meta.env.DEV) console.error('[TossPaymentWidget] init/render failed:', err)
        const raw = err instanceof Error ? err.message : ''
        const msg = /not.*found|404|variant/i.test(raw)
          ? '결제 위젯 설정 누락 — 관리자에게 문의해주세요. (Toss 콘솔에서 위젯 등록 필요)'
          : /widget.*key|클라이언트 키|개별 연동 키/i.test(raw)
          ? '결제 시스템 키 type 오류 — 관리자에게 문의해주세요.'
          : raw || t('payment.initError', { defaultValue: '결제 초기화 실패' })
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

  // 2️⃣ amount 변경 시 widget 반영 (쿠폰 / 딜 사용 변경 등).
  useEffect(() => {
    if (loadingState !== 'ready' || !widgetsRef.current) return
    widgetsRef.current.setAmount({ currency: 'KRW', value: Math.round(totalAmount) }).catch(() => null)
  }, [totalAmount, loadingState])

  const handlePayment = useCallback(async () => {
    if (loadingState !== 'ready' || isProcessing || !widgetsRef.current) return

    try {
      setIsProcessing(true)

      const orderId = generateOrderId(userId)
      const orderName = cartItems.length === 1
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      if (onBeforePayment) {
        await onBeforePayment(orderId)
      }

      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
      // requestPayment 가 redirect — 아래 라인 실행 안 됨.
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[TossPaymentWidget] requestPayment failed:', err)
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
  }, [loadingState, isProcessing, userId, cartItems, onBeforePayment, onPaymentError, t])

  return (
    <div className="space-y-3">
      {/* in-page 결제 위젯 mount point — 카드/계좌이체/카카오페이 등 선택 UI */}
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
