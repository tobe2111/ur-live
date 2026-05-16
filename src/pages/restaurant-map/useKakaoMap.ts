import { useRef, useState, useCallback, useEffect } from 'react'
import { escapeHtml } from '@/shared/utils/html'
import { formatNumber } from '@/utils/format'
import type { Restaurant, KakaoPlace } from './types'

interface UseKakaoMapParams {
  kr: boolean
  withCoords: Restaurant[]
  coordGroupSize: Map<string, number>
  selected: Restaurant | null
  setSelected: (r: Restaurant | null) => void
  kakaoPlaces: KakaoPlace[]
  setSuggestionFor: (p: KakaoPlace | null) => void
  userLoc: { lat: number; lng: number } | null
  liveSellerIds: Set<number>
  favorites: number[]
}

export function useKakaoMap({
  kr,
  withCoords,
  coordGroupSize,
  selected,
  setSelected,
  kakaoPlaces,
  setSuggestionFor,
  userLoc,
  liveSellerIds,
  favorites,
}: UseKakaoMapParams) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  const [mapLevel, setMapLevel] = useState<number>(7)

  // SDK loading
  useEffect(() => {
    if (!kr) {
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
      // 🛡️ 2026-05-16: 명시적 줌/팬 활성화 — 기본값이지만 명시로 안전
      mapInstance.current.setDraggable(true)
      mapInstance.current.setZoomable(true)
      const zoomControl = new window.kakao.maps.ZoomControl()
      mapInstance.current.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT)
      window.kakao.maps.event.addListener(mapInstance.current, 'zoom_changed', () => {
        if (mapInstance.current) setMapLevel(mapInstance.current.getLevel())
      })
    }

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    const gridSize = mapLevel <= 3 ? 0 : mapLevel <= 5 ? 0.001 : mapLevel <= 7 ? 0.005 : 0.02
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
            background: linear-gradient(135deg,#ec4899,#f43f5e);
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
        ? `<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:live-pulse 1.2s infinite;">●</span>`
        : hasDiscount
        ? `<span style="position:absolute;top:-6px;right:-8px;background:#ef4444;color:#fff;border-radius:8px;padding:1px 4px;font-size:9px;font-weight:800;line-height:1.2;">-${Math.round((1 - r.price / r.original_price) * 100)}%</span>`
        : isFav
        ? `<span style="position:absolute;top:-3px;right:-3px;color:#ef4444;font-size:11px;line-height:1;">❤</span>`
        : groupSize > 1
        ? `<span style="position:absolute;top:-4px;right:-6px;background:#3b82f6;color:#fff;border-radius:9px;padding:0 4px;font-size:9px;font-weight:800;line-height:1.4;">+${groupSize - 1}</span>`
        : ''

      const bg = isSelected ? '#ec4899' : isLive ? '#fff5f5' : '#ffffff'
      const borderColor = isSelected ? '#ec4899' : isLive ? '#ef4444' : '#e5e7eb'
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
        mapInstance.current.panTo(pos)
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

    if (withCoords.length > 1) {
      const bounds = new window.kakao.maps.LatLngBounds()
      withCoords.forEach(r => bounds.extend(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)))
      mapInstance.current.setBounds(bounds)
    } else if (withCoords.length === 1) {
      mapInstance.current.setCenter(new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng))
      mapInstance.current.setLevel(5)
    } else if (kakaoPlaces.length > 0 && userLoc) {
      mapInstance.current.setCenter(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
      mapInstance.current.setLevel(4)
    }
  }, [sdkLoaded, withCoords, selected?.id, kakaoPlaces, userLoc, liveSellerIds, favorites, coordGroupSize, mapLevel, setSelected, setSuggestionFor])

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

  return { mapRef, mapInstance, sdkLoaded, sdkError, mapLevel }
}
