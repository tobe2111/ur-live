import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Bell, ShoppingCart, Heart, Truck, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, X, Map, List } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatPrice } from '@/utils/currency'
import { toast } from '@/hooks/useToast'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  sold_count?: number
  stock: number
  category?: string
  seller_name?: string
  restaurant_name?: string
  restaurant_lat?: number
  restaurant_lng?: number
}

type SortOption = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'discount'

const SORT_LABELS: Record<SortOption, string> = {
  popular: '인기순',
  newest: '최신순',
  price_asc: '낮은 가격순',
  price_desc: '높은 가격순',
  discount: '할인율순',
}

const ITEMS_PER_PAGE = 12

export default function BrowsePage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category') || 'all'
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || 'popular'
  )
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE)
  const [priceRange, setPriceRange] = useState<'all' | 'under10' | 'under30' | 'under50' | 'over50'>('all')
  const [freeShipOnly, setFreeShipOnly] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [mapView, setMapView] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
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
      toast.success('관심 등록됨! 공구 시작 시 알려드릴게요')
    } else {
      api.post('/api/interest/remove', { product_id: productId, type: 'meal_voucher' }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.add(productId); return next })
      })
      toast.info('관심 등록이 해제되었습니다')
    }
  }

  // 카카오맵 초기화 (식사권 + 지도 모드일 때만)
  useEffect(() => {
    if (!isMealVoucher || !mapView || !mapContainerRef.current) return
    if (mapInstanceRef.current) {
      updateMapMarkers()
      return
    }

    const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || '975a2e7f97254b08f15dba4d177a2865'

    const initMap = () => {
      if (!mapContainerRef.current) return
      const center = new window.kakao.maps.LatLng(35.2340, 129.0843) // 부산 기본
      mapInstanceRef.current = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 8 })
      updateMapMarkers()
    }

    if (window.kakao?.maps) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`
      script.onload = () => window.kakao.maps.load(initMap)
      document.head.appendChild(script)
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
          <div style="font-size:12px;color:#ef4444;font-weight:700;margin-top:4px">${(p.price || 0).toLocaleString()}원</div>
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

  useEffect(() => {
    setLoading(true)
    const url = category === 'all'
      ? '/api/products?limit=100'
      : `/api/products?category=${encodeURIComponent(category)}&limit=100`
    api.get(url)
      .then(r => { if (r.data.success) setProducts(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

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
    }
    return result
  }, [products, sortBy, priceRange, freeShipOnly])

  const displayed = sorted.slice(0, showCount)
  const hasMore = showCount < sorted.length

  return (
    <div className="bg-white min-h-screen">
      <SEO title="쇼핑" description="유어딜 인기 상품, 맛집 바우처, 라이브 특가를 만나보세요" url="/browse" />
      {/* 상단 헤더: 검색바 + 아이콘 */}
      <div className="sticky top-0 z-50 bg-white px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5 cursor-pointer"
          >
            <Search className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">상품명, 브랜드명</span>
          </div>
          <button onClick={() => navigate('/cart')} className="p-1 relative">
            <ShoppingCart className="w-6 h-6 text-gray-800" />
          </button>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide">
        <div className="flex px-4 gap-1 py-2">
          {[
            { key: 'all', label: '전체', emoji: '🔥' },
            { key: 'fashion', label: '패션', emoji: '👗' },
            { key: 'beauty', label: '뷰티', emoji: '💄' },
            { key: 'food', label: '식품', emoji: '🍜' },
            { key: 'living', label: '리빙', emoji: '🏠' },
            { key: 'digital', label: '디지털', emoji: '📱' },
            { key: 'meal_voucher', label: '식사권', emoji: '🎫' },
          ].map(c => (
            <button key={c.key}
              onClick={() => { navigate(c.key === 'all' ? '/browse' : `/browse?category=${c.key}`); setShowCount(ITEMS_PER_PAGE) }}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                category === c.key || (c.key === 'all' && category === 'all')
                  ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-extrabold text-gray-900">{category === 'all' ? '오늘의 핫딜' : `${({'fashion':'패션','beauty':'뷰티','food':'식품','living':'리빙','digital':'디지털','meal_voucher':'식사권'} as Record<string, string>)[category] || category}`}</h1>
        </div>

        {/* 배너 */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-800 to-pink-700 rounded-2xl px-5 py-3.5 mb-5">
          <p className="text-center text-white text-sm font-bold tracking-wide">매일 달라지는 초특가 상품</p>
        </div>

        {/* 필터 + 정렬 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${showFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
              <SlidersHorizontal className="w-3 h-3" /> 필터
            </button>
            <span className="text-xs text-gray-500">{sorted.length}개</span>
            {isMealVoucher && (
              <button onClick={() => setMapView(!mapView)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${mapView ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
                {mapView ? <><List className="w-3 h-3" /> 리스트</> : <><Map className="w-3 h-3" /> 지도</>}
              </button>
            )}
          </div>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowSortDropdown(v => !v)}
              className="flex items-center gap-1 text-sm text-gray-700 font-medium"
            >
              {SORT_LABELS[sortBy]}
              <ChevronDown className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showSortDropdown && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setShowSortDropdown(false) }}
                    className={`w-full text-left px-3 py-2.5 text-sm ${
                      sortBy === opt ? 'bg-red-50 text-red-500 font-semibold' : 'text-gray-700 hover:bg-gray-50'
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
          <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1.5">가격대</p>
              <div className="flex flex-wrap gap-1.5">
                {([['all','전체'],['under10','1만원 미만'],['under30','3만원 미만'],['under50','5만원 미만'],['over50','5만원 이상']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => { setPriceRange(v); setShowCount(ITEMS_PER_PAGE) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${priceRange === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setFreeShipOnly(!freeShipOnly); setShowCount(ITEMS_PER_PAGE) }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${freeShipOnly ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
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
          <div className="mb-4 rounded-xl overflow-hidden border border-gray-200">
            <div ref={mapContainerRef} className="w-full h-[400px] bg-gray-100" />
          </div>
        )}

        {/* 상품 그리드 (3열) */}
        {loading ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <div className="aspect-square bg-gray-100 animate-pulse rounded-lg" />
                <div className="mt-2 h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="mt-1 h-3 bg-gray-100 rounded animate-pulse w-2/3" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">상품이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-x-3 gap-y-6">
              {displayed.map(product => {
                const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)
                const displayPrice = product.current_price || product.price

                return (
                  <button
                    key={product.id}
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="text-left active:scale-[0.98] transition-transform"
                  >
                    {/* 썸네일 */}
                    <div className="relative aspect-square overflow-hidden bg-gray-50 rounded-lg">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gray-100" />
                      )}
                      {/* 관심 등록 (식사권만) / 하트 (일반) */}
                      <div className="absolute bottom-2 right-2">
                        {isMealVoucher ? (
                          <button
                            onClick={(e) => toggleInterest(e, product.id, product.name)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm active:scale-90 transition-transform"
                            aria-label="관심 등록"
                          >
                            <Bell
                              className={`w-3.5 h-3.5 ${interestedIds.has(product.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-400'}`}
                            />
                          </button>
                        ) : (
                          <Heart className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
                        )}
                      </div>
                    </div>

                    {/* 상품 정보 */}
                    <div className="mt-2">
                      <p className="text-[12px] text-gray-800 leading-tight line-clamp-2">
                        {product.name}
                      </p>
                      {product.original_price && product.original_price > displayPrice && (
                        <p className="text-[11px] text-gray-400 line-through mt-1">
                          {formatPrice(product.original_price)}
                        </p>
                      )}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        {discountRate > 0 && (
                          <span className="text-[13px] font-extrabold text-red-500">{discountRate}%</span>
                        )}
                        <span className="text-[13px] font-extrabold text-gray-900">
                          {formatPrice(displayPrice)}
                        </span>
                      </div>
                      {(product.sold_count ?? 0) > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{product.sold_count}명 구매</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Truck className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-400">무료배송</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 더보기 */}
            {hasMore && (
              <div className="flex justify-center mt-6 pb-4">
                <button onClick={() => setShowCount(c => c + ITEMS_PER_PAGE)}
                  className="px-8 py-3 border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50">
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
