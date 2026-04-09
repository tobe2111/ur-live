import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Zap, Clock, ShoppingCart } from 'lucide-react'

interface TimeDeal {
  id: number; product_id: number; product_name: string
  original_price: number; deal_price: number; discount_percent: number
  max_claims: number; claimed_count: number
  status: string; expires_at: string
}

export default function TimeDealPopup({ streamId }: { streamId: string | number }) {
  const navigate = useNavigate()
  const [deal, setDeal] = useState<TimeDeal | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [show, setShow] = useState(false)
  const prevDealId = useRef<number | null>(null)

  useEffect(() => {
    const poll = () => {
      api.get(`/api/timedeal/stream/${streamId}`).then(r => {
        if (r.data.success && r.data.data && r.data.data.status === 'active') {
          const d = r.data.data
          setDeal(d)
          setTimeLeft(Math.max(0, Math.floor((new Date(d.expires_at).getTime() - Date.now()) / 1000)))
          if (prevDealId.current !== d.id) {
            prevDealId.current = d.id
            setShow(true)
            setClaimed(false)
          }
        } else {
          if (deal && deal.status === 'active') setShow(false)
          setDeal(null)
        }
      }).catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 2000)
    return () => clearInterval(iv)
  }, [streamId])

  useEffect(() => {
    if (deal?.status === 'active' && timeLeft > 0) {
      const t = setInterval(() => setTimeLeft(v => {
        if (v <= 1) { setShow(false); return 0 }
        return v - 1
      }), 1000)
      return () => clearInterval(t)
    }
  }, [deal?.id, deal?.status])

  const handleClaim = async () => {
    if (!deal || claiming || claimed) return
    setClaiming(true)
    try {
      const res = await api.post(`/api/timedeal/${deal.id}/claim`)
      if (res.data.success) {
        setClaimed(true)
        toast.success('타임딜 획득! 장바구니에서 할인가로 구매하세요')
      } else {
        toast.error(res.data.error)
      }
    } catch (err: any) { toast.error(err?.response?.data?.error || '참여 실패') }
    finally { setClaiming(false) }
  }

  if (!deal || !show || deal.status !== 'active') return null

  const remaining = deal.max_claims - deal.claimed_count
  const progressPct = Math.min(100, (deal.claimed_count / deal.max_claims) * 100)

  return (
    <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 animate-in slide-in-from-bottom duration-300">
      <div className="w-full max-w-md bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-4 text-white shadow-2xl relative overflow-hidden">
        {/* 배경 효과 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
        </div>

        <div className="relative">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              <span className="font-bold">타임딜!</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono font-bold text-sm">{timeLeft}초</span>
            </div>
          </div>

          {/* 상품 정보 */}
          <p className="text-sm font-semibold line-clamp-1 mb-1">{deal.product_name}</p>

          <div className="flex items-end gap-2 mb-2">
            <span className="text-[10px] line-through text-white/60">{deal.original_price.toLocaleString()}원</span>
            <span className="text-xl font-bold">{deal.deal_price.toLocaleString()}원</span>
            <span className="bg-yellow-400 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded">
              -{deal.discount_percent}%
            </span>
          </div>

          {/* 남은 수량 바 */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-white/70 mb-1">
              <span>남은 수량 {remaining}개</span>
              <span>{deal.claimed_count}/{deal.max_claims}</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleClaim}
              disabled={claiming || claimed || remaining <= 0}
              className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-[0.97] transition-all ${
                claimed ? 'bg-green-400 text-green-900' :
                remaining <= 0 ? 'bg-gray-400 text-gray-200' :
                'bg-white text-red-600'
              }`}
            >
              {claimed ? '✓ 획득 완료' : remaining <= 0 ? '매진' : claiming ? '처리 중...' : '지금 구매하기'}
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-4 py-3 bg-white/20 rounded-xl text-sm font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
