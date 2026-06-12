/**
 * 🛡️ 2026-06-12 (전수조사 4차 B-1): 숙소 결제 returnUrl 경량 페이지.
 *
 * Toss 위젯(/pay/widget) 의 successUrl/failUrl 양쪽이 이 페이지로 redirect:
 *   - 성공: ?order_id=N&paymentKey=...&orderId=STAY-N&amount=...
 *   - 실패: ?order_id=N&code=...&message=...
 *
 * 성공 시 POST /api/group-buy/stays/bookings/confirm { paymentKey, orderId(orders.id 숫자), amount }
 * 호출 — 서버가 금액 검증 + Toss 승인 + booking CAS confirm + 달력 차감.
 * PaymentSuccessPage(일반 주문 흐름, 잠금) 와 분리된 stays 전용 페이지.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'

type State = 'confirming' | 'success' | 'overbooked' | 'fail'

export default function StayCheckoutReturnPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<State>('confirming')
  const [message, setMessage] = useState('')
  const [amountDone, setAmountDone] = useState(0)
  const calledRef = useRef(false)

  const paymentKey = searchParams.get('paymentKey') || ''
  const tossOrderId = searchParams.get('orderId') || ''
  const amount = Number(searchParams.get('amount'))
  const failCode = searchParams.get('code') || ''
  const failMessage = searchParams.get('message') || ''
  const orderIdParam = Number(searchParams.get('order_id'))
  // order_id 쿼리 우선, 없으면 Toss orderId('STAY-N') 에서 복원.
  const orderId = Number.isFinite(orderIdParam) && orderIdParam > 0
    ? orderIdParam
    : Number(tossOrderId.replace(/^STAY-/, ''))

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    // Toss failUrl redirect (code/message) 또는 paymentKey 누락 → 실패 화면.
    if (failCode || !paymentKey) {
      setState('fail')
      setMessage(failMessage || '결제가 완료되지 않았습니다.')
      return
    }
    if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isFinite(amount) || amount <= 0) {
      setState('fail')
      setMessage('결제 정보가 올바르지 않습니다.')
      return
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('firebase_token')
    api.post(
      '/api/group-buy/stays/bookings/confirm',
      { paymentKey, orderId, amount },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    )
      .then((r) => {
        if (r.data?.success) {
          setAmountDone(Number(r.data.data?.amount) || amount)
          setState('success')
        } else {
          setState('fail')
          setMessage(r.data?.error || '결제 승인에 실패했습니다.')
        }
      })
      .catch((err: unknown) => {
        const ax = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
        if (ax.response?.data?.code === 'STAY_OVERBOOKED') {
          setState('overbooked')
          setMessage(ax.response.data?.error || '객실이 매진되어 결제가 자동 환불됩니다.')
        } else if (ax.response?.status === 401) {
          navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        } else {
          setState('fail')
          setMessage(ax.response?.data?.error || '결제 승인에 실패했습니다. 잠시 후 다시 시도해주세요.')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <SEO title="숙소 결제 확인 - 유어딜" description="숙소 결제 확인" url="/stays/checkout-return" noindex />
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 text-center">
        {state === 'confirming' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-pink-500 mx-auto mb-4" />
            <p className="text-[15px] font-bold text-gray-900">결제 승인 중...</p>
            <p className="text-[12px] text-gray-500 mt-1">잠시만 기다려주세요. 페이지를 닫지 마세요.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-[17px] font-extrabold text-gray-900">예약이 확정되었습니다 🎉</p>
            {amountDone > 0 && (
              <p className="text-[13px] text-gray-600 mt-1">결제 금액: ₩{formatNumber(amountDone)}</p>
            )}
            <p className="text-[12px] text-gray-500 mt-2">체크인 코드 등 상세는 내 숙소 예약에서 확인하세요.</p>
            <div className="mt-5 space-y-2">
              <button onClick={() => navigate('/my-stays', { replace: true })}
                className="w-full py-3 bg-pink-500 text-white text-[14px] font-bold rounded-full">
                내 숙소 예약 보기
              </button>
              <button onClick={() => navigate('/', { replace: true })}
                className="w-full py-3 bg-gray-100 text-gray-700 text-[14px] font-semibold rounded-full">
                홈으로
              </button>
            </div>
          </>
        )}
        {state === 'overbooked' && (
          <>
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-[16px] font-extrabold text-gray-900">객실이 매진되었습니다</p>
            <p className="text-[13px] text-gray-600 mt-2">{message}</p>
            <p className="text-[12px] text-gray-500 mt-1">결제는 자동 환불 처리됩니다 (영업일 기준 3-5일).</p>
            <button onClick={() => navigate('/stays', { replace: true })}
              className="mt-5 w-full py-3 bg-pink-500 text-white text-[14px] font-bold rounded-full">
              다른 숙소 둘러보기
            </button>
          </>
        )}
        {state === 'fail' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-[16px] font-extrabold text-gray-900">결제가 완료되지 않았습니다</p>
            {message && <p className="text-[13px] text-gray-600 mt-2 break-words">{message}</p>}
            <div className="mt-5 space-y-2">
              {Number.isFinite(orderId) && orderId > 0 && (
                <button onClick={() => navigate(`/checkout?order_id=${orderId}&stay=1`, { replace: true })}
                  className="w-full py-3 bg-pink-500 text-white text-[14px] font-bold rounded-full">
                  다시 결제하기
                </button>
              )}
              <button onClick={() => navigate('/my-stays', { replace: true })}
                className="w-full py-3 bg-gray-100 text-gray-700 text-[14px] font-semibold rounded-full">
                내 숙소 예약 보기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
