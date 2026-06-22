import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { escapeHtml } from '@/shared/utils/html'
import { formatNumber } from '@/utils/format'
import type { Restaurant, KakaoPlace } from './types'

// 🗺️ 2026-06-22 (대표 — "중앙 기준이 하단 시트 크기에 따라 달라진다"): 선택 핀을 *보이는 지도 영역*
//   (상단 검색바 아래 ~ 하단 시트 위)의 중앙으로 끌어올릴 px 오프셋을 시트 snap 별로 동적 계산.
//   ⚠️ 시트 높이는 RestaurantMapPage 의 sheetTopByState / sheetTopByStateLg 와 동일하게 미러링 —
//      그쪽 값 변경 시 이 함수도 함께 갱신할 것.
const SHEET_TOP_SEARCH_INSET = 76 // 상단 floating glass 검색바 대략 높이(px)
function centerOffsetForSheet(snap: 'peek' | 'mid' | 'full'): number {
  if (typeof window === 'undefined') return 150
  const H = window.innerHeight
  const isLg = !!window.matchMedia?.('(min-width: 1024px)').matches
  // 시트 top(px) = 시트가 가리기 시작하는 y. 이 위가 보이는 지도 영역.
  const sheetTop =
    snap === 'peek' ? H - 320 // calc(100dvh - 320px)
    : snap === 'mid' ? (isLg ? H * 0.6 : H * 0.4) // calc(100dvh - 40dvh/60dvh)
    : (isLg ? H * 0.2 : H * 0.08) // full: calc(100dvh - 80dvh/92dvh)
  const visibleCenter = (SHEET_TOP_SEARCH_INSET + sheetTop) / 2
  // 양수 = 핀을 기하학적 중앙(H/2)에서 이만큼 위로 끌어올림 → 보이는 영역 중앙에 위치.
  return Math.max(0, H / 2 - visibleCenter)
}

interface UseKakaoMapParams {
  kr: boolean
  /** 리스트 모드 등 지도를 안 쓰는 화면에선 false → Kakao SDK 미로드(홈 피드 perf). */
  enabled?: boolean
  withCoords: Restaurant[]
  coordGroupSize: Map<string, number>
  selected: Restaurant | null
  setSelected: (r: Restaurant | null) => void
  kakaoPlaces: KakaoPlace[]
  setSuggestionFor: (p: KakaoPlace | null) => void
  userLoc: { lat: number; lng: number } | null
  liveSellerIds: Set<number>
  favorites: number[]
  /** 현재 바텀시트 snap — 핀 클릭 시 보이는 영역 중앙 오프셋 계산에 사용. */
  sheetSnap?: 'peek' | 'mid' | 'full'
}

export function useKakaoMap({
  kr,
  enabled = true,
  withCoords,
  coordGroupSize,
  selected,
  setSelected,
  kakaoPlaces,
  setSuggestionFor,
  userLoc,
  liveSellerIds,
  favorites,
  sheetSnap = 'peek',
}: UseKakaoMapParams) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  // panToProduct 가 stale 없이 현재 snap 을 읽도록 ref 동기화(의존성 churn 방지 — panToProduct 는 stable).
  const sheetSnapRef = useRef(sheetSnap)
  sheetSnapRef.current = sheetSnap
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])
  // 🛡️ 2026-06-20 (대표 — 줌 전수조사): 초기 fit(setBounds/setLevel)은 데이터 로드 후 '한 번만'.
  //   기존엔 initMap 의존성에 mapLevel 이 있어 zoom_changed→setMapLevel→initMap 재실행→fit 재호출로
  //   매 줌마다 setLevel(5)/setBounds 가 사용자 줌을 원위치시켜 "줌이 안 먹는" 근본 원인이었음.
  const didInitialFit = useRef(false)

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  const [mapLevel, setMapLevel] = useState<number>(7)
  // 🛡️ 2026-06-20 (대표 — 줌 마커 churn 최적화): 클러스터 gridSize 는 줌 '구간'에서만 바뀜(레벨 3/5/7 경계).
  //   initMap 의존성을 mapLevel(매 줌) → gridSize(구간 변화 시만)로 바꿔 마커 전량 재빌드를 줌 구간 전환 때만.
  const gridSize = useMemo(() => (mapLevel <= 3 ? 0 : mapLevel <= 5 ? 0.001 : mapLevel <= 7 ? 0.005 : 0.02), [mapLevel])

  // SDK loading
  useEffect(() => {
    if (!kr || !enabled) {
      setSdkLoaded(false)
      return
    }
    import('@/lib/kakao-sdk').then(({ ensureKakaoMaps }) => {
      ensureKakaoMaps()
        .then(() => setSdkLoaded(true))
        .catch((e) => {
          if (import.meta.env.DEV) console.error('[RestaurantMap] Kakao Maps load failed:', e)
          setSdkLoaded(false)
          setSdkError(true)
        })
    })
  }, [kr])

  // 🗺️ 2026-06-22 (대표 — "공구 상품을 누르면 지도 한가운데로" + "중앙 기준이 시트 크기 따라 달라짐"):
  //   선택 상품이 *보이는 지도 영역*의 중앙에 오도록 pan. 하단 바텀시트가 화면 아래를 가리므로 단순
  //   panTo(기하학적 중앙)만 하면 핀이 시트 근처(아래쪽)에 박힘. projection 으로 중심좌표를 남쪽으로 옮겨
  //   핀을 위로 끌어올림 → 시각적 중앙 배치. 오프셋은 시트 snap(현재 또는 호출자 지정)에 따라 동적 계산.
  //   projection 미지원/실패 시 plain panTo 폴백.
  const panToProduct = useCallback((lat: number, lng: number, level?: number, snap?: 'peek' | 'mid' | 'full') => {
    const map = mapInstance.current
    if (!map || !window.kakao?.maps || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (typeof level === 'number') map.setLevel(level)
    const latlng = new window.kakao.maps.LatLng(lat, lng)
    const offsetY = centerOffsetForSheet(snap ?? sheetSnapRef.current)
    try {
      const proj = map.getProjection()
      const pt = proj.pointFromCoords(latlng)
      const offsetCenter = proj.coordsFromPoint(new window.kakao.maps.Point(pt.x, pt.y + offsetY))
      map.panTo(offsetCenter)
    } catch {
      map.panTo(latlng)
    }
  }, [])

  const initMap = useCallback(() => {
    if (!sdkLoaded || !mapRef.current || !window.kakao?.maps) return

    const center = withCoords.length > 0
      ? new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng)
      : new window.kakao.maps.LatLng(37.5665, 126.978)

    if (!mapInstance.current) {
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 7,
        // 🛡️ 2026-06-20 (대표 신고 — 스크롤/핀치 줌 잘 안됨): Kakao 네이티브 스크롤휠 줌 명시 활성화.
        //   기존 커스텀 wheel 핸들러(capture+stopImmediatePropagation, 1레벨/tick)가 네이티브 부드러운
        //   커서기준 줌·트랙패드 핀치를 가로채 오히려 뻑뻑했음 → 제거하고 네이티브에 위임.
        scrollwheel: true,
      })
      // 🛡️ 2026-05-16: 명시적 줌/팬 활성화 — 기본값이지만 명시로 안전
      mapInstance.current.setDraggable(true)
      mapInstance.current.setZoomable(true)
      // 🛡️ 2026-05-17: 줌 레벨 명시 — 너무 깊거나 얕은 줌 차단
      mapInstance.current.setMinLevel(1)
      mapInstance.current.setMaxLevel(14)
      // 🛡️ 2026-06-20 (대표 — "버튼과 줌 슬라이더 계속 겹침"): Kakao ZoomControl(+/− 슬라이더) 제거.
      //   스크롤휠·핀치·더블클릭 줌은 그대로 동작(setZoomable+scrollwheel) → 슬라이더 없어도 줌 가능 + 겹침 해소.
      window.kakao.maps.event.addListener(mapInstance.current, 'zoom_changed', () => {
        if (mapInstance.current) setMapLevel(mapInstance.current.getLevel())
      })
      // 🛡️ 2026-06-20: 커스텀 wheel 핸들러 제거 — 네이티브 scrollwheel 줌(위 옵션)에 위임(커서기준·트랙패드 핀치 부드럽게).
    }

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    const clusters = new Map<string, Restaurant[]>()
    if (gridSize > 0) {
      withCoords.forEach(r => {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        const key = `${gx}_${gy}`
        if (!clusters.has(key)) clusters.set(key, [])
        clusters.get(key)!.push(r)
      })
    }

    if (gridSize > 0) {
      clusters.forEach((items) => {
        if (items.length < 2) return
        const sumLat = items.reduce((s, x) => s + x.restaurant_lat, 0)
        const sumLng = items.reduce((s, x) => s + x.restaurant_lng, 0)
        const cx = sumLat / items.length
        const cy = sumLng / items.length
        const minPrice = Math.min(...items.map(x => x.price || 0))
        const cPos = new window.kakao.maps.LatLng(cx, cy)
        const cContent = document.createElement('div')
        cContent.innerHTML = `
          <div style="
            background: linear-gradient(135deg,#6b7280,#6b7280);
            color: #fff;
            border: 3px solid #fff;
            border-radius: 999px;
            min-width: 44px;
            height: 44px;
            padding: 0 12px;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: 0 4px 14px rgba(236,72,153,0.4);
            cursor: pointer;
            transform: translate(-50%, -50%);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          ">
            <span>${items.length}</span>
            <span style="font-size:9px;opacity:0.9;font-weight:600;">${formatNumber(minPrice)}원~</span>
          </div>
        `
        cContent.addEventListener('click', () => {
          if (mapInstance.current) {
            mapInstance.current.panTo(cPos)
            const newLevel = Math.max(1, mapInstance.current.getLevel() - 2)
            mapInstance.current.setLevel(newLevel)
          }
        })
        const cOverlay = new window.kakao.maps.CustomOverlay({
          position: cPos,
          content: cContent,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 5,
          map: mapInstance.current,
        })
        overlaysRef.current.push(cOverlay)
      })
    }

    const clusteredKeys = new Set<string>()
    if (gridSize > 0) {
      clusters.forEach((items, key) => {
        if (items.length >= 2) clusteredKeys.add(key)
      })
    }

    withCoords.forEach(r => {
      if (gridSize > 0) {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        if (clusteredKeys.has(`${gx}_${gy}`)) return
      }
      const pos = new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)

      const hasDiscount = r.original_price > r.price
      const isLive = r.seller_id ? liveSellerIds.has(r.seller_id) : false
      const isFav = favorites.includes(r.id)
      const isSelected = selected?.id === r.id

      const cat = (r.category || '').toLowerCase()
      const emoji = cat.includes('beauty') ? '💇'
        : cat.includes('health') ? '💪'
        : cat.includes('pet') ? '🐶'
        : cat.includes('stay') ? '🏨'
        : cat.includes('activity') ? '🎯'
        : '🍽️'

      const groupKey = `${r.restaurant_lat.toFixed(5)}_${r.restaurant_lng.toFixed(5)}`
      const groupSize = coordGroupSize.get(groupKey) || 1
      const cornerBadge = isLive
        ? `<span style="position:absolute;top:-4px;right:-4px;background:#111827;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:live-pulse 1.2s infinite;">●</span>`
        : hasDiscount
        ? `<span style="position:absolute;top:-6px;right:-8px;background:#111827;color:#fff;border-radius:8px;padding:1px 4px;font-size:9px;font-weight:800;line-height:1.2;">-${Math.round((1 - r.price / r.original_price) * 100)}%</span>`
        : isFav
        ? `<span style="position:absolute;top:-3px;right:-3px;color:#111827;font-size:11px;line-height:1;">❤</span>`
        : groupSize > 1
        ? `<span style="position:absolute;top:-4px;right:-6px;background:#374151;color:#fff;border-radius:9px;padding:0 4px;font-size:9px;font-weight:800;line-height:1.4;">+${groupSize - 1}</span>`
        : ''

      const bg = isSelected ? '#6b7280' : isLive ? '#fff5f5' : '#ffffff'
      const borderColor = isSelected ? '#6b7280' : isLive ? '#111827' : '#e5e7eb'
      const size = isSelected ? 36 : 32

      const content = document.createElement('div')
      content.innerHTML = `
        <div style="
          background: ${bg};
          border: 2px solid ${borderColor};
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          font-size: ${isSelected ? 18 : 16}px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
          cursor: pointer;
          transform: translate(-50%, -50%) scale(${isSelected ? 1.05 : 1});
          transition: transform 0.15s, background 0.15s;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        ">
          <span style="filter:${isSelected ? 'brightness(0) invert(1)' : 'none'};">${emoji}</span>
          ${cornerBadge}
        </div>
      `
      content.addEventListener('click', () => {
        setSelected(r)
        // 🗺️ 2026-06-22: 핀 클릭도 보이는 영역 중앙으로(하단 시트 보정). 현재 줌은 유지.
        panToProduct(r.restaurant_lat, r.restaurant_lng)
      })

      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 0.5,
        xAnchor: 0.5,
        map: mapInstance.current,
      })
      overlaysRef.current.push(overlay)
    })

    kakaoPlaces.forEach(p => {
      const lat = Number(p.y), lng = Number(p.x)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const safeName = escapeHtml(p.place_name || '')
      const grayContent = document.createElement('div')
      grayContent.innerHTML = `
        <div style="
          background: rgba(255,255,255,0.92);
          color: #6b7280;
          border: 1.5px dashed #d1d5db;
          border-radius: 10px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          cursor: pointer;
          transform: translateY(-50%);
        ">
          ${safeName}
          <span style="color:#9ca3af; margin-left:3px; font-size:9px;">+</span>
        </div>
      `
      grayContent.addEventListener('click', () => setSuggestionFor(p))
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(lat, lng),
        content: grayContent,
        yAnchor: 1.3,
        zIndex: 1,
        map: mapInstance.current,
      })
      overlaysRef.current.push(overlay)
    })

    // 🛡️ 2026-06-20 (대표 — 줌 전수조사): 초기 뷰 맞춤은 데이터가 처음 들어온 시점 '한 번만'.
    //   이후(줌/마커 재빌드)엔 절대 재-fit 안 함 → 사용자 줌/이동 보존. category 변경 등으로 다시
    //   맞추고 싶으면 didInitialFit.current=false 로 리셋하는 별도 트리거를 추가(현재는 최초 1회).
    if (!didInitialFit.current) {
      if (withCoords.length > 1) {
        const bounds = new window.kakao.maps.LatLngBounds()
        withCoords.forEach(r => bounds.extend(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)))
        mapInstance.current.setBounds(bounds)
        didInitialFit.current = true
      } else if (withCoords.length === 1) {
        mapInstance.current.setCenter(new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng))
        mapInstance.current.setLevel(5)
        didInitialFit.current = true
      } else if (kakaoPlaces.length > 0 && userLoc) {
        mapInstance.current.setCenter(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
        mapInstance.current.setLevel(4)
        didInitialFit.current = true
      }
    }
  }, [sdkLoaded, withCoords, selected?.id, kakaoPlaces, userLoc, liveSellerIds, favorites, coordGroupSize, gridSize, setSelected, setSuggestionFor, panToProduct])

  useEffect(() => { initMap() }, [initMap])

  useEffect(() => {
    return () => {
      try {
        overlaysRef.current.forEach(o => o.setMap?.(null))
        overlaysRef.current = []
        markersRef.current.forEach(m => m.setMap?.(null))
        markersRef.current = []
        mapInstance.current = null
      } catch { /* ignore */ }
    }
  }, [])

  return { mapRef, mapInstance, sdkLoaded, sdkError, mapLevel, panToProduct }
}
