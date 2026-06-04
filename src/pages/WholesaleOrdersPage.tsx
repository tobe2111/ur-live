import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Package, Truck } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { useWholesaleOrders } from '@/hooks/queries/useWholesale'
import { WT, won } from './wholesale/wholesale-theme'

// 🏭 2026-06-04 유통스타트 도매 주문 내역 — TDS 라이트 시안 정비. 라이트 고정 B2B.

const STATUS: Record<string, { t: string; c: string; bg: string }> = {
  PENDING: { t: '결제대기', c: '#9A6B00', bg: '#FFF6E6' },
  PAID: { t: '결제완료', c: '#11875A', bg: '#EAF6EF' },
  SHIPPED: { t: '배송중', c: '#1B64DA', bg: '#EAF1FE' },
  PARTIAL_REFUNDED: { t: '부분환불', c: '#C2620C', bg: '#FFF1E6' },
  REFUNDED: { t: '환불완료', c: '#D63A4E', bg: '#FDECEF' },
  CANCELLED: { t: '취소', c: '#8A929E', bg: '#F2F4F6' },
  EXPIRED: { t: '만료', c: '#B6BCC4', bg: '#F2F4F6' },
  FAILED: { t: '실패', c: '#8A929E', bg: '#F2F4F6' },
  DONE: { t: '구매확정', c: '#11875A', bg: '#EAF6EF' },
}

export default function WholesaleOrdersPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { data: orders = [], isLoading: loading } = useWholesaleOrders()

  useEffect(() => { if (!token) navigate('/seller/login') }, [token, navigate])

  function copyTrack(track: string) {
    navigator.clipboard?.writeText(track).then(() => toast.success('운송장 번호를 복사했어요')).catch(() => { /* noop */ })
  }

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="도매 주문 내역 - 유통스타트" description="유통사 도매 주문 내역" url="/wholesale/orders" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={() => navigate('/wholesale')} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>주문 내역</h1>
        </div>
      </header>

      <main className="ur-content-narrow px-5 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: WT.ink4 }} /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Package className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
            <p className="text-[15px] font-medium mb-1" style={{ color: WT.ink2 }}>주문 내역이 없어요</p>
            <button onClick={() => navigate('/wholesale')} className="mt-5 px-6 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>상품 둘러보기</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map(o => {
              const st = STATUS[o.status] || { t: o.status, c: WT.ink2, bg: WT.fill }
              return (
                <div key={o.id} className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[12px] tabular-nums" style={{ color: WT.ink4 }}>{new Date(o.created_at).toLocaleString('ko-KR')}</span>
                    <span className="text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: st.c, background: st.bg }}>{st.t}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: WT.ink2 }}>주문 #{o.id}{o.grade ? ` · ${o.grade}등급가` : ''}</span>
                    <span className="text-[17px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{won(o.subtotal)}</span>
                  </div>
                  {o.tracking_number && (
                    <button onClick={() => copyTrack(o.tracking_number!)} className="mt-3 w-full flex items-center justify-between rounded-xl px-3.5 h-11" style={{ background: WT.fill2 }}>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: WT.ink2 }}><Truck className="w-4 h-4" /> {o.courier || '택배'}</span>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: WT.ink }}>{o.tracking_number} <span className="text-[11px] font-medium" style={{ color: WT.ink4 }}>복사</span></span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
