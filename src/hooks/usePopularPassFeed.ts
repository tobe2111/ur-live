import { useEffect, useState } from 'react'

/**
 * 🎟️ 인기 이용권 피드를 **한 번만** 받는 훅 (2026-10-14 — 쇼츠 빈 카드 · 위시리스트 추천이 함께 쓴다).
 *
 * 홈 피드와 **같은 주소**(cron 이 예열하는 키)를 쓴다 — 새 캐시 키를 만들지 않는다.
 * ⚠️ 이 문자열을 바꾸면 예열을 못 받아 콜드 D1 로 간다(`cache-prewarm.ts` HOT_PATHS 와 짝).
 * 모듈 캐시라 한 탭에서 두 화면이 써도 요청은 한 번이다.
 */
export const POPULAR_PASS_FEED_URL = '/api/group-buy/products?status=active&category=all&sort=popular'

export interface PopularPass {
  id: number
  name?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  image_url?: string | null
  category?: string | null
  deal_only?: number | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  restaurant_lat?: number | null
  restaurant_lng?: number | null
  [k: string]: unknown
}

let cache: PopularPass[] | null = null
let inflight: Promise<PopularPass[] | null> | null = null

function load(): Promise<PopularPass[] | null> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch(POPULAR_PASS_FEED_URL)
      .then((r) => r.json() as Promise<{ success?: boolean; data?: PopularPass[] }>)
      .then((r) => (r?.success && Array.isArray(r.data) ? (cache = r.data) : null))
      .catch(() => null)
      .finally(() => { inflight = null })
  }
  return inflight
}

/** `need` 가 처음 true 가 될 때 받는다. 실패하면 null — 쓰는 쪽은 아무것도 안 그린다. */
export function usePopularPassFeed(need: boolean): PopularPass[] | null {
  const [feed, setFeed] = useState<PopularPass[] | null>(cache)
  useEffect(() => {
    if (!need || feed) return
    let alive = true
    load().then((d) => { if (alive && d) setFeed(d) })
    return () => { alive = false }
  }, [need, feed])
  return feed
}
