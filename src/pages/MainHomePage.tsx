import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingCart, Eye, Play, ChevronRight, Clock, ShoppingBag, Bell } from 'lucide-react'
import api from '@/lib/api'
import axios from 'axios'
import HeroBanner from '@/components/main/HeroBanner'
import SiteFooter from '@/components/main/SiteFooter'
import BroadcastNotifyButton from '@/components/live/BroadcastNotifyButton'
import SEO, { organizationJsonLd } from '@/components/SEO'
import SharePrompt from '@/components/SharePrompt'

// ── Types ──
interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  status: string
  seller_name?: string
  viewer_count?: number
  scheduled_at?: string
  current_product?: { id: number; name: string; price: number } | null
  thumbnail_url?: string
  image_url?: string
}

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  image_url?: string
  discount_rate?: number
  seller_name?: string
  category?: string
  group_buy_target?: number
  group_buy_current?: number
  group_buy_deadline?: string
  sold_count?: number
  avg_rating?: number
  review_count?: number
  restaurant_address?: string
}

// ── QuickAccess items ──
const QUICK_ACCESS = [
  { key: 'meal_voucher', label: '맛집', icon: '🍽️', path: '/browse?category=meal_voucher' },
  { key: 'brand', label: '브랜드', icon: '🏪', path: '/browse' },
  { key: 'group_buy', label: '공구', icon: '🎁', path: '/group-buy' },
  { key: 'deals', label: '특가', icon: '⚡', path: '/browse?sort=discount' },
  { key: 'ranking', label: '랭킹', icon: '📊', path: '/browse?sort=popular' },
]

// ── Stream thumbnail helper ──
function getThumb(stream: LiveStream) {
  return stream.thumbnail_url || stream.image_url ||
    (stream.youtube_video_id ? `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg` : null)
}

// ── Live stream card (v4: 148px wide, aspect 3/4) ──
function LiveCard({ stream, onClick }: { stream: LiveStream; onClick: () => void }) {
  const thumb = getThumb(stream)
  const isLive = stream.status === 'live'

  return (
    <button onClick={onClick} className="shrink-0 w-[148px] text-left active:scale-[0.98] transition-transform">
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#1A1A1A]">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
        )}

        {/* Badge */}
        {isLive ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-md shadow-lg shadow-red-500/30">
            <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white">LIVE</span>
          </div>
        ) : stream.status === 'scheduled' ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500 px-2 py-0.5 rounded-md">
            <Clock className="h-2.5 w-2.5 text-white" />
            <span className="text-[10px] font-bold text-white">예정</span>
          </div>
        ) : (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-gray-600/80 px-2 py-0.5 rounded-md">
            <Play className="h-2.5 w-2.5 text-white" />
            <span className="text-[10px] font-bold text-white">다시보기</span>
          </div>
        )}

        {/* Viewer count */}
        {isLive && stream.viewer_count !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
            <Eye className="h-3 w-3 text-white" />
            <span className="text-[10px] font-semibold text-white">
              {stream.viewer_count >= 1000 ? `${(stream.viewer_count / 1000).toFixed(1)}K` : stream.viewer_count}
            </span>
          </div>
        )}

        {/* Seller avatar + name at bottom of thumbnail */}
        {stream.seller_name && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{stream.seller_name.charAt(0)}</span>
            </div>
            <span className="text-[11px] font-medium text-white drop-shadow-lg">{stream.seller_name}</span>
          </div>
        )}
      </div>

      {/* Text info below thumbnail */}
      <div className="mt-2 px-0.5 h-[42px]">
        <p className="text-[12px] font-bold text-white leading-tight truncate">
          {stream.title}
        </p>
        {stream.current_product && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[13px] font-extrabold text-white">
              {stream.current_product.price.toLocaleString()}원
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 font-bold rounded">특가</span>
          </div>
        )}
      </div>
    </button>
  )
}

// ── Product card for UR특가 (3-column grid, square) ──
function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate()
  const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)

  return (
    <div className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/products/${product.id}`)}>
      <div className="relative aspect-square overflow-hidden bg-[#1A1A1A] rounded-xl">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-gray-500" />
          </div>
        )}
        {discountRate > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-[#EF4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
            {discountRate}%
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <p className="text-[11px] text-gray-300 leading-snug line-clamp-1">{product.name}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          {discountRate > 0 && (
            <span className="text-[12px] font-extrabold text-red-500">{discountRate}%</span>
          )}
          <span className="text-[12px] font-extrabold text-white">{product.price.toLocaleString()}원</span>
        </div>
        {product.original_price && product.original_price > product.price && (
          <p className="text-[10px] text-gray-500 line-through mt-0.5">{product.original_price.toLocaleString()}원</p>
        )}
      </div>
    </div>
  )
}

// ── GroupBuyRow card (vertical list) ──
function GroupBuyRow() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/group-buy/products?status=active')
      .then(r => {
        if (r.data?.success) {
          const list: Product[] = r.data.data || []
          const sorted = [...list].sort(
            (a, b) => ((b.group_buy_current || 0) - (a.group_buy_current || 0))
          ).slice(0, 6)
          setItems(sorted)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <section className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-white">🎁 맛집 공구</h2>
        <button
          onClick={() => navigate('/group-buy')}
          className="text-[12px] text-gray-500 flex items-center"
        >
          전체보기 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map(item => {
          const target = item.group_buy_target || 0
          const current = item.group_buy_current || 0
          const achieved = target > 0 && current >= target
          const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0
          const disc = item.original_price && item.original_price > item.price
            ? Math.round((1 - item.price / item.original_price) * 100)
            : 0

          return (
            <div
              key={item.id}
              onClick={() => navigate(`/products/${item.id}`)}
              className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl cursor-pointer active:scale-[0.99] transition-transform"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#1A1A1A] shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-900/30 to-rose-900/30" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white font-medium truncate">{item.name}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  {disc > 0 && (
                    <span className="text-[12px] font-extrabold text-red-400">{disc}%</span>
                  )}
                  <span className="text-[13px] font-extrabold text-white">
                    {item.price?.toLocaleString()}원
                  </span>
                  {item.original_price && item.original_price > item.price && (
                    <span className="text-[10px] text-gray-500 line-through">{item.original_price.toLocaleString()}</span>
                  )}
                </div>
                {target > 0 && (
                  <div className="mt-1.5">
                    <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${achieved ? 'bg-emerald-500' : 'bg-pink-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">
                      {achieved ? '목표 달성!' : `${current}/${target}명 참여중`}
                    </p>
                  </div>
                )}
              </div>

              {/* Action button */}
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/products/${item.id}`) }}
                className="shrink-0 px-3 py-1.5 bg-pink-500 text-white text-[11px] font-bold rounded-lg active:scale-95 transition-transform"
              >
                참여
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Main component ──
export default function MainHomePage() {
  const navigate = useNavigate()

  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = '유어딜 - 라이브 커머스'
    Promise.allSettled([
      axios.get('/api/streams?status=live'),
      axios.get('/api/streams?status=scheduled'),
      axios.get('/api/streams?status=ended&limit=10'),
      api.get('/api/products?limit=6&sort=popular&featured=true'),
    ]).then(([liveRes, schedRes, endedRes, prodRes]) => {
      if (liveRes.status === 'fulfilled' && liveRes.value.data.success)
        setLiveStreams(liveRes.value.data.data || [])
      if (schedRes.status === 'fulfilled' && schedRes.value.data.success)
        setScheduledStreams(schedRes.value.data.data || [])
      if (endedRes.status === 'fulfilled' && endedRes.value.data.success)
        setEndedStreams(endedRes.value.data.data || [])
      if (prodRes.status === 'fulfilled' && prodRes.value.data.success)
        setProducts(prodRes.value.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-[#020202] min-h-screen pb-16">
      <SEO
        title="홈"
        description="라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매, 실시간 라이브 쇼핑"
        url="/"
        jsonLd={organizationJsonLd}
      />

      {/* ── Header (v4: sticky, gradient logo) ── */}
      <header className="sticky top-0 z-50 bg-[#020202]/95 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between h-12 px-4">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#EF4444] to-[#EC4899]">
              <Play className="h-3.5 w-3.5 text-white fill-white" />
            </div>
            <span className="text-[15px] font-extrabold text-white tracking-tight">유어딜</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/search')} className="p-1.5">
              <Search className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
            </button>
            <button onClick={() => navigate('/notifications')} className="p-1.5">
              <Bell className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
            </button>
            <button onClick={() => navigate('/cart')} className="p-1.5 relative">
              <ShoppingCart className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
              {(() => {
                let count = 0
                try { count = JSON.parse(localStorage.getItem('cart') || '[]').length } catch {}
                return count > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null
              })()}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <HeroBanner />

      {/* ── QuickAccess: 5-column icon grid ── */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-5 gap-2">
          {QUICK_ACCESS.map(item => (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[22px]">
                {item.icon}
              </div>
              <span className="text-[10px] font-medium text-gray-400">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── LiveNow: Horizontal scroll cards ── */}
      {liveStreams.length > 0 && (
        <section className="pt-2 pb-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-white flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-md">
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-white">LIVE</span>
                </span>
                지금 라이브
              </span>
            </div>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              전체보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {liveStreams.map(stream => (
              <LiveCard key={stream.id} stream={stream} onClick={() => navigate(`/live/${stream.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Scheduled Streams: Horizontal scroll cards ── */}
      {scheduledStreams.length > 0 && (
        <section className="pb-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-[15px] font-bold text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" />
              라이브 예고
            </h2>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              전체보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {scheduledStreams.map(stream => {
              const thumb = getThumb(stream)
              const schedDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null
              const timeLabel = schedDate ? schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
              const dateLabel = schedDate ? `${schedDate.getMonth() + 1}/${schedDate.getDate()}` : ''

              return (
                <button
                  key={stream.id}
                  onClick={() => navigate(`/live/${stream.id}`)}
                  className="shrink-0 w-[148px] text-left active:scale-[0.98] transition-transform"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#1A1A1A]">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center">
                        <Play className="w-8 h-8 text-gray-600" />
                      </div>
                    )}

                    {/* Scheduled badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500 px-2 py-0.5 rounded-md">
                      <Clock className="h-2.5 w-2.5 text-white" />
                      <span className="text-[10px] font-bold text-white">예정</span>
                    </div>

                    {/* Date/time overlay at bottom */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-2 px-2">
                      <p className="text-[10px] text-white/70">{dateLabel}</p>
                      <p className="text-[16px] font-black text-white leading-tight">{timeLabel}</p>
                    </div>

                    {/* Seller avatar */}
                    {stream.seller_name && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white">{stream.seller_name.charAt(0)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 px-0.5">
                    <p className="text-[12px] font-bold text-white leading-tight truncate">{stream.title}</p>
                    {stream.seller_name && (
                      <p className="text-[10px] text-gray-500 mt-0.5">{stream.seller_name}</p>
                    )}
                  </div>

                  {/* Notify button */}
                  <div className="mt-1.5 px-0.5">
                    <BroadcastNotifyButton streamId={stream.id} compact />
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── GroupBuyRow: Vertical list cards ── */}
      <GroupBuyRow />

      {/* ── ProductGrid: 3-column grid ── */}
      {products.length > 0 && (
        <section className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-white">UR 특가 🔥</h2>
            <button onClick={() => navigate('/browse')} className="text-[12px] text-gray-500 flex items-center">
              전체보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ── Ended / Replay streams ── */}
      {endedStreams.length > 0 && (
        <section className="pt-2 pb-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-[15px] font-bold text-white flex items-center gap-1.5">
              <Play className="w-4 h-4 text-gray-500" />
              다시보기
            </h2>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              더보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {endedStreams.slice(0, 6).map(stream => (
              <LiveCard key={stream.id} stream={stream} onClick={() => navigate(`/live/${stream.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className="px-4 py-6">
          <div className="grid grid-cols-2 gap-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="aspect-[3/4] bg-[#1A1A1A] animate-pulse rounded-2xl" />
                <div className="mt-2 h-3 bg-[#1A1A1A] rounded animate-pulse w-3/4" />
                <div className="mt-1 h-3 bg-[#1A1A1A] rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently viewed */}
      <RecentlyViewed />

      {/* Invite prompt for new users */}
      <InvitePrompt />

      <SiteFooter />
    </div>
  )
}

function InvitePrompt() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const userId = localStorage.getItem('user_id')
    if (!userId) return
    if (localStorage.getItem('invite_prompt_shown') === '1') return
    const recent = localStorage.getItem('recently_viewed')
    if (!recent || JSON.parse(recent).length <= 1) {
      setTimeout(() => setShow(true), 3000)
      localStorage.setItem('invite_prompt_shown', '1')
    }
  }, [])
  if (!show) return null
  return (
    <SharePrompt
      title="친구를 초대해보세요! 🎉"
      message="친구에게 유어딜을 소개하면 함께 혜택을 받을 수 있어요"
      shareTitle="유어딜 - 라이브 커머스"
      shareDescription="라이브 방송으로 만나는 최저가 특가 상품! 지금 가입하세요"
      shareLink="/"
      shareButtonText="유어딜 보러가기"
      reward="친구 초대 시 500딜 적립!"
      onClose={() => setShow(false)}
    />
  )
}

function RecentlyViewed() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Array<{ id: number; name: string; price?: number; image?: string }>>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('recently_viewed') || '[]'
      setItems(JSON.parse(raw).slice(0, 10))
    } catch {}
  }, [])

  if (items.length === 0) return null

  return (
    <div className="px-4 py-6">
      <h2 className="text-[15px] font-bold text-white mb-3">최근 본 상품</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        {items.map((p) => (
          <div key={p.id} onClick={() => navigate(`/products/${p.id}`)}
            className="shrink-0 w-28 cursor-pointer active:scale-[0.98] transition-transform">
            <div className="aspect-square bg-[#1A1A1A] rounded-xl overflow-hidden">
              {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
            </div>
            <p className="text-[11px] text-gray-300 mt-1.5 truncate">{p.name}</p>
            <p className="text-[12px] font-bold text-white">{p.price?.toLocaleString()}원</p>
          </div>
        ))}
      </div>
    </div>
  )
}
