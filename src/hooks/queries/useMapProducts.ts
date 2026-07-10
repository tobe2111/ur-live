/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 레스토랑 지도 상품(공구) 목록 (카테고리별 캐시).
 * 📄 2026-07-08 (대표 "가장 이상적·영구적 — 상한 없이"): 서버 기본 피드는 LIMIT 50(캐시/SSR 고정)이라
 *   50개 초과 상품이 홈 지도/리스트에서 통째로 누락됐음. 12페이지 상한(band-aid)도 아닌 **완전 무상한**으로:
 *   전체 딜을 **progressive(점진) 로딩** — page1(캐시 fast-path) 도착 즉시 렌더 + 이후 페이지를 이어받아
 *   누적하며 지도/리스트가 성장. 상한 없음(50 미만 페이지에서 종료). id 중복 제거로 경계 방어.
 *   RQ(useQuery) 단건 페치로는 progressive 갱신이 안 돼 직접 상태관리 + 카테고리별 2분 모듈캐시(탭 왕복 재로딩 방지).
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { Restaurant } from '@/pages/restaurant-map/types'

const _cache = new Map<string, { items: Restaurant[]; ts: number }>()
const CACHE_MS = 2 * 60 * 1000

async function fetchPage(category: string, page: number): Promise<Restaurant[] | null> {
  const params: Record<string, string | number> = { category }
  if (page > 1) { params.page = page; params.limit = 50 }  // page1 = 무파라미터(캐시 경로 유지)
  const r = await api.get('/api/group-buy/products', { params }).catch(() => null)
  if (r == null) return null  // 네트워크 오류 → 호출측이 재시도/중단 판단
  return (r.data?.success ? (r.data.data || []) : []) as Restaurant[]
}

export function useMapProducts(category: string) {
  const fresh = () => {
    const c = _cache.get(category)
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
        // 네트워크 오류 시 1회 재시도, 그래도 실패면 이 페이지에서 중단(부분 표시 · 캐시 안 함 → 재진입 시 재시도).
        let arr = await fetchPage(category, page)
        if (arr == null) arr = await fetchPage(category, page)
        if (cancelled) return
        if (arr == null) { errored = true; break }

        let added = false
        for (const p of arr) {
          const id = (p as { id?: number | string }).id
          if (id != null && !seen.has(id)) { seen.add(id); acc.push(p); added = true }
        }
        if (added) setItems([...acc])
        if (page === 1) setIsLoading(false)  // 첫 페이지 즉시 렌더 → 나머지는 배경에서 성장
        if (arr.length < 50) break            // 마지막 페이지(50 미만) → 상한 없이 종료
      }
      if (cancelled) return
      if (!errored) _cache.set(category, { items: acc, ts: Date.now() })  // 완주분만 캐시
      setIsLoading(false)
    })()

    return () => { cancelled = true }
  }, [category])

  return { data: items, isLoading }
}
