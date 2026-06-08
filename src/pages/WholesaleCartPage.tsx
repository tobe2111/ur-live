import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Trash2, ShoppingCart, CreditCard, Wallet } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { WT, won, comma } from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'

// 🏭 BIZ-2 v1: 여신(외상) 상태. /api/wholesale/me 의 credit 블록.
interface CreditInfo { limit: number; outstanding: number; available: number; frozen: boolean; enabled: boolean }

// 🏭 2026-06-04 유통스타트 도매몰 — 다품목 장바구니 (TDS 라이트).
//   카트 items[] → POST /api/wholesale/orders (배열 그대로) → 체크아웃. 라이트 고정 B2B.

export default function WholesaleCartPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { items, setQty, remove, clear, subtotal, totalQty } = useWholesaleCart()
  const [ordering, setOrdering] = useState(false)
  const [unavailable, setUnavailable] = useState<number[]>([])
  // 🏭 BIZ-2 v1: 결제수단 — 'prepay'(기본 선결제) | 'credit'(여신/외상). 기본은 항상 선결제.
  const [payMethod, setPayMethod] = useState<'prepay' | 'credit'>('prepay')
  const [credit, setCredit] = useState<CreditInfo | null>(null)

  useEffect(() => {
    if (!token) return
    api.get('/api/wholesale/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.data?.success && r.data.credit) setCredit(r.data.credit as CreditInfo) })
      .catch(() => { /* 여신 미부여/오류 시 선결제만 노출 */ })
  }, [token])

  if (!token) return <Navigate to="/wholesale/intro" replace />

  // 여신 사용 가능 + 이번 주문이 가용 한도 이내일 때만 외상 선택 허용.
  const creditEligible = !!credit && credit.enabled && !credit.frozen && credit.available > 0
  const creditFitsOrder = creditEligible && subtotal <= (credit?.available || 0)
  const useCredit = payMethod === 'credit' && creditFitsOrder

  async function placeOrder() {
    if (!items.length || ordering) return
    setOrdering(true)
    setUnavailable([])
    try {
      const r = await api.post('/api/wholesale/orders', {
        items: items.map((x) => ({ product_id: x.id, qty: x.qty })),
        ...(useCredit ? { payment_method: 'credit' } : {}),
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) {
        if (r.data.payment_method === 'credit' || r.data.on_credit) {
          // 여신주문은 Toss 미경유 — 즉시 완료. 장바구니 비우고 외상 성공 안내.
          clear()
          navigate(`/wholesale/success?credit=1&order=${r.data.order_id}&amount=${r.data.amount}`)
        } else {
          // 🏭 2026-06-07 (안정성 — 사용자 승인): 장바구니는 결제 성공(success 페이지) 후 비움.
          //   기존엔 주문 생성(PENDING) 직후 비워 Toss 위젯 이탈/결제 실패 시 장바구니가 사라졌음.
          navigate(`/wholesale/checkout?order=${r.data.order_id}`, { state: { orderId: r.data.toss_order_id, amount: r.data.amount, orderName: r.data.order_name } })
        }
      } else { toast.error(r.data.error || '주문 생성 실패') }
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { error?: string; unavailable?: number[] } } })?.response?.data
      if (Array.isArray(data?.unavailable) && data.unavailable.length) setUnavailable(data.unavailable)
      toast.error(data?.error || '주문 생성 중 오류')
    } finally { setOrdering(false) }
  }

  const removeUnavailable = () => { unavailable.forEach(remove); setUnavailable([]) }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="장바구니 - 유통스타트 도매" description="도매 장바구니" url="/wholesale/cart" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={() => navigate('/wholesale')} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>장바구니 {items.length > 0 && <span style={{ color: WT.brand }}>{items.length}</span>}</h1>
        </div>
      </header>

      <main className="ur-content-narrow px-5 lg:px-8 py-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <ShoppingCart className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
            <p className="text-[15px] font-medium mb-1" style={{ color: WT.ink2 }}>장바구니가 비어 있어요</p>
            <p className="text-[13px] mb-6" style={{ color: WT.ink3 }}>도매 상품을 담아 한 번에 주문하세요</p>
            <button onClick={() => navigate('/wholesale')} className="px-6 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>상품 둘러보기</button>
          </div>
        ) : (
          <>
            {unavailable.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl p-3.5" style={{ background: '#FDECEF', border: '1px solid #F8C9D2' }}>
                <p className="text-[13px] font-medium" style={{ color: '#B3253B' }}>주문 불가 상품 {unavailable.length}개가 있어요 (품절·중지·권한 변경)</p>
                <button onClick={removeUnavailable} className="shrink-0 px-3 h-9 rounded-lg text-[13px] font-bold text-white" style={{ background: '#D63A4E' }}>빼고 계속</button>
              </div>
            )}
            <div className="space-y-2.5">
              {items.map((it) => {
                const bad = unavailable.includes(it.id)
                return (
                <div key={it.id} className="flex gap-3 rounded-2xl bg-white p-3" style={{ border: '1px solid ' + (bad ? '#F1AAB6' : WT.line), background: bad ? '#FFF6F8' : '#fff' }}>
                  <button onClick={() => navigate(`/wholesale/product/${it.id}`)} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden" style={{ background: WT.fill }}>
                    {it.image_url && <img src={it.image_url} alt={it.name || ''} className="w-full h-full object-cover" loading="lazy" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button onClick={() => navigate(`/wholesale/product/${it.id}`)} className="text-left text-[14px] font-medium line-clamp-2 leading-[1.4]" style={{ color: WT.ink }}>{it.name || `상품 #${it.id}`}</button>
                        {bad && <span className="inline-block mt-1 px-2 py-0.5 text-[11px] font-bold rounded-full" style={{ background: '#FDECEF', color: '#B3253B' }}>주문 불가</span>}
                      </div>
                      <button onClick={() => remove(it.id)} aria-label="삭제" className="shrink-0 p-1"><Trash2 className="w-4 h-4" style={{ color: WT.ink4 }} /></button>
                    </div>
                    <div className="mt-1 text-[14px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(it.price || 0)} <span className="text-[12px] font-medium" style={{ color: WT.ink4 }}>/ 개</span></div>
                    <div className="mt-2 flex items-center justify-between">
                      {(() => { const step = Math.max(1, it.moq || 1); return (
                      <div className="inline-flex items-center rounded-full h-9" style={{ background: WT.fill }}>
                        <button className="h-9 w-9 text-[18px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty - step)} disabled={it.qty <= step}>−</button>
                        <span className="w-10 text-center text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(it.qty)}</span>
                        <button className="h-9 w-9 text-[18px]" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty + step)}>+</button>
                      </div>
                      )})()}
                      <span className="text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{won((it.price || 0) * it.qty)}</span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
            <button onClick={clear} className="mt-3 text-[13px] font-medium" style={{ color: WT.ink3 }}>전체 비우기</button>

            <div className="mt-5 rounded-2xl p-4" style={{ background: WT.fill2 }}>
              <div className="flex items-center justify-between text-[14px]">
                <span style={{ color: WT.ink3 }}>총 {comma(totalQty)}개 · {items.length}개 상품</span>
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(subtotal)}</span>
              </div>
              <p className="mt-1 text-[12px]" style={{ color: WT.ink4 }}>실제 결제 금액은 주문 시 서버에서 등급 공급가로 재계산됩니다.</p>
            </div>

            {/* 🏭 BIZ-2 v1: 결제수단 — 여신(외상) 사용 가능 유통사에게만 외상 옵션 노출. 기본=선결제. */}
            {creditEligible && (
              <div className="mt-4">
                <p className="text-[13px] font-bold mb-2" style={{ color: WT.ink }}>결제수단</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('prepay')}
                    className="w-full flex items-center gap-3 rounded-2xl p-3.5 text-left transition"
                    style={{ border: '1.5px solid ' + (payMethod === 'prepay' ? WT.brand : WT.line), background: payMethod === 'prepay' ? '#FFF6F8' : '#fff' }}
                  >
                    <CreditCard className="w-5 h-5 shrink-0" style={{ color: payMethod === 'prepay' ? WT.brand : WT.ink3 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold" style={{ color: WT.ink }}>선결제 (카드/계좌)</div>
                      <div className="text-[12px]" style={{ color: WT.ink3 }}>토스페이먼츠로 즉시 결제</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('credit')}
                    disabled={!creditFitsOrder}
                    className="w-full flex items-center gap-3 rounded-2xl p-3.5 text-left transition disabled:opacity-50"
                    style={{ border: '1.5px solid ' + (payMethod === 'credit' && creditFitsOrder ? WT.brand : WT.line), background: payMethod === 'credit' && creditFitsOrder ? '#FFF6F8' : '#fff' }}
                  >
                    <Wallet className="w-5 h-5 shrink-0" style={{ color: payMethod === 'credit' && creditFitsOrder ? WT.brand : WT.ink3 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold" style={{ color: WT.ink }}>여신 결제 (외상)</div>
                      <div className="text-[12px] tabular-nums" style={{ color: WT.ink3 }}>
                        가용 한도 {won(credit?.available || 0)} <span style={{ color: WT.ink4 }}>(한도 {won(credit?.limit || 0)} − 미수금 {won(credit?.outstanding || 0)})</span>
                      </div>
                      {!creditFitsOrder && (
                        <div className="text-[11px] mt-0.5 font-medium" style={{ color: '#B3253B' }}>이 주문 금액이 가용 한도를 초과합니다</div>
                      )}
                    </div>
                  </button>
                </div>
                {useCredit && (
                  <p className="mt-2 text-[11px]" style={{ color: WT.ink4 }}>여신 결제 시 결제 없이 즉시 주문되고, 미수금은 정산일에 정산됩니다.</p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white z-40 px-5" style={{ borderTop: '1px solid ' + WT.line, boxShadow: WT.shUp, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', paddingTop: '0.75rem' }}>
          <div className="ur-content-narrow mx-auto flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[12px]" style={{ color: WT.ink3 }}>합계</div>
              <div className="text-[19px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(subtotal)}</div>
            </div>
            <button onClick={placeOrder} disabled={ordering} className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
              {ordering ? <Loader2 className="w-5 h-5 animate-spin inline" /> : useCredit ? `여신으로 ${comma(items.length)}개 주문` : `${comma(items.length)}개 상품 주문`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
