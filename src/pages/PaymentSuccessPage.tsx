import { useEffect, useState, useRef } from 'react'
import SEO from '@/components/SEO'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CheckCircle, Package, AlertCircle } from 'lucide-react'
import { getUserId } from '@/utils/auth'
import { addBreadcrumb, captureError } from '@/lib/sentry'
import { formatNumber } from '@/utils/format'

export default function PaymentSuccessPage() {
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderInfo, setOrderInfo] = useState<{
    orderId?: string;
    method?: string;
    status?: string;
    orders?: Array<{ payment_method?: string }>;
    payment?: { method?: string };
  } | null>(null)
  
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

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보가 유효하지 않습니다.')
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
        setError('결제 금액이 유효하지 않습니다.')
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
        setError(response.data.error || '결제 승인에 실패했습니다.')
        return
      }

      addBreadcrumb('payment', 'confirm success', { orderId })

      const paymentData = response.data.data
      setOrderInfo(paymentData)

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

      // 3️⃣ 장바구니 비우기 (바로구매 모드에서는 스킵)
      const isDirectPurchase = sessionStorage.getItem('directPurchase') === 'true'
      sessionStorage.removeItem('directPurchase')
      if (!isDirectPurchase) try {
        await api.post('/api/cart/clear')
        localStorage.removeItem('hasCartItems')
      } catch (cartErr) {
      }

    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      captureError(err as Error, { flow: 'payment_confirm', orderId })
      setError(axiosErr.response?.data?.error || '결제 승인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      isProcessingRef.current = false // 처리 완료
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[#6e6e73] font-medium">결제를 승인하는 중입니다...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[#1d1d1f] mb-4">결제 승인 실패</h1>
          <p className="text-[#6e6e73] mb-8">{error}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/checkout')}
              className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
            >
              다시 시도
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-[#007aff] hover:bg-[#0051d5] text-white"
            >
              메인으로
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4 py-6">
      <SEO title="결제 완료 - 유어딜" description="주문이 성공적으로 완료되었습니다" url="/payment/success" noindex />
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-lg border border-[#e5e5e7]">
          {/* 성공 아이콘 */}
          <div className="text-center mb-5 sm:mb-6 lg:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-green-100 mb-3 sm:mb-4">
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-green-600" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1d1d1f] mb-1 sm:mb-2">결제 완료!</h1>
            <p className="text-xs sm:text-sm lg:text-base text-[#6e6e73]">주문이 성공적으로 완료되었습니다.</p>
          </div>

          {/* 주문 정보 */}
          {orderInfo && (
            <div className="space-y-3 sm:space-y-4 lg:space-y-6">
              <div className="bg-[#f5f5f7] rounded-lg sm:rounded-xl p-4 sm:p-5 lg:p-6">
                <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-[#1d1d1f] mb-3 sm:mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-[#007aff]" />
                  주문 정보
                </h2>

                <div className="space-y-2.5 sm:space-y-3">
                  {/* 주문번호 */}
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-xs sm:text-sm text-[#6e6e73] font-medium shrink-0">주문번호</span>
                    <span className="text-xs sm:text-sm font-semibold text-[#007aff] font-mono break-all text-right max-w-[65%]">
                      {orderInfo.orderId || orderId}
                    </span>
                  </div>

                  <div className="flex justify-between items-center gap-3">
                    <span className="text-xs sm:text-sm text-[#6e6e73] font-medium shrink-0">결제 방법</span>
                    <span className="text-xs sm:text-sm lg:text-base font-semibold text-[#1d1d1f]">
                      {orderInfo.payment?.method || orderInfo.orders?.[0]?.payment_method || '-'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 sm:pt-3 mt-1 border-t border-[#d2d2d7]">
                    <span className="text-sm sm:text-base lg:text-lg font-medium text-[#1d1d1f]">결제 금액</span>
                    <span className="text-lg sm:text-xl lg:text-2xl font-bold text-[#007aff]">
                      {parseInt(amount || '0')}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 안내 메시지 */}
              {orderInfo?.status === 'demo' ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm lg:text-base text-yellow-900 leading-relaxed">
                    🎭 <strong>데모 모드</strong>: 실제 결제가 진행되지 않았습니다. 테스트 목적으로만 사용하세요.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm lg:text-base text-blue-900 leading-relaxed">
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
                  className="w-full sm:flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  다시 테스트하기
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className="w-full sm:flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-all"
                >
                  메인으로
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/my-orders')}
                  className="w-full sm:flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  주문 내역 보기
                </Button>
                <Button
                  onClick={() => {
                    // ✅ UX M20 FIX: 1시간 이상 경과한 lastViewedLiveId는 stale로 간주하여 홈으로 이동
                    const lastLiveId = localStorage.getItem('lastViewedLiveId')
                    const lastViewedAt = localStorage.getItem('lastViewedLiveAt')
                    const isStale = !lastViewedAt || (Date.now() - parseInt(lastViewedAt, 10)) > 3600000
                    if (lastLiveId && !isStale) {
                      navigate(`/live/${lastLiveId}`)
                    } else {
                      navigate('/')
                    }
                  }}
                  className="w-full sm:flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-all"
                >
                  쇼핑 계속하기
                </Button>
              </>
            )}
          </div>

          {/* 고객센터 정보 */}
          <div className="mt-5 sm:mt-6 lg:mt-8 pt-5 sm:pt-6 border-t border-[#e5e5e7] text-center">
            <p className="text-xs sm:text-sm text-[#86868b] mb-2">
              궁금한 점이 있으신가요?
            </p>
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-[#1d1d1f] mb-1.5">
              📞 고객센터: 0507-0177-0432
            </p>
            <p className="text-xs sm:text-sm text-[#86868b]">
              평일 09:00 - 18:00
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
