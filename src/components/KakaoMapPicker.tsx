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
   * 🖱️ 2026-09-21 (대표 *"여기 스크롤하는게 어려워 … 어디에 손가락을 대느냐에 따라 달라"*).
   *
   * 기본(false)은 **문서 흐름** — 검색창·지도·목록이 위에서 아래로 쌓이고, 스크롤은 바깥이 한다.
   * 페이지 안(`/seller/store-info` 등)에서는 그게 맞다.
   *
   * `true` 면 **부모 높이를 채우는 한 칸짜리 레이아웃**이 된다: 검색창·지도는 고정이고
   * **스크롤되는 곳은 결과 목록 하나뿐**이다. 모달처럼 높이가 잘린 자리에서 필요하다 —
   * 거기선 [모달 바디 / 지도 / 목록] 셋이 제스처를 나눠 먹어서, 커서 위치에 따라 다른 게 움직였다.
   * ⚠️ 부모가 `flex flex-col` + 높이 제약을 줘야 한다(안 주면 그냥 안 늘어난다).
   */
  fill?: boolean
}

/**
 * 카카오맵 매장 검색 + 시각화 컴포넌트
 * 검색 결과를 지도 위에 마커로 표시, 마커 클릭 시 선택
 */
export default function KakaoMapPicker({ onSelect, selectedPlace, kakaoJsKey, fill = false }: Props) {
  const { t } = useTranslation()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)

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

  /**
   * 📐 `fill` 에서는 결과가 도착하면 지도가 낮아진다(목록에 자리를 준다). 카카오 지도는 컨테이너가
   * 바뀐 걸 스스로 모르므로 `relayout()` 을 불러 줘야 한다 — 안 부르면 줄어든 자리에 **회색 띠**가
   * 남거나 중심이 어긋난다(높이만 바꾸고 끝내면 반드시 밟는 함정이다).
   */
  const shrunk = fill && results.length > 0
  useEffect(() => {
    if (!fill || !mapRef.current) return
    const id = setTimeout(() => {
      try {
        const center = mapRef.current.getCenter()
        mapRef.current.relayout()
        mapRef.current.setCenter(center)
      } catch { /* SDK 미로드 — 다음 렌더에 다시 온다 */ }
    }, 0)
    return () => clearTimeout(id)
  }, [shrunk, fill])

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
    <div className={fill ? 'flex flex-col h-full min-h-0 gap-3' : 'space-y-3'}>
      {/* 검색창 — fill 에서는 맨 위에 고정(스크롤 대상 아님) */}
      <div className={`flex gap-2${fill ? ' shrink-0' : ''}`}>
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
      <div className={`relative rounded-xl overflow-hidden border border-line${fill ? ' shrink-0' : ''}`}>
        <div
          ref={mapContainerRef}
          className={`w-full bg-gray-100 dark:bg-[#1D1F29] ${fill ? (shrunk ? 'h-[160px]' : 'h-[260px]') : 'h-[320px]'}`}
        />
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
      </div>

      {/* 검색 결과 리스트 (지도 + 리스트 병행) */}
      {results.length > 0 && (
        <div className={`${fill ? 'flex-1 min-h-0' : 'max-h-64'} overflow-y-auto overscroll-contain border border-gray-100 dark:border-[#2C2F35] rounded-lg divide-y divide-gray-100`}>
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
