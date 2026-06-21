import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CheckCircle, Package, AlertCircle } from 'lucide-react'
import { getUserId } from '@/utils/auth'
import { addBreadcrumb, captureError } from '@/lib/sentry'
import { formatNumber } from '@/utils/format'

export default function PaymentSuccessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 🛡️ 2026-05-13 (Phase A): 라이브 자동 복귀 카운트다운 — 결제 완료 후 5초 뒤 자동 이동.
  //   FOMO + 시청 유지 동시 잡음. 시청자 명시적 취소 가능.
  const [autoReturnSec, setAutoReturnSec] = useState<number | null>(null)
  const autoReturnTargetRef = useRef<string | null>(null)
  const [orderInfo, setOrderInfo] = useState<{
    orderId?: string;
    method?: string;
    status?: string;
    orders?: Array<{ payment_method?: string }>;
    // 🛡️ 2026-05-24 docs 일치 (TossPaymentObject):
    //   결제 승인 응답의 핵심 필드들 — UI 표시 + 검증용.
    payment?: {
      paymentKey?: string;
      orderId?: string;
      method?: string;
      totalAmount?: number;
      approvedAt?: string;
      receipt?: { url?: string };
      easyPay?: { provider?: string };
      card?: { number?: string; installmentPlanMonths?: number };
      /** 🛡️ 2026-05-24 docs: 현금영수증 (현금성 결제 시 자동 발급). */
      cashReceipt?: { receiptUrl?: string; type?: string };
    };
  } | null>(null)
  // 🛡️ 2026-05-24 docs 권장: amount 변조 검증 — URL amount vs server totalAmount 불일치 시 경고.
  const [amountMismatch, setAmountMismatch] = useState(false)
  // 🛡️ 2026-05-21 Phase B-2: 결제 직후 자체 예약 필요한 상품 prompt.
  //   booking_required=1 + 아직 appointment 미생성 — 사용자가 잊지 않게 CTA 표시.
  const [pendingBookings, setPendingBookings] = useState<Array<{ product_id: number; product_name: string; image_url: string | null; restaurant_name: string | null }>>([])
  
  // ✅ BUG #4 FIX: Use a ref for the processing flag instead of state.
  // Using state inside a useEffect closure causes a stale-closure bug:
  // the effect captures `isProcessing = false` at mount time, so the guard
  // `if (isProcessing) return` NEVER fires on re-renders — allowing duplicate calls.
  // A ref is mutable and always reflects the current value without re-closure issues.
  const isProcessingRef = useRef(false)

  // URL 파라미터에서 결제 정보 추출
  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')
  // 🏁 2026-06-12 [UNLOCK] (4차 감사 G2): 딜 전액결제는 paymentKey 가 없음 —
  //   CheckoutPage 가 /api/points/pay 성공 후 ?method=deal 로 리다이렉트.
  //   기존엔 paymentKey 부재 → 에러 화면 (결제는 이미 성공했는데!) + 카트 미정리.
  const method = searchParams.get('method')

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      // 딜 전액결제 성공 경로 — Toss confirm 불필요 (서버 /points/pay 에서 이미 완결)
      if (method === 'deal' && orderId && amount) {
        if (isProcessingRef.current) return
        handleDealSuccess()
        return
      }
      setError(t('payment.errors.invalidInfo', { defaultValue: '결제 정보가 유효하지 않습니다.' }))
      setLoading(false)
      return
    }

    // 🔒 중복 호출 방지: ref는 클로저에 영향 받지 않으므로 항상 현재 값을 읽음
    if (isProcessingRef.current) {
      return
    }

    // 🔥 Firebase Auth 초기화 완료 후 결제 승인 실행
    // 토스페이먼츠 리다이렉트 직후에는 Firebase가 아직 세션을 복원 중이므로
    // onAuthStateChanged가 한 번 발화할 때까지 대기 (최대 8초)
    waitForFirebaseAndConfirm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentKey, orderId, amount])

  // 🏁 2026-06-12 [UNLOCK] (4차 감사 G2+G9): 딜 전액결제 성공 화면.
  //   결제 자체는 /api/points/pay 가 원자적으로 완결 — 여기서는 표시 + 후처리만.
  //   카트 정리는 선택 삭제(order_number 의 상품만) — 미구매 아이템 보존.
  async function handleDealSuccess() {
    isProcessingRef.current = true
    try {
      addBreadcrumb('payment', 'deal success view', { orderId })
      setOrderInfo({ orderId: orderId ?? undefined, method: '딜 포인트', status: 'deal' })

      // 예약 필요한 상품 CTA (카드 결제와 동일)
      if (orderId) {
        api.get(`/api/orders/${orderId}/pending-bookings`)
          .then(r => { if (r.data?.success) setPendingBookings(r.data.data?.pending || []) })
          .catch(() => { /* 조회 실패해도 성공 화면은 정상 표시 */ })
      }

      // 전환 추적
      try {
        const g = (window as any).gtag
        if (typeof g === 'function') {
          g('event', 'purchase', {
            transaction_id: orderId,
            value: Math.round(Number(amount)) || 0,
            currency: 'KRW',
            payment_type: 'deal_points',
          })
        }
      } catch {}

      // 카트 선택 정리 (바로구매면 카트 자체를 안 거침)
      const isDirectPurchase = sessionStorage.getItem('directPurchase') === 'true'
      sessionStorage.removeItem('directPurchase')
      if (!isDirectPurchase) {
        try {
          await api.post('/api/cart/clear', { order_number: orderId })
          localStorage.removeItem('hasCartItems')
        } catch { /* 정리 실패는 치명적 아님 — 다음 카트 진입 시 사용자가 정리 가능 */ }
      }
    } finally {
      setLoading(false)
      isProcessingRef.current = false
    }
  }

  async function waitForFirebaseAndConfirm() {
    // 한국: Firebase 대기 불필요 (세션 쿠키 인증)
    const { isKorea } = await import('@/config/region')
    if (!isKorea()) {
      try {
        const { getFirebaseAuth } = await import('@/lib/firebase-auth')
        const auth = await getFirebaseAuth()
        if (typeof (auth as unknown as Record<string, unknown>).authStateReady === 'function') {
          await (auth as unknown as { authStateReady: () => Promise<void> }).authStateReady()
        } else {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 8000)
            const unsubscribe = auth.onAuthStateChanged(() => {
              clearTimeout(timer)
              unsubscribe()
              resolve()
            })
          })
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('[PaymentSuccess] Firebase auth wait error:', e);
      }
    }
    confirmPayment()
  }

  async function confirmPayment() {
    // 🔒 중복 호출 방지 (ref 사용)
    isProcessingRef.current = true

    // v37 FIX: URL에서 paymentKey/orderId 즉시 제거 (새로고침 시 재승인 방지)
    // replaceState → 뒤로가기 히스토리 건드리지 않음, URL만 정리
    try {
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch {}

    try {

      // 1️⃣ 사용자 정보 확인
      // ✅ BUG #22 FIX: getUserId() is declared `async` (returns Promise<string|null>).
      // The old code called it without `await`, so `userId` was always a resolved
      // Promise object — which is truthy — and the demo-mode guard below never fired.
      // More critically, `userId` was then stored as "[object Promise]" in the
      // order payload, causing every order creation to fail with a DB type error.
      const userId = await getUserId()
      
      // 🎯 데모 모드 감지: userId가 없으면 데모 결제로 간주
      if (!userId) {
        setOrderInfo({
          orderId: orderId ?? undefined,
          method: '테스트',
          status: 'demo'
        })
        setLoading(false)
        return
      }


      // 2️⃣ 결제 승인 요청 (주문은 CheckoutPage에서 결제 전에 이미 생성됨)
      // 토스 리다이렉트에서 전달된 amount를 정수로 변환 (KRW는 소수점 없음)
      const parsedAmount = Math.round(Number(amount))
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError(t('payment.errors.invalidAmount', { defaultValue: '결제 금액이 유효하지 않습니다.' }))
        return
      }

      addBreadcrumb('payment', 'confirm start', {
        orderId,
        amount: parsedAmount,
      })

      const response = await api.post('/api/payments/confirm', {
        paymentKey,
        orderId,
        amount: parsedAmount,
      })

      if (!response.data.success) {
        addBreadcrumb('payment', 'confirm failed', {
          orderId,
          error: response.data.error,
        }, 'error')
        setError(response.data.error || t('payment.errors.approvalFailed', { defaultValue: '결제 승인에 실패했습니다.' }))
        return
      }

      addBreadcrumb('payment', 'confirm success', { orderId })

      const paymentData = response.data.data
      setOrderInfo(paymentData)

      // 🛡️ 2026-05-24 docs 권장 검증: 'URL 쿼리 파라미터의 amount 값이 메서드 파라미터로 설정한 amount와 같은지
      //   반드시 확인하고 결제 승인 API를 호출해서 결제를 완료하세요.'
      //   server confirm 이 이미 검증 (총액 mismatch 시 400) 했지만 client-side 도 추가 안전망.
      const serverTotal = Number(paymentData?.payment?.totalAmount)
      if (Number.isFinite(serverTotal) && serverTotal !== parsedAmount) {
        captureError(new Error('AMOUNT_MISMATCH_CLIENT'), {
          flow: 'payment_confirm',
          orderId,
          urlAmount: parsedAmount,
          serverAmount: serverTotal,
        })
        setAmountMismatch(true)
      }

      // 🛡️ 2026-05-21 Phase B-2: 결제 직후 예약 필요한 상품 조회.
      //   booking_required=1 상품이 있으면 "예약 잡기" CTA 자동 노출 → 사용자 잊지 않게.
      if (orderId) {
        api.get(`/api/orders/${orderId}/pending-bookings`)
          .then(r => { if (r.data?.success) setPendingBookings(r.data.data?.pending || []) })
          .catch(() => { /* 조회 실패해도 결제 성공 화면은 정상 표시 */ })
      }

      // 전환 추적 (Google Analytics)
      try {
        const method = paymentData?.orders?.[0]?.payment_method || paymentData?.method || 'unknown'
        const g = (window as any).gtag
        if (typeof g === 'function') {
          g('event', 'purchase', {
            transaction_id: orderId,
            value: parsedAmount,
            currency: 'KRW',
            payment_type: method,
          })
        }
      } catch {}

      // 3️⃣ 장바구니 정리 (바로구매 모드에서는 스킵)
      // 🏁 2026-06-12 [UNLOCK] (G9): 전체 비우기 → 이 주문에 포함된 상품만 선택 삭제.
      //   카트에서 일부만 선택 결제한 경우 미구매 아이템이 같이 지워지던 문제 fix.
      const isDirectPurchase = sessionStorage.getItem('directPurchase') === 'true'
      sessionStorage.removeItem('directPurchase')
      if (!isDirectPurchase) try {
        await api.post('/api/cart/clear', { order_number: orderId })
        localStorage.removeItem('hasCartItems')
      } catch (cartErr) {
      }

    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      captureError(err as Error, { flow: 'payment_confirm', orderId })
      setError(axiosErr.response?.data?.error || t('payment.errors.approvalError', { defaultValue: '결제 승인 중 오류가 발생했습니다.' }))
    } finally {
      setLoading(false)
      isProcessingRef.current = false // 처리 완료
      // 🛡️ 2026-05-13 (Phase A): 라이브에서 진입한 결제면 5초 카운트다운 후 자동 라이브 복귀.
      //   시청 유지 + FOMO 자극. 사용자 명시적 취소 가능.
      const lastLiveId = localStorage.getItem('lastViewedLiveId')
      const lastViewedAt = localStorage.getItem('lastViewedLiveAt')
      const isFromLive = lastLiveId && lastViewedAt && (Date.now() - parseInt(lastViewedAt, 10)) < 600_000  // 10분 이내
      if (isFromLive && lastLiveId) {
        autoReturnTargetRef.current = `/live/${lastLiveId}`
        setAutoReturnSec(5)
      }
    }
  }

  // 🛡️ 2026-05-13 (Phase A): autoReturn 카운트다운 + 자동 navigate
  useEffect(() => {
    if (autoReturnSec === null) return
    if (autoReturnSec <= 0) {
      const target = autoReturnTargetRef.current
      if (target) navigate(target)
      return
    }
    const t = setTimeout(() => setAutoReturnSec(s => (s !== null ? s - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [autoReturnSec, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-[#6e6e73] dark:text-gray-400 font-medium">{t('paymentSuccess.approving')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[#1d1d1f] dark:text-white mb-4">{t('paymentSuccess.approveFailed')}</h1>
          <p className="text-[#6e6e73] dark:text-gray-400 mb-8">{error}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/checkout')}
              className="flex-1 bg-[#f5f5f7] dark:bg-[#1A1A1A] hover:bg-[#e8e8ed] dark:hover:bg-[#2A2A2A] text-[#1d1d1f] dark:text-white"
            >
              다시 시도
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white"
            >
              메인으로
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0A0A0A] flex items-center justify-center px-4 py-6">
      <SEO title={t('payment.successSeoTitle', { defaultValue: '결제 완료 - 유어딜' })} description={t('payment.successSeoDesc', { defaultValue: '주문이 성공적으로 완료되었습니다' })} url="/payment/success" noindex />
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-lg border border-[#e5e5e7] dark:border-[#2A2A2A]">
          {/* 성공 아이콘 */}
          <div className="text-center mb-5 sm:mb-6 lg:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-3 sm:mb-4">
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1d1d1f] dark:text-white mb-1 sm:mb-2">{t('paymentSuccess.title')}</h1>
            <p className="text-xs sm:text-sm lg:text-base text-[#6e6e73] dark:text-gray-400">{t('paymentSuccess.subtitle')}</p>
          </div>

          {/* 🛡️ 2026-05-21 Phase B-2: 예약 잡기 CTA — booking_required 상품이 있으면 자동 노출.
                결제 직후 사용자가 예약 잊지 않게 강조 배치. */}
          {pendingBookings.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-500/10 p-4 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">📅</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">예약이 필요한 상품 {pendingBookings.length}개</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">아래 상품은 매장 방문 전 시간 예약이 필요합니다. 지금 잡으시면 매장에서 헛걸음하지 않아요.</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {pendingBookings.slice(0, 3).map(p => (
                  <div key={p.product_id} className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-100">
                    <span className="text-gray-400">•</span>
                    <span className="font-medium line-clamp-1">{p.product_name}</span>
                    {p.restaurant_name && <span className="text-gray-500 dark:text-gray-400 text-[10px]">({p.restaurant_name})</span>}
                  </div>
                ))}
                {pendingBookings.length > 3 && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">외 {pendingBookings.length - 3}개</div>
                )}
              </div>
              <button
                onClick={() => navigate('/my-appointments?from_payment=' + orderId)}
                className="w-full py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white text-sm font-bold rounded-lg"
              >
                지금 예약 잡기 →
              </button>
            </div>
          )}

          {/* 주문 정보 */}
          {orderInfo && (
            <div className="space-y-3 sm:space-y-4 lg:space-y-6">
              <div className="bg-[#f5f5f7] dark:bg-[#1A1A1A] rounded-lg sm:rounded-xl p-4 sm:p-5 lg:p-6">
                <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-[#1d1d1f] dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900 dark:text-white" />
                  주문 정보
                </h2>

                <div className="space-y-2.5 sm:space-y-3">
                  {/* 주문번호 */}
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-xs sm:text-sm text-[#6e6e73] dark:text-gray-400 font-medium shrink-0">{t('paymentSuccess.orderNumber')}</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white font-mono break-all text-right max-w-[65%]">
                      {orderInfo.orderId || orderId}
                    </span>
                  </div>

                  <div className="flex justify-between items-center gap-3">
                    <span className="text-xs sm:text-sm text-[#6e6e73] dark:text-gray-400 font-medium shrink-0">{t('paymentSuccess.paymentMethod')}</span>
                    <span className="text-xs sm:text-sm lg:text-base font-semibold text-[#1d1d1f] dark:text-white">
                      {/* 🛡️ 2026-05-24 docs: '카드' / '가상계좌' / '계좌이체' / '휴대폰' / '문화상품권' / '해외간편결제'
                          간편결제 (토스페이/네이버페이/카카오페이 등) 면 method='카드' + easyPay.provider 표시. */}
                      {orderInfo.payment?.easyPay?.provider
                        ? `${orderInfo.payment.easyPay.provider} (간편결제)`
                        : orderInfo.payment?.method || orderInfo.orders?.[0]?.payment_method || orderInfo.method || '-'}
                    </span>
                  </div>

                  {/* 🛡️ 2026-05-24 docs: card.number 마스킹 + 할부 표시 (카드 결제 시). */}
                  {orderInfo.payment?.card?.number && (
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs sm:text-sm text-[#6e6e73] dark:text-gray-400 font-medium shrink-0">카드 번호</span>
                      <span className="text-xs sm:text-sm font-mono text-[#1d1d1f] dark:text-white">
                        {orderInfo.payment.card.number}
                        {orderInfo.payment.card.installmentPlanMonths && orderInfo.payment.card.installmentPlanMonths > 0
                          ? ` · ${orderInfo.payment.card.installmentPlanMonths}개월 할부`
                          : ' · 일시불'}
                      </span>
                    </div>
                  )}

                  {/* 🛡️ 2026-05-24 docs: approvedAt (ISO 8601 with TZ) — 사용자 시각으로 변환. */}
                  {orderInfo.payment?.approvedAt && (
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs sm:text-sm text-[#6e6e73] dark:text-gray-400 font-medium shrink-0">승인 시각</span>
                      <span className="text-xs sm:text-sm text-[#1d1d1f] dark:text-white">
                        {new Date(orderInfo.payment.approvedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2.5 sm:pt-3 mt-1 border-t border-[#d2d2d7] dark:border-[#2A2A2A]">
                    <span className="text-sm sm:text-base lg:text-lg font-medium text-[#1d1d1f] dark:text-white">{t('paymentSuccess.paymentAmount')}</span>
                    <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(parseInt(amount || '0'))}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 🛡️ 2026-05-24 docs: amount 검증 결과 (이상 시 사용자 알림). */}
              {amountMismatch && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-red-900 dark:text-red-300 leading-relaxed">
                    ⚠️ 결제 금액 검증 경고가 있습니다. 고객센터로 문의해주세요.
                  </p>
                </div>
              )}

              {/* 🛡️ 2026-05-24 docs: receipt.url — 영수증 (사용자 ID/금액 등 안내, Toss 호스팅). */}
              {orderInfo?.payment?.receipt?.url && (
                <a
                  href={orderInfo.payment.receipt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[#f5f5f7] dark:bg-[#1A1A1A] hover:bg-[#e8e8ed] dark:hover:bg-[#2A2A2A] rounded-lg sm:rounded-xl p-3 sm:p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#1d1d1f] dark:text-white">📄 영수증 보기</p>
                      <p className="text-[10px] sm:text-xs text-[#6e6e73] dark:text-gray-400 mt-0.5">토스페이먼츠 호스팅</p>
                    </div>
                    <span className="text-gray-400 text-xs">→</span>
                  </div>
                </a>
              )}

              {/* 🛡️ 2026-05-24 docs: cashReceipt.receiptUrl — 현금영수증 (가상계좌/계좌이체/현금 결제 시 자동 발급). */}
              {orderInfo?.payment?.cashReceipt?.receiptUrl && (
                <a
                  href={orderInfo.payment.cashReceipt.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[#f5f5f7] dark:bg-[#1A1A1A] hover:bg-[#e8e8ed] dark:hover:bg-[#2A2A2A] rounded-lg sm:rounded-xl p-3 sm:p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#1d1d1f] dark:text-white">🧾 현금영수증 보기</p>
                      <p className="text-[10px] sm:text-xs text-[#6e6e73] dark:text-gray-400 mt-0.5">
                        {orderInfo.payment.cashReceipt.type ? `${orderInfo.payment.cashReceipt.type} — ` : ''}국세청 발급 완료 후 홈택스 조회 가능
                      </p>
                    </div>
                    <span className="text-gray-400 text-xs">→</span>
                  </div>
                </a>
              )}

              {/* 안내 메시지 */}
              {orderInfo?.status === 'demo' ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm lg:text-base text-yellow-900 dark:text-yellow-300 leading-relaxed">
                    🎭 <strong>{t('paymentSuccess.demoMode')}</strong>: {t('paymentSuccess.demoModeDesc')}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm lg:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    주문이 정상적으로 완료되었습니다. 배송 현황은 주문 내역에서 확인하실 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="mt-5 sm:mt-6 lg:mt-8 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            {orderInfo?.status === 'demo' ? (
              <>
                <Button
                  onClick={() => navigate('/payment/demo')}
                  className="w-full sm:flex-1 bg-[#f5f5f7] dark:bg-[#2A2A2A] hover:bg-[#e8e8ed] dark:hover:bg-[#3A3A3A] text-[#1d1d1f] dark:text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  다시 테스트하기
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className="w-full sm:flex-1 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  메인으로
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/my-orders')}
                  className="w-full sm:flex-1 bg-[#f5f5f7] dark:bg-[#2A2A2A] hover:bg-[#e8e8ed] dark:hover:bg-[#3A3A3A] text-[#1d1d1f] dark:text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  주문 내역 보기
                </Button>
                <Button
                  onClick={() => {
                    // ✅ UX M20 FIX: 1시간 이상 경과한 lastViewedLiveId는 stale로 간주하여 홈으로 이동
                    setAutoReturnSec(null)  // 카운트다운 취소
                    const lastLiveId = localStorage.getItem('lastViewedLiveId')
                    const lastViewedAt = localStorage.getItem('lastViewedLiveAt')
                    const isStale = !lastViewedAt || (Date.now() - parseInt(lastViewedAt, 10)) > 3600000
                    if (lastLiveId && !isStale) {
                      navigate(`/live/${lastLiveId}`)
                    } else {
                      navigate('/')
                    }
                  }}
                  className="w-full sm:flex-1 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  {autoReturnSec !== null && autoReturnSec > 0
                    ? `라이브 복귀 (${autoReturnSec}초)`
                    : '쇼핑 계속하기'}
                </Button>
              </>
            )}
          </div>

          {/* 고객센터 정보 */}
          <div className="mt-5 sm:mt-6 lg:mt-8 pt-5 sm:pt-6 border-t border-[#e5e5e7] dark:border-[#2A2A2A] text-center">
            <p className="text-xs sm:text-sm text-[#86868b] dark:text-gray-500 mb-2">
              궁금한 점이 있으신가요?
            </p>
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-[#1d1d1f] dark:text-white mb-1.5">
              💬 고객센터: 카카오톡 채널 문의
            </p>
            <p className="text-xs sm:text-sm text-[#86868b] dark:text-gray-500">
              평일 09:00 - 18:00
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
