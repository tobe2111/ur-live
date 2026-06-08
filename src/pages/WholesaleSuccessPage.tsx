import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { WT, won } from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'

// 🏭 2026-06-01 유통스타트 도매 결제 성공 → 서버 confirm (Phase 2).
//   Toss 가 successUrl 에 paymentKey/orderId/amount 를 붙여 redirect.

export default function WholesaleSuccessPage() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const [state, setState] = useState<'confirming' | 'done' | 'error'>('confirming')
  const [errorMsg, setErrorMsg] = useState('')
  const ranRef = useRef(false)
  const { clear } = useWholesaleCart()

  const paymentKey = sp.get('paymentKey') || ''
  const orderId = sp.get('orderId') || ''
  const amount = Number(sp.get('amount') || '0')
  // 🏭 BIZ-2 v1: 여신(외상) 주문은 Toss 미경유 — 서버에서 이미 ON_CREDIT 로 확정됨. confirm 불필요.
  const isCredit = sp.get('credit') === '1'

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const token = localStorage.getItem('seller_token')
    if (!token) { navigate('/seller/login'); return }
    if (isCredit) {
      // 외상 주문은 cart 에서 이미 생성·확정·장바구니 비움 완료 → 안내만.
      setState('done'); return
    }
    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
      setErrorMsg('결제 정보가 올바르지 않습니다.'); setState('error'); return
    }
    api.post('/api/wholesale/orders/confirm', { paymentKey, orderId, amount }, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.data.success) { clear(); setState('done') }  // 🏭 2026-06-07: 결제 성공 후 장바구니 비움(이탈 보존).
        else { setErrorMsg(r.data.error || '결제 확인 실패'); setState('error') }
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        setErrorMsg(msg || '결제 확인 중 오류가 발생했습니다'); setState('error')
      })
  }, [paymentKey, orderId, amount, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="도매 결제 완료 - 유통스타트" description="도매 주문 결제 결과" url="/wholesale/success" noindex />
      {state === 'confirming' && (
        <><Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: WT.ink4 }} /><p style={{ color: WT.ink2 }}>결제를 확인하고 있습니다...</p></>
      )}
      {state === 'done' && (
        <>
          <CheckCircle2 className="w-14 h-14 mb-4" style={{ color: WT.pos }} />
          <h1 className="text-xl font-bold mb-1" style={{ color: WT.ink }}>주문이 완료되었습니다</h1>
          <p className="tabular-nums" style={{ color: WT.ink2 }}>{won(amount)} {isCredit ? '여신(외상) 주문 완료' : '결제 완료'}</p>
          {isCredit && <p className="mt-1 text-[13px]" style={{ color: WT.ink3 }}>미수금은 정산일에 정산됩니다. 거래내역에서 확인하세요.</p>}
          <div className="mb-6" />
          <div className="flex gap-3">
            <button onClick={() => navigate('/wholesale/orders')} className="px-5 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>주문 내역</button>
            <button onClick={() => navigate('/wholesale')} className="px-5 h-12 rounded-xl font-bold" style={{ background: WT.fill, color: WT.ink }}>계속 쇼핑</button>
          </div>
        </>
      )}
      {state === 'error' && (
        <>
          <XCircle className="w-14 h-14 mb-4" style={{ color: '#D63A4E' }} />
          <h1 className="text-xl font-bold mb-1" style={{ color: WT.ink }}>결제 확인 실패</h1>
          <p className="mb-6 whitespace-pre-wrap" style={{ color: WT.ink2 }}>{errorMsg}</p>
          <button onClick={() => navigate('/wholesale')} className="px-5 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>카탈로그로</button>
        </>
      )}
    </div>
  )
}
