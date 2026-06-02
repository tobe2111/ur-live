import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { formatWon } from '@/utils/format'

// 🏭 2026-06-01 유통스타트 도매 결제 성공 → 서버 confirm (Phase 2).
//   Toss 가 successUrl 에 paymentKey/orderId/amount 를 붙여 redirect.

export default function WholesaleSuccessPage() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const [state, setState] = useState<'confirming' | 'done' | 'error'>('confirming')
  const [errorMsg, setErrorMsg] = useState('')
  const ranRef = useRef(false)

  const paymentKey = sp.get('paymentKey') || ''
  const orderId = sp.get('orderId') || ''
  const amount = Number(sp.get('amount') || '0')

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const token = localStorage.getItem('seller_token')
    if (!token) { navigate('/seller/login'); return }
    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
      setErrorMsg('결제 정보가 올바르지 않습니다.'); setState('error'); return
    }
    api.post('/api/wholesale/orders/confirm', { paymentKey, orderId, amount }, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.data.success) setState('done')
        else { setErrorMsg(r.data.error || '결제 확인 실패'); setState('error') }
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        setErrorMsg(msg || '결제 확인 중 오류가 발생했습니다'); setState('error')
      })
  }, [paymentKey, orderId, amount, navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
      <SEO title="도매 결제 완료 - 유통스타트" description="도매 주문 결제 결과" url="/wholesale/success" noindex />
      {state === 'confirming' && (
        <><Loader2 className="w-10 h-10 animate-spin text-gray-400 mb-4" /><p className="text-gray-600 dark:text-gray-300">결제를 확인하고 있습니다...</p></>
      )}
      {state === 'done' && (
        <>
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">주문이 완료되었습니다</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{formatWon(amount)} 결제 완료</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/wholesale/orders')} className="px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold">주문 내역</button>
            <button onClick={() => navigate('/wholesale')} className="px-5 py-3 border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-200 rounded-lg font-semibold">계속 쇼핑</button>
          </div>
        </>
      )}
      {state === 'error' && (
        <>
          <XCircle className="w-14 h-14 text-rose-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">결제 확인 실패</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap">{errorMsg}</p>
          <button onClick={() => navigate('/wholesale')} className="px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold">카탈로그로</button>
        </>
      )}
    </div>
  )
}
