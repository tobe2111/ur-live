/**
 * 🗺️ 2026-11-17 지도 이동이 에지 캐시를 타는지 — 대표 *"유저가 갑자기 많아지는 경우도 대비해서"*.
 *
 * 지키는 것:
 *  1. 같은 동네 안의 작은 이동은 **같은 bbox 문자열**(= 같은 URL = 같은 캐시 칸)이 된다.
 *  2. 보내는 영역은 보이는 영역을 늘 **감싼다**(가장자리 딜이 빠지지 않는다).
 *  3. 지도 화면이 날 좌표를 다시 URL 에 싣지 않는다.
 *
 * 못 막는 것: 줌 레벨을 바꾸면 영역 자체가 달라지므로 캐시 칸도 달라진다(정상). 에지 캐시가 실제로
 *   적중하는지는 라이브 응답 헤더로만 확인된다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { snapMapBbox, MAP_BBOX_STEP } from '@/shared/map-bbox-snap'

describe('지도 bbox 격자 맞춤', () => {
  it('몇 미터 움직여도 같은 문자열', () => {
    const a = snapMapBbox(37.51234567, 127.01234567, 37.53456789, 127.04567891)
    const b = snapMapBbox(37.51239999, 127.01231111, 37.53451111, 127.04561234)
    expect(a).toBe(b)
    expect(a).toBe('37.50,127.00,37.54,127.06')
  })

  it('보이는 영역을 늘 감싼다', () => {
    for (let i = 0; i < 500; i++) {
      const swLat = 33 + Math.random() * 5, swLng = 125 + Math.random() * 5
      const neLat = swLat + Math.random() * 0.3, neLng = swLng + Math.random() * 0.3
      const [s1, s2, n1, n2] = snapMapBbox(swLat, swLng, neLat, neLng).split(',').map(Number)
      expect(s1).toBeLessThanOrEqual(swLat)
      expect(s2).toBeLessThanOrEqual(swLng)
      expect(n1).toBeGreaterThanOrEqual(neLat)
      expect(n2).toBeGreaterThanOrEqual(neLng)
      expect(n1 - s1).toBeLessThanOrEqual(neLat - swLat + 2 * MAP_BBOX_STEP + 1e-9)
    }
  })

  it('격자에 딱 맞는 좌표는 그대로 둔다(부동소수 오차로 칸이 밀리지 않는다)', () => {
    expect(snapMapBbox(37.52, 127.02, 37.56, 127.06)).toBe('37.52,127.02,37.56,127.06')
  })

  it('지도 화면이 날 좌표를 URL 에 싣지 않는다', () => {
    const page = fs.readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8')
    expect(page).toMatch(/const bbox = snapMapBbox\(/)
    expect(page).not.toMatch(/const bbox = `\$\{sw\.getLat\(\)\}/)
  })
})
