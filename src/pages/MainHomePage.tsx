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
}

// ── Category (퀵메뉴 통합) ──
const CATEGORIES = [
  { key: 'all', label: '전체', icon: '🔥' },
  { key: 'live', label: '라이브', icon: '📺' },
  { key: 'meal_voucher', label: '맛집', icon: '🍽️' },
  { key: 'fashion', label: '패션', icon: '👗' },
  { key: 'beauty', label: '뷰티', icon: '💄' },
  { key: 'food', label: '식품', icon: '🍜' },
  { key: 'living', label: '리빙', icon: '🏠' },
  { key: 'digital', label: '디지털', icon: '📱' },
]

// ── 지역 필터 ──
const REGIONS = [
  { key: 'all', label: '전체' },
  { key: '서울', label: '서울' },
  { key: '경기', label: '경기' },
  { key: '인천', label: '인천' },
  { key: '부산', label: '부산' },
  { key: '대구', label: '대구' },
  { key: '광주', label: '광주' },
  { key: '대전', label: '대전' },
  { key: '울산', label: '울산' },
  { key: '제주', label: '제주' },
]

// ── Stream thumbnail helper ──
function getThumb(stream: LiveStream) {
  return stream.thumbnail_url || stream.image_url ||
    (stream.youtube_video_id ? `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg` : null)
}

// ── Live stream card (Grip-style: thumbnail + info separated) ──
function LiveCard({ stream, onClick }: { stream: LiveStream; onClick: () => void }) {
  const thumb = getThumb(stream)
  const isLive = stream.status === 'live'

  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.98] transition-transform">
      {/* 썸네일 영역 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#1A1A1A]">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
        )}

        {/* LIVE / 예정 / 다시보기 배지 */}
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

        {/* 시청자 수 */}
        {isLive && stream.viewer_count !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
            <Eye className="h-3 w-3 text-white" />
            <span className="text-[10px] font-semibold text-white">
              {stream.viewer_count >= 1000 ? `${(stream.viewer_count / 1000).toFixed(1)}K` : stream.viewer_count}
            </span>
          </div>
        )}

        {/* 셀러 프로필 (썸네일 하단) */}
        {stream.seller_name && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{stream.seller_name.charAt(0)}</span>
            </div>
            <span className="text-[11px] font-medium text-white drop-shadow-lg">{stream.seller_name}</span>
          </div>
        )}
      </div>

      {/* 텍스트 정보 영역 (높이 고정) */}
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

// ── 날짜 헬퍼 ──
function getDayLabel(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  if (date.toDateString() === today.toDateString()) return `오늘 (${dayNames[date.getDay()]})`
  if (date.toDateString() === tomorrow.toDateString()) return `내일 (${dayNames[date.getDay()]})`
  return `${date.getMonth() + 1}/${date.getDate()} (${dayNames[date.getDay()]})`
}

// ── 날짜 탭 바 컴포넌트 ──
function ScheduleDateTabs({ selectedDate, onSelect }: { selectedDate: Date | null; onSelect: (d: Date | null) => void }) {
  const today = new Date()
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d
  })
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="flex gap-1.5 px-4 overflow-x-auto no-scrollbar pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`flex flex-col items-center shrink-0 px-3 py-2 rounded-xl transition-all ${
          !selectedDate ? 'bg-red-500 text-white' : 'text-gray-500'
        }`}
      >
        <span className="text-[10px] font-medium">전체</span>
        <span className={`text-[14px] font-bold ${!selectedDate ? 'text-white' : 'text-gray-300'}`}>ALL</span>
      </button>
      {days.map((d, i) => {
        const isSelected = selectedDate ? d.toDateString() === selectedDate.toDateString() : false
        const label = i === 0 ? '오늘' : i === 1 ? '내일' : dayNames[d.getDay()]
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        return (
          <button
            key={i}
            onClick={() => onSelect(d)}
            className={`flex flex-col items-center shrink-0 px-3 py-2 rounded-xl transition-all ${
              isSelected
                ? 'bg-red-500 text-white'
                : isWeekend ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            <span className="text-[10px] font-medium">{label}</span>
            <span className={`text-[14px] font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>{d.getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 맛집 공동구매 섹션 (지역 필터 포함) ──
function GroupBuySection() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Product[]>([])
  const [region, setRegion] = useState('all')

  useEffect(() => {
    api.get('/api/group-buy/products?status=active')
      .then(r => { if (r.data.success) setItems(r.data.data || []) })
      .catch(() => {})
  }, [])

  // 지역 필터링 (restaurant_address에서 첫 단어 매칭)
  const filtered = region === 'all' ? items : items.filter(item =>
    (item as any).restaurant_address?.includes(region)
  )

  return (
    <section className="px-4 py-4">
      {/* 공동구매 배너 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => navigate('/browse?category=meal_voucher')}
          className="flex-1 bg-gradient-to-r from-orange-500 via-pink-500 to-red-500 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-white text-lg font-extrabold">🍽️ 맛집 공동구매</p>
          <p className="text-white/80 text-xs mt-1">인플루언서 추천 맛집 식사권</p>
        </button>
        <button
          onClick={() => navigate('/restaurant-map')}
          className="w-[120px] bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform shrink-0"
        >
          <p className="text-white text-2xl">🗺️</p>
          <p className="text-white text-xs font-bold mt-1">맛집 지도</p>
        </button>
      </div>

      {/* 지역 필터 */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
        {REGIONS.map(r => (
          <button
            key={r.key}
            onClick={() => setRegion(r.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              region === r.key ? 'bg-pink-500 text-white' : 'bg-[#1A1A1A] text-gray-500'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-600 text-xs py-4">해당 지역 공동구매가 없습니다</p>
      ) : (
      <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-white">{region === 'all' ? '전체' : region} 맛집 {filtered.length}개</p>
        <button onClick={() => navigate('/browse?category=meal_voucher')} className="text-[12px] text-gray-500 flex items-center">
          전체보기 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {filtered.slice(0, 6).map(item => {
          const progress = item.group_buy_target ? Math.min(100, ((item.group_buy_current || 0) / item.group_buy_target) * 100) : 0
          const disc = item.original_price ? Math.round((1 - item.price / item.original_price) * 100) : 0
          return (
            <button key={item.id} onClick={() => navigate(`/products/${item.id}`)} className="shrink-0 w-40 text-left active:scale-[0.97]">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#1A1A1A]">
                {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                {disc > 0 && (
                  <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{disc}%</span>
                )}
              </div>
              <div className="mt-2">
                <p className="text-[11px] text-white font-medium line-clamp-1">{item.name}</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[13px] font-extrabold text-red-400">{item.price?.toLocaleString()}원</span>
                  {item.original_price && <span className="text-[10px] text-gray-600 line-through">{item.original_price.toLocaleString()}</span>}
                </div>
                {(item.group_buy_target ?? 0) > 0 && (
                  <div className="mt-1.5">
                    <div className="w-full bg-[#1A1A1A] rounded-full h-1.5">
                      <div className="h-full bg-pink-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">{item.group_buy_current || 0}/{item.group_buy_target}명 참여</p>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      </>
      )}
    </section>
  )
}

// ── Product card for UR특가 ──
function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate()
  const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)

  return (
    <div className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/products/${product.id}`)}>
      <div className="relative aspect-square overflow-hidden bg-[#1A1A1A] rounded-xl">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-gray-500" />
          </div>
        )}
        {discountRate > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
            {discountRate}%
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <p className="text-[11px] text-gray-300 leading-snug line-clamp-1">{product.name}</p>
        {product.original_price && product.original_price > product.price && (
          <p className="text-[10px] text-gray-600 line-through mt-0.5">{product.original_price.toLocaleString()}원</p>
        )}
        <div className="flex items-baseline gap-1 mt-0.5">
          {discountRate > 0 && (
            <span className="text-[12px] font-extrabold text-red-500">{discountRate}%</span>
          )}
          <span className="text-[12px] font-extrabold text-white">{product.price.toLocaleString()}원</span>
        </div>
        <div className="flex items-center gap-0.5 mt-0.5">
          <span className="text-yellow-400 text-[9px]">★</span>
          <span className="text-[9px] text-gray-500">{((product as any).avg_rating || 4.8).toFixed(1)} ({(product as any).review_count || product.sold_count || 0})</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──
export default function MainHomePage() {
  const navigate = useNavigate()

  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null)
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

  const allStreams = [...liveStreams, ...scheduledStreams, ...endedStreams]

  return (
    <div className="bg-[#121212] min-h-screen pb-16">
      <SEO
        title="홈"
        description="라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매, 실시간 라이브 쇼핑"
        url="/"
        jsonLd={organizationJsonLd}
      />
      {/* ── Header (1줄) ── */}
      <header className="sticky top-0 z-50 bg-[#020202] border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between h-12 px-4">
          <Link to="/" className="flex items-center gap-1.5">
            <svg viewBox="0 0 40 36" fill="none" className="h-7 w-auto">
              <path d="M8 8h2l1.5 3H34a1 1 0 01.96 1.28l-3.5 12A1 1 0 0130.5 25H14.5a1 1 0 01-.96-.72L9.8 10H8V8z" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="16" cy="31" r="2.5" fill="#EF4444"/>
              <circle cx="29" cy="31" r="2.5" fill="#EF4444"/>
              <path d="M19.5 13.5v8l6-4z" fill="#EF4444"/>
            </svg>
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

      {/* ── Live Now Section ── */}
      {liveStreams.length > 0 && (
        <section className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-md">
                <span className="h-1.5 w-1.5 bg-[#121212] rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-white">LIVE</span>
              </div>
              <h2 className="text-[15px] font-bold text-white">지금 방송 중</h2>
            </div>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              더보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {liveStreams.slice(0, 4).map(stream => (
              <LiveCard key={stream.id} stream={stream} onClick={() => navigate(`/live/${stream.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ── 카테고리 (원형 아이콘) ── */}
      <section className="px-4 py-3">
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => {
                if (cat.key === 'live') navigate('/live')
                else if (cat.key === 'all') navigate('/browse')
                else navigate(`/browse?category=${cat.key}`)
              }}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-xl">
                {cat.icon}
              </div>
              <span className="text-[10px] font-medium text-gray-400">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 라이브 예고 (그립 스타일) ── */}
      {scheduledStreams.length > 0 && (
        <section className="pb-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-[15px] font-bold text-white">라이브 예고</h2>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              더보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 날짜 탭 바 */}
          <ScheduleDateTabs
            selectedDate={selectedScheduleDate}
            onSelect={setSelectedScheduleDate}
          />

          {/* 예고 카드 가로 스크롤 */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1 mt-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {scheduledStreams
              .filter(s => {
                if (!selectedScheduleDate || !s.scheduled_at) return true
                const streamDate = new Date(s.scheduled_at).toDateString()
                return streamDate === selectedScheduleDate.toDateString()
              })
              .map(stream => {
                const schedDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null
                const dayLabel = schedDate ? getDayLabel(schedDate) : ''
                const timeLabel = schedDate ? schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
                const thumb = stream.youtube_video_id
                  ? `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`
                  : stream.thumbnail_url || stream.image_url || null

                return (
                  <button
                    key={stream.id}
                    onClick={() => navigate(`/live/${stream.id}`)}
                    className="flex-shrink-0 w-[220px] bg-[#121212] rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform border border-[#1A1A1A]"
                  >
                    {/* 썸네일 */}
                    <div className="relative aspect-[3/4] bg-[#0A0A0A]">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-900/30 to-purple-900/30">
                          <Play className="w-10 h-10 text-gray-600" />
                        </div>
                      )}

                      {/* 셀러명 오버레이 */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white">{stream.seller_name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-[11px] font-bold text-white drop-shadow-lg">{stream.seller_name || '셀러'}</span>
                      </div>

                      {/* 날짜/시간 오버레이 */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-3">
                        <p className="text-[12px] text-white/80 font-medium">{dayLabel}</p>
                        <p className="text-[22px] font-black text-white leading-tight">{timeLabel}</p>
                      </div>
                    </div>

                    {/* 상품 정보 */}
                    {stream.current_product && (
                      <div className="px-3 py-2 flex items-center gap-2 border-t border-[#1A1A1A]">
                        <div className="w-10 h-10 rounded-lg bg-[#1A1A1A] overflow-hidden shrink-0">
                          {/* 상품 이미지 대체 */}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-400 truncate">{stream.current_product.name}</p>
                          <p className="text-[11px] font-bold text-white">{stream.current_product.price?.toLocaleString()}원</p>
                        </div>
                      </div>
                    )}

                    {/* 제목 */}
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{stream.title}</p>
                    </div>

                    {/* 방송 알림 받기 버튼 */}
                    <div className="px-3 pb-3">
                      <BroadcastNotifyButton streamId={stream.id} compact />
                    </div>
                  </button>
                )
              })}
            {scheduledStreams.filter(s => {
              if (!selectedScheduleDate || !s.scheduled_at) return true
              return new Date(s.scheduled_at).toDateString() === selectedScheduleDate.toDateString()
            }).length === 0 && (
              <div className="w-full text-center py-8">
                <p className="text-xs text-gray-600">이 날짜에 예정된 방송이 없습니다</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── UR 특가 ── */}
      {/* ── 맛집 공동구매 섹션 ── */}
      <GroupBuySection />

      {products.length > 0 && (
        <section className="px-4 py-4 bg-[#0A0A0A]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold text-white">UR 특가 🔥</h2>
              <p className="text-[11px] text-gray-500">라이브 없이도 구매 가능한 인기 상품</p>
            </div>
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
        <section className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-white flex items-center gap-1.5">
              <Play className="w-4 h-4 text-gray-500" />
              다시보기
            </h2>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              더보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {endedStreams.slice(0, 4).map(stream => (
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

      {/* 최근 본 상품 */}
      <RecentlyViewed />

      {/* 신규 가입자 친구 초대 유도 */}
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
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('recently_viewed') || '[]'
      setItems(JSON.parse(raw).slice(0, 10))
    } catch {}
  }, [])

  if (items.length === 0) return null

  return (
    <div className="px-4 py-6">
      <h2 className="text-lg font-bold text-white mb-3">최근 본 상품</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {items.map((p: any) => (
          <div key={p.id} onClick={() => navigate(`/products/${p.id}`)}
            className="shrink-0 w-28 cursor-pointer">
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
