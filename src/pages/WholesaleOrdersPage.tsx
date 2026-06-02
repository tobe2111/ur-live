import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Package } from 'lucide-react'
import { formatWon } from '@/utils/format'

// 🏭 2026-06-01 유통스타트 — 유통사 도매 주문 내역 (Phase 2).

interface OrderRow {
  id: number
  toss_order_id: string
  status: string
  grade: string | null
  subtotal: number
  courier: string | null
  tracking_number: string | null
  created_at: string
  paid_at: string | null
  shipped_at: string | null
}

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  PENDING: { t: '결제대기', c: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  PAID: { t: '결제완료', c: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  SHIPPED: { t: '발송완료', c: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  PARTIAL_REFUNDED: { t: '부분환불', c: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  REFUNDED: { t: '환불완료', c: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' },
  CANCELLED: { t: '취소', c: 'bg-gray-100 text-gray-500 dark:bg-[#1A1A1A] dark:text-gray-400' },
  FAILED: { t: '실패', c: 'bg-gray-100 text-gray-500 dark:bg-[#1A1A1A] dark:text-gray-400' },
}

export default function WholesaleOrdersPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/seller/login'); return }
    api.get('/api/wholesale/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data.success) setOrders(r.data.orders || []) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      <SEO title="도매 주문 내역 - 유통스타트" description="유통사 도매 주문 내역" url="/wholesale/orders" noindex />
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121212]/95 backdrop-blur border-b border-gray-100 dark:border-[#2A2A2A]">
        <div className="ur-content-wide flex items-center gap-3 px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate('/wholesale')} aria-label="뒤로"><ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" /></button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">도매 주문 내역</h1>
        </div>
      </header>

      <main className="ur-content-wide px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 dark:text-gray-500">
            <Package className="w-10 h-10 mb-3" /><p>주문 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const st = STATUS_LABEL[o.status] || { t: o.status, c: 'bg-gray-100 text-gray-600 dark:bg-[#1A1A1A] dark:text-gray-300' }
              return (
                <div key={o.id} className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(o.created_at).toLocaleString('ko-KR')}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.c}`}>{st.t}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">주문 #{o.id}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">{formatWon(o.subtotal)}</span>
                  </div>
                  {o.tracking_number && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">송장: {o.courier} {o.tracking_number}</div>
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
