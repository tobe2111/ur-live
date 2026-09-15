import type { Restaurant } from './types'

/**
 * 🗺️ **같은 좌표에 여러 이용권** — 핀 하나로 접고 개수를 세는 규칙 (순수 함수).
 *
 * ## 왜 함수로 뺐나
 * 페이지 안에 **같은 그룹핑이 두 벌**로 있었다(대표 목록용 `withCoords` 하나, 개수 맵
 * `coordGroupSize` 하나). 둘 다 `filtered` 를 걸러 5자리 키로 묶는 같은 일을 하는데,
 * 걸러내는 조건과 키 만드는 식을 **각자 적어 두고 있었다** — 한쪽만 고치면 대표 핀은 떴는데
 * 개수 칩이 없거나(그 반대) 하는, 에러 없이 조용히 어긋나는 상태가 된다.
 * 이제 한 번 순회해서 둘을 같이 낸다.
 *
 * ## 🔴 키는 5자리 반올림 고정
 * `~1m` 정밀도 = 사실상 같은 매장. 이 문자열은 `useKakaoMap` 의 핀 key 와 오버레이 조회에
 * 그대로 쓰이므로 **형식을 바꾸면 핀이 전부 새로 그려진다**(diff 재조정이 무의미해진다).
 */
export function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)}_${lng.toFixed(5)}`
}

export interface CoordGroups {
  /** 그룹 대표 하나씩 — 순서는 입력(정렬 결과) 그대로. */
  withCoords: Restaurant[]
  /** 좌표 키 → 그 자리에 몇 개 있나(핀 알약 안 카운트 칩). */
  coordGroupSize: Map<string, number>
}

export function groupByCoord(items: Restaurant[]): CoordGroups {
  const first = new Map<string, Restaurant>()
  const coordGroupSize = new Map<string, number>()
  for (const r of items) {
    if (!r.restaurant_lat || !r.restaurant_lng) continue
    const key = coordKey(r.restaurant_lat, r.restaurant_lng)
    if (!first.has(key)) first.set(key, r)
    coordGroupSize.set(key, (coordGroupSize.get(key) || 0) + 1)
  }
  return { withCoords: Array.from(first.values()), coordGroupSize }
}
