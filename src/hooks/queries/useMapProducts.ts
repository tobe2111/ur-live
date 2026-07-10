/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 레스토랑 지도 상품(공구) 목록 (카테고리별 캐시).
 * 📄 2026-07-08 (대표 "가장 이상적·영구적 — 상한 없이 / 수천개 대비 업체 방식"):
 *   ① progressive(점진) 로딩 — page1(캐시 fast-path) 즉시 렌더 + 이후 페이지 누적. ② 근본 스케일:
 *   near(내 위치) 있으면 **거리순 서버 랭킹** + 초기 로드를 근접 상위 SOFT_CAP 개로 바운드(수천개여도 홈은
 *   가벼움). 뷰포트(지도 pan) 추가 로드는 RestaurantMapPage 가 bbox 로 병합. near 없으면 최신순 progressive.
 *   현재 규모(수백)에선 SOFT_CAP 미만이라 전부 로드(무회귀) — 수천개 시점에 근접 바운드가 자연 활성.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { Restaurant } from '@/pages/restaurant-map/types'

const SOFT_CAP = 500  // 초기 로드 상한(근접 우선). 이보다 많으면 지도 pan(bbox)·리스트로 확장.
const CACHE_MS = 2 * 60 * 1000
const _cache = new Map<string, { items: Restaurant[]; ts: number }>()

type Near = { lat: number; lng: number } | null | undefined

function keyOf(category: string, near: Near): string {
  return near ? `${category}@${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : category
}

async function fetchPage(category: string, page: number, near: Near): Promise<Restaurant[] | null> {
  const params: Record<string, string | number> = { category }
  if (page > 1) { params.page = page; params.limit = 50 }  // page1 = 무파라미터(near 없을 때 캐시 경로 유지)
  if (near) { params.near = `${near.lat},${near.lng}`; if (page === 1) params.limit = 50 }  // near 붙으면 거리순
  const r = await api.get('/api/group-buy/products', { params }).catch(() => null)
  if (r == null) return null
  return (r.data?.success ? (r.data.data || []) : []) as Restaurant[]
}

export function useMapProducts(category: string, near?: Near) {
  const cacheKey = keyOf(category, near)
  const fresh = () => {
    const c = _cache.get(cacheKey)
    return c && Date.now() - c.ts < CACHE_MS ? c : null
  }
  const [items, setItems] = useState<Restaurant[]>(() => fresh()?.items ?? [])
  const [isLoading, setIsLoading] = useState<boolean>(() => !fresh())

  useEffect(() => {
    const cached = fresh()
    if (cached) { setItems(cached.items); setIsLoading(false); return }

    let cancelled = false
    const seen = new Set<number | string>()
    const acc: Restaurant[] = []
    setItems([]); setIsLoading(true)

    ;(async () => {
      let errored = false
      for (let page = 1; !cancelled; page++) {
        let arr = await fetchPage(category, page, near)
        if (arr == null) arr = await fetchPage(category, page, near)  // 1회 재시도
        if (cancelled) return
        if (arr == null) { errored = true; break }

        let added = false
        for (const p of arr) {
          const id = (p as { id?: number | string }).id
          if (id != null && !seen.has(id)) { seen.add(id); acc.push(p); added = true }
        }
        if (added) setItems([...acc])
        if (page === 1) setIsLoading(false)      // 첫 페이지 즉시 렌더 → 나머지 배경 성장
        if (arr.length < 50) break                // 마지막 페이지
        if (acc.length >= SOFT_CAP) break          // 🌍 근접 상위 바운드(수천개 스케일 — 나머지는 지도 pan/리스트)
      }
      if (cancelled) return
      if (!errored) _cache.set(cacheKey, { items: acc, ts: Date.now() })
      setIsLoading(false)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  return { data: items, isLoading }
}
