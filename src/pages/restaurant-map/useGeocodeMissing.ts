/**
 * 🗺️ 좌표 없는 딜(주소만 있음) 클라이언트 지오코딩 보강 훅 — RestaurantMapPage 에서 추출.
 *
 * 🚑 2026-07-02 (대표 신고 — 메인/지도에서 `/api/kakao/place/address` 429 폭주 + 전체 느림):
 *   기존 effect 의 3중 낭비를 수리.
 *   ① 캐시 미확인 재요청: sessionStorage geoCache 에 좌표가 이미 있어도 filter 가 안 봐서
 *      매 마운트마다 같은 딜을 다시 지오코딩 → 홈↔지도 왕복만으로 레이트리밋(30/60s) 소진.
 *   ② 동일 주소 중복 쿼리: 같은 매장(같은 주소)의 딜 여러 개가 각각 1요청.
 *   ③ 429 후에도 계속 폭주: 배치 잔여분을 끝까지 시도 → 429 연쇄(Sentry 노이즈).
 *   → geoCache 보유분 제외 + 주소별 1회만 + 429 시 배치 즉시 중단(다음 마운트에 자연 재시도).
 *
 * 기존 동작 보존: 서버 cron(restaurant-geocode)이 채우기 전 누락분 즉시 핀 표시,
 *   sessionStorage 캐시(ur_geocache_v1), 딜당 1회 시도, 배치 최대 12개.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/lib/api'

interface GeoTarget {
  id: number
  restaurant_address?: string | null
  restaurant_lat?: number | null
  restaurant_lng?: number | null
}

type Coord = { lat: number; lng: number }

export function useGeocodeMissing<T extends GeoTarget>(restaurants: T[]): T[] {
  const [geoCache, setGeoCache] = useState<Record<number, Coord>>(() => {
    try { return JSON.parse(sessionStorage.getItem('ur_geocache_v1') || '{}') } catch { return {} }
  })
  const geoAttempted = useRef<Set<number>>(new Set())

  useEffect(() => {
    const missing = restaurants
      .filter(r => !r.restaurant_lat && r.restaurant_address && !geoCache[r.id] && !geoAttempted.current.has(r.id))
      .slice(0, 12)
    if (missing.length === 0) return
    missing.forEach(r => geoAttempted.current.add(r.id))
    let cancelled = false
    ;(async () => {
      const next: Record<number, Coord> = {}
      const byAddr = new Map<string, Coord | null>()  // 주소별 1회만 쿼리
      for (const r of missing) {
        const addr = r.restaurant_address!
        if (byAddr.has(addr)) {
          const hit = byAddr.get(addr)
          if (hit) next[r.id] = hit
          continue
        }
        try {
          const res = await api.get('/api/kakao/place/address', { params: { query: addr } })
          const d = res.data?.data?.documents?.[0]
          const lat = Number(d?.y), lng = Number(d?.x)
          const coord = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
          byAddr.set(addr, coord)
          if (coord) next[r.id] = coord
        } catch (e) {
          byAddr.set(addr, null)
          // 레이트리밋 도달 — 이번 배치 중단(잔여 id 는 attempted 해제해 다음 마운트에 재시도).
          if ((e as { response?: { status?: number } })?.response?.status === 429) {
            missing.slice(missing.indexOf(r) + 1).forEach(m => geoAttempted.current.delete(m.id))
            break
          }
        }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setGeoCache(prev => {
          const merged = { ...prev, ...next }
          try { sessionStorage.setItem('ur_geocache_v1', JSON.stringify(merged)) } catch { /* ignore */ }
          return merged
        })
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants])

  return useMemo(
    () => restaurants.map(r => (!r.restaurant_lat && geoCache[r.id])
      ? { ...r, restaurant_lat: geoCache[r.id].lat, restaurant_lng: geoCache[r.id].lng }
      : r),
    [restaurants, geoCache]
  )
}
