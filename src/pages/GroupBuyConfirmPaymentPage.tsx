/**
 * 🛡️ 2026-05-22: 공구 토스 결제 confirm 페이지 — Toss success URL 에서 도달.
 *
 * 흐름:
 *   1) Toss 호스팅 결제 페이지에서 결제 완료 → redirect /group-buy/confirm-payment?paymentKey=...&orderId=...&amount=...&productId=...&qty=...
 *   2) 본 페이지 mount → /api/group-buy/confirm-toss 호출 → 서버가 Toss 승인 + voucher 발급
 *   3) 성공 시 /my-vouchers 로 이동, 실패 시 에러 표시 + 고객센터 안내
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'

export default function GroupBuyConfirmPaymentPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [state, setState] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const processedRef = useRef(false)

  const paymentKey = params.get('paymentKey') || ''
  const orderId = params.get('orderId') || ''
  const amount = Number(params.get('amount') || 0)
  const productId = Number(params.get('productId') || 0)
  const qty = Math.max(1, Number(params.get('qty') || 1))

  useEffect(() => {
    if (processedRef.current) return
    if (!paymentKey || !orderId || !amount || !productId) {
      setErrorMsg('결제 정보가 올바르지 않습니다.')
      setState('error')
      return
    }
    processedRef.current = true

    api.post('/api/group-buy/confirm-toss', { paymentKey, orderId, amount, productId, qty })
      .then((r) => {
        if (r.data?.success) {
          setState('success')
          try {
            localStorage.setItem('gb_just_joined', JSON.stringify({
              product_id: productId,
              timestamp: Date.now(),
            }))
          } catch { /* */ }
          setTimeout(() => navigate('/my-vouchers'), 1500)
        } else {
          setErrorMsg(r.data?.error || '결제 처리 실패')
          setState('error')
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || err?.message || '결제 승인 중 오류'
        setErrorMsg(msg)
        setState('error')
      })
  }, [paymentKey, orderId, amount, productId, qty, navigate])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center px-4">
      <SEO title="공구 결제 처리" url="/group-buy/confirm-payment" noindex />
      <div className="text-center max-w-sm">
        {state === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">결제 승인 중...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">잠시만 기다려주세요</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">공구 참여 완료!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">교환권 페이지로 이동합니다...</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">결제 처리 실패</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{errorMsg}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">고객센터에 문의해주세요.<br/>결제 정보: {orderId.slice(0, 20)}</p>
            <button
              onClick={() => navigate(`/group-buy/${productId}`)}
              className="mt-6 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold"
            >
              상품 페이지로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
