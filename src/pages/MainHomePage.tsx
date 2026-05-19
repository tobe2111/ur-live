import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ShoppingCart, Eye, Play, Clock, Bell, MapPin, ChevronDown, Map } from 'lucide-react'
import api from '@/lib/api'
import { isLoggedInSync } from '@/utils/auth'
import SiteFooter from '@/components/main/SiteFooter'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import BroadcastNotifyButton from '@/components/live/BroadcastNotifyButton'
import { formatNumber } from '@/utils/format'
import UrDealLogo from '@/components/brand/UrDealLogo'
import RecentlyViewed from './main-home/RecentlyViewed'
import InvitePrompt from './main-home/InvitePrompt'
import SocarStyleHero from './main-home/SocarStyleHero'
import SocarStyleBanner from './main-home/SocarStyleBanner'
import { REGIONS, CATEGORIES } from './main-home/constants'
import { detectRegionFromCoords, getThumb, disc, fmtEnd } from './main-home/utils'
import type { LiveStream, Product } from './main-home/types'
import FlashDealsHero from '@/components/main/FlashDealsHero'

// 🛡️ 2026-05-02: TD-018 분할 — types/constants/utils + RecentlyViewed/InvitePrompt
//   를 ./main-home/ 디렉토리로 추출.
// 🛡️ 2026-04-22: HeroBanner 통합 — 어드민 등록 배너가 메인페이지에 표시되도록 연결
// 이전: HeroBanner 컴포넌트 존재하지만 MainHomePage 에 import 안 됨 → 어드민 배너 등록해도 메인에 안 뜸
// 🛡️ 2026-04-22: HeroBanner 별도 섹션 제거. 어드민 배너를 Region Hero 의 배경 이미지로 사용 (풀스크린).

export default function MainHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 지역: localStorage 저장값 > GPS 자동 감지 > 기본값
  const [region, setRegion] = useState(() => {
    try {
      const saved = localStorage.getItem('user_region')
      if (saved && REGIONS.includes(saved)) return saved
    } catch { /* ignore */ }
    return REGIONS[0]
  })
  // 🛡️ 2026-05-03: 지역 선택 모달 — cycle 대신 전체 리스트에서 직접 선택.
  const [regionModalOpen, setRegionModalOpen] = useState(false)

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
  // 🛡️ 2026-05-19: 카테고리별 온라인 상품 섹션 (브랜드 2차 분류).
  const [categorySections, setCategorySections] = useState<Array<{
    category: string; count: number;
    products: Product[];
    brands?: Array<{ brand_name: string; cnt: number }>;
  }>>([])
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
    const id = setInterval(() => { if (!document.hidden) fetchUnread() }, 60_000)
    const onVisible = () => { if (!document.hidden) fetchUnread() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
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
    document.title = t('mainHome.docTitle')
    // 🛡️ 2026-04-28: 6 calls → 1 (/api/home/bundle) — 1분 edge cache + swr.
    //   첫 진입: 1회 round-trip (D1 6쿼리 병렬). 이후 진입: edge cache hit (수십 ms).
    // 🛡️ 2026-05-01: 8s timeout + 안전 가드 — Worker cold start / D1 hang 시 무한 스켈레톤 차단.
    // 🛡️ 2026-05-06: 60s 자동 새로고침 (visibility-aware) — 라이브 시작/종료 자동 반영.
    let bundleSettled = false
    let cancelled = false
    const safetyTimer = setTimeout(() => {
      if (!bundleSettled && !cancelled) {
        bundleSettled = true
        setLoading(false)
      }
    }, 8000)

    const fetchBundle = (initial: boolean) => {
      api.get('/api/home/bundle', { timeout: 8000 })
        .then(res => {
          if (cancelled || !res.data.success) return
          const d = res.data.data || {}
          if (Array.isArray(d.live)) setLiveStreams(d.live)
          if (Array.isArray(d.scheduled)) setScheduledStreams(d.scheduled)
          if (Array.isArray(d.ended)) setEndedStreams(d.ended)
          if (Array.isArray(d.meal_vouchers)) setMealProducts(d.meal_vouchers)
          if (Array.isArray(d.featured)) setProducts(d.featured)
          if (Array.isArray(d.latest)) setNewProducts(d.latest)
        })
        .catch(() => { /* swallow — 빈 페이지 fallback */ })

      // 🛡️ 2026-05-19: 카테고리별 온라인 상품 (편의점/카페/도서 등).
      api.get('/api/home/categories', { timeout: 8000 })
        .then(res => {
          if (cancelled || !res.data.success) return
          const sections = res.data.data?.sections || []
          if (Array.isArray(sections)) setCategorySections(sections)
        })
        .catch(() => { /* swallow */ })
        .finally(() => {
          if (cancelled) return
          if (initial) {
            bundleSettled = true
            clearTimeout(safetyTimer)
            setLoading(false)
          }
        })
    }

    fetchBundle(true)
    // 🛡️ 2026-05-13: 60s → 20s — 셀러 시작/종료 즉시성 강화. 비용 최소 (단일 endpoint, 가벼움).
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchBundle(false)
    }, 20_000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchBundle(false) }
    document.addEventListener('visibilitychange', onVisible)
    // 윈도우 focus 시에도 즉시 refresh — 셀러가 다른 탭에서 시작/종료한 뒤 메인으로 돌아왔을 때
    const onFocus = () => fetchBundle(false)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [t])

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
    <div className="bg-white dark:bg-[#020202] min-h-screen pb-safe-nav md:pb-16">
      <SEO title={t('mainHome.seoTitle')} description={t('mainHome.seoDesc')} url="/" jsonLd={[organizationJsonLd, webSiteJsonLd]} />

      {/* ═══ Sticky Top Bar ═══ — 모바일 전용. md+ 는 DesktopTopNav 가 담당. */}
      <div className="md:hidden sticky top-0 inset-x-0 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur-md">
        <div className="ur-content-wide px-4 lg:px-8 pt-3 pb-2 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <UrDealLogo size={18} />
        </Link>
        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-200">
          <button onClick={() => navigate('/search')} className="p-1.5"><Search className="h-5 w-5" strokeWidth={1.5} /></button>
          <button onClick={() => navigate('/notifications')} aria-label={unreadCount > 0 ? t('mainHome.ariaNotificationsCount', { count: unreadCount }) : t('mainHome.ariaNotifications')} className="p-1.5 relative">
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
      </div>

      <div className="ur-content-wide">
        {/* 🛡️ 2026-05-16: 쏘카 스타일 hero — 인사 + 슬로건 + 8 카테고리 그리드 */}
        {/*   userName: 카카오 로그인 시 별명 / 비로그인 시 '유저' 자동 fallback */}
        <SocarStyleHero userName={typeof window !== 'undefined' ? (localStorage.getItem('user_name') || undefined) : undefined} />
        {/* SVG 그라디언트 배너 — 페이지네이션 */}
        <SocarStyleBanner />

      {/* 🛡️ 2026-05-17: Quick 3-entry (LIVE/MEAL/SPECIAL) 제거.
            SocarStyleHero 카테고리 그리드 (라이브/식사권/특가) 와 100% 중복 + 식사권 destination 불일치 (/browse vs /group-buy) — UX 일관성 위해 Hero 만 SSOT 로 유지. */}

      {/* 🛡️ 2026-05-17: 라이브 진행 중 섹션을 상단으로 이동 — 시간 민감 컨텐츠 우선 노출.
            기존: hero → 내주변 맛집 → flash → 라이브 → 예정 → 다시보기 → UR특가
            지금: hero → 라이브 → 오프라인(내주변 맛집) → 온라인(flash + UR특가) → 예정 → 다시보기 */}
      {liveStreams.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse" />
                <span className="text-[10px] font-extrabold text-red-400 tracking-[0.14em]">{t('mainHome.nowLiveTag')}</span>
              </div>
              <p className="text-[18px] font-extrabold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.03em' }}>{t('mainHome.quickLiveTitle')}</p>
            </div>
            <button onClick={() => navigate('/live')} className="text-[11px] text-gray-500 dark:text-gray-400 pb-1">{t('mainHome.seeAll')}</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 md:overflow-visible md:grid md:grid-cols-3 md:mx-0 md:px-0 lg:grid-cols-4 xl:grid-cols-5">
            {liveStreams.map(s => {
              const thumb = getThumb(s)
              return (
                <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="shrink-0 w-[170px] md:w-auto text-left active:scale-[0.98] transition-transform">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-[#1A1A1A]">
                    {thumb && <img src={thumb} alt={s.title || t('mainHome.altLiveStream')} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
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
                      <p className="text-[10px] text-white/80 font-semibold truncate">@{s.seller_name || t('mainHome.fallbackSeller')}</p>
                      <p className="text-[12px] text-white font-bold leading-tight line-clamp-2 mt-0.5">{s.title}</p>
                    </div>
                  </div>
                  {s.current_product && (
                    <div className="flex items-baseline gap-1 mt-2 px-0.5">
                      <span className="text-[13px] font-extrabold text-red-400">{t('mainHome.priceWon', { defaultValue: '{{price}}원', price: formatNumber(s.current_product.price) })}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 🏪 오프라인 — 내 주변 공구 (식사/숙소/미용/기타) ═══ */}
      <div className="px-4 pt-7">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {/* 🛡️ 2026-05-17: '오프라인' 대분류 라벨 명시 — 온라인 (FlashDeals/UR특가) 와 시각 분리. */}
              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 tracking-[0.14em]">🏪 {t('mainHome.offlineTag', { defaultValue: '오프라인 — 내 주변 공구' })}</span>
              <button onClick={() => setRegionModalOpen(true)} className="text-[9px] text-gray-500 dark:text-gray-400 underline underline-offset-2">
                {region}
              </button>
            </div>
            <p className="text-[18px] font-extrabold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.03em' }}>{t('mainHome.nearbyTitle', { region: region.split(' ')[0] })}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{t('mainHome.nearbyCount', { count: displayMeals.length })}</p>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <button onClick={() => navigate('/restaurant-map')} className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              <Map className="w-3.5 h-3.5" /> {t('mainHome.mapShortcut')}
            </button>
            {/* 🛡️ 2026-05-17: '전체 보기' 는 /group-buy 의 voucher 카테고리만 (특정 cat 강제 X). */}
            <button onClick={() => navigate('/group-buy')} className="text-[11px] text-gray-500 dark:text-gray-400">{t('mainHome.seeAll')}</button>
          </div>
        </div>

        {/* 🛡️ 2026-05-17: 4 카테고리 sub-tab — 식사/미용/숙소/기타. 클릭 시 해당 필터로 /group-buy 이동. */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {[
            { key: 'meal_voucher',   emoji: '🍽️', label: '식사' },
            { key: 'beauty_voucher', emoji: '💇', label: '미용' },
            { key: 'stay_voucher',   emoji: '🏨', label: '숙소' },
            { key: 'etc_voucher',    emoji: '🎯', label: '기타' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => navigate(`/group-buy?category=${c.key}`)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
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
            <p className="text-[13px] font-extrabold text-gray-900 dark:text-white leading-tight">{t('mainHome.mapBannerTitle')}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{t('mainHome.mapBannerSub')}</p>
          </div>
          <span className="text-[14px] text-[#FBBF24] shrink-0">→</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {displayMeals.slice(0, 8).map((m, i) => {
            const current = m.group_buy_current || 0
            const d = disc(m.price, m.original_price)
            const isClosing = m.group_buy_deadline && (new Date(m.group_buy_deadline).getTime() - Date.now()) < 3600000
            const isHot = current >= 20 // 사회적 증명: 20명 이상 구매 시 인기 표시
            return (
              <button key={m.id} onClick={() => navigate(`/products/${m.id}`)} className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left bg-white dark:bg-[#0B0B0B] border border-gray-100 dark:border-[#151515]">
                <span className="text-[20px] font-black w-[22px] shrink-0" style={{ color: i < 3 ? '#FBBF24' : '#6B7280', letterSpacing: '-0.03em' }}>{i + 1}</span>
                <div className="rounded-lg overflow-hidden shrink-0 relative w-[68px] h-[68px] bg-gray-100 dark:bg-[#1A1A1A]">
                  {m.image_url && <img src={m.image_url} alt={m.name || t('mainHome.altProduct')} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    <span className="text-[9px] font-extrabold px-1 rounded bg-[#FDE68A] text-[#78350F]">🍽 {m.restaurant_address?.split(' ')[0] || t('mainHome.fallbackRestaurant')}</span>
                    {isHot && <span className="text-[9px] font-extrabold px-1 rounded bg-pink-500 text-white">{t('mainHome.tagHot')}</span>}
                    {isClosing && <span className="text-[9px] font-extrabold px-1 rounded bg-[#EF4444] text-white">{t('mainHome.tagClosing')}</span>}
                  </div>
                  <p className="text-[12px] text-gray-900 dark:text-white font-bold leading-tight line-clamp-2">{m.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    {d > 0 && <span className="text-[11px] font-extrabold text-red-400">{d}%</span>}
                    <span className="text-[12px] font-extrabold text-gray-900 dark:text-white">{t('mainHome.priceWon', { defaultValue: '{{price}}원', price: formatNumber(m.price) })}</span>
                  </div>
                  {current > 0 && (
                    <p className="text-[10px] mt-1.5 text-gray-500 dark:text-gray-400">
                      👥 <span className="font-semibold text-gray-700 dark:text-gray-200">{t('mainHome.buyersCount', { count: current })}</span> {t('mainHome.buyingNow')}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ 🛍️ 온라인 — FLASH DEALS ═══ */}
      <FlashDealsHero />

      {/* 🛡️ 2026-05-17: 기존 '지금 라이브딜' 섹션은 상단(banner 다음)으로 이동됨 → 중복 제거. */}

      {/* ═══ 예정 방송 ═══ */}
      {scheduledStreams.length > 0 && (
        <div className="px-4 pt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-extrabold text-blue-400 tracking-[0.14em]">{t('mainHome.scheduledTag')}</p>
              <p className="text-[15px] font-extrabold text-gray-900 dark:text-white mt-0.5">{t('mainHome.scheduledTitle')}</p>
            </div>
            <button onClick={() => navigate('/live')} className="text-[11px] text-gray-500 dark:text-gray-400">{t('mainHome.seeAll')}</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 md:overflow-visible md:grid md:grid-cols-3 md:mx-0 md:px-0 lg:grid-cols-4 xl:grid-cols-5">
            {scheduledStreams.slice(0, 10).map(s => {
              const thumb = getThumb(s)
              const schedDate = s.scheduled_at ? new Date(s.scheduled_at) : null
              const timeLabel = schedDate ? schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
              return (
                <div key={s.id} className="shrink-0 w-[170px] lg:w-auto text-left">
                  <button type="button" onClick={() => navigate(`/live/${s.id}`)} className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A1A1A] cursor-pointer text-left">
                    {thumb && <img src={thumb} alt={s.title || t('mainHome.altScheduled')} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.9) 100%)' }} />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500 px-2 py-0.5 rounded-md">
                      <Clock className="h-2.5 w-2.5 text-white" />
                      <span className="text-[10px] font-bold text-white">{t('mainHome.scheduledBadge')}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      {timeLabel && <p className="text-[18px] font-black text-white">{timeLabel}</p>}
                      <p className="text-[10px] text-white/70 truncate">@{s.seller_name || t('mainHome.fallbackSeller')}</p>
                    </div>
                  </button>
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-1 mt-1.5">{s.title}</p>
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
              <p className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 tracking-[0.14em]">{t('mainHome.replayTag')}</p>
              <p className="text-[15px] font-extrabold text-gray-900 dark:text-white mt-0.5">{t('mainHome.replayTitle')}</p>
            </div>
            <button onClick={() => navigate('/live')} className="text-[11px] text-gray-500 dark:text-gray-400">{t('mainHome.seeAll')}</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 md:overflow-visible md:grid md:grid-cols-3 md:mx-0 md:px-0 lg:grid-cols-4 xl:grid-cols-5">
            {endedStreams.slice(0, 10).map(s => {
              const thumb = getThumb(s)
              return (
                <button key={s.id} onClick={() => navigate(`/live/${s.id}`)} className="shrink-0 w-[150px] lg:w-auto text-left">
                  <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]" style={{ aspectRatio: '16/9' }}>
                    {thumb && <img src={thumb} alt={s.title || t('mainHome.altReplay')} loading="lazy" decoding="async" className="w-full h-full object-cover brightness-[0.85]" />}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Play className="h-2.5 w-2.5 text-white" />
                      <span className="text-[9px] font-bold text-white">{t('mainHome.replayBadge')}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-1 mt-1.5">{s.title}</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">@{s.seller_name || t('mainHome.fallbackSeller')}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 🛡️ 2026-05-19: 카테고리별 온라인 상품 (편의점/카페/도서/모바일교환권 등). */}
      {categorySections.length > 0 && (
        <div className="pt-8 mt-6 bg-gray-50 dark:bg-[#050505] border-t-8 border-gray-100 dark:border-[#0A0A0A]">
          <div className="px-4 pt-5 pb-3">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold tracking-[0.14em]">🛍️ {t('mainHome.onlineTag', { defaultValue: '온라인' })}</p>
            <p className="text-[22px] font-black text-gray-900 dark:text-white mt-0.5" style={{ letterSpacing: '-0.04em' }}>카테고리별 상품</p>
          </div>

          {categorySections.map((section) => (
            <div key={section.category} className="px-4 pb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-extrabold text-gray-900 dark:text-white">
                  {section.category}
                  <span className="ml-2 text-[10px] font-normal text-gray-500 dark:text-gray-400">{section.count}개</span>
                </p>
                <button
                  onClick={() => navigate(`/browse?category=${encodeURIComponent(section.category)}`)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold"
                >
                  더보기 →
                </button>
              </div>
              {/* 🛡️ 2026-05-19: 브랜드 2차 분류 칩 (스타벅스/GS25 등) */}
              {section.brands && section.brands.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-4 px-4 scrollbar-hide">
                  {section.brands.map((b) => (
                    <button
                      key={b.brand_name}
                      onClick={() => navigate(`/browse?category=${encodeURIComponent(section.category)}&brand=${encodeURIComponent(b.brand_name)}`)}
                      className="shrink-0 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-[11px] font-bold rounded-full hover:bg-amber-100"
                    >
                      {b.brand_name} <span className="opacity-60 ml-0.5">{b.cnt}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-4">
                {section.products.slice(0, 8).map((p) => {
                  const d = disc(p.price, p.original_price)
                  // 🛡️ 2026-05-19: deal_only 상품은 '원' 대신 '딜' 단위로 표시.
                  const isDealOnly = Number(p.deal_only) === 1
                  const priceUnit = isDealOnly ? '딜' : '원'
                  const priceLabel = `${formatNumber(p.price)}${priceUnit}`
                  const origLabel = p.original_price ? `${formatNumber(p.original_price)}${priceUnit}` : ''
                  return (
                    <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="text-left w-full block">
                      <div className="relative rounded-lg overflow-hidden aspect-square w-full bg-gray-100 dark:bg-[#1A1A1A]">
                        {p.image_url && <img src={p.image_url} alt={p.name || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                        {d > 0 && <span className="absolute top-1.5 left-1.5 bg-[#EF4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">{d}%</span>}
                        {isDealOnly && <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">🎁 딜 교환</span>}
                      </div>
                      <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-tight line-clamp-2 mt-2">{p.name}</p>
                      {p.original_price && p.original_price > p.price && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-600 line-through mt-0.5">{origLabel}</p>
                      )}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        {d > 0 && <span className="text-[12px] font-extrabold text-red-500">{d}%</span>}
                        <span className={`text-[12px] font-extrabold ${isDealOnly ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{priceLabel}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Bottom sections ═══ */}
      <RecentlyViewed />
      <InvitePrompt />
      </div>
      <SiteFooter />

      {/* 🛡️ 2026-05-03: 지역 선택 모달 — 전체 REGIONS 리스트에서 직접 선택. */}
      {regionModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setRegionModalOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0A0A0A] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('mainHome.regionPickerAria', { defaultValue: '지역 선택' })}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">
                {t('mainHome.regionPickerTitle', { defaultValue: '지역 선택' })}
              </h3>
              <button
                onClick={() => setRegionModalOpen(false)}
                aria-label={t('common.close', { defaultValue: '닫기' })}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.06]"
              >
                <span className="text-gray-900 dark:text-white/70 text-lg leading-none">×</span>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {REGIONS.map(r => {
                const active = r === region
                return (
                  <button
                    key={r}
                    onClick={() => { handleRegionChange(r); setRegionModalOpen(false) }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                      active ? 'bg-pink-500/[0.12]' : 'hover:bg-gray-200 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 ${active ? 'text-pink-400' : 'text-gray-900 dark:text-white/40'}`} />
                    <span className={`flex-1 text-[14px] ${active ? 'text-pink-300 font-bold' : 'text-gray-900 dark:text-white'}`}>
                      {r}
                    </span>
                    {active && (
                      <span className="text-pink-400 text-[12px] font-bold">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

{/* 로딩 오버레이 제거 — 각 섹션이 데이터 없으면 자체 스켈레톤 표시 */}
    </div>
  )
}
