import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingCart, Eye, Play, ChevronRight, Clock, ShoppingBag, Bell, MapPin, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import axios from 'axios'
import SiteFooter from '@/components/main/SiteFooter'
import SEO, { organizationJsonLd } from '@/components/SEO'
import SharePrompt from '@/components/SharePrompt'

interface LiveStream {
  id: number; title: string; youtube_video_id?: string; status: string
  seller_name?: string; viewer_count?: number; scheduled_at?: string
  current_product?: { id: number; name: string; price: number } | null
  thumbnail_url?: string; image_url?: string
}

interface Product {
  id: number; name: string; price: number; original_price?: number; image_url?: string
  discount_rate?: number; seller_name?: string; category?: string
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string
  sold_count?: number; avg_rating?: number; review_count?: number; restaurant_address?: string
}

const REGIONS = ['강남 · 역삼', '홍대 · 합정', '성수 · 건대', '여의도', '판교 · 분당', '부산', '대구', '제주']
const CATEGORIES = [
  { k: 'fashion', l: '패션', i: '👗', bg: '#FCE7F3' },
  { k: 'beauty', l: '뷰티', i: '💄', bg: '#FEF3C7' },
  { k: 'food', l: '식품', i: '🍜', bg: '#FEE2E2' },
  { k: 'living', l: '리빙', i: '🏠', bg: '#DBEAFE' },
  { k: 'digital', l: '디지털', i: '📱', bg: '#E0E7FF' },
  { k: 'kids', l: '키즈', i: '🧸', bg: '#D1FAE5' },
  { k: 'sports', l: '스포츠', i: '⚽', bg: '#FEF3C7' },
  { k: 'culture', l: '문화', i: '🎫', bg: '#F3E8FF' },
  { k: 'travel', l: '여행', i: '✈️', bg: '#CFFAFE' },
  { k: 'pet', l: '반려', i: '🐕', bg: '#FED7AA' },
]

function getThumb(s: LiveStream) {
  return s.thumbnail_url || s.image_url || (s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg` : null)
}
function disc(p: number, op?: number) { return op && op > p ? Math.round((1 - p / op) * 100) : 0 }
function fmtEnd(deadline?: string) {
  if (!deadline) return ''
  const min = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 60000))
  if (min < 60) return `${min}분 후 마감`
  if (min < 1440) return `${Math.floor(min / 60)}시간 ${min % 60}분 후 마감`
  return `${Math.floor(min / 1440)}일 후 마감`
}

function RecentlyViewed() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Array<{ id: number; name: string; price?: number; image?: string }>>([])
  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem('recently_viewed') || '[]').slice(0, 10)) } catch {} }, [])
  if (items.length === 0) return null
  return (
    <div className="px-4 py-6">
      <h2 className="text-[15px] font-bold text-white mb-3">최근 본 상품</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map(p => (
          <div key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="shrink-0 w-28 cursor-pointer">
            <div className="aspect-square bg-[#1A1A1A] rounded-xl overflow-hidden">
              {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
            </div>
            <p className="text-xs text-gray-300 mt-1.5 truncate">{p.name}</p>
            <p className="text-xs font-bold text-white">{p.price?.toLocaleString()}원</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvitePrompt() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const userId = localStorage.getItem('user_id')
    if (!userId || localStorage.getItem('invite_prompt_shown') === '1') return
    const recent = localStorage.getItem('recently_viewed')
    if (!recent || JSON.parse(recent).length <= 1) {
      setTimeout(() => setShow(true), 3000)
      localStorage.setItem('invite_prompt_shown', '1')
    }
  }, [])
  if (!show) return null
  return <SharePrompt title="친구를 초대해보세요! 🎉" message="친구에게 유어딜을 소개하면 함께 혜택을 받을 수 있어요" shareTitle="유어딜 - 라이브 커머스" shareDescription="라이브 방송으로 만나는 최저가 특가 상품!" shareLink="/" shareButtonText="유어딜 보러가기" reward="친구 초대 시 500딜 적립!" onClose={() => setShow(false)} />
}

export default function MainHomePage() {
  const navigate = useNavigate()
  const [region, setRegion] = useState(REGIONS[0])
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [mealProducts, setMealProducts] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = '유어딜 - 라이브 커머스'
    Promise.allSettled([
      axios.get('/api/streams?status=live'),
      axios.get('/api/streams?status=scheduled'),
      axios.get('/api/streams?status=ended&limit=6'),
      api.get('/api/group-buy/products?status=active'),
      api.get('/api/products?limit=12&sort=popular&featured=true'),
    ]).then(([liveRes, schedRes, endedRes, mealRes, prodRes]) => {
      if (liveRes.status === 'fulfilled' && liveRes.value.data.success) setLiveStreams(liveRes.value.data.data || [])
      if (schedRes.status === 'fulfilled' && schedRes.value.data.success) setScheduledStreams(schedRes.value.data.data || [])
      if (endedRes.status === 'fulfilled' && endedRes.value.data.success) setEndedStreams(endedRes.value.data.data || [])
      if (mealRes.status === 'fulfilled' && mealRes.value.data.success) setMealProducts(mealRes.value.data.data || [])
      if (prodRes.status === 'fulfilled' && prodRes.value.data.success) setProducts(prodRes.value.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  // Nearby 지역 필터링
  const filteredMeals = mealProducts.filter(m => {
    if (region === REGIONS[0]) return true
    const regionKey = region.split(' ')[0]
    return m.restaurant_address?.includes(regionKey)
  })
  const displayMeals = filteredMeals.length > 0 ? filteredMeals : mealProducts

  const featured = displayMeals[0]
  const featuredDisc = featured ? disc(featured.price, featured.original_price) : 0

  return (
    <div className="bg-[#020202] min-h-screen pb-16">
      <SEO title="홈" description="라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매" url="/" jsonLd={organizationJsonLd} />

      {/* ═══ Region Hero ═══ */}
      <div className="relative" style={{ height: 340, background: '#000' }}>
        {featured?.image_url && <img src={featured.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-55" />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0) 55%, rgba(5,5,5,1) 100%)' }} />

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 px-4 pt-3 flex items-center justify-between z-10">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#EF4444] to-[#EC4899]">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
            <span className="text-[15px] font-extrabold text-white" style={{ letterSpacing: '-0.04em', fontStyle: 'italic' }}>UR·DEAL</span>
          </Link>
          <div className="flex items-center gap-1 text-gray-200">
            <button onClick={() => navigate('/search')} className="p-1.5"><Search className="h-5 w-5" strokeWidth={1.5} /></button>
            <button onClick={() => navigate('/notifications')} className="p-1.5 relative">
              <Bell className="h-5 w-5" strokeWidth={1.5} />
              <span className="absolute top-1 right-1 rounded-full w-1.5 h-1.5 bg-[#EF4444]" />
            </button>
            <button onClick={() => navigate('/cart')} className="p-1.5 relative">
              <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Region + featured content */}
        <div className="absolute top-12 left-4 right-4 z-10">
          <button onClick={() => setRegion(REGIONS[(REGIONS.indexOf(region) + 1) % REGIONS.length])}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/[0.12] backdrop-blur-md border border-white/20">
            <MapPin className="w-3.5 h-3.5 text-white" />
            <span className="text-[12px] font-bold text-white">{region}</span>
            <ChevronDown className="w-2.5 h-2.5 text-white" />
          </button>
          <p className="text-[11px] text-white/70 font-semibold tracking-widest mt-3">NOW · 오늘의 마감 임박</p>
          <h1 className="text-[26px] font-black text-white mt-1" style={{ letterSpacing: '-0.04em', lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
            {featured?.name || '맛집 공동구매'}
          </h1>
          {featured && (
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[12px] font-extrabold text-red-400">{featuredDisc}%</span>
              <span className="text-[18px] font-black text-white">{featured.price.toLocaleString()}원</span>
              {featured.original_price && <span className="text-[10px] text-white/55 line-through">{featured.original_price.toLocaleString()}</span>}
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 z-10">
          <div className="flex-1 rounded-xl p-2.5 flex items-center gap-2 bg-red-500/[0.18] backdrop-blur-md border border-red-500/40">
            <Clock className="w-3.5 h-3.5 text-red-300 shrink-0" />
            <div>
              <p className="text-[11px] text-white font-bold leading-tight">{featured ? fmtEnd(featured.group_buy_deadline) : '진행 중'}</p>
              <p className="text-[10px] text-red-300 font-semibold">{featured ? `${featured.group_buy_current || 0}/${featured.group_buy_target || 0}명 모집 중` : ''}</p>
            </div>
          </div>
          <button onClick={() => featured && navigate(`/products/${featured.id}`)} className="rounded-xl px-4 py-3 shrink-0 bg-white text-black text-[12px] font-extrabold">참여하기</button>
        </div>
      </div>

      {/* ═══ Quick 3-entry ═══ */}
      <div className="px-4 pt-4 pb-1">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => navigate('/live')} className="rounded-xl p-2.5 text-left bg-red-500/[0.08] border border-red-500/20">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full animate-pulse" />
              <span className="text-[9px] text-red-300 font-extrabold tracking-widest">LIVE</span>
            </div>
            <p className="text-[12px] text-white font-extrabold">지금 라이브딜</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{liveStreams.length}개 방송</p>
          </button>
          <button onClick={() => navigate('/browse?category=meal_voucher')} className="rounded-xl p-2.5 text-left bg-yellow-400/[0.08] border border-yellow-400/25">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px]">🍽</span>
              <span className="text-[9px] text-yellow-200 font-extrabold tracking-widest">MEAL</span>
            </div>
            <p className="text-[12px] text-white font-extrabold">오늘의 식사권딜</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{displayMeals.length}개 모집 중</p>
          </button>
          <button onClick={() => navigate('/browse')} className="rounded-xl p-2.5 text-left bg-blue-400/[0.08] border border-blue-400/25">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px]">🛍</span>
              <span className="text-[9px] text-blue-300 font-extrabold tracking-widest">SPECIAL</span>
            </div>
            <p className="text-[12px] text-white font-extrabold">UR특가</p>
            <p className="text-[10px] text-gray-400 mt-0.5">최대 70%</p>
          </button>
        </div>
      </div>

      {/* ═══ 내 주변 맛집 식사권 ═══ */}
      <div className="px-4 pt-7">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[14px]">📍</span>
              <span className="text-[10px] font-extrabold text-[#FBBF24] tracking-[0.14em]">NEARBY · 내 주변</span>
            </div>
            <p className="text-[18px] font-extrabold text-white" style={{ letterSpacing: '-0.03em' }}>{region.split(' ')[0]} 맛집 식사권</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{displayMeals.length}개 · 인기순</p>
          </div>
          <button onClick={() => navigate('/browse?category=meal_voucher')} className="text-[11px] text-gray-400 pb-1">전체 →</button>
        </div>

        <div className="space-y-2">
          {displayMeals.slice(0, 5).map((m, i) => {
            const pct = m.group_buy_target ? Math.min(100, Math.round((m.group_buy_current || 0) / m.group_buy_target * 100)) : 0
            const d = disc(m.price, m.original_price)
            const isClosing = m.group_buy_deadline && (new Date(m.group_buy_deadline).getTime() - Date.now()) < 3600000
            return (
              <button key={m.id} onClick={() => navigate(`/products/${m.id}`)} className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left bg-[#0B0B0B] border border-[#151515]">
                <span className="text-[20px] font-black w-[22px] shrink-0" style={{ color: i < 3 ? '#FBBF24' : '#6B7280', letterSpacing: '-0.03em' }}>{i + 1}</span>
                <div className="rounded-lg overflow-hidden shrink-0 relative w-[68px] h-[68px] bg-[#1A1A1A]">
                  {m.image_url && <img src={m.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] font-extrabold px-1 rounded bg-[#FDE68A] text-[#78350F]">🍽 {m.restaurant_address?.split(' ')[0] || '맛집'}</span>
                    {isClosing && <span className="text-[9px] font-extrabold px-1 rounded bg-[#EF4444] text-white">⏰ 곧 마감</span>}
                  </div>
                  <p className="text-[12px] text-white font-bold leading-tight line-clamp-2">{m.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    {d > 0 && <span className="text-[11px] font-extrabold text-red-400">{d}%</span>}
                    <span className="text-[12px] font-extrabold text-white">{m.price.toLocaleString()}원</span>
                  </div>
                  <div className="mt-1.5 rounded-full h-[3px] bg-[#1A1A1A]">
                    <div className="rounded-full h-[3px]" style={{ width: `${pct}%`, background: pct >= 100 ? '#10B981' : '#FBBF24' }} />
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">{m.group_buy_current || 0}/{m.group_buy_target || 0}명 · {pct}% 달성</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ 지금 라이브딜 ═══ */}
      {liveStreams.length > 0 && (
        <div className="px-4 pt-8">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse" />
                <span className="text-[10px] font-extrabold text-red-400 tracking-[0.14em]">NOW LIVE · 지금 방송</span>
              </div>
              <p className="text-[18px] font-extrabold text-white" style={{ letterSpacing: '-0.03em' }}>지금 라이브딜</p>
            </div>
            <button onClick={() => navigate('/live')} className="text-[11px] text-gray-400 pb-1">전체 →</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {liveStreams.map(s => {
              const thumb = getThumb(s)
              return (
                <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="shrink-0 w-[170px] text-left active:scale-[0.98] transition-transform">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#1A1A1A]">
                    {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 35%, rgba(0,0,0,0.9) 100%)' }} />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-md shadow-lg shadow-red-500/30">
                      <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-white">LIVE</span>
                    </div>
                    {s.viewer_count != null && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                        <Eye className="h-3 w-3 text-white" />
                        <span className="text-[9px] font-bold text-white">{s.viewer_count >= 1000 ? `${(s.viewer_count / 1000).toFixed(1)}K` : s.viewer_count}</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[10px] text-white/80 font-semibold truncate">@{s.seller_name || '셀러'}</p>
                      <p className="text-[12px] text-white font-bold leading-tight line-clamp-2 mt-0.5">{s.title}</p>
                    </div>
                  </div>
                  {s.current_product && (
                    <div className="flex items-baseline gap-1 mt-2 px-0.5">
                      <span className="text-[13px] font-extrabold text-red-400">{s.current_product.price.toLocaleString()}원</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 예정 방송 ═══ */}
      {scheduledStreams.length > 0 && (
        <div className="px-4 pt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-extrabold text-blue-400 tracking-[0.14em]">🔔 UPCOMING</p>
              <p className="text-[15px] font-extrabold text-white mt-0.5">예정 방송</p>
            </div>
            <button onClick={() => navigate('/live')} className="text-[11px] text-gray-400">전체 →</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {scheduledStreams.slice(0, 6).map(s => {
              const thumb = getThumb(s)
              const schedDate = s.scheduled_at ? new Date(s.scheduled_at) : null
              const timeLabel = schedDate ? schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
              return (
                <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="shrink-0 w-[170px] text-left">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#1A1A1A]">
                    {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.9) 100%)' }} />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500 px-2 py-0.5 rounded-md">
                      <Clock className="h-2.5 w-2.5 text-white" />
                      <span className="text-[10px] font-bold text-white">예정</span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      {timeLabel && <p className="text-[18px] font-black text-white">{timeLabel}</p>}
                      <p className="text-[10px] text-white/70 truncate">@{s.seller_name || '셀러'}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-300 line-clamp-1 mt-1.5">{s.title}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 다시보기 ═══ */}
      {endedStreams.length > 0 && (
        <div className="px-4 pt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-extrabold text-gray-500 tracking-[0.14em]">▶ REPLAY</p>
              <p className="text-[15px] font-extrabold text-white mt-0.5">다시보기</p>
            </div>
            <button onClick={() => navigate('/live')} className="text-[11px] text-gray-400">전체 →</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {endedStreams.slice(0, 6).map(s => {
              const thumb = getThumb(s)
              return (
                <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="shrink-0 w-[150px] text-left">
                  <div className="relative rounded-xl overflow-hidden bg-[#1A1A1A]" style={{ aspectRatio: '16/9' }}>
                    {thumb && <img src={thumb} alt="" className="w-full h-full object-cover brightness-[0.85]" />}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Play className="h-2.5 w-2.5 text-white" />
                      <span className="text-[9px] font-bold text-white">다시보기</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-300 line-clamp-1 mt-1.5">{s.title}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">@{s.seller_name || '셀러'}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ UR특가 ═══ */}
      <div className="pt-8 mt-6" style={{ background: '#050505', borderTop: '8px solid #0A0A0A' }}>
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] text-blue-300 font-extrabold tracking-[0.14em]">🛍 UR SPECIAL</p>
          <p className="text-[22px] font-black text-white mt-0.5" style={{ letterSpacing: '-0.04em' }}>UR특가</p>
        </div>

        {/* Category grid */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-5 gap-y-4">
            {CATEGORIES.map(c => (
              <button key={c.k} onClick={() => navigate(`/browse?category=${c.k}`)} className="flex flex-col items-center gap-1.5">
                <div className="rounded-2xl flex items-center justify-center w-[52px] h-[52px] text-[22px]" style={{ background: c.bg }}>{c.i}</div>
                <span className="text-[11px] text-gray-200 font-semibold">{c.l}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 실시간 랭킹 */}
        {products.length > 0 && (
          <div className="px-4 pb-5">
            <p className="text-[14px] font-extrabold text-white mb-3">🏆 실시간 랭킹</p>
            <div className="grid grid-cols-2 gap-3">
              {products.slice(0, 4).map((p, i) => {
                const d = disc(p.price, p.original_price)
                return (
                  <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="text-left relative">
                    <div className="relative rounded-lg overflow-hidden aspect-square bg-[#1A1A1A]">
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                      <span className="absolute top-1.5 left-1.5 rounded flex items-center justify-center w-[22px] h-[22px] bg-[#EF4444] text-[11px] font-black text-white">{i + 1}</span>
                    </div>
                    <p className="text-[11px] text-gray-200 leading-tight line-clamp-2 mt-1.5">{p.name}</p>
                    <p className="text-[12px] font-extrabold text-white mt-1">
                      {d > 0 && <span className="text-red-400 mr-1">{d}%</span>}{p.price.toLocaleString()}원
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 추천 상품 */}
        {products.length > 4 && (
          <div className="px-4 pb-5">
            <p className="text-[14px] font-extrabold text-white mb-3">추천 상품</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {products.slice(4).map(p => {
                const d = disc(p.price, p.original_price)
                return (
                  <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="text-left">
                    <div className="relative rounded-lg overflow-hidden aspect-square bg-[#1A1A1A]">
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                      {d > 0 && <span className="absolute top-1.5 left-1.5 bg-[#EF4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">{d}%</span>}
                    </div>
                    <p className="text-[11px] text-gray-200 leading-tight line-clamp-2 mt-2">{p.name}</p>
                    {p.original_price && p.original_price > p.price && (
                      <p className="text-[10px] text-gray-500 line-through mt-0.5">{p.original_price.toLocaleString()}원</p>
                    )}
                    <div className="flex items-baseline gap-1 mt-0.5">
                      {d > 0 && <span className="text-[12px] font-extrabold text-red-500">{d}%</span>}
                      <span className="text-[12px] font-extrabold text-white">{p.price.toLocaleString()}원</span>
                    </div>
                    {(p.avg_rating || p.sold_count) && (
                      <p className="text-[10px] text-gray-500 mt-0.5">★ {(p.avg_rating || 4.5).toFixed(1)} · {(p.sold_count || 0).toLocaleString()} 구매</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Bottom sections ═══ */}
      <RecentlyViewed />
      <InvitePrompt />
      <SiteFooter />

      {loading && (
        <div className="fixed inset-0 bg-[#020202] flex items-center justify-center z-50">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
