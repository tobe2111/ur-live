/**
 * 🗺️ **같은 좌표 이용권 묶기** — 2026-09-09 (안 R1 머지 중 추출).
 *
 * 페이지 안에 같은 그룹핑이 **두 벌**이었다: 대표 목록(`withCoords`)과 개수 맵(`coordGroupSize`).
 * 걸러내는 조건과 키 식을 각자 적어 둬서, 한쪽만 고치면 **대표 핀은 뜨는데 개수 칩이 없는**
 * 상태가 조용히 만들어진다(에러가 안 난다). 한 번 순회로 합치면서 그 성질을 여기서 못 박는다.
 */
import { describe, it, expect } from 'vitest'
import { groupByCoord, coordKey } from '@/pages/restaurant-map/coord-groups'
import type { Restaurant } from '@/pages/restaurant-map/types'

const r = (id: number, lat: number | null, lng: number | null): Restaurant =>
  ({ id, restaurant_lat: lat, restaurant_lng: lng } as unknown as Restaurant)

describe('🗺️ 좌표 그룹', () => {
  it('같은 자리는 대표 하나 + 개수만큼 센다', () => {
    const { withCoords, coordGroupSize } = groupByCoord([
      r(1, 37.12345, 127.12345), r(2, 37.12345, 127.12345), r(3, 37.5, 127.5),
    ])
    expect(withCoords.map((x) => x.id)).toEqual([1, 3])
    expect(coordGroupSize.get(coordKey(37.12345, 127.12345))).toBe(2)
    expect(coordGroupSize.get(coordKey(37.5, 127.5))).toBe(1)
  })

  it('대표는 **먼저 온 것** — 입력 순서가 곧 정렬 결과라 뒤집으면 목록과 핀이 어긋난다', () => {
    const { withCoords } = groupByCoord([r(9, 37.1, 127.1), r(8, 37.1, 127.1)])
    expect(withCoords.map((x) => x.id)).toEqual([9])
  })

  it('두 값이 같은 순회에서 나온다 — 대표가 있으면 개수도 반드시 있다', () => {
    const { withCoords, coordGroupSize } = groupByCoord([
      r(1, 37.1, 127.1), r(2, null, 127.2), r(3, 37.3, null), r(4, 0, 0), r(5, 37.5, 127.5),
    ])
    for (const x of withCoords) {
      expect(coordGroupSize.get(coordKey(x.restaurant_lat!, x.restaurant_lng!))).toBeGreaterThan(0)
    }
    // 좌표 없는 행(0 포함 — 좌표 미설정이 0 으로 저장된다)은 핀을 만들지 않는다.
    expect(withCoords.map((x) => x.id)).toEqual([1, 5])
    expect(coordGroupSize.size).toBe(2)
  })

  it('키는 5자리 반올림 고정 — 형식이 바뀌면 핀 diff 가 통째로 무의미해진다', () => {
    expect(coordKey(37.123456789, 127.987654321)).toBe('37.12346_127.98765')
    // ~1m 차이는 같은 매장으로 접힌다.
    expect(coordKey(37.1234567, 127.1)).toBe(coordKey(37.1234571, 127.1))
  })

  it('페이지는 자기 그룹핑을 다시 짜지 않는다', async () => {
    const { readCode } = await import('../helpers/source-text')
    const page = readCode('src/pages/RestaurantMapPage.tsx')
    expect(page).toContain('groupByCoord(filtered)')
    // 좌표 키를 손으로 다시 만드는 곳이 없어야 한다(형식이 갈리는 자리).
    expect(page).not.toContain('.toFixed(5)}_$')
  })
})
