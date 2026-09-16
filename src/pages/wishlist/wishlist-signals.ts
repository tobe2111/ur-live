/**
 * 💗 찜 목록의 "지금 사야 하나" 신호 — 순수 계산 (2026-09-03 대표 확정 · 위시리스트 안 B).
 *
 * 왜 이 파일이 따로 있나: 배지·정렬·요약이 **같은 판정**을 써야 한다. 화면마다 따로 계산하면
 * 카드엔 "가격 내림"이 떠 있는데 옆 요약은 0 이라고 말하는, 아무도 못 믿는 화면이 된다.
 * 그래서 판정은 여기 하나뿐이고 화면 셋이 이 함수를 부른다(테스트도 여기에 붙는다).
 *
 * ⚠️ 이 파일이 못 하는 것: 값의 출처는 서버다. `base_price` 열이 없는 환경에선 인하 신호가
 *    아예 안 나온다(0건). 그건 결함이 아니라 **모름**이고, 화면은 조용히 그 배지만 뺀다.
 */
import type { WishlistItem } from '@/hooks/queries/useWishlist'

export type WishlistSort = 'recent' | 'drop' | 'discount'

/**
 * 찜한 뒤 내린 금액(원). 내리지 않았거나 알 수 없으면 null.
 *
 * ⚠️ 할인율(`discount_rate`)과 헷갈리지 말 것 — 그건 **상시 표시가**이고 찜과 무관하다.
 *    "찜한 뒤 내렸다"는 오직 `base_price` 대비로만 말할 수 있다.
 */
export function priceDrop(it: Pick<WishlistItem, 'price' | 'base_price'>): number | null {
  const base = Number(it.base_price)
  const now = Number(it.price)
  if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0 || now <= 0) return null
  const diff = Math.round(base - now)
  return diff > 0 ? diff : null
}

/**
 * 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): 마감 임박 신호 두 개와 그 정렬 칩을 지웠다.
 *
 * 마감이 사라지자 남은 일수가 모든 항목에서 null 이었다. 그러면 정렬은 전부 동점이라
 * **칩을 눌러도 순서가 그대로**이고(= 하는 일이 없는 칩), 요약의 "마감 N일 이내"는 영구히 0 이다.
 * 사라진 개념을 가리키는 UI 를 남기면 다음 사람이 그게 살아 있는 줄 안다.
 */

export interface WishlistSummary {
  total: number
  drops: number
  /** 카테고리별 개수 — 많은 순. */
  byCategory: { category: string; count: number }[]
}

export function summarize(items: WishlistItem[]): WishlistSummary {
  const cat = new Map<string, number>()
  let drops = 0
  for (const it of items) {
    if (priceDrop(it) != null) drops++
    const c = it.category || 'etc'
    cat.set(c, (cat.get(c) ?? 0) + 1)
  }
  return {
    total: items.length,
    drops,
    byCategory: [...cat.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * 정렬. 원본 배열은 건드리지 않는다.
 *
 * 어느 정렬이든 **동점이면 최근 찜순**으로 떨어진다 — 서버가 `created_at DESC` 로 주므로
 * 원래 순서를 tie-breaker 로 쓰면 된다(안정 정렬이라 인덱스 비교가 곧 그 순서다).
 */
export function sortWishlist(items: WishlistItem[], sort: WishlistSort): WishlistItem[] {
  if (sort === 'recent') return items
  const arr = items.map((it, i) => ({ it, i }))
  const key = (x: WishlistItem): number => {
    if (sort === 'drop') return -(priceDrop(x) ?? -1)
    return -(Number(x.discount_rate) || 0)
  }
  arr.sort((a, b) => {
    const d = key(a.it) - key(b.it)
    return d !== 0 ? d : a.i - b.i
  })
  return arr.map((x) => x.it)
}
