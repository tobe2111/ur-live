import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Minus, Plus, Tag } from 'lucide-react'
import { formatWon } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import { useWholesaleProduct } from '@/hooks/queries/useWholesale'

// 🏭 2026-06-01 유통스타트 도매 상품 상세 + B2B 주문 (Phase 2).

export default function WholesaleProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const h = { headers: { Authorization: `Bearer ${token}` } }

  // 🛡️ 2026-06-01 Tier2: 읽기는 React Query. 주문 POST(placeOrder) 는 그대로 유지.
  const { data, isLoading: loading } = useWholesaleProduct(id)
  const item = data?.item ?? null
  const grade = data?.grade ?? ''
  const [qty, setQty] = useState(1)
  const [ordering, setOrdering] = useState(false)

  useEffect(() => {
    if (!token) navigate('/seller/login')
  }, [token, navigate])

  async function placeOrder() {
    if (!item || ordering) return
    setOrdering(true)
    try {
      const r = await api.post('/api/wholesale/orders', { items: [{ product_id: item.id, qty }] }, h)
      if (r.data.success) {
        // order_id 를 쿼리로도 전달 — 체크아웃 새로고침 시 state 유실되어도 복구 가능.
        navigate(`/wholesale/checkout?order=${r.data.order_id}`, {
          state: { orderId: r.data.toss_order_id, amount: r.data.amount, orderName: r.data.order_name },
        })
      } else {
        toast.error(r.data.error || '주문 생성 실패')
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || '주문 생성 중 오류')
    } finally { setOrdering(false) }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex justify-center items-center"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
  }
  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">상품을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/wholesale')} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg">카탈로그로</button>
      </div>
    )
  }

  const total = item.distributor_price * qty

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] pb-28">
      <SEO title={`${item.name} - 유통스타트 도매`} description="유통사 전용 도매 공급가" url={`/wholesale/product/${item.id}`} noindex />
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121212]/95 backdrop-blur border-b border-gray-100 dark:border-[#2A2A2A]">
        <div className="ur-content-wide flex items-center gap-3 px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} aria-label="뒤로"><ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" /></button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white truncate">{item.name}</h1>
        </div>
      </header>

      <main className="ur-content-wide px-4 lg:px-8 py-5 lg:grid lg:grid-cols-2 lg:gap-8">
        <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A] rounded-2xl overflow-hidden mb-5 lg:mb-0">
          {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
        </div>
        <div>
          {grade && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-[#1A1A1A] dark:text-gray-200 mb-3">
              <Tag className="w-3.5 h-3.5" /> {grade} 공급가
            </span>
          )}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{item.name}</h2>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">{formatWon(item.distributor_price)}</div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">재고 {item.stock?.toLocaleString('ko-KR') ?? 0}개</p>
          {item.description && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-6">{item.description}</p>}

          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">수량</span>
            <div className="flex items-center border border-gray-200 dark:border-[#2A2A2A] rounded-lg">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="p-2"><Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
              <input
                type="number" min={1} value={qty}
                onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                className="w-16 text-center bg-transparent text-gray-900 dark:text-white"
              />
              <button onClick={() => setQty(q => q + 1)} className="p-2"><Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121212] border-t border-gray-100 dark:border-[#2A2A2A] z-30" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="ur-content-wide px-4 lg:px-8 pt-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-xs text-gray-400 dark:text-gray-500">총 결제 금액</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">{formatWon(total)}</div>
          </div>
          <button
            onClick={placeOrder} disabled={ordering || item.stock <= 0}
            className="px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-full disabled:opacity-50"
          >
            {ordering ? <Loader2 className="w-5 h-5 animate-spin" /> : item.stock <= 0 ? '품절' : '주문하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
