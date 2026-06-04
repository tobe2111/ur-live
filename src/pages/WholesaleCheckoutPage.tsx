import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { getTossPayments, getTossClientKey } from '@/lib/toss-preload'
import { getSellerId } from '@/lib/seller-auth'
import { WT, won } from './wholesale/wholesale-theme'

// 🏭 2026-06-01 유통스타트 도매 B2B 선결제 (Phase 2). 셀러(유통사) 컨텍스트 Toss 위젯.
//   TossWidgetPayPage 의 검증된 시퀀스를 셀러용으로 복제 (customerKey = wseller_<id>).

type TossWidgets = ReturnType<Awaited<ReturnType<typeof getTossPayments>>['widgets']>

interface OrderState { orderId: string; amount: number; orderName: string }

export default function WholesaleCheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const stateOrder = (location.state || null) as OrderState | null

  const [order, setOrder] = useState<OrderState | null>(stateOrder)
  const [state, setState] = useState<'loading' | 'ready' | 'processing' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const initializedRef = useRef(false)
  const widgetsRef = useRef<TossWidgets | null>(null)

  // 새로고침 등으로 navigation state 유실 시 ?order=<id> 로 주문 재조회해 복구.
  useEffect(() => {
    if (stateOrder?.orderId) return
    const oid = sp.get('order')
    if (!oid) return
    const token = localStorage.getItem('seller_token')
    api.get(`/api/wholesale/orders/${oid}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.data.success) { setErrorMsg('주문을 찾을 수 없습니다.'); setState('error'); return }
        const o = r.data.order as { toss_order_id: string; subtotal: number; status: string }
        if (o.status !== 'PENDING') { setErrorMsg('이미 처리된 주문입니다.'); setState('error'); return }
        const items = (r.data.items || []) as Array<{ name: string }>
        const orderName = items.length <= 1
          ? (items[0]?.name || '도매 주문').slice(0, 90)
          : `${items[0].name.slice(0, 40)} 외 ${items.length - 1}건`
        setOrder({ orderId: o.toss_order_id, amount: o.subtotal, orderName })
      })
      .catch(() => { setErrorMsg('주문 정보를 불러오지 못했습니다.'); setState('error') })
  }, [stateOrder, sp])

  useEffect(() => {
    if (initializedRef.current) return
    if (!order || !order.orderId || !Number.isFinite(order.amount) || order.amount <= 0 || !order.orderName) {
      // state 없고 ?order 재조회도 불가할 때만 에러 — 재조회 대기 중에는 단정하지 않음.
      if (!sp.get('order') && !stateOrder) { setErrorMsg('주문 정보가 올바르지 않습니다. 카탈로그에서 다시 주문해주세요.'); setState('error') }
      return
    }
    const sellerId = getSellerId()
    if (!sellerId) { navigate('/seller/login'); return }
    initializedRef.current = true

    const STEP_TIMEOUT_MS = 8000
    const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`[TIMEOUT:${label}]`)), STEP_TIMEOUT_MS))])

    let cancelled = false
    ;(async () => {
      try {
        const clientKey = getTossClientKey()
        const sdk = await withTimeout(getTossPayments(clientKey), 'SDK_LOAD')
        if (cancelled) return
        const sanitized = String(sellerId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 40)
        const widgets = sdk.widgets({ customerKey: `wseller_${sanitized}`.substring(0, 50) })
        if (!widgets) throw new Error('widgets() returned null')
        await withTimeout(widgets.setAmount({ currency: 'KRW', value: Math.round(order.amount) }), 'SET_AMOUNT')

        let svPayment = '', svAgreement = ''
        try {
          const r = await fetch('/api/payments/client-key', { cache: 'no-store' })
          const j = await r.json() as { data?: { variant_payment?: string; variant_agreement?: string } }
          svPayment = String(j?.data?.variant_payment || '')
          svAgreement = String(j?.data?.variant_agreement || '')
        } catch { /* fallback */ }
        const VK_PAYMENT = svPayment || ((import.meta.env.VITE_TOSS_VARIANT_PAYMENT as string) || '')
        const VK_AGREEMENT = svAgreement || ((import.meta.env.VITE_TOSS_VARIANT_AGREEMENT as string) || '')

        const tryRender = async (method: 'renderPaymentMethods' | 'renderAgreement', selector: string, preferred: string) => {
          if (preferred) {
            try { await withTimeout(widgets[method]({ selector, variantKey: preferred }) as unknown as Promise<void>, `${method}:${preferred}`); return } catch { /* fall through */ }
          }
          await withTimeout(widgets[method]({ selector }) as unknown as Promise<void>, `${method}:default`)
        }
        await tryRender('renderPaymentMethods', '#wholesale-pay-method', VK_PAYMENT)
        await tryRender('renderAgreement', '#wholesale-pay-agreement', VK_AGREEMENT)

        if (cancelled) return
        widgetsRef.current = widgets
        setState('ready')
      } catch (err: unknown) {
        if (cancelled) return
        const raw = err instanceof Error ? err.message : String(err)
        const baseMsg = /TIMEOUT/i.test(raw)
          ? '결제 위젯 로딩이 지연됩니다. 새로고침해주세요.'
          : /not.*found|404|variant/i.test(raw)
          ? '결제 수단이 Toss 콘솔에 등록되어 있지 않습니다.'
          : '결제 초기화 실패'
        setErrorMsg(`${baseMsg}\n\n[SDK]: ${raw.slice(0, 200)}`)
        setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [order, navigate])

  async function handlePay() {
    if (!widgetsRef.current || state !== 'ready' || !order) return
    setState('processing')
    try {
      await widgetsRef.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName.length > 100 ? order.orderName.slice(0, 97) + '...' : order.orderName,
        successUrl: `${window.location.origin}/wholesale/success`,
        failUrl: `${window.location.origin}/wholesale/checkout`,
      })
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e?.code === 'USER_CANCEL') { setState('ready'); return }
      setErrorMsg(e?.message || '결제 요청 실패')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="도매 결제 - 유통스타트" description="유통사 도매 결제" url="/wholesale/checkout" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>도매 결제</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 py-5 space-y-4 pb-32">
        <section className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line }}>
          <p className="text-[12px] mb-1" style={{ color: WT.ink3 }}>주문 상품</p>
          <p className="text-[15px] font-bold" style={{ color: WT.ink }}>{order?.orderName || '—'}</p>
          <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
            <span className="text-[13px]" style={{ color: WT.ink3 }}>결제 금액</span>
            <span className="text-[20px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{order ? won(order.amount) : '—'}</span>
          </div>
        </section>

        <div id="wholesale-pay-method" className="min-h-[180px] rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid ' + WT.line }} />
        <div id="wholesale-pay-agreement" className="min-h-[60px] rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid ' + WT.line }} />

        {state === 'error' && errorMsg && (
          <div className="p-4 rounded-2xl" style={{ background: '#FDECEF', border: '1px solid #F8C9D2' }}>
            <p className="text-[13px] font-medium whitespace-pre-wrap" style={{ color: '#B3253B' }}>{errorMsg}</p>
            <button onClick={() => navigate('/wholesale')} className="mt-2 text-[12px] underline font-medium" style={{ color: WT.ink2 }}>카탈로그로 돌아가기</button>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white z-30" style={{ borderTop: '1px solid ' + WT.line, boxShadow: WT.shUp, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="ur-content-narrow px-4 pt-3">
          <button onClick={handlePay} disabled={state !== 'ready'} className="w-full h-14 text-[16px] font-bold rounded-2xl text-white disabled:opacity-50" style={{ background: WT.brand }}>
            {state === 'loading' && <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />결제 시스템 로딩 중...</span>}
            {state === 'processing' && <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />결제 진행 중...</span>}
            {state === 'ready' && order && `${won(order.amount)} 결제하기`}
            {state === 'error' && '결제 시스템 오류'}
          </button>
        </div>
      </div>
    </div>
  )
}
