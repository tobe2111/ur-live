import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Gavel, Crown, Timer } from 'lucide-react'

interface AuctionData {
  id: number; title: string; start_price: number; current_price: number
  min_increment: number; bid_count: number; winner_name: string | null
  status: string; ends_at: string; top_bids: { user_name: string; amount: number }[]
}

export default function AuctionPanel({ streamId }: { streamId: string | number }) {
  const navigate = useNavigate()
  const [auction, setAuction] = useState<AuctionData | null>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [bidding, setBidding] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const poll = () => {
      api.get(`/api/auction/stream/${streamId}`).then(r => {
        if (r.data.success && r.data.data) {
          setAuction(r.data.data)
          const diff = Math.max(0, Math.floor((new Date(r.data.data.ends_at).getTime() - Date.now()) / 1000))
          setTimeLeft(diff)
          if (!bidAmount || bidAmount < r.data.data.current_price + r.data.data.min_increment) {
            setBidAmount(r.data.data.current_price + r.data.data.min_increment)
          }
        } else {
          setAuction(null)
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    }
    poll()
    // 🛡️ 2026-04-29 perf audit: 3초 → 5초 폴링 완화 (서버 부하 ↓)
    const iv = setInterval(poll, 5000)
    return () => clearInterval(iv)
  }, [streamId])

  useEffect(() => {
    if (auction?.status === 'active') {
      timerRef.current = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
      return () => clearInterval(timerRef.current)
    }
  }, [auction?.id, auction?.status])

  if (!auction) return null

  // 경매 종료 → 낙찰자에게 구매 버튼 표시
  if (auction.status === 'ended' && auction.winner_name) {
    return (
      <div className="bg-gradient-to-br from-green-500/90 to-emerald-600/90 backdrop-blur-md rounded-2xl p-4 text-white shadow-lg">
        <div className="text-center">
          <p className="text-sm font-bold mb-1">경매 종료!</p>
          <p className="text-xs opacity-80">👑 {auction.winner_name}님 낙찰</p>
          <p className="text-2xl font-bold mt-2">{auction.current_price?.toLocaleString()}원</p>
          <button
            onClick={async () => {
              try {
                const res = await api.post(`/api/auction/${auction.id}/purchase`)
                if (res.data.success) {
                  const d = res.data.data
                  // 낙찰가로 바로 결제 페이지 이동
                  navigate(`/checkout?auction=${auction.id}&product=${d.product_id}&price=${d.auction_price}`)
                } else {
                  toast.error(res.data.error)
                }
              } catch (err: any) { toast.error(err?.response?.data?.error || '구매 실패') }
            }}
            className="mt-3 w-full py-2.5 bg-white text-green-700 font-bold rounded-xl text-sm active:scale-[0.96]"
          >
            낙찰가로 구매하기
          </button>
        </div>
      </div>
    )
  }

  if (auction.status !== 'active') return null

  const handleBid = async () => {
    if (bidding) return
    setBidding(true)
    try {
      const res = await api.post(`/api/auction/${auction.id}/bid`, { amount: bidAmount })
      if (res.data.success) {
        toast.success(`${bidAmount.toLocaleString()}원 입찰 성공!`)
        setBidAmount(bidAmount + auction.min_increment)
      } else {
        toast.error(res.data.error)
      }
    } catch (err: any) { toast.error(err?.response?.data?.error || '입찰 실패') }
    finally { setBidding(false) }
  }

  const mm = Math.floor(timeLeft / 60)
  const ss = timeLeft % 60

  return (
    <div className="bg-gradient-to-br from-amber-500/90 to-orange-600/90 backdrop-blur-md rounded-2xl p-4 text-white shadow-lg animate-in slide-in-from-bottom">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          <span className="font-bold text-sm">실시간 경매</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
          <Timer className="w-3.5 h-3.5" />
          <span className="text-sm font-mono font-bold">
            {mm}:{ss.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 상품 제목 */}
      <p className="text-sm font-semibold mb-2 line-clamp-1">{auction.title}</p>

      {/* 현재 가격 */}
      <div className="bg-white/20 rounded-xl p-3 mb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-white/70">현재 최고가</p>
            <p className="text-2xl font-bold">{auction.current_price.toLocaleString()}원</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/70">입찰 {auction.bid_count}회</p>
            {auction.winner_name && (
              <div className="flex items-center gap-1 text-xs">
                <Crown className="w-3 h-3 text-yellow-300" />
                {auction.winner_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top 입찰자 */}
      {auction.top_bids?.length > 0 && (
        <div className="mb-3 space-y-1">
          {auction.top_bids.slice(0, 3).map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                {i === 0 ? '👑' : i === 1 ? '💎' : '⭐'}
                {b.user_name}
              </span>
              <span className="font-mono">{b.amount.toLocaleString()}원</span>
            </div>
          ))}
        </div>
      )}

      {/* 입찰 입력 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(Number(e.target.value))}
            min={auction.current_price + auction.min_increment}
            step={auction.min_increment}
            className="w-full px-3 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />
        </div>
        <button
          onClick={handleBid}
          disabled={bidding || timeLeft <= 0}
          className="px-5 py-2.5 bg-white text-orange-600 font-bold rounded-xl text-sm active:scale-[0.96] disabled:opacity-50 shrink-0"
        >
          {bidding ? '...' : '입찰'}
        </button>
      </div>

      {/* 최소 입찰 안내 */}
      <p className="text-[10px] text-white/60 mt-2 text-center">
        최소 입찰: {(auction.current_price + auction.min_increment).toLocaleString()}원 (+{auction.min_increment.toLocaleString()}원)
      </p>
    </div>
  )
}
