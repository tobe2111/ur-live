import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingCart, Bell, Eye, Play, ChevronRight, ShoppingBag, Clock, Star, Flame, Tv, Radio } from 'lucide-react'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import api from '@/lib/api'
import axios from 'axios'
import HeroBanner from '@/components/main/HeroBanner'
import SiteFooter from '@/components/main/SiteFooter'

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
}

// ── Category filter chips ──
const CATEGORIES = [
  { key: 'all', label: '전체', icon: '🔥' },
  { key: 'ranking', label: '랭킹', icon: '🏆' },
  { key: 'fashion', label: '패션', icon: '👗' },
  { key: 'beauty', label: '뷰티', icon: '💄' },
  { key: 'food', label: '식품', icon: '🍜' },
  { key: 'living', label: '리빙', icon: '🏠' },
  { key: 'digital', label: '디지털', icon: '📱' },
]

// ── Quick menu buttons ──
const QUICK_MENUS = [
  { label: '인기 랭킹', icon: Star, path: '/browse?sort=popular', color: 'from-amber-400 to-orange-500' },
  { label: '오늘의 핫딜', icon: Flame, path: '/browse?sort=discount', color: 'from-red-400 to-pink-500' },
  { label: '인기 쇼츠', icon: Tv, path: '/live', color: 'from-purple-400 to-indigo-500' },
  { label: '방송 예고', icon: Radio, path: '/live', color: 'from-blue-400 to-cyan-500' },
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

      {/* 텍스트 정보 영역 (썸네일 아래 분리) */}
      <div className="mt-2 px-0.5">
        <p className="text-[12px] font-bold text-white leading-tight line-clamp-2">
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
        <p className="text-[11px] text-gray-300 leading-snug line-clamp-2">{product.name}</p>
        <div className="mt-0.5 flex items-baseline gap-1">
          {discountRate > 0 && (
            <span className="text-[12px] font-extrabold text-red-500">{discountRate}%</span>
          )}
          <span className="text-[12px] font-extrabold text-white">{product.price.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──
export default function MainHomePage() {
  const navigate = useNavigate()
  const krUser = useAuthKR(state => state.user)
  const worldUser = useAuthWorld(state => state.user)
  const user = isKorea() ? krUser : worldUser
  const isLoggedIn = !!user

  const [activeTab, setActiveTab] = useState<'recommend' | 'following'>('recommend')
  const [activeCategory, setActiveCategory] = useState('all')
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

  const allStreams = [...liveStreams, ...scheduledStreams, ...endedStreams]

  return (
    <div className="bg-[#121212] min-h-screen pb-16">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 bg-[#121212]">
        {/* Row 1: Logo + Search + Icons */}
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <img
                src="/logo.png" alt="유어딜" className="h-7"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  if (!img.src.includes('googleusercontent'))
                    img.src = 'https://lh3.googleusercontent.com/d/1KIviBiRXEnTqMXRPfQ0gg4ZUewVf7gOq'
                }}
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/search')} className="p-1.5">
              <Search className="h-5 w-5 text-gray-100" strokeWidth={1.5} />
            </button>
            <button onClick={() => navigate('/cart')} className="p-1.5 relative">
              <ShoppingCart className="h-5 w-5 text-gray-100" strokeWidth={1.5} />
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
            <button
              onClick={() => navigate(isLoggedIn ? '/user/profile' : '/login')}
              className="p-1.5"
            >
              {isLoggedIn && localStorage.getItem('user_profile_image') ? (
                <img src={localStorage.getItem('user_profile_image')!} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-[#333] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-500">
                    {isLoggedIn ? ((user as any)?.name?.charAt(0) || 'U') : '?'}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Tabs */}
        <div className="flex items-center gap-4 px-4 border-b border-[#1A1A1A]">
          {(['recommend', 'following'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 text-[14px] font-bold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-white border-gray-900'
                  : 'text-gray-500 border-transparent'
              }`}
            >
              {tab === 'recommend' ? '추천' : '팔로잉'}
            </button>
          ))}
        </div>

        {/* Row 3: Category chips */}
        <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar bg-[#121212] border-b border-gray-50">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-[#1A1A1A] text-gray-500'
              }`}
            >
              <span className="text-[11px]">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
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

      {/* ── Quick Menu ── */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-4 gap-3">
          {QUICK_MENUS.map(menu => (
            <button
              key={menu.label}
              onClick={() => navigate(menu.path)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${menu.color} flex items-center justify-center shadow-sm`}>
                <menu.icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium text-gray-500">{menu.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Scheduled Streams ── */}
      {scheduledStreams.length > 0 && (
        <section className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-500" />
              방송 예고
            </h2>
            <button onClick={() => navigate('/live')} className="text-[12px] text-gray-500 flex items-center">
              더보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {scheduledStreams.map(stream => (
              <button
                key={stream.id}
                onClick={() => navigate(`/live/${stream.id}`)}
                className="flex-shrink-0 w-[200px] bg-[#0A0A0A] rounded-xl p-3 text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-600">{stream.seller_name?.charAt(0) || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">{stream.seller_name || '셀러'}</p>
                    {stream.scheduled_at && (
                      <p className="text-[10px] text-blue-500 font-medium">
                        {new Date(stream.scheduled_at).toLocaleString('ko-KR', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2">{stream.title}</p>
                <button
                  onClick={(e) => { e.stopPropagation() }}
                  className="mt-2 w-full py-1.5 bg-[#121212] border border-red-200 rounded-lg text-[11px] font-bold text-red-500"
                >
                  방송 알림 받기
                </button>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── UR 특가 ── */}
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

      <SiteFooter />
    </div>
  )
}
