import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { escapeHtml } from '@/shared/utils/html'

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
  /**
   * 📍 2026-09-21 시안 ② — 핀을 끌어 정확한 위치를 잡는다.
   *
   * 넘기면 선택된 핀이 **드래그 가능**해지고 지도를 눌러도 핀이 옮겨간다.
   * 옮긴 좌표는 카카오 SDK 의 `services.Geocoder.coord2Address` 로 **주소를 되찾아** 함께 돌려준다
   * (SDK 를 `libraries=services` 로 이미 싣고 있어 서버 왕복이 없다).
   *
   * ⚠️ `onSelect` 와 **일부러 갈라 놓았다** — `onSelect` 는 "다른 매장을 골랐다" 라서 이름·전화·place id 까지
   * 바꾸지만, 핀 이동은 "같은 매장의 위치를 더 정확히" 이므로 **주소와 좌표만** 바꿔야 한다.
   * 한 콜백으로 합치면 핀을 조금 끌었다고 매장 전화번호가 지워진다.
   */
  onPinMove?: (loc: { address: string; lat: string; lng: string }) => void
}

/**
 * 카카오맵 매장 검색 + 시각화 컴포넌트
 * 검색 결과를 지도 위에 마커로 표시, 마커 클릭 시 선택
 */
export default function KakaoMapPicker({ onSelect, selectedPlace, kakaoJsKey, onPinMove }: Props) {
  const { t } = useTranslation()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const pinRef = useRef<any>(null)          // 📍 드래그 가능한 선택 핀 (onPinMove 가 있을 때만)
  const geocoderRef = useRef<any>(null)
  const onPinMoveRef = useRef(onPinMove)
  onPinMoveRef.current = onPinMove          // 리스너는 한 번만 달고 최신 콜백을 본다

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<KakaoPlace[]>([])
  const [mapReady, setMapReady] = useState(false)

  // 🛡️ 2026-05-19: SDK 로드 — kakaoJsKey 없거나 SDK 로드 실패 시 graceful (페이지 크래시 X).
  const [sdkError, setSdkError] = useState<string | null>(null)
  useEffect(() => {
    if (!kakaoJsKey) {
      setSdkError('카카오 맵 API 키가 설정되지 않았습니다 (운영자 환경변수 확인 필요).')
      return
    }
    if (window.kakao?.maps) {
      try { initMap() } catch (e) { setSdkError((e as Error).message) }
      return
    }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&libraries=services&autoload=false`
    script.async = true
    script.onload = () => {
      try {
        window.kakao.maps.load(() => {
          try { initMap() } catch (e) { setSdkError((e as Error).message) }
        })
      } catch (e) {
        setSdkError((e as Error).message)
      }
    }
    script.onerror = () => setSdkError('카카오 맵 SDK 로드 실패 — 네트워크 확인 또는 도메인 허용 설정 확인.')
    document.head.appendChild(script)
  }, [kakaoJsKey])

  function initMap() {
    if (!mapContainerRef.current) return
    const defaultCenter = new window.kakao.maps.LatLng(37.5665, 126.9780) // 서울
    mapRef.current = new window.kakao.maps.Map(mapContainerRef.current, {
      center: defaultCenter, level: 5
    })
    infoWindowRef.current = new window.kakao.maps.InfoWindow({ zIndex: 1 })

    // 📍 시안 ② — 핀 이동을 쓰는 화면에서만 지오코더를 준비하고 지도 클릭을 받는다.
    //    onPinMove 를 안 넘기는 화면은 리스너조차 안 달려 종전과 동작이 같다.
    if (onPinMoveRef.current) {
      try { geocoderRef.current = new window.kakao.maps.services.Geocoder() } catch { geocoderRef.current = null }
      window.kakao.maps.event.addListener(mapRef.current, 'click', (e: any) => {
        if (!onPinMoveRef.current) return
        movePinTo(e.latLng)
      })
    }

    setMapReady(true)

    // 선택된 장소가 있으면 지도 중심 이동
    if (selectedPlace?.lat && selectedPlace?.lng) {
      const pos = new window.kakao.maps.LatLng(Number(selectedPlace.lat), Number(selectedPlace.lng))
      mapRef.current.setCenter(pos)
      if (onPinMoveRef.current) placePin(pos)
      else addMarker({
        place_name: selectedPlace.name,
        address_name: selectedPlace.address,
        x: selectedPlace.lng,
        y: selectedPlace.lat,
      }, true)
    }
  }

  /**
   * 📍 드래그 핀을 그 자리에 세운다(없으면 만들고, 있으면 옮긴다).
   * 핀은 검색 결과 마커와 **따로 산다** — `clearMarkers()` 가 지우는 것은 검색 결과뿐이라
   * 새로 검색해도 사용자가 잡아 둔 위치가 사라지지 않는다.
   */
  function placePin(pos: any) {
    if (!mapRef.current) return
    if (!pinRef.current) {
      pinRef.current = new window.kakao.maps.Marker({
        position: pos, map: mapRef.current, draggable: true, zIndex: 10,
      })
      window.kakao.maps.event.addListener(pinRef.current, 'dragend', () => {
        reportPin(pinRef.current.getPosition())
      })
    } else {
      pinRef.current.setPosition(pos)
      pinRef.current.setMap(mapRef.current)
    }
  }

  function movePinTo(pos: any) {
    placePin(pos)
    reportPin(pos)
  }

  /**
   * 좌표 → 주소(역지오코딩) → 호출부로.
   * ⚠️ 주소를 못 찾아도 **좌표는 반드시 보고한다** — 지도에서 옮긴 핀과 저장된 좌표가 어긋나면
   *    사용자가 고친 줄 알고 넘어가는데 실제론 안 고쳐진, 에러 없는 어긋남이 생긴다.
   */
  function reportPin(pos: any) {
    const lat = String(pos.getLat())
    const lng = String(pos.getLng())
    const cb = onPinMoveRef.current
    if (!cb) return
    const g = geocoderRef.current
    if (!g) { cb({ address: '', lat, lng }); return }
    try {
      g.coord2Address(pos.getLng(), pos.getLat(), (result: any[], status: any) => {
        const ok = status === window.kakao.maps.services.Status.OK && result?.[0]
        const addr = ok ? (result[0].road_address?.address_name || result[0].address?.address_name || '') : ''
        cb({ address: addr, lat, lng })
      })
    } catch {
      cb({ address: '', lat, lng })
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
      // 🛡️ 2026-05-22: Kakao Maps API 응답값 XSS 방어 — InfoWindow.setContent 는 HTML 그대로 렌더.
      //   place.place_name / address_name 은 외부 데이터 (Kakao 측 변동성 + 검색어에 따라 reflected risk).
      infoWindowRef.current.setContent(
        `<div style="padding:8px 10px;min-width:160px">
          <div style="font-weight:700;font-size:13px;color:#111">${escapeHtml(place.place_name || '')}</div>
          <div style="font-size:11px;color:#666;margin-top:2px">${escapeHtml(place.road_address_name || place.address_name || '')}</div>
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
      // 검색으로 고른 직후부터 바로 끌 수 있게 핀을 그 자리에 세운다(주소는 방금 고른 것이라 되찾지 않는다).
      if (onPinMoveRef.current) placePin(pos)
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
            className="w-full pl-9 pr-3 py-2.5 border border-line rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
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

      {/* 카카오맵 — 🛡️ 2026-05-19: SDK 실패 시 graceful fallback (페이지 크래시 방지). */}
      <div className="relative rounded-xl overflow-hidden border border-line">
        <div ref={mapContainerRef} className="w-full h-[320px] bg-gray-100 dark:bg-[#1D1F29]" />
        {sdkError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1D1F29] p-4 text-center">
            <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-1">지도를 불러올 수 없습니다</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{sdkError}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">아래 검색은 그대로 사용 가능합니다.</p>
          </div>
        ) : !mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-[#1D1F29]">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-gray-500" />
          </div>
        )}

        {/* 📍 시안 ② 안내 — 지도 위에 얹는 흰 띠. light-island: 지도 타일은 다크에서도 밝다. */}
        {onPinMove && mapReady && !sdkError && (
          <div className="light-island absolute left-2 right-2 bottom-2 rounded-lg bg-white/95 px-3 py-2 shadow-lift"> {/* light-fixed: 지도 위 — 타일이 다크에서도 밝다 */}
            <p className="text-[11px] text-gray-700 leading-snug"> {/* light-fixed: 지도 위 */}
              {t('map.picker.dragHint', { defaultValue: '핀을 끌어 정확한 위치로 옮겨 주세요 — 지도를 눌러도 옮겨집니다' })}
            </p>
          </div>
        )}
      </div>

      {/* 검색 결과 리스트 (지도 + 리스트 병행) */}
      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto border border-gray-100 dark:border-[#2C2F35] rounded-lg divide-y divide-gray-100">
          {results.map((p, i) => (
            <button
              key={p.id || i}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-[#1D1F29]"
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
