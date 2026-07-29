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

// 🚑 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사 — 홈 SSR 미소비 수리): 워커가 홈 하드로드마다
//   head 에 주입하는 __SSR_INITIAL_MAIN__ (= /api/group-buy/products?status=active&category=all)를
//   page1 시드로 동기 소비 → 홈 첫 페인트가 [리스트 스켈레톤 → 콘텐츠] 대신 즉시 콘텐츠.
//   서버 기본 status='active'(group-buy-public.routes:93) 라 클라 page1(?category=all)과 동일 페이로드.
//   ⚠️ near(거리순 랭킹) 요청과는 페이로드/정렬이 다르므로 **near 없는 기본 피드에만** 시드 적용.
//   'all' 카테고리 + 하드로드 직후 1회만 유효(모듈 플래그) — 이후엔 모듈캐시/일반 fetch 경로 그대로.
let _ssrSeedUsed = false
function peekSsrMainSeed(category: string, near: Near): Restaurant[] | null {
  if (_ssrSeedUsed || near || category !== 'all' || typeof document === 'undefined') return null
  try {
    const el = document.getElementById('__SSR_INITIAL_MAIN__')
    if (!el?.textContent) return null
    const parsed = JSON.parse(el.textContent)
    if (parsed?.success && Array.isArray(parsed.data)) return parsed.data as Restaurant[]
  } catch { /* 손상된 inject — fetch fallback */ }
  return null
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
  // 🚑 2026-07-10: 첫 페인트에 [모듈캐시 > SSR 시드] 동기 반영 — 시드 있으면 스켈레톤 프레임 0.
  const [items, setItems] = useState<Restaurant[]>(() => fresh()?.items ?? peekSsrMainSeed(category, near) ?? [])
  const [isLoading, setIsLoading] = useState<boolean>(() => !fresh() && !peekSsrMainSeed(category, near))

  useEffect(() => {
    const cached = fresh()
    if (cached) { setItems(cached.items); setIsLoading(false); return }

    let cancelled = false
    const seen = new Set<number | string>()
    const acc: Restaurant[] = []

    // 🚑 2026-07-10: SSR 시드 = page1 대체(1회 소비, near 없는 기본 피드 한정). 50개(풀 페이지)면
    //   page2 부터 이어받아 성장, 50 미만이면 완주로 간주(모듈캐시 기록 후 종료).
    //   시드 없으면 기존 경로(스켈레톤 + page1 fetch).
    const seed = peekSsrMainSeed(category, near)
    let startPage = 1
    if (seed) {
      _ssrSeedUsed = true
      for (const p of seed) {
        const sid = (p as { id?: number | string }).id
        if (sid != null && !seen.has(sid)) { seen.add(sid); acc.push(p) }
      }
      setItems([...acc]); setIsLoading(false)
      if (seed.length < 50) { _cache.set(cacheKey, { items: acc, ts: Date.now() }); return }
      startPage = 2
    } else {
      setItems([]); setIsLoading(true)
    }

    ;(async () => {
      let errored = false
      for (let page = startPage; !cancelled; page++) {
        // 네트워크 오류 시 1회 재시도, 그래도 실패면 이 페이지에서 중단(부분 표시 · 캐시 안 함 → 재진입 시 재시도).
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
