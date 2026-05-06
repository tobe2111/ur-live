import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

declare global {
  interface Window { kakao: any }
}

export interface KakaoPlace {
  place_name: string
  road_address_name?: string
  address_name?: string
  phone?: string
  category_name?: string
  x: string  // longitude
  y: string  // latitude
  id?: string
}

interface Props {
  onSelect: (place: KakaoPlace) => void
  selectedPlace?: { name: string; address: string; lat: string; lng: string } | null
  kakaoJsKey: string
  kakaoRestKey?: string
}

/**
 * 카카오맵 매장 검색 + 시각화 컴포넌트
 * 검색 결과를 지도 위에 마커로 표시, 마커 클릭 시 선택
 */
export default function KakaoMapPicker({ onSelect, selectedPlace, kakaoJsKey }: Props) {
  const { t } = useTranslation()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<KakaoPlace[]>([])
  const [mapReady, setMapReady] = useState(false)

  // SDK 로드
  useEffect(() => {
    if (window.kakao?.maps) {
      initMap()
      return
    }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&libraries=services&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(initMap)
    document.head.appendChild(script)
  }, [kakaoJsKey])

  function initMap() {
    if (!mapContainerRef.current) return
    const defaultCenter = new window.kakao.maps.LatLng(37.5665, 126.9780) // 서울
    mapRef.current = new window.kakao.maps.Map(mapContainerRef.current, {
      center: defaultCenter, level: 5
    })
    infoWindowRef.current = new window.kakao.maps.InfoWindow({ zIndex: 1 })
    setMapReady(true)

    // 선택된 장소가 있으면 지도 중심 이동
    if (selectedPlace?.lat && selectedPlace?.lng) {
      const pos = new window.kakao.maps.LatLng(Number(selectedPlace.lat), Number(selectedPlace.lng))
      mapRef.current.setCenter(pos)
      addMarker({
        place_name: selectedPlace.name,
        address_name: selectedPlace.address,
        x: selectedPlace.lng,
        y: selectedPlace.lat,
      }, true)
    }
  }

  function clearMarkers() {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
  }

  function addMarker(place: KakaoPlace, isSelected = false) {
    if (!mapRef.current) return
    const pos = new window.kakao.maps.LatLng(Number(place.y), Number(place.x))
    const marker = new window.kakao.maps.Marker({
      position: pos,
      map: mapRef.current,
    })

    window.kakao.maps.event.addListener(marker, 'click', () => {
      infoWindowRef.current.setContent(
        `<div style="padding:8px 10px;min-width:160px">
          <div style="font-weight:700;font-size:13px;color:#111">${place.place_name}</div>
          <div style="font-size:11px;color:#666;margin-top:2px">${place.road_address_name || place.address_name || ''}</div>
          <button id="map-select-btn" style="margin-top:6px;padding:4px 10px;background:#111;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer">선택</button>
        </div>`
      )
      infoWindowRef.current.open(mapRef.current, marker)
      setTimeout(() => {
        const btn = document.getElementById('map-select-btn')
        if (btn) btn.onclick = () => { onSelect(place); infoWindowRef.current.close() }
      }, 0)
    })

    markersRef.current.push(marker)

    if (isSelected) {
      // 선택된 마커는 기본 표시
      mapRef.current.setCenter(pos)
    }

    return marker
  }

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/kakao/place/search?query=${encodeURIComponent(query)}&size=15`
      )
      const json: any = await res.json()
      const docs: KakaoPlace[] = json.data?.documents || json.documents || []
      setResults(docs)

      clearMarkers()
      if (docs.length > 0 && mapRef.current) {
        const bounds = new window.kakao.maps.LatLngBounds()
        docs.forEach(p => {
          addMarker(p)
          bounds.extend(new window.kakao.maps.LatLng(Number(p.y), Number(p.x)))
        })
        mapRef.current.setBounds(bounds)
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[KakaoMapPicker] search failed:', e)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(place: KakaoPlace) {
    onSelect(place)
    // 지도 중심 이동
    if (mapRef.current) {
      const pos = new window.kakao.maps.LatLng(Number(place.y), Number(place.x))
      mapRef.current.setCenter(pos)
      mapRef.current.setLevel(3)
    }
  }

  return (
    <div className="space-y-3">
      {/* 검색창 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
            placeholder={t('map.picker.placeholder', { defaultValue: '매장 이름 또는 주소 (예: 광화문 김밥천국)' })}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold shrink-0 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
        </button>
      </div>

      {/* 카카오맵 */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A]">
        <div ref={mapContainerRef} className="w-full h-[320px] bg-gray-100 dark:bg-[#1A1A1A]" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A]">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        )}
      </div>

      {/* 검색 결과 리스트 (지도 + 리스트 병행) */}
      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto border border-gray-100 dark:border-[#1A1A1A] rounded-lg divide-y divide-gray-100">
          {results.map((p, i) => (
            <button
              key={p.id || i}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50"
            >
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{p.place_name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{p.road_address_name || p.address_name}</p>
                {p.category_name && <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{p.category_name}</p>}
              </div>
              {p.phone && <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{p.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
