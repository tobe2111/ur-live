import { useEffect, useRef, useState } from 'react'
import { mapRegionLabel, regionDepth, shouldRefetchRegion, type MapRegionParts } from '@/shared/map-region-label'

interface Params {
  /** `useKakaoMap` 이 돌려주는 지도 인스턴스 ref. */
  mapInstance: { current: any }
  /** 지도 모드 + SDK 로드 완료일 때만 붙인다. */
  enabled: boolean
}

/**
 * 📍 지금 **보고 있는 화면**의 지역명 (2026-09-09 대표 확정 "안 R1").
 *
 * ## 왜 새 왕복이 없나
 * 카카오 SDK 를 이미 `libraries=services` 로 싣는다(`src/lib/kakao-sdk.ts`) → `Geocoder.coord2RegionCode`
 * 가 **클라에서** 좌표→행정동을 준다. 서버 요청 0 · 새 키 0 · 첫 화면 블로킹 0.
 *
 * ## 🔴 함정 셋 (전부 여기서 막는다)
 * 1. **`idle` 은 자주 온다** — 팬·핀치가 멈출 때마다 발화한다. 그대로 부르면 손가락 한 번에 수십 번
 *    지오코딩이 나간다 ⇒ 450ms 디바운스 + `shouldRefetchRegion`(같은 자리·같은 줌 구간이면 스킵).
 * 2. **지역명이 없는 좌표가 있다** — 바다·비행장 위에서는 결과가 빈 배열이다. 그때는 **이름을 지우지
 *    않고 직전 이름을 유지**한다: 시트 문구가 팬 도중 `동탄6동 ↔ 이 지역` 으로 깜빡이면 그게 더 나쁘다.
 * 3. **언마운트 후 setState** — 지오코딩 콜백은 비동기라 지도 모드를 빠져나간 뒤에도 온다 ⇒ `alive` 가드.
 *
 * 실패·미지원(services 라이브러리 누락 등)이면 조용히 `null` 을 유지한다 = 오늘과 동일한 "이 지역".
 */
export function useViewportRegion({ mapInstance, enabled }: Params): string | null {
  const [label, setLabel] = useState<string | null>(null)
  /** 마지막으로 실제 지오코딩을 부른 자리(중복 호출 차단용). */
  const lastRef = useRef<{ lat: number; lng: number; level: number } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const map = mapInstance.current
    const kakao = (window as unknown as { kakao?: any }).kakao
    if (!map || !kakao?.maps?.services?.Geocoder) return

    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let geocoder: any
    try {
      geocoder = new kakao.maps.services.Geocoder()
    } catch {
      return // services 미탑재 — 오늘과 동일하게 "이 지역"
    }

    const resolve = () => {
      let center: any, level: number, spanLat = 0.02
      try {
        center = map.getCenter()
        level = map.getLevel()
        const b = map.getBounds()
        if (b) spanLat = Math.abs(b.getNorthEast().getLat() - b.getSouthWest().getLat())
      } catch {
        return
      }
      if (!center || !Number.isFinite(level)) return
      const next = { lat: center.getLat(), lng: center.getLng(), level }
      // 전국 뷰는 물어볼 것도 없다 — 한 점의 시도는 화면을 대표하지 못한다(규칙은 SSOT 가 정한다).
      if (regionDepth(level) === 0) {
        lastRef.current = next
        setLabel(null)
        return
      }
      if (!shouldRefetchRegion(lastRef.current, next, spanLat)) return
      lastRef.current = next
      try {
        geocoder.coord2RegionCode(next.lng, next.lat, (result: any[], status: string) => {
          if (!alive) return
          if (status !== kakao.maps.services.Status.OK || !Array.isArray(result) || result.length === 0) return
          // 행정동('H')이 사람이 쓰는 이름이다(법정동 'B' 는 "반송동" 처럼 생활권과 다를 수 있다).
          const row = result.find((r) => r?.region_type === 'H') || result[0]
          const parts: MapRegionParts = {
            region1: row?.region_1depth_name,
            region2: row?.region_2depth_name,
            region3: row?.region_3depth_name,
          }
          const next2 = mapRegionLabel(level, parts)
          if (next2) setLabel(next2)
        })
      } catch { /* 지오코딩 실패 — 직전 이름 유지 */ }
    }

    const onIdle = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(resolve, 450)
    }
    kakao.maps.event.addListener(map, 'idle', onIdle)
    resolve() // 첫 진입은 idle 을 기다리지 않는다(시트가 "이 지역"으로 시작했다가 뒤늦게 바뀌면 눈에 띈다)

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      try { kakao.maps.event.removeListener(map, 'idle', onIdle) } catch { /* */ }
    }
  }, [enabled, mapInstance])

  return label
}
