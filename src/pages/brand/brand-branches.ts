/**
 * 🏷️ 브랜드 페이지의 지점 정렬 — 순수 함수 (2026-10-17). 시험이 직접 돌린다.
 *
 * 위치가 있으면 가까운 순, 좌표 없는 지점은 맨 뒤(등록 순서 유지). 위치가 없으면 서버가 준 순서 그대로.
 */
import { distanceKm } from '@/pages/restaurant-map/utils'

export interface BrandStore { seller_id: number; name: string; address: string; lat: number | null; lng: number | null }

export function sortBranchesByDistance(stores: readonly BrandStore[], from: { lat: number; lng: number } | null): BrandStore[] {
  if (!from) return [...stores]
  return stores
    .map((s, i) => ({ s, i, d: s.lat != null && s.lng != null ? distanceKm(from.lat, from.lng, s.lat, s.lng) : Infinity }))
    .sort((a, b) => (a.d - b.d) || (a.i - b.i))
    .map((x) => x.s)
}
