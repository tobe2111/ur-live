/**
 * 🔄 동네딜/공구 피드 캐시 무효화 (2026-07-01 대표 — 관리자 이미지 수정이 홈 썸네일에도 반영되게).
 *
 * 배경: 홈(`/`)·동네딜 리스트는 2단 캐시로 서빙 — (1) materialized `group_buy_feed_cache`(cron 만 갱신),
 * (2) 엣지 `caches.default`(publicCache, 5min fresh/30min SWR). 관리자가 상품 이미지를 바꿔도
 * 상세 페이지는 원본을 직접 읽어 즉시 반영되지만, 홈 썸네일은 두 캐시가 옛 이미지를 물고 있어 안 바뀜.
 *
 * 해결(쓰기 시 무효화 — 읽기 캐시 정책은 불변, additive): 관리자 동네딜 write 후 이 함수를 호출해
 *   (1) materialized 캐시 비움 → 다음 요청은 라이브(신선) 쿼리, (2) 엣지 캐시의 홈/피드 키 퍼지.
 * 엣지 키 목록은 cache-prewarm HOT_PATHS + SSR MAIN/GROUPBUY 슬롯 경로와 1:1 일치.
 * best-effort — 실패해도 write 자체엔 영향 없음(캐시는 TTL/cron 으로 자가치유).
 */
import type { Env } from '../types/env'

// 엣지 퍼지 대상(홈 SSR·prewarm·리스트가 실제 사용하는 경로 문자열과 정확히 일치해야 함).
const FEED_EDGE_PATHS: readonly string[] = [
  '/api/group-buy/products',
  '/api/group-buy/products?status=active&category=all',
  '/api/group-buy/products?status=active',
  '/api/group-buy/products?status=active&limit=200',
  '/api/group-buy/products?status=active&category=meal_voucher',
  '/api/group-buy/products?status=active&category=stay_voucher',
  '/api/group-buy/products?status=active&category=beauty_voucher',
  '/api/group-buy/products?status=active&category=etc_voucher',
]

export async function invalidateGroupBuyFeed(
  env: Env,
  origin: string,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<void> {
  // 1) materialized 캐시 비움 → 다음 요청은 라이브(신선) 쿼리로 폴백(cron 이 곧 재계산).
  try {
    await env.DB.prepare('DELETE FROM group_buy_feed_cache').run()
  } catch { /* 테이블 없음 등 — best-effort */ }
  // 2) 엣지 캐시(caches.default) 퍼지 — 홈/피드 키.
  try {
    // @ts-expect-error — Cloudflare Workers 전역 caches
    const cache = caches.default
    const jobs = FEED_EDGE_PATHS.map((p) => cache.delete(new Request(`${origin}${p}`, { method: 'GET' })) as Promise<boolean>)
    const all = Promise.all(jobs).then(() => undefined)
    if (waitUntil) waitUntil(all)
    else await all
  } catch { /* best-effort */ }
}
