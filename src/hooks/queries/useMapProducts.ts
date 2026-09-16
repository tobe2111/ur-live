/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 동네딜 지도/홈 목록 데이터 훅 (카테고리별 캐시).
 *
 * 🚦 2026-09-03 [UNLOCK_LOADING] (대표 "가장 이상적으로 하자") — **전량 순회를 걷어냈다.**
 *   이전: page1 을 받은 뒤 50개씩 **끝까지 스스로 걸어가** 활성 이용권 전부를 메모리에 올렸다
 *   (라이브 실측 338건 = 요청 7회 · 66KB gzip, 진입할 때마다). 화면에 뜨는 카드는 10~20장인데.
 *   게다가 지도는 그렇게 받아 놓고도 idle 마다 bbox 로 같은 지역을 또 받았다(중복).
 *   그리고 `SOFT_CAP=500` 은 **에러 없이 조용히 끊기는 절벽**이었다 — 500건을 넘는 순간
 *   그 뒤 이용권은 목록에서 그냥 사라진다(오늘 338이라 아직 안 보일 뿐).
 *
 *   지금: **page1 + 요청받을 때만 더**(`loadMore`) — 같은 레포의 PC 홈 피드(GroupBuyFeed)가
 *   이미 쓰던 패턴이다. 전체 집합이 정말 필요한 순간(지역/가격대/반경/즐겨찾기 필터)에만
 *   `loadAll()` 로 나머지를 받는다 ⇒ **비용을 그 기능을 쓰는 사람에게만** 부과한다.
 *   정렬은 서버로 넘겼다(`sort`) — 50개 안에서 정렬하면 "전체 중 할인 큰 순"이 거짓말이 된다.
 *   "N곳" 은 서버가 주는 `total`(전체 개수)로 말한다 — 다 안 받고도 정확하다.
 *
 * ⚠️ 잠긴 계약 불변: 워커 SSR 시드(`__SSR_INITIAL_MAIN__`, 무파라미터 기본 요청)는 그대로 page1
 *   자리에 동기 소비된다(첫 페인트 0-RTT). near(거리순 서버 랭킹) 경로도 그대로.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import type { Restaurant } from '@/pages/restaurant-map/types'

const PAGE = 50
/** `loadAll()` 안전 상한 — 무한 루프/폭주 차단용이지 "여기서 끊는다"는 뜻이 아니다(도달 시 로그 없이 멈춘다). */
const ALL_CAP = 3000
const CACHE_MS = 2 * 60 * 1000

type Near = { lat: number; lng: number } | null | undefined
interface Entry { items: Restaurant[]; total: number | null; page: number; done: boolean; ts: number }

const _cache = new Map<string, Entry>()

function keyOf(category: string, near: Near, sort: string): string {
  return `${category}|${sort || 'def'}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`
}

// 🚑 2026-07-10 [UNLOCK_LOADING]: 워커가 홈 하드로드마다 head 에 주입하는 __SSR_INITIAL_MAIN__
//   (= /api/group-buy/products?status=active&category=all)를 page1 시드로 **동기** 소비 →
//   첫 페인트가 [스켈레톤 → 콘텐츠] 대신 즉시 콘텐츠. near/sort 가 붙으면 페이로드가 다르므로 미적용.
let _ssrSeedUsed = false
function peekSsrMainSeed(category: string, near: Near, sort: string): Restaurant[] | null {
  if (_ssrSeedUsed || near || sort || category !== 'all' || typeof document === 'undefined') return null
  try {
    const el = document.getElementById('__SSR_INITIAL_MAIN__')
    if (!el?.textContent) return null
    const parsed = JSON.parse(el.textContent)
    if (parsed?.success && Array.isArray(parsed.data)) return parsed.data as Restaurant[]
  } catch { /* 손상된 inject — fetch fallback */ }
  return null
}

async function fetchPage(category: string, page: number, near: Near, sort: string): Promise<{ items: Restaurant[]; total: number | null } | null> {
  const params: Record<string, string | number> = { category }
  // page1 은 파라미터를 최소로 — 정렬/near 가 없으면 무파라미터 기본 요청(= materialized·SSR 과 같은 캐시 경로).
  if (page > 1) { params.page = page; params.limit = PAGE }
  if (sort) params.sort = sort
  if (near) { params.near = `${near.lat},${near.lng}`; if (page === 1) params.limit = PAGE }
  const r = await api.get('/api/group-buy/products', { params }).catch(() => null)
  if (r == null) return null
  const items = (r.data?.success ? (r.data.data || []) : []) as Restaurant[]
  const total = typeof r.data?.total === 'number' ? (r.data.total as number) : null
  return { items, total }
}

export function useMapProducts(category: string, near?: Near, opts?: { sort?: string }) {
  const sort = opts?.sort || ''
  const cacheKey = keyOf(category, near, sort)
  const fresh = (k: string) => {
    const c = _cache.get(k)
    return c && Date.now() - c.ts < CACHE_MS ? c : null
  }
  const seedOf = (k: string): Entry | null => {
    const cached = fresh(k)
    if (cached) return cached
    const seed = peekSsrMainSeed(category, near, sort)
    return seed ? { items: seed, total: null, page: 1, done: seed.length < PAGE, ts: Date.now() } : null
  }

  const [entry, setEntry] = useState<Entry>(() => seedOf(cacheKey) ?? { items: [], total: null, page: 0, done: false, ts: 0 })
  const [isLoading, setIsLoading] = useState<boolean>(() => !seedOf(cacheKey))
  const [loadingMore, setLoadingMore] = useState(false)
  // 최신 상태를 콜백이 읽기 위한 미러(클로저가 낡은 page 를 보면 같은 페이지를 반복 요청한다).
  const ref = useRef<{ key: string; entry: Entry; busy: boolean }>({ key: cacheKey, entry, busy: false })
  ref.current.entry = entry
  ref.current.key = cacheKey

  const commit = useCallback((k: string, next: Entry) => {
    _cache.set(k, next)
    if (ref.current.key !== k) return       // 그 사이 카테고리/정렬이 바뀌었으면 화면에 반영하지 않는다
    ref.current.entry = next
    setEntry(next)
  }, [])

  /** 다음 페이지 1장. 이미 끝났거나 진행 중이면 no-op. */
  const loadMore = useCallback(async () => {
    const k = ref.current.key
    const cur = ref.current.entry
    if (cur.done || ref.current.busy || cur.page === 0) return
    ref.current.busy = true
    setLoadingMore(true)
    try {
      const res = await fetchPage(category, cur.page + 1, near, sort)
      if (res == null) return                // 실패는 조용히 — 다음 스크롤/재시도에서 다시 부른다
      const seen = new Set(cur.items.map((p) => (p as { id?: number | string }).id))
      const add = res.items.filter((p) => !seen.has((p as { id?: number | string }).id))
      commit(k, { ...cur, items: add.length ? [...cur.items, ...add] : cur.items, total: res.total ?? cur.total, page: cur.page + 1, done: res.items.length < PAGE, ts: Date.now() })
    } finally {
      ref.current.busy = false
      setLoadingMore(false)
    }
  }, [category, near, sort, commit])

  /**
   * 전체 집합이 **정말 필요한** 순간(지역/가격대/반경/즐겨찾기 필터처럼 서버가 못 걸러 주는 조건)에만
   * 나머지를 받아 온다. 이미 다 받았으면 no-op — 필터를 껐다 켜도 다시 걷지 않는다.
   */
  const loadAll = useCallback(async () => {
    const k = ref.current.key
    if (ref.current.entry.done || ref.current.busy || ref.current.entry.page === 0) return
    ref.current.busy = true
    setLoadingMore(true)
    try {
      let cur = ref.current.entry
      const seen = new Set(cur.items.map((p) => (p as { id?: number | string }).id))
      const acc = [...cur.items]
      for (let page = cur.page + 1; acc.length < ALL_CAP; page++) {
        const res = await fetchPage(category, page, near, sort)
        if (res == null || ref.current.key !== k) break
        for (const p of res.items) {
          const id = (p as { id?: number | string }).id
          if (id != null && !seen.has(id)) { seen.add(id); acc.push(p) }
        }
        cur = { ...cur, items: [...acc], total: res.total ?? cur.total, page, done: res.items.length < PAGE, ts: Date.now() }
        commit(k, cur)
        if (cur.done) break
      }
    } finally {
      ref.current.busy = false
      setLoadingMore(false)
    }
  }, [category, near, sort, commit])

  useEffect(() => {
    const cachedHit = fresh(cacheKey)
    const seeded = cachedHit ?? seedOf(cacheKey)
    if (seeded) {
      if (!cachedHit) _ssrSeedUsed = true    // SSR 시드는 1회만 — 이후 마운트가 낡은 시드를 다시 읽지 않게
      _cache.set(cacheKey, seeded)
      ref.current.entry = seeded
      setEntry(seeded)
      setIsLoading(false)
      if (cachedHit) return                  // 모듈 캐시 적중 — 네트워크 0
    } else {
      setEntry({ items: [], total: null, page: 0, done: false, ts: 0 })
      setIsLoading(true)
    }

    let cancelled = false
    ;(async () => {
      const res = await fetchPage(category, 1, near, sort)
      if (cancelled || ref.current.key !== cacheKey) return
      if (res == null) { setIsLoading(false); return }   // 실패 — 시드가 있으면 그대로 보여 준다
      commit(cacheKey, { items: res.items, total: res.total, page: 1, done: res.items.length < PAGE, ts: Date.now() })
      setIsLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  return {
    data: entry.items,
    isLoading,
    /** 서버가 말해 주는 전체 개수(필터 없는 피드 기준). 없으면 null → 호출자가 로드된 수로 폴백. */
    total: entry.total,
    loadMore,
    loadAll,
    loadingMore,
    reachedEnd: entry.done,
  }
}
