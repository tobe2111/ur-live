import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Navigation, Search, Star, Ticket } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Restaurant {
  id: number; name: string; restaurant_name: string; restaurant_address: string
  restaurant_phone: string; restaurant_lat: number; restaurant_lng: number
  price: number; original_price: number; image_url: string
  discount_percent: number; rating: number
}

declare global {
  interface Window {
    kakao: any
  }
}

export default function RestaurantMapPage() {
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [search, setSearch] = useState('')
  const [sdkLoaded, setSdkLoaded] = useState(false)

  const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '제주']

  // 카카오맵 SDK 로드
  useEffect(() => {
    const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY
    if (window.kakao?.maps) { setSdkLoaded(true); return }
    if (!kakaoKey) { setSdkLoaded(true); return } // SDK 없으면 목록만 표시
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`
    script.onload = () => {
      window.kakao.maps.load(() => setSdkLoaded(true))
    }
    document.head.appendChild(script)
  }, [])

  // 데이터 로드
  useEffect(() => {
    api.get('/api/group-buy/products', { params: { category: 'meal_voucher' } })
      .then(r => {
        if (r.data.success) {
          const items = (r.data.data || []).filter((p: any) => p.restaurant_lat && p.restaurant_lng)
          setRestaurants(items)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = restaurants.filter(r => {
    if (region && region !== '전체' && !r.restaurant_address?.includes(region)) return false
    if (search && !r.restaurant_name?.toLowerCase().includes(search.toLowerCase()) && !r.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // 지도 초기화 + 마커
  const initMap = useCallback(() => {
    if (!sdkLoaded || !mapRef.current || !window.kakao?.maps) return

    const center = filtered.length > 0
      ? new window.kakao.maps.LatLng(filtered[0].restaurant_lat, filtered[0].restaurant_lng)
      : new window.kakao.maps.LatLng(37.5665, 126.978)

    if (!mapInstance.current) {
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 8
      })
    }

    // 기존 마커 제거
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    filtered.forEach(r => {
      const pos = new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)
      const marker = new window.kakao.maps.Marker({ position: pos, map: mapInstance.current })

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;font-weight:600;white-space:nowrap;">${r.restaurant_name}</div>`
      })

      window.kakao.maps.event.addListener(marker, 'click', () => {
        setSelected(r)
        mapInstance.current.panTo(pos)
      })
      window.kakao.maps.event.addListener(marker, 'mouseover', () => infowindow.open(mapInstance.current, marker))
      window.kakao.maps.event.addListener(marker, 'mouseout', () => infowindow.close())

      markersRef.current.push(marker)
    })

    if (filtered.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds()
      filtered.forEach(r => bounds.extend(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)))
      mapInstance.current.setBounds(bounds)
    }
  }, [sdkLoaded, filtered])

  useEffect(() => { initMap() }, [initMap])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 shrink-0">맛집 지도</h1>
          <div className="flex-1 relative ml-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="맛집 검색"
              className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
        </div>

        {/* 지역 필터 */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setRegion(r === '전체' ? '' : r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                (r === '전체' && !region) || region === r
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 지도 */}
      {window.kakao?.maps && (
        <div ref={mapRef} className="w-full h-[300px] bg-gray-100" />
      )}

      {/* 선택된 맛집 카드 */}
      {selected && (
        <div className="sticky top-[110px] z-40 mx-4 mt-3 bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <div className="flex gap-3">
            {selected.image_url && (
              <img src={selected.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{selected.restaurant_name}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{selected.restaurant_address}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-lg font-bold text-red-500">{selected.price?.toLocaleString()}원</span>
                {selected.original_price > selected.price && (
                  <span className="text-xs text-gray-400 line-through">{selected.original_price.toLocaleString()}원</span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate(`/products/${selected.id}`)}
              className="self-center px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-xl shrink-0"
            >
              구매
            </button>
          </div>
        </div>
      )}

      {/* 맛집 목록 */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">
            바우처 사용 가능 맛집
            <span className="text-pink-500 ml-1">{filtered.length}</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">해당 지역에 맛집이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r)
                  if (mapInstance.current && window.kakao?.maps) {
                    mapInstance.current.panTo(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng))
                  }
                }}
                className={`w-full flex gap-3 p-3 rounded-2xl text-left transition-colors ${
                  selected?.id === r.id ? 'bg-pink-50 border border-pink-200' : 'bg-white border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {r.image_url && (
                  <img src={r.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-gray-900 text-sm truncate">{r.restaurant_name}</p>
                    <Ticket className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{r.restaurant_address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-red-500">{r.price?.toLocaleString()}원</span>
                    {r.original_price > r.price && (
                      <>
                        <span className="text-[11px] text-gray-400 line-through">{r.original_price?.toLocaleString()}원</span>
                        <span className="text-[11px] bg-red-50 text-red-500 font-bold px-1 rounded">
                          -{Math.round((1 - r.price / r.original_price) * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/products/${r.id}`) }}
                  className="self-center px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg shrink-0"
                >
                  구매
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
