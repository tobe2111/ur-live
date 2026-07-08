import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import type { SortBy } from './types'

/**
 * 🧭 2026-07-07 (대표 — 홈 '내 주변' 기준을 제대로): 위치가 잡히면
 *  (1) 첫 진입 1회 자동 '가까운 순' 정렬(+내 주변 모드) — 사용자가 정렬/지역을 직접 고르면 skip,
 *  (2) 동네 이름 역지오코딩(좌표→행정동) → 상단 '전국' 라벨을 실제 동네로(폴백 '내 주변').
 * GPS 거부/위치 없음이면 둘 다 미발동 → 기존 전국·할인순 유지(폴백).
 *
 * 반환 setSortByUser 를 정렬 UI(SheetFilterBar/FilterSheet)에 넘기면 사용자가 정렬을 직접
 * 바꾼 시점부터 자동 개입을 멈춘다(userTouched 가드).
 */
export function useNearMeAuto(opts: {
  userLoc: { lat: number; lng: number } | null
  region: string
  district: string
  setSortBy: (s: SortBy) => void
  setNearMeMode: (b: boolean) => void
}): { nearDong: string; setSortByUser: (s: SortBy) => void } {
  const { userLoc, region, district, setSortBy, setNearMeMode } = opts
  const [nearDong, setNearDong] = useState<string>(() => {
    try { return localStorage.getItem('ur_near_dong_v1') || '' } catch { return '' }
  })
  const autoAppliedRef = useRef(false)
  const userTouchedRef = useRef(false)
  const setSortByUser = useCallback((s: SortBy) => { userTouchedRef.current = true; setSortBy(s) }, [setSortBy])

  useEffect(() => {
    if (!userLoc) return
    if (!autoAppliedRef.current && !userTouchedRef.current && !region && !district) {
      autoAppliedRef.current = true
      setSortBy('distance')
      setNearMeMode(true)
    }
    let alive = true
    api.get(`/api/kakao/coord2region?lat=${userLoc.lat}&lng=${userLoc.lng}`)
      .then((r) => {
        const dong = r.data?.data?.dong
        if (alive && typeof dong === 'string' && dong) {
          setNearDong(dong)
          try { localStorage.setItem('ur_near_dong_v1', dong) } catch { /* quota */ }
        }
      })
      .catch(() => { /* silent — 라벨은 '내 주변' 폴백 */ })
    return () => { alive = false }
  }, [userLoc, region, district, setSortBy, setNearMeMode])

  return { nearDong, setSortByUser }
}
