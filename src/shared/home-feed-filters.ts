/**
 * 🎚️ PC 홈 탐색 필터 — 거리·가격 (2026-10-14 대표 확정 "시안 4" 의 왼쪽 필터, 시안 2 에서 가져옴).
 *
 * 순수 함수만 둔다(시험이 그대로 부른다). 지역·종류는 이미 피드가 가진 축이라 여기 없다.
 *
 * ⚠️ 이 필터는 **받아 둔 페이지 안에서** 거른다 — 지역 필터(`inRegion`)와 같은 방식이다.
 *   서버로 보내지 않는 이유: 홈 피드의 1페이지는 SSR 시드·cron 예열을 받는 캐시 키라, 파라미터를
 *   하나 늘리면 그 키가 갈려 첫 화면이 콜드 D1 로 떨어진다.
 */
export type PriceBand = 'lt20k' | '20to50k' | 'gte50k'

export interface FeedFilters {
  /** 내 위치에서 이 거리(km) 안. 위치가 없으면 무시된다. */
  maxKm?: number | null
  price?: PriceBand | null
}

export const PRICE_BANDS: { key: PriceBand; label: string }[] = [
  { key: 'lt20k', label: '~2만원' },
  { key: '20to50k', label: '2~5만원' },
  { key: 'gte50k', label: '5만원~' },
]

export const DISTANCE_CHOICES: { km: number | null; label: string }[] = [
  { km: 1, label: '1km' },
  { km: 3, label: '3km' },
  { km: 10, label: '10km' },
  { km: null, label: '전국' },
]

interface Filterable {
  price?: number | null
  current_price?: number | null
  restaurant_lat?: number | null
  restaurant_lng?: number | null
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180
  const dLat = (bLat - aLat) * r
  const dLng = (bLng - aLng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** 카드가 보여 주는 가격과 같은 값(공구 확정가가 있으면 그것) — 카드와 다른 값으로 거르면 거짓말이 된다. */
function shownPrice(p: Filterable): number | null {
  const v = p.current_price ?? p.price
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function passesFeedFilters(p: Filterable, f: FeedFilters | undefined, loc?: { lat: number; lng: number } | null): boolean {
  if (!f) return true
  if (f.maxKm != null && loc) {
    const la = p.restaurant_lat, ln = p.restaurant_lng
    // 좌표가 없는 이용권은 거리를 모른다 — "가까이 있다"고 말할 수 없으니 거리 필터에서는 뺀다.
    if (la == null || ln == null || !Number.isFinite(la) || !Number.isFinite(ln)) return false
    if (km(loc.lat, loc.lng, la, ln) > f.maxKm) return false
  }
  if (f.price) {
    const v = shownPrice(p)
    if (v == null) return false
    if (f.price === 'lt20k' && !(v < 20_000)) return false
    if (f.price === '20to50k' && !(v >= 20_000 && v < 50_000)) return false
    if (f.price === 'gte50k' && !(v >= 50_000)) return false
  }
  return true
}

/** useMemo 의존성용 — 객체 참조가 아니라 값으로 비교한다. */
export function feedFiltersKey(f: FeedFilters | undefined): string {
  return f ? `${f.maxKm ?? ''}|${f.price ?? ''}` : ''
}
