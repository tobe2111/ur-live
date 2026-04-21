import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Search, Ticket, Phone, ExternalLink, X, ChevronUp, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { isKorea } from '@/shared/config/region'

interface Restaurant {
  id: number; name: string; restaurant_name: string; restaurant_address: string
  restaurant_phone: string; restaurant_lat: number; restaurant_lng: number
  price: number; original_price: number; image_url: string
  discount_percent: number; rating: number
}

// Window.kakao is declared in KakaoCallbackPage.tsx or similar global declaration

const REGIONS = [
  { key: '', label: '전체', emoji: '📍', lat: 36.5, lng: 127.8, level: 13 },
  { key: '서울', label: '서울', emoji: '🏙️', lat: 37.5665, lng: 126.978, level: 8 },
  { key: '경기', label: '경기', emoji: '🌳', lat: 37.4138, lng: 127.5183, level: 10 },
  { key: '인천', label: '인천', emoji: '⚓', lat: 37.4563, lng: 126.7052, level: 9 },
  { key: '부산', label: '부산', emoji: '🌊', lat: 35.1796, lng: 129.0756, level: 8 },
  { key: '대구', label: '대구', emoji: '🍎', lat: 35.8714, lng: 128.6014, level: 8 },
  { key: '광주', label: '광주', emoji: '💡', lat: 35.1595, lng: 126.8526, level: 8 },
  { key: '대전', label: '대전', emoji: '🧪', lat: 36.3504, lng: 127.3845, level: 8 },
  { key: '제주', label: '제주', emoji: '🍊', lat: 33.4890, lng: 126.4983, level: 9 },
]

export default function RestaurantMapPage() {
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [search, setSearch] = useState('')
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [listExpanded, setListExpanded] = useState(false)
  const [mapView, setMapView] = useState(true)

  const kr = isKorea()

  // 지도 SDK 로드 (한국: 카카오맵 / 글로벌: 목록만)
  useEffect(() => {
    if (!kr) {
      setSdkLoaded(false)
      setMapView(false)
      return
    }
    import('@/lib/kakao-sdk').then(({ ensureKakaoMaps }) => {
      ensureKakaoMaps()
        .then(() => setSdkLoaded(true))
        .catch((e) => {
          console.error('[RestaurantMap] Kakao Maps load failed:', e)
          setSdkLoaded(false)
          setMapView(false)
        })
    })
  }, [kr])

  // 데이터 로드
  useEffect(() => {
    api.get('/api/group-buy/products', { params: { category: 'meal_voucher' } })
      .then(r => {
        if (r.data.success) {
          setRestaurants(r.data.data || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = restaurants.filter(r => {
    if (region && !r.restaurant_address?.includes(region)) return false
    if (search) {
      const q = search.toLowerCase()
      return r.restaurant_name?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.restaurant_address?.toLowerCase().includes(q)
    }
    return true
  })

  const withCoords = filtered.filter(r => r.restaurant_lat && r.restaurant_lng)

  // 지도 초기화 + 마커
  const initMap = useCallback(() => {
    if (!sdkLoaded || !mapRef.current || !window.kakao?.maps) return

    const center = withCoords.length > 0
      ? new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng)
      : new window.kakao.maps.LatLng(37.5665, 126.978)

    if (!mapInstance.current) {
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 7,
      })
      // 줌 컨트롤
      const zoomControl = new window.kakao.maps.ZoomControl()
      mapInstance.current.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT)
    }

    // 기존 마커/오버레이 제거
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    withCoords.forEach(r => {
      const pos = new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)

      // 커스텀 오버레이 (마커 대신)
      const discountText = r.original_price > r.price
        ? `-${Math.round((1 - r.price / r.original_price) * 100)}%`
        : ''

      const content = document.createElement('div')
      content.innerHTML = `
        <div style="
          background: ${selected?.id === r.id ? '#ec4899' : '#fff'};
          color: ${selected?.id === r.id ? '#fff' : '#111'};
          border: 2px solid ${selected?.id === r.id ? '#ec4899' : '#e5e7eb'};
          border-radius: 12px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          cursor: pointer;
          transform: translateY(-50%);
          position: relative;
        ">
          ${r.restaurant_name}
          ${discountText ? `<span style="color:${selected?.id === r.id ? '#fef08a' : '#ef4444'};margin-left:4px;">${discountText}</span>` : ''}
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid ${selected?.id === r.id ? '#ec4899' : '#e5e7eb'};
          "></div>
        </div>
      `
      content.addEventListener('click', () => {
        setSelected(r)
        mapInstance.current.panTo(pos)
      })

      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.3,
        map: mapInstance.current,
      })
      overlaysRef.current.push(overlay)
    })

    // 범위 맞추기
    if (withCoords.length > 1) {
      const bounds = new window.kakao.maps.LatLngBounds()
      withCoords.forEach(r => bounds.extend(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)))
      mapInstance.current.setBounds(bounds)
    } else if (withCoords.length === 1) {
      mapInstance.current.setCenter(new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng))
      mapInstance.current.setLevel(5)
    }
  }, [sdkLoaded, withCoords, selected?.id])

  useEffect(() => { initMap() }, [initMap])

  const selectAndPan = (r: Restaurant) => {
    setSelected(r)
    if (mapInstance.current && window.kakao?.maps && r.restaurant_lat && r.restaurant_lng) {
      mapInstance.current.panTo(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng))
      mapInstance.current.setLevel(4)
    }
    setMapView(true)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 pb-16">
      <SEO title="맛집 지도" description="유어딜 바우처 사용 가능 맛집을 지도에서 찾아보세요. 인플루언서 추천 맛집 최대 70% 할인" url="/restaurant-map" />
      {/* ═══ Header ═══ */}
      <div className="shrink-0 bg-white z-50 border-b border-gray-200">
        {/* Title + Search */}
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="맛집 이름이나 지역을 검색하세요"
              className="w-full pl-9 pr-8 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* 지역 필터 칩 */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {REGIONS.map(r => (
            <button
              key={r.key}
              onClick={() => {
                setRegion(r.key)
                setMapView(true)
                if (mapInstance.current && window.kakao?.maps) {
                  mapInstance.current.panTo(new window.kakao.maps.LatLng(r.lat, r.lng))
                  mapInstance.current.setLevel(r.level)
                }
              }}
              className={`flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
                region === r.key
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-pink-300'
              }`}
            >
              <span>{r.emoji}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 지도 / 목록 토글 ═══ */}
      <div className="flex-1 relative overflow-hidden">
        {/* 카카오맵 */}
        {sdkLoaded && window.kakao?.maps ? (
          <div
            ref={mapRef}
            className={`absolute inset-0 transition-transform duration-300 ${
              !mapView ? '-translate-y-full' : 'translate-y-0'
            }`}
            style={{ height: '100%' }}
          />
        ) : (
          <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center">
            <MapPin className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">지도를 불러오는 중...</p>
            <p className="text-xs text-gray-400 mt-1">카카오맵 SDK 로딩 중</p>
          </div>
        )}

        {/* 선택된 맛집 카드 (지도 위 오버레이) */}
        {selected && mapView && (
          <div className="absolute bottom-4 left-4 right-4 z-30 animate-in slide-in-from-bottom duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <div className="flex gap-3">
                {selected.image_url ? (
                  <img src={selected.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                    <span className="text-2xl">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="font-bold text-gray-900 text-[15px]">{selected.restaurant_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {selected.restaurant_address}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-extrabold text-gray-900">{selected.price?.toLocaleString()}원</span>
                    {selected.original_price > selected.price && (
                      <>
                        <span className="text-xs text-gray-400 line-through">{selected.original_price.toLocaleString()}원</span>
                        <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md">
                          -{Math.round((1 - selected.price / selected.original_price) * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {selected.restaurant_phone && (
                  <a href={`tel:${selected.restaurant_phone}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-700 font-medium">
                    <Phone className="w-3.5 h-3.5" /> 전화
                  </a>
                )}
                <button
                  onClick={() => navigate(`/products/${selected.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-bold active:scale-[0.97] transition-transform"
                >
                  <Ticket className="w-4 h-4" /> 바우처 구매
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 지도/목록 전환 FAB */}
        <button
          onClick={() => setMapView(!mapView)}
          className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-4 py-2.5 bg-white rounded-full shadow-lg border border-gray-200 text-sm font-semibold text-gray-700 active:scale-95 transition-transform"
        >
          {mapView ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              목록
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              지도
            </>
          )}
        </button>

        {/* 목록 뷰 */}
        <div className={`absolute inset-0 bg-gray-50 overflow-y-auto transition-transform duration-300 ${
          mapView ? 'translate-y-full' : 'translate-y-0'
        }`}>
          <div className="px-4 py-4">
            {/* 통계 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-gray-900">
                바우처 맛집 <span className="text-pink-500">{filtered.length}곳</span>
              </h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <MapPin className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-900 font-bold">맛집을 찾지 못했어요</p>
                <p className="text-sm text-gray-400 mt-1">다른 지역이나 검색어를 시도해보세요</p>
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {filtered.map(r => {
                  const discount = r.original_price > r.price ? Math.round((1 - r.price / r.original_price) * 100) : 0
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectAndPan(r)}
                      className={`w-full flex gap-3 p-3.5 rounded-2xl text-left transition-all ${
                        selected?.id === r.id
                          ? 'bg-pink-50 border-2 border-pink-300 shadow-sm'
                          : 'bg-white border border-gray-100 hover:shadow-md'
                      }`}
                    >
                      {r.image_url ? (
                        <img src={r.image_url} alt="" className="w-[72px] h-[72px] rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-[72px] h-[72px] rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-gray-900 text-sm truncate">{r.restaurant_name}</p>
                          {discount > 0 && (
                            <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md shrink-0">
                              -{discount}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {r.restaurant_address || '주소 미등록'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{r.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-base font-extrabold text-gray-900">{r.price?.toLocaleString()}원</span>
                          {r.original_price > r.price && (
                            <span className="text-xs text-gray-400 line-through">{r.original_price.toLocaleString()}원</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/products/${r.id}`) }}
                        className="self-center px-3.5 py-2 bg-pink-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
                      >
                        구매
                      </button>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
