import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingCart, Eye, Play, Clock, Bell, MapPin, ChevronDown, Map } from 'lucide-react'
import api from '@/lib/api'
import { isLoggedInSync } from '@/utils/auth'
import SiteFooter from '@/components/main/SiteFooter'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import SharePrompt from '@/components/SharePrompt'
import BroadcastNotifyButton from '@/components/live/BroadcastNotifyButton'
import { formatNumber } from '@/utils/format'
// 🛡️ 2026-04-22: HeroBanner 통합 — 어드민 등록 배너가 메인페이지에 표시되도록 연결
// 이전: HeroBanner 컴포넌트 존재하지만 MainHomePage 에 import 안 됨 → 어드민 배너 등록해도 메인에 안 뜸
// 🛡️ 2026-04-22: HeroBanner 별도 섹션 제거. 어드민 배너를 Region Hero 의 배경 이미지로 사용 (풀스크린).

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

// 좌표 → 가장 가까운 REGIONS 항목 매핑 (러프한 bounding box, 에너지 적게)
const REGION_COORDS: Array<{ name: string; lat: number; lng: number }> = [
  { name: '강남 · 역삼', lat: 37.498, lng: 127.028 },
  { name: '홍대 · 합정', lat: 37.556, lng: 126.923 },
  { name: '성수 · 건대', lat: 37.544, lng: 127.056 },
  { name: '여의도', lat: 37.521, lng: 126.924 },
  { name: '판교 · 분당', lat: 37.395, lng: 127.110 },
  { name: '부산', lat: 35.180, lng: 129.075 },
  { name: '대구', lat: 35.872, lng: 128.601 },
  { name: '제주', lat: 33.499, lng: 126.531 },
]
function detectRegionFromCoords(lat: number, lng: number): string | null {
  let closest: { name: string; dist: number } | null = null
  for (const r of REGION_COORDS) {
    const dLat = lat - r.lat
    const dLng = lng - r.lng
    const dist = dLat * dLat + dLng * dLng // squared distance 로 충분 (정렬용)
    if (!closest || dist < closest.dist) closest = { name: r.name, dist }
  }
  // 0.5도 이내 (대략 55km) 만 유효
  if (closest && closest.dist < 0.25) return closest.name
  return null
}
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
          <button type="button" key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="shrink-0 w-28 cursor-pointer text-left">
            <div className="aspect-square bg-[#1A1A1A] rounded-xl overflow-hidden">
              {p.image && <img src={p.image} alt={p.name || '상품 이미지'} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <p className="text-xs text-gray-300 mt-1.5 truncate">{p.name}</p>
            <p className="text-xs font-bold text-white">{p.price?.toLocaleString()}원</p>
          </button>
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
  // 지역: localStorage 저장값 > GPS 자동 감지 > 기본값
  const [region, setRegion] = useState(() => {
    try {
      const saved = localStorage.getItem('user_region')
      if (saved && REGIONS.includes(saved)) return saved
    } catch { /* ignore */ }
    return REGIONS[0]
  })

  // GPS 자동 지역 감지 (한 번만 시도, 권한 거부 시 기본값 유지)
  useEffect(() => {
    try {
      if (localStorage.getItem('user_region')) return // 이미 수동 선택/저장된 값 존중
    } catch { /* ignore */ }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords
      const detected = detectRegionFromCoords(latitude, longitude)
      if (detected) {
        setRegion(detected)
        try { localStorage.setItem('user_region', detected) } catch { /* ignore */ }
      }
    }, () => { /* denied or unavailable */ }, { timeout: 5000, enableHighAccuracy: false, maximumAge: 600000 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 수동 지역 변경도 저장
  const handleRegionChange = (r: string) => {
    setRegion(r)
    try { localStorage.setItem('user_region', r) } catch { /* ignore */ }
  }
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [mealProducts, setMealProducts] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)
  // 🛡️ 2026-04-22: 알림 unread badge 실시간 동기화 (이전: static red dot)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // 🛡️ 2026-04-28: 비로그인 사용자는 /api/cart 호출 안 함.
    //   이전: 카톡 인앱에서 비로그인 + 옛 localStorage 토큰 잔존 → 401 →
    //   api.ts 인터셉터가 alert() + redirect → 카톡이 alert 차단 → throw → 흰화면.
    if (!isLoggedInSync()) { setCartCount(0); return }
    // ✅ UX C2 FIX: API 응답은 { success, data: { items: [...], summary } } 구조
    api.get('/api/cart').then(res => {
      if (res.data?.success) {
        const items = res.data.data?.items || (Array.isArray(res.data.data) ? res.data.data : [])
        const count = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
        setCartCount(count)
      }
    }).catch(() => {
      setCartCount(0)
    })
  }, [])

  // 🛡️ 알림 unread 수 동기화 — 60초마다 갱신, 비로그인이면 0
  // 🛡️ 2026-04-23 배치 175: 비로그인 상태에서 호출 시 401 → Sentry 스팸 + 강제 로그아웃 유발.
  //   로그인 여부를 먼저 체크하고, 로그인한 경우에만 API 호출.
  useEffect(() => {
    if (!isLoggedInSync()) { setUnreadCount(0); return }
    let cancelled = false
    const fetchUnread = () => {
      if (!isLoggedInSync()) { setUnreadCount(0); return }
      api.get('/api/notifications/unread-count').then(res => {
        if (cancelled) return
        const c = Number(res.data?.count ?? 0)
        setUnreadCount(Number.isFinite(c) && c >= 0 ? c : 0)
      }).catch(() => { if (!cancelled) setUnreadCount(0) })
    }
    fetchUnread()
    const id = setInterval(fetchUnread, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // 🛡️ 2026-04-22: 신상품 추가 (별도 state)
  const [newProducts, setNewProducts] = useState<Product[]>([])

  // 🛡️ 어드민 등록 배너 — Region Hero 의 풀스크린 배경 이미지로 사용
  // 어드민이 /admin/banners 에서 등록한 image_url + link_url 을 그대로 표시.
  // 여러 배너 등록 시 display_order 순으로 첫 번째 배너만 Hero 배경에 사용 (나머지는 추후 carousel 가능).
  const [heroBanner, setHeroBanner] = useState<{ id: number; image_url: string; link_url: string | null; title: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    api.get('/api/banners').then(res => {
      if (cancelled) return
      const banners = res.data?.data || []
      if (banners.length > 0) {
        const b = banners[0]
        setHeroBanner({
          id: b.id,
          image_url: b.image_url,
          link_url: b.link_url,
          title: b.title || ''
        })
      }
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    document.title = '유어딜 - 라이브 커머스'
    // 🛡️ 2026-04-28: 6 calls → 1 (/api/home/bundle) — 1분 edge cache + swr.
    //   첫 진입: 1회 round-trip (D1 6쿼리 병렬). 이후 진입: edge cache hit (수십 ms).
    // 🛡️ 2026-05-01: 8s timeout + 안전 가드 — Worker cold start / D1 hang 시 무한 스켈레톤 차단.
    //   axios 기본 timeout (15s) 보다 짧게 잡아 사용자에게 빠르게 빈 화면 fallback.
    let bundleSettled = false
    const safetyTimer = setTimeout(() => {
      if (!bundleSettled) {
        bundleSettled = true
        setLoading(false)
      }
    }, 8000)

    api.get('/api/home/bundle', { timeout: 8000 })
      .then(res => {
        if (!res.data.success) return
        const d = res.data.data || {}
        if (Array.isArray(d.live)) setLiveStreams(d.live)
        if (Array.isArray(d.scheduled)) setScheduledStreams(d.scheduled)
        if (Array.isArray(d.ended)) setEndedStreams(d.ended)
        if (Array.isArray(d.meal_vouchers)) setMealProducts(d.meal_vouchers)
        if (Array.isArray(d.featured)) setProducts(d.featured)
        if (Array.isArray(d.latest)) setNewProducts(d.latest)
      })
      .catch(() => { /* swallow — 빈 페이지 fallback */ })
      .finally(() => {
        bundleSettled = true
        clearTimeout(safetyTimer)
        setLoading(false)
      })

    return () => { clearTimeout(safetyTimer) }
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
      <SEO title="홈" description="라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매" url="/" jsonLd={[organizationJsonLd, webSiteJsonLd]} />

      {/* ═══ Sticky Top Bar ═══ */}
      <div className="sticky top-0 inset-x-0 px-4 pt-3 pb-2 flex items-center justify-between z-30 bg-[#020202]/95 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#EF4444] to-[#EC4899]">
            <Play className="h-3 w-3 text-white fill-white" />
          </div>
          <span className="text-[15px] font-extrabold text-white" style={{ letterSpacing: '-0.04em', fontStyle: 'italic' }}>UR·DEAL</span>
        </Link>
        <div className="flex items-center gap-1 text-gray-200">
          <button onClick={() => navigate('/search')} className="p-1.5"><Search className="h-5 w-5" strokeWidth={1.5} /></button>
          <button onClick={() => navigate('/notifications')} aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 (읽지 않음)` : '알림'} className="p-1.5 relative">
            <Bell className="h-5 w-5" strokeWidth={1.5} />
            {/* 🛡️ 2026-04-22: static red dot → 실제 unread count badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/cart')} className="p-1.5 relative">
            <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══ Region Hero (어드민 배너를 풀스크린 배경으로) ═══
           🛡️ 2026-04-22: 어드민 등록 배너(image_url)를 우선 배경으로 사용.
           - 배너 등록되어 있으면: 배너 이미지가 배경, 배너 클릭 시 link_url 이동
           - 배너 없으면: 기존처럼 featured 상품 이미지를 배경으로 fallback */}
      <div className="relative" style={{ height: 300, background: '#000' }}>
        {/* 배경 이미지 (어드민 배너 우선, fallback featured) — LCP 최적화 */}
        {(heroBanner?.image_url || featured?.image_url) && (
          <img
            src={heroBanner?.image_url || featured?.image_url}
            alt={heroBanner?.title || featured?.name || '배너'}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
            fetchPriority="high"
            decoding="async"
          />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0) 55%, rgba(5,5,5,1) 100%)' }} />
        {/* 배너 클릭 핸들러 (link_url 있을 때) — 텍스트/CTA 버튼 위 z-index 보다 낮게 */}
        {heroBanner?.link_url && (
          <button
            onClick={() => {
              const link = String(heroBanner.link_url || '').trim()
              if (link.startsWith('/') && !link.startsWith('//')) navigate(link)
              else if (link.startsWith('http://') || link.startsWith('https://')) window.open(link, '_blank', 'noopener,noreferrer')
            }}
            aria-label={`배너: ${heroBanner.title}`}
            className="absolute inset-0 z-0 cursor-pointer"
          />
        )}

        {/* Region + featured content */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <button onClick={() => handleRegionChange(REGIONS[(REGIONS.indexOf(region) + 1) % REGIONS.length])}
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
              <span className="text-[18px] font-black text-white">{formatNumber(featured.price)}원</span>
              {featured.original_price && <span className="text-[10px] text-white/55 line-through">{formatNumber(featured.original_price)}</span>}
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 z-10">
          <div className="flex-1 rounded-xl p-2.5 flex items-center gap-2 bg-red-500/[0.18] backdrop-blur-md border border-red-500/40">
            <Clock className="w-3.5 h-3.5 text-red-300 shrink-0" />
            <div>
              <p className="text-[11px] text-white font-bold leading-tight">{featured ? fmtEnd(featured.group_buy_deadline) : '진행 중'}</p>
              <p className="text-[10px] text-red-300 font-semibold">
                {featured && (featured.group_buy_current || 0) > 0
                  ? `지금 ${featured.group_buy_current}명 구매 중`
                  : '마감 임박'}
              </p>
            </div>
          </div>
          <button onClick={() => featured && navigate(`/products/${featured.id}`)} className="rounded-xl px-4 py-3 shrink-0 bg-white text-black text-[12px] font-extrabold">구매하기</button>
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
          <div className="flex items-center gap-2 pb-1">
            <button onClick={() => navigate('/restaurant-map')} className="flex items-center gap-1 text-[11px] text-[#FBBF24] font-bold">
              <Map className="w-3.5 h-3.5" /> 지도
            </button>
            <button onClick={() => navigate('/browse?category=meal_voucher')} className="text-[11px] text-gray-400">전체 →</button>
          </div>
        </div>

        {/* 🛡️ 2026-04-27: 카카오맵 지도 페이지 유입 — 메인 hook CTA 배너 */}
        <button
          onClick={() => navigate('/restaurant-map')}
          className="w-full mb-3 rounded-xl p-3 flex items-center gap-3 bg-gradient-to-r from-[#FBBF24]/[0.12] via-[#F59E0B]/[0.10] to-[#FB923C]/[0.08] border border-[#FBBF24]/30 active:scale-[0.99] transition-transform"
        >
          <div className="w-9 h-9 rounded-lg bg-[#FBBF24]/20 flex items-center justify-center shrink-0">
            <Map className="w-5 h-5 text-[#FBBF24]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-extrabold text-white leading-tight">🗺️ 지도에서 한눈에 보기</p>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">내 위치 기준 가까운 맛집 식사권</p>
          </div>
          <span className="text-[14px] text-[#FBBF24] shrink-0">→</span>
        </button>

        <div className="space-y-2">
          {displayMeals.slice(0, 5).map((m, i) => {
            const current = m.group_buy_current || 0
            const d = disc(m.price, m.original_price)
            const isClosing = m.group_buy_deadline && (new Date(m.group_buy_deadline).getTime() - Date.now()) < 3600000
            const isHot = current >= 20 // 사회적 증명: 20명 이상 구매 시 인기 표시
            return (
              <button key={m.id} onClick={() => navigate(`/products/${m.id}`)} className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left bg-[#0B0B0B] border border-[#151515]">
                <span className="text-[20px] font-black w-[22px] shrink-0" style={{ color: i < 3 ? '#FBBF24' : '#6B7280', letterSpacing: '-0.03em' }}>{i + 1}</span>
                <div className="rounded-lg overflow-hidden shrink-0 relative w-[68px] h-[68px] bg-[#1A1A1A]">
                  {m.image_url && <img src={m.image_url} alt={m.name || '상품 이미지'} loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    <span className="text-[9px] font-extrabold px-1 rounded bg-[#FDE68A] text-[#78350F]">🍽 {m.restaurant_address?.split(' ')[0] || '맛집'}</span>
                    {isHot && <span className="text-[9px] font-extrabold px-1 rounded bg-pink-500 text-white">🔥 HOT</span>}
                    {isClosing && <span className="text-[9px] font-extrabold px-1 rounded bg-[#EF4444] text-white">⏰ 곧 마감</span>}
                  </div>
                  <p className="text-[12px] text-white font-bold leading-tight line-clamp-2">{m.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    {d > 0 && <span className="text-[11px] font-extrabold text-red-400">{d}%</span>}
                    <span className="text-[12px] font-extrabold text-white">{formatNumber(m.price)}원</span>
                  </div>
                  {current > 0 && (
                    <p className="text-[10px] mt-1.5 text-gray-400">
                      👥 <span className="font-semibold text-gray-200">{current}명</span> 구매 중
                    </p>
                  )}
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
                    {thumb && <img src={thumb} alt={s.title || '라이브 방송'} loading="lazy" className="w-full h-full object-cover" />}
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
                      <span className="text-[13px] font-extrabold text-red-400">{formatNumber(s.current_product.price)}원</span>
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
                <div key={s.id} className="shrink-0 w-[170px] text-left">
                  <button type="button" onClick={() => navigate(`/live/${s.id}`)} className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#1A1A1A] cursor-pointer text-left">
                    {thumb && <img src={thumb} alt={s.title || '예정 방송'} loading="lazy" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.9) 100%)' }} />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500 px-2 py-0.5 rounded-md">
                      <Clock className="h-2.5 w-2.5 text-white" />
                      <span className="text-[10px] font-bold text-white">예정</span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      {timeLabel && <p className="text-[18px] font-black text-white">{timeLabel}</p>}
                      <p className="text-[10px] text-white/70 truncate">@{s.seller_name || '셀러'}</p>
                    </div>
                  </button>
                  <p className="text-[11px] text-gray-300 line-clamp-1 mt-1.5">{s.title}</p>
                  <div className="mt-1.5">
                    <BroadcastNotifyButton streamId={s.id} compact />
                  </div>
                </div>
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
                    {thumb && <img src={thumb} alt={s.title || '다시보기'} loading="lazy" className="w-full h-full object-cover brightness-[0.85]" />}
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
                      {p.image_url && <img src={p.image_url} alt={p.name || '상품 이미지'} loading="lazy" className="w-full h-full object-cover" />}
                      <span className="absolute top-1.5 left-1.5 rounded flex items-center justify-center w-[22px] h-[22px] bg-[#EF4444] text-[11px] font-black text-white">{i + 1}</span>
                    </div>
                    <p className="text-[11px] text-gray-200 leading-tight line-clamp-2 mt-1.5">{p.name}</p>
                    <p className="text-[12px] font-extrabold text-white mt-1">
                      {d > 0 && <span className="text-red-400 mr-1">{d}%</span>}{formatNumber(p.price)}원
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
                      {p.image_url && <img src={p.image_url} alt={p.name || '상품 이미지'} loading="lazy" className="w-full h-full object-cover" />}
                      {d > 0 && <span className="absolute top-1.5 left-1.5 bg-[#EF4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">{d}%</span>}
                    </div>
                    <p className="text-[11px] text-gray-200 leading-tight line-clamp-2 mt-2">{p.name}</p>
                    {p.original_price && p.original_price > p.price && (
                      <p className="text-[10px] text-gray-500 line-through mt-0.5">{formatNumber(p.original_price)}원</p>
                    )}
                    <div className="flex items-baseline gap-1 mt-0.5">
                      {d > 0 && <span className="text-[12px] font-extrabold text-red-500">{d}%</span>}
                      <span className="text-[12px] font-extrabold text-white">{formatNumber(p.price)}원</span>
                    </div>
                    {(p.avg_rating || p.sold_count) && (
                      <p className="text-[10px] text-gray-500 mt-0.5">★ {(p.avg_rating || 4.5).toFixed(1)} · {formatNumber(p.sold_count || 0)} 구매</p>
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

{/* 로딩 오버레이 제거 — 각 섹션이 데이터 없으면 자체 스켈레톤 표시 */}
    </div>
  )
}
