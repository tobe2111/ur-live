import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Bell, ShoppingCart, Heart, Truck, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, X, Map, List } from 'lucide-react'
import api from '@/lib/api'
import SEO, { itemListJsonLd } from '@/components/SEO'
import { formatPrice } from '@/utils/currency'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import RecentlyViewedSection from './browse/RecentlyViewedSection'
import { SORT_LABELS, ITEMS_PER_PAGE } from './browse/types'
import type { Product, SortOption } from './browse/types'

// 🛡️ 2026-05-02: TD-018 분할 — types/RecentlyViewedSection 을 ./browse/ 로 추출.
//   미사용 lucide 아이콘 (Clock — RecentlyViewed 내부로 이동) 정리.

interface BrowsePageProps {
  defaultCategory?: string
}

export default function BrowsePage({ defaultCategory }: BrowsePageProps = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
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

  const toggleInterest = (e: React.MouseEvent, productId: number, productName?: string) => {
    e.stopPropagation()
    e.preventDefault()
    const isAdding = !interestedIds.has(productId)
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
  }

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
          <div style="font-size:12px;color:#ef4444;font-weight:700;margin-top:4px">${formatNumber(p.price || 0)}원</div>
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

  const loadProducts = useCallback(() => {
    setLoading(true)
    setError(null)
    // 🛡️ 2026-05-19: limit 100→500 (KT Alpha 2260개 등록 대응). 백엔드 max=500.
    const url = category === 'all'
      ? '/api/products?limit=500'
      : `/api/products?category=${encodeURIComponent(category)}&limit=500`
    api.get(url)
      .then(r => {
        if (r.data.success) {
          setProducts(r.data.data || [])
        } else {
          setError(t('browse.loadError'))
        }
      })
      .catch(() => {
        // ✅ UX M17 FIX: 에러 상태 설정 (무시 금지)
        setError(t('browse.loadRetry'))
      })
      .finally(() => setLoading(false))
  }, [category])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    const handler = () => setShowSortDropdown(false)
    if (showSortDropdown) {
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [showSortDropdown])

  const sorted = useMemo(() => {
    let result = [...products]
    // 가격 필터
    if (priceRange === 'under10') result = result.filter(p => (p.current_price || p.price) < 10000)
    else if (priceRange === 'under30') result = result.filter(p => (p.current_price || p.price) < 30000)
    else if (priceRange === 'under50') result = result.filter(p => (p.current_price || p.price) < 50000)
    else if (priceRange === 'over50') result = result.filter(p => (p.current_price || p.price) >= 50000)
    // 무료배송 필터 (5만원 이상)
    if (freeShipOnly) result = result.filter(p => (p.current_price || p.price) >= 50000)
    // 정렬
    switch (sortBy) {
      case 'popular': result.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)); break
      case 'price_asc': result.sort((a, b) => (a.current_price || a.price) - (b.current_price || b.price)); break
      case 'price_desc': result.sort((a, b) => (b.current_price || b.price) - (a.current_price || a.price)); break
      case 'discount': result.sort((a, b) => b.discount_rate - a.discount_rate); break
      case 'newest': result.sort((a, b) => b.id - a.id); break
    }
    return result
  }, [products, sortBy, priceRange, freeShipOnly])

  const displayed = sorted.slice(0, showCount)
  const hasMore = showCount < sorted.length

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
          <button onClick={() => navigate('/cart')} className="p-1 relative">
            <ShoppingCart className="w-6 h-6 text-gray-800 dark:text-gray-100" />
          </button>
          </div>
        </div>
      </div>

      {/* 카테고리 탭 (v4 Editorial) — PC 에서도 풀너비 가로 스크롤, 콘텐츠 centered */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A] overflow-x-auto scrollbar-hide">
        <div className="ur-content-wide flex px-4 lg:px-8 gap-1.5 pb-2.5">
          {[
            { key: 'all', label: t('browse.categoryAll') },
            { key: 'meal_voucher', label: t('browse.categoryVoucher') },
            { key: 'food', label: t('browse.categoryFood') },
            { key: 'fashion', label: t('browse.categoryFashion') },
            { key: 'beauty', label: t('browse.categoryBeauty') },
            { key: 'living', label: t('browse.categoryLiving') },
            { key: 'digital', label: t('browse.categoryDigital') },
          ].map(c => (
            <button key={c.key}
              onClick={() => { navigate(c.key === 'all' ? '/browse' : `/browse?category=${c.key}`); setShowCount(ITEMS_PER_PAGE) }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${
                category === c.key || (c.key === 'all' && category === 'all')
                  ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400'
              }`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ur-content-wide px-4 py-5 lg:px-8">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">{category === 'all' ? t('browse.todaysHot') : (({'fashion':t('browse.categoryFashion'),'beauty':t('browse.categoryBeauty'),'food':t('browse.categoryFood'),'living':t('browse.categoryLiving'),'digital':t('browse.categoryDigital'),'meal_voucher':t('browse.categoryVoucher')} as Record<string, string>)[category] || category)}</h1>
        </div>

        {/* v4 배너 (Editorial Grid) */}
        <div className="rounded-2xl p-4 flex items-center justify-between relative overflow-hidden mb-5"
          style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #6B21A8 50%, #BE185D 100%)' }}>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-white/75">TODAY'S DEAL</p>
            <p className="text-[16px] font-extrabold text-white mt-0.5">매일 바뀌는 초특가</p>
            <p className="text-[11px] text-white/85 mt-1">최대 70% OFF · 오늘만</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-white">
            전체 보기 <ChevronRight className="w-3 h-3" />
          </div>
        </div>

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
                      sortBy === opt ? 'bg-red-50 text-red-500 font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-[#121212]'
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

        {/* 최근 본 상품 */}
        <RecentlyViewedSection />

        {/* v4 Editorial Grid — hero + 2열 */}
        {loading ? (
          <div className="space-y-4">
            <div className="w-full lg:max-w-md aspect-[4/3] lg:aspect-square bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
              onClick={loadProducts}
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
            {/* v4 Hero product (첫 번째 상품 풀폭) */}
            {displayed.length > 0 && (() => {
              const hero = displayed[0]
              const heroDiscount = hero.discount_rate || (hero.original_price ? Math.round((1 - hero.price / hero.original_price) * 100) : 0)
              const heroPrice = hero.current_price || hero.price
              return (
                <button
                  onClick={() => navigate(`/products/${hero.id}`)}
                  className="block w-full lg:max-w-md text-left mb-6"
                >
                  <div
                    className="relative rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-square"
                    style={{ background: '#F9FAFB' }}
                  >
                    {hero.image_url && <img src={hero.image_url} alt={hero.name || t('browse.altProduct')} className="w-full h-full object-cover" fetchPriority="high" decoding="async" />}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {heroDiscount > 0 && (
                        <span className="rounded-md px-2 py-0.5 bg-red-500 text-white text-[9px] font-extrabold">-{heroDiscount}%</span>
                      )}
                    </div>
                    <div className="absolute bottom-2 right-2 rounded-full p-2 bg-white dark:bg-[#0A0A0A]/90 backdrop-blur-sm">
                      <Heart className="w-4 h-4 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    {hero.seller_name && <p className="text-[10px] text-gray-400 dark:text-gray-500">@{hero.seller_name}</p>}
                    <p className="text-[14px] text-gray-900 dark:text-white font-medium mt-0.5 line-clamp-1">{hero.name}</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      {hero.original_price && hero.original_price > heroPrice && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 line-through">{formatPrice(hero.original_price)}</span>
                      )}
                      {heroDiscount > 0 && <span className="text-[18px] font-extrabold text-red-500">{heroDiscount}%</span>}
                      <span className="text-[18px] font-extrabold text-gray-900 dark:text-white">{formatPrice(heroPrice)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">⭐ {hero.sold_count || 0}명 구매 · 🚚 무료배송</p>
                  </div>
                </button>
              )
            })()}

            {/* 2열 그리드 (나머지 상품) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8">
              {displayed.slice(1).map(product => {
                const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)
                const displayPrice = product.current_price || product.price

                return (
                  <button
                    key={product.id}
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="text-left active:scale-[0.98] transition-transform w-full block"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-gray-50 dark:bg-[#121212] rounded-xl">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name || t('browse.altProduct')} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-[#1A1A1A]" />
                      )}
                      {discountRate > 0 && (
                        <span className="absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-extrabold">
                          -{discountRate}%
                        </span>
                      )}
                      <span className="absolute bottom-1.5 right-1.5 rounded-full p-1.5 bg-white dark:bg-[#0A0A0A]/85 backdrop-blur-sm">
                        {isMealVoucher ? (
                          <Bell
                            onClick={(e: React.MouseEvent) => toggleInterest(e, product.id, product.name)}
                            className={`w-3 h-3 ${interestedIds.has(product.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-300 dark:text-gray-600'}`}
                          />
                        ) : (
                          <Heart className="w-3 h-3 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                        )}
                      </span>
                    </div>

                    <div className="mt-2">
                      {product.seller_name && <p className="text-[10px] text-gray-400 dark:text-gray-500">@{product.seller_name}</p>}
                      <p className="text-[12px] text-gray-900 dark:text-white leading-tight line-clamp-2">{product.name}</p>
                      {product.original_price && product.original_price > displayPrice && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 line-through mt-1">{formatPrice(product.original_price)}</p>
                      )}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        {discountRate > 0 && (
                          <span className="text-[13px] font-extrabold text-red-500">{discountRate}%</span>
                        )}
                        <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">{formatPrice(displayPrice)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">⭐ {product.sold_count || 0}</span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 font-semibold">
                          <Truck className="w-2.5 h-2.5" /> 무료
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 더보기 — sentinel div: observer가 보이면 자동 로드 + 버튼 fallback */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center mt-6 pb-20">
                <button onClick={() => setShowCount(c => c + ITEMS_PER_PAGE)}
                  className="px-8 py-3 border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-[#121212]">
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
