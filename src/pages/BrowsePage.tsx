import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ShoppingCart, Truck, ChevronLeft, SlidersHorizontal, ChevronDown, X, Map, List } from 'lucide-react'
import { captureTrackingFromUrl } from '@/lib/seller-tracking'
import api from '@/lib/api'
import SEO, { itemListJsonLd } from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { usePrefetchProduct } from '@/hooks/usePrefetchProduct'
import { SORT_LABELS, ITEMS_PER_PAGE } from './browse/types'
import type { Product, SortOption } from './browse/types'
import BrowseProductCard from './browse/BrowseProductCard'

// 🛡️ 2026-05-02: TD-018 분할 — types/RecentlyViewedSection 을 ./browse/ 로 추출.
//   미사용 lucide 아이콘 (Clock — RecentlyViewed 내부로 이동) 정리.

interface BrowsePageProps {
  defaultCategory?: string
}

// 🛡️ 2026-06-01 (loading): 상품 카드 React.memo — 2026-06-10 ./browse/BrowseProductCard 로 추출
//   (홈 상품 레일과 카드 공유 — 사용자 요청 "쇼핑 페이지에서 썼던 그대로"). 코드/렌더 결과 불변.

export default function BrowsePage({ defaultCategory }: BrowsePageProps = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-24 (loading P0): 카드 hover/touch 시 상품 상세 prefetch.
  const prefetchProduct = usePrefetchProduct()
  // 🛡️ 2026-05-21 Phase D: 셀러 트래킹 (URL ?seller=ID) sessionStorage 저장.
  useEffect(() => { captureTrackingFromUrl() }, [])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  // ✅ UX M17 FIX: 에러 상태 + 재시도 버튼
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const category = defaultCategory || searchParams.get('category') || 'all'

  // v37 FIX: sortBy를 URL 파라미터로 양방향 동기화
  // - 뒤로가기 시 URL의 sort 값으로 자동 복원
  // - 공유 URL에 sort 포함
  const sortBy = (searchParams.get('sort') as SortOption) || 'popular'
  const setSortBy = (next: SortOption) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (next === 'popular') n.delete('sort')
      else n.set('sort', next)
      return n
    }, { replace: true })
  }
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  // 🏭 2026-06-05 (사용자 요청): 카테고리 scroll-up reveal — 동네딜/교환권처럼 위로 살짝 올리면 카테고리 재노출.
  //   아래로 스크롤 시 숨김(콘텐츠 공간 최대화), 위로 살짝 올리면 다시 내려옴.
  const [revealTop, setRevealTop] = useState(true)
  const lastScrollYRef = useRef(0)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const last = lastScrollYRef.current
        if (y < 120) setRevealTop(true)            // 상단 근처는 항상 표시
        else if (y > last + 6) setRevealTop(false) // 아래로 스크롤 → 숨김
        else if (y < last - 6) setRevealTop(true)  // 위로 스크롤 → 표시
        lastScrollYRef.current = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // 🛡️ 2026-05-19: 진짜 cursor-based 무한스크롤 (이전: client-side slice 만).
  //   2260+ 개 상품에서도 메모리 효율 + 백엔드 1페이지씩 가져옴.
  // 🛡️ 2026-05-24 (loading P0): PAGE_SIZE 50 → 20.
  //   첫 화면 이미지 다운로드 -60% (50개 카드 평균 200~500KB 이미지 = 10-25MB → 4-10MB).
  //   IntersectionObserver 가 sentinel 도달 시 자동으로 다음 페이지 fetch — UX 동일.
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 20
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE)
  const [priceRange, setPriceRange] = useState<'all' | 'under10' | 'under30' | 'under50' | 'over50'>('all')
  const [freeShipOnly, setFreeShipOnly] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [mapView, setMapView] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver — sentinel에 닿으면 자동으로 더 로드 (클릭 없이 무한 스크롤)
  useEffect(() => {
    if (!loadMoreRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setShowCount(c => c + ITEMS_PER_PAGE)
    }, { threshold: 0.1 })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [products])
  // Kakao Maps SDK refs — no TS definitions available for this external SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])

  const isMealVoucher = category === 'meal_voucher'
  const [interestedIds, setInterestedIds] = useState<Set<number>>(new Set())

  // 🛡️ 2026-06-01 (loading): currentlyInterested 를 인자로 받아 interestedIds 클로저 제거 → useCallback 안정화
  //   (memo 카드가 stable 콜백 받도록). 동작 동일.
  const toggleInterest = useCallback((e: React.MouseEvent, productId: number, productName: string | undefined, currentlyInterested: boolean) => {
    e.stopPropagation()
    e.preventDefault()
    const isAdding = !currentlyInterested
    setInterestedIds(prev => {
      const next = new Set(prev)
      if (isAdding) next.add(productId)
      else next.delete(productId)
      return next
    })
    if (isAdding) {
      api.post('/api/interest/add', {
        restaurant_name: productName || '',
        product_id: productId,
        type: 'meal_voucher',
      }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.delete(productId); return next })
      })
      toast.success(t('common.interestAdded'))
    } else {
      api.post('/api/interest/remove', { product_id: productId, type: 'meal_voucher' }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.add(productId); return next })
      })
      toast.info(t('common.interestRemoved'))
    }
  }, [t])

  // 카카오맵 초기화 (식사권 + 지도 모드일 때만)
  useEffect(() => {
    if (!isMealVoucher || !mapView || !mapContainerRef.current) return
    if (mapInstanceRef.current) {
      updateMapMarkers()
      return
    }

    const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

    const initMap = () => {
      if (!mapContainerRef.current) return
      const center = new window.kakao.maps.LatLng(35.2340, 129.0843) // 부산 기본
      mapInstanceRef.current = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 8 })
      updateMapMarkers()
    }

    if (window.kakao?.maps) {
      initMap()
    } else {
      // 🛡️ 2026-04-22: 중복 로드 방지 — 이미 로드된 script 재사용
      const SCRIPT_ID = 'kakao-maps-sdk'
      const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (existingScript) {
        // 다른 곳에서 이미 추가됨 — onload 등록만 하거나 즉시 init 시도
        if (window.kakao?.maps) {
          window.kakao.maps.load(initMap)
        } else {
          existingScript.addEventListener('load', () => window.kakao.maps.load(initMap), { once: true })
        }
      } else {
        const script = document.createElement('script')
        script.id = SCRIPT_ID
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`
        script.onload = () => window.kakao.maps.load(initMap)
        document.head.appendChild(script)
        // cleanup 은 안 함 — 다른 페이지(RestaurantMap 등)도 사용 → singleton SDK 유지
      }
    }
  }, [mapView, isMealVoucher, products])

  function updateMapMarkers() {
    if (!mapInstanceRef.current) return
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const bounds = new window.kakao.maps.LatLngBounds()
    let hasMarkers = false

    sorted.forEach(p => {
      const lat = p.restaurant_lat
      const lng = p.restaurant_lng
      if (!lat || !lng) return

      hasMarkers = true
      const pos = new window.kakao.maps.LatLng(Number(lat), Number(lng))
      bounds.extend(pos)

      const marker = new window.kakao.maps.Marker({ position: pos, map: mapInstanceRef.current })
      const infoWindow = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:8px 12px;min-width:150px">
          <div style="font-weight:700;font-size:13px;color:#111">${p.restaurant_name || p.name}</div>
          <div style="font-size:12px;color:#ef4444;font-weight:700;margin-top:4px">${formatNumber(p.price || 0)}${Number(p.deal_only) === 1 ? ' 딜' : '원'}</div>
          <a href="/products/${p.id}" style="display:inline-block;margin-top:6px;padding:4px 10px;background:#111;color:#fff;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none">상세보기</a>
        </div>`
      })

      window.kakao.maps.event.addListener(marker, 'click', () => {
        markersRef.current.forEach(m => m.__infoWindow?.close())
        infoWindow.open(mapInstanceRef.current, marker)
        marker.__infoWindow = infoWindow
      })

      marker.__infoWindow = infoWindow
      markersRef.current.push(marker)
    })

    if (hasMarkers) mapInstanceRef.current.setBounds(bounds)
  }

  // 🏭 2026-06-05: 정렬/필터 변경 refetch 시 화면 비우지 않으려고 현재 products 길이를 ref 로 추적.
  const productsRef = useRef<Product[]>([])
  useEffect(() => { productsRef.current = products }, [products])
  // 🛡️ 2026-05-19: page-based cursor pagination (50개씩 누적 로드).
  //   /browse 는 일반 상품만 (deal_only=0). 교환권은 /vouchers 신규 페이지에서.
  const loadProducts = useCallback((pageNum: number, reset: boolean) => {
    // 🏭 2026-06-05 (사용자 신고 — 정렬 뒤늦게 반영): 정렬/필터 변경 시 화면 비우지 않고(즉시 클라 정렬) 백그라운드 교체.
    if (reset) { if (productsRef.current.length === 0) setLoading(true) }
    else setLoadingMore(true)
    if (reset) setError(null)
    // 🏭 2026-06-05 (감사 — 정렬/가격 서버사이드화): 클라 정렬키(price_asc/desc) → 서버키(price_low/high) 매핑.
    const SORT_MAP: Record<SortOption, string> = { popular: 'popular', newest: 'newest', price_asc: 'price_low', price_desc: 'price_high', discount: 'discount' }
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PAGE_SIZE),
      exclude_deal_only: '1',  // 🛡️ 2026-05-19: /browse = 쇼핑만, 교환권 제외.
      sort: SORT_MAP[sortBy] || 'popular',
    })
    if (category !== 'all') params.set('category', category)
    // 🏭 2026-06-05 (감사): 가격범위도 서버에서 — 로드된 일부가 아닌 "전체 상품" 기준 필터.
    if (priceRange === 'under10') params.set('max_price', '10000')
    else if (priceRange === 'under30') params.set('max_price', '30000')
    else if (priceRange === 'under50') params.set('max_price', '50000')
    else if (priceRange === 'over50') params.set('min_price', '50000')
    api.get(`/api/products?${params.toString()}`)
      .then(r => {
        if (r.data.success) {
          const newItems: Product[] = r.data.data || []
          setProducts(prev => reset ? newItems : [...prev, ...newItems])
          setHasMore(newItems.length === PAGE_SIZE)
          if (reset) setPage(1)
        } else if (reset) {
          setError(t('browse.loadError'))
        }
      })
      .catch(() => {
        if (reset) setError(t('browse.loadRetry'))
      })
      .finally(() => {
        if (reset) setLoading(false); else setLoadingMore(false)
      })
  }, [category, sortBy, priceRange, t])

  useEffect(() => {
    setProducts([])
    // 🛡️ 2026-05-27 (loading P0): SSR inject first-paint — category=all 초기 진입 즉시 표시.
    // 🏭 2026-06-05: SSR(__SSR_INITIAL_BROWSE__)은 기본(popular/전체가격)일 때만 소비 — 정렬/가격 변경 시 서버 refetch.
    if (category === 'all' && sortBy === 'popular' && priceRange === 'all') {
      try {
        if (typeof document !== 'undefined') {
          const el = document.getElementById('__SSR_INITIAL_BROWSE__')
          if (el?.textContent) {
            const parsed = JSON.parse(el.textContent)
            if (parsed?.success && Array.isArray(parsed?.data)) {
              setProducts(parsed.data)
              setHasMore(parsed.data.length === PAGE_SIZE)
              setLoading(false)
              return
            }
          }
        }
      } catch { /* SSR 누락 — fallback */ }
    }
    loadProducts(1, true)
  }, [category, loadProducts])

  // IntersectionObserver — sentinel 닿으면 다음 페이지 자동 fetch.
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore) {
        const next = page + 1
        setPage(next)
        loadProducts(next, false)
      }
    }, { threshold: 0.1 })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, page, loadProducts])

  useEffect(() => {
    const handler = () => setShowSortDropdown(false)
    if (showSortDropdown) {
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [showSortDropdown])

  const sorted = useMemo(() => {
    // 🏭 2026-06-05 (사용자 신고 — 정렬이 화면에 반영 안 됨): 서버 정렬/가격필터에 더해 로드된 상품을 클라에서도
    //   한 번 더 정렬·필터 → 캐시/배포 지연과 무관하게 선택이 "즉시 보이게"(belt-and-suspenders).
    //   서버는 전체 상품 기준 정확성(페이지 경계) 담당, 클라는 즉시 시각 반영.
    const pr = (p: Product) => (p.current_price || p.price) || 0
    let result = [...products]
    if (priceRange === 'under10') result = result.filter(p => pr(p) < 10000)
    else if (priceRange === 'under30') result = result.filter(p => pr(p) < 30000)
    else if (priceRange === 'under50') result = result.filter(p => pr(p) < 50000)
    else if (priceRange === 'over50') result = result.filter(p => pr(p) >= 50000)
    if (freeShipOnly) result = result.filter(p => pr(p) >= 50000)
    switch (sortBy) {
      case 'price_asc': result.sort((a, b) => pr(a) - pr(b)); break
      case 'price_desc': result.sort((a, b) => pr(b) - pr(a)); break
      case 'popular': result.sort((a, b) => (Number(b.sold_count) || 0) - (Number(a.sold_count) || 0)); break
      case 'discount': result.sort((a, b) => (Number(b.discount_rate) || 0) - (Number(a.discount_rate) || 0)); break
      case 'newest': result.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)); break
    }
    return result
  }, [products, sortBy, priceRange, freeShipOnly])

  const displayed = sorted.slice(0, showCount)
  // showCount < 로드된 항목 OR 백엔드에 더 있음 → "더 있다" 표시.
  const canShowMore = showCount < sorted.length || hasMore

  return (
    <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">
      <SEO
        title={t('browse.title')}
        description={t('browse.seoDesc')}
        url="/browse"
        jsonLd={products.length > 0 ? itemListJsonLd(
          products.slice(0, 20).map((p, i) => ({
            position: i + 1,
            name: p.name,
            url: `/products/${p.id}`,
            image: p.image_url || undefined,
          }))
        ) : undefined}
      />
      {/* 상단 헤더: 검색바 + 아이콘 — 모바일 전용. md+ 는 DesktopTopNav 가 동일 기능 제공. */}
      <div className="md:hidden sticky top-0 z-50 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-wide px-4 py-2.5 lg:px-8">
          <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-[#1A1A1A] rounded-full px-4 py-2.5 cursor-pointer"
            aria-label={t('browse.searchAria')}
          >
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="text-sm text-gray-400 dark:text-gray-500">상품명, 브랜드명</span>
          </button>
          <button onClick={() => navigate('/cart')} aria-label="장바구니" className="p-1 relative">
            <ShoppingCart className="w-6 h-6 text-gray-800 dark:text-gray-100" />
          </button>
          </div>
        </div>
      </div>

      {/* 🛡️ 2026-05-21: 카테고리 가로 스크롤 아이콘 (당근/쿠팡 패턴 — 옵션 A).
            기존 칩 → 이모지 아이콘 + 라벨 세로 배치 + 가로 스크롤.
            한 화면 4-5개씩 표시, 손가락으로 swipe. */}
      {/* 🏭 2026-06-05 (사용자 요청): 카테고리 scroll-up reveal — 위로 조금 올리면 재노출 (동네딜/교환권 패턴).
            sticky top-[60px](모바일 헤더 아래)/md:top-14(데스크톱 탑네비 아래) + revealTop 따라 translateY. */}
      <div
        className="sticky top-[60px] md:top-14 z-30 bg-white dark:bg-[#0A0A0A]"
        style={{ transform: revealTop ? 'translateY(0)' : 'translateY(-110%)', transition: 'transform 0.25s ease', willChange: 'transform' }}
      >
      <div className="border-b border-gray-100 dark:border-[#1A1A1A] overflow-x-auto scrollbar-hide">
        <div className="ur-content-wide flex px-4 lg:px-8 gap-3 py-3">
          {[
            { key: 'all',          label: t('browse.categoryAll', { defaultValue: '전체' }),       emoji: '🛍️' },
            // 🏭 2026-06-04 (사용자 지적): 식사권/교환권은 쇼핑(/browse=실물상품)이 아닌 동네딜·교환권 영역 → 칩 제거.
            { key: 'food',         label: t('browse.categoryFood', { defaultValue: '식품' }),      emoji: '🍱' },
            { key: 'fashion',      label: t('browse.categoryFashion', { defaultValue: '패션' }),   emoji: '👗' },
            { key: 'beauty',       label: t('browse.categoryBeauty', { defaultValue: '뷰티' }),    emoji: '💄' },
            // 🛒 2026-06-23 (대표 '카테고리별로 잘 나뉘어졌어?'): key 는 products.category 실제 저장값.
            //   '리빙'='lifestyle' / '디지털'='electronics' (이전 'living'/'digital' 은 저장값과 불일치 → 0개였음).
            { key: 'lifestyle',    label: t('browse.categoryLiving', { defaultValue: '리빙' }),    emoji: '🛋️' },
            { key: 'electronics',  label: t('browse.categoryDigital', { defaultValue: '디지털' }), emoji: '📱' },
          ].map(c => {
            const active = category === c.key || (c.key === 'all' && category === 'all')
            return (
              <button key={c.key}
                onClick={() => { navigate(c.key === 'all' ? '/browse' : `/browse?category=${c.key}`); setShowCount(ITEMS_PER_PAGE) }}
                className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform min-w-[56px]"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-colors ${
                  active
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                    : 'bg-gray-100 dark:bg-[#1A1A1A]'
                }`}>
                  {c.emoji}
                </div>
                <span className={`text-[11px] font-bold ${
                  active ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {c.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      </div>

      <div className="ur-content-wide px-4 py-5 lg:px-8">
        {/* 섹션 헤더 — 🏭 2026-06-04: 기본('전체')에선 '오늘의 핫딜' 타이틀 숨김(핫딜 섹션 제거). 카테고리 선택 시엔 라벨 표시. */}
        {category !== 'all' && (
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">{(({'fashion':t('browse.categoryFashion'),'beauty':t('browse.categoryBeauty'),'food':t('browse.categoryFood'),'lifestyle':t('browse.categoryLiving'),'electronics':t('browse.categoryDigital'),'living':t('browse.categoryLiving'),'digital':t('browse.categoryDigital'),'meal_voucher':'식사권','beauty_voucher':'뷰티 교환권','health_voucher':'건강 교환권','pet_voucher':'반려 교환권','stay_voucher':'숙박 교환권','activity_voucher':'액티비티 교환권','etc_voucher':'기타 교환권'} as Record<string, string>)[category] || category)}</h1>
          </div>
        )}

        {/* 🏭 2026-06-04 (사용자 요청): '오늘의 핫딜'(TODAY'S DEAL) 프로모 배너 제거 — 불필요. */}

        {/* 필터 + 정렬 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold ${showFilter ? 'bg-gray-900 text-white' : 'bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A2A2A]'}`}>
              <SlidersHorizontal className="w-3 h-3" /> 필터
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{sorted.length}개</span>
            {isMealVoucher && (
              <button onClick={() => setMapView(!mapView)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${mapView ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2A2A2A]'}`}>
                {mapView ? <><List className="w-3 h-3" /> {t('browse.viewList')}</> : <><Map className="w-3 h-3" /> {t('browse.viewMap')}</>}
              </button>
            )}
          </div>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowSortDropdown(v => !v)}
              className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 font-medium"
            >
              {SORT_LABELS[sortBy]}
              <ChevronDown className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showSortDropdown && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl shadow-lg z-30 overflow-hidden">
                {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setShowSortDropdown(false) }}
                    className={`w-full text-left px-3 py-2.5 text-sm ${
                      sortBy === opt ? 'bg-red-50 text-red-500 font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#121212]'
                    }`}
                  >
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 필터 패널 */}
        {showFilter && (
          <div className="bg-gray-50 dark:bg-[#121212] rounded-xl p-3 mb-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">가격대</p>
              <div className="flex flex-wrap gap-1.5">
                {([['all', t('browse.priceAll')],['under10', t('browse.priceUnder10')],['under30', t('browse.priceUnder30')],['under50', t('browse.priceUnder50')],['over50', t('browse.priceOver50')]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => { setPriceRange(v); setShowCount(ITEMS_PER_PAGE) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${priceRange === v ? 'bg-gray-900 text-white' : 'bg-white dark:bg-[#0A0A0A] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A]'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setFreeShipOnly(!freeShipOnly); setShowCount(ITEMS_PER_PAGE) }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${freeShipOnly ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#0A0A0A] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A]'}`}>
                <Truck className="w-3 h-3" /> 무료배송만
              </button>
              {(priceRange !== 'all' || freeShipOnly) && (
                <button onClick={() => { setPriceRange('all'); setFreeShipOnly(false) }} className="text-xs text-red-500 font-medium flex items-center gap-0.5">
                  <X className="w-3 h-3" /> 초기화
                </button>
              )}
            </div>
          </div>
        )}

        {/* 지도 뷰 (식사권 카테고리일 때) */}
        {isMealVoucher && mapView && (
          <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A]">
            <div ref={mapContainerRef} className="w-full h-[400px] bg-gray-100 dark:bg-[#1A1A1A]" />
          </div>
        )}

        {/* 🏭 2026-06-04 (사용자 요청): '최근 본 상품' 섹션 제거. */}

        {/* v4 Editorial Grid — hero + 2열 */}
        {loading ? (
          <div className="space-y-4">
            <div className="w-full lg:max-w-md aspect-[4/3] lg:aspect-square bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded-xl" />
                  <div className="mt-2 h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* ✅ UX M17 FIX: 에러 상태 + 재시도 버튼 */
          <div className="text-center py-16">
            <p className="text-gray-900 dark:text-white mb-4">{error}</p>
            <button
              onClick={() => loadProducts(1, true)}
              className="px-6 py-2 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 dark:text-gray-500">상품이 없습니다</p>
          </div>
        ) : (
          <>
            {/* 🛡️ 2026-05-19: 사용자 요청 — hero 제거, 처음부터 2열 그리드 균등 표시. */}
            {/* 🛡️ 2026-05-21: 카드 높이 불일치 (삐뚤어짐) 영구 fix.
                  원인: original_price/discount 가 조건부 렌더 → 카드마다 높이 다름.
                  해결: items-stretch flex-col + 슬롯 명시 placeholder (모든 카드 동일 구조).
                  디자인: 첨부 이미지 (참외 카드) 스타일 — 원가 strike → 제목 → 할인%+가격 → ⭐+무료 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2.5 items-stretch">
              {displayed.map((product, idx) => (
                <BrowseProductCard
                  key={product.id}
                  product={product}
                  aboveFold={idx < 4}
                  isMealVoucher={isMealVoucher}
                  interested={interestedIds.has(product.id)}
                  onToggleInterest={toggleInterest}
                />
              ))}
            </div>

            {/* 더보기 — sentinel div: observer가 보이면 자동 로드 + 버튼 fallback */}
            {canShowMore && (
              <div ref={loadMoreRef} className="flex justify-center mt-6 pb-20">
                <button onClick={() => {
                  if (showCount < sorted.length) setShowCount(c => c + ITEMS_PER_PAGE)
                  else if (hasMore && !loadingMore) { const n = page + 1; setPage(n); loadProducts(n, false) }
                }}
                  className="px-8 py-3 border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#121212]">
                  더보기 ({sorted.length - showCount}개 남음)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
