import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Gavel, Crown, Timer } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface AuctionData {
  id: number; title: string; start_price: number; current_price: number
  min_increment: number; bid_count: number; winner_name: string | null
  status: string; ends_at: string; top_bids: { user_name: string; amount: number }[]
}

export default function AuctionPanel({ streamId }: { streamId: string | number }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [auction, setAuction] = useState<AuctionData | null>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [bidding, setBidding] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const poll = () => {
      if (document.hidden) return
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
    const iv = setInterval(poll, 5000)
    const onVisible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVisible) }
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
          <p className="text-sm font-bold mb-1">{t('live.auction.ended', { defaultValue: '경매 종료!' })}</p>
          <p className="text-xs opacity-80">{t('live.auction.winner', { defaultValue: '👑 {{name}}님 낙찰', name: auction.winner_name })}</p>
          <p className="text-2xl font-bold mt-2">{auction.current_price?.toLocaleString()}{t('live.auction.wonSuffix', { defaultValue: '원' })}</p>
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
              } catch (err: any) { toast.error(err?.response?.data?.error || t('live.auction.purchaseFailed', { defaultValue: '구매 실패' })) }
            }}
            className="mt-3 w-full py-2.5 bg-white text-green-700 font-bold rounded-xl text-sm active:scale-[0.96]"
          >
            {t('live.auction.purchaseAtWinningPrice', { defaultValue: '낙찰가로 구매하기' })}
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
        toast.success(t('live.auction.bidSuccess', { defaultValue: '{{amount}}원 입찰 성공!', amount: formatNumber(bidAmount) }))
        setBidAmount(bidAmount + auction.min_increment)
      } else {
        toast.error(res.data.error)
      }
    } catch (err: any) { toast.error(err?.response?.data?.error || t('live.auction.bidFailed', { defaultValue: '입찰 실패' })) }
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
          <span className="font-bold text-sm">{t('live.auction.title', { defaultValue: '실시간 경매' })}</span>
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
            <p className="text-[10px] text-gray-900 dark:text-white/70">{t('live.auction.currentHighest', { defaultValue: '현재 최고가' })}</p>
            <p className="text-2xl font-bold">{formatNumber(auction.current_price)}{t('live.auction.wonSuffix', { defaultValue: '원' })}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-900 dark:text-white/70">{t('live.auction.bidCount', { defaultValue: '입찰 {{count}}회', count: auction.bid_count })}</p>
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
              <span className="font-mono">{formatNumber(b.amount)}{t('live.auction.wonSuffix', { defaultValue: '원' })}</span>
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
          {bidding ? '...' : t('live.auction.bid', { defaultValue: '입찰' })}
        </button>
      </div>

      {/* 최소 입찰 안내 */}
      <p className="text-[10px] text-gray-900 dark:text-white/60 mt-2 text-center">
        {t('live.auction.minBidInfo', { defaultValue: '최소 입찰: {{min}}원 (+{{inc}}원)', min: formatNumber(auction.current_price + auction.min_increment), inc: formatNumber(auction.min_increment) })}
      </p>
    </div>
  )
}
