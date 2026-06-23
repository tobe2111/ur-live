/**
 * 🧭 2026-06-22: 공구 상세 첫 paint 시드 선택 SSOT (pure helper — 테스트 가능).
 *
 * 배경(전수조사): `/group-buy/:id` 첫 도달 시 SSR inject(`__SSR_INITIAL_DETAIL__`)가 detail 을
 *   즉시 채워도 `loading=true` 라 skeleton 이 항상 떴고, 홈 카드가 hover/viewport 로 warm 한
 *   React Query 캐시는 페이지가 raw axios 로 다시 cold fetch 하느라 통째로 낭비됐다.
 *   → 첫 render 에 "이미 가진 데이터"(RQ 캐시 / SSR inject / localCache)를 즉시 소비해 skeleton 을 건너뛴다.
 *
 * 우선순위: RQ in-memory(세션 내 가장 신선) > SSR inject(edge 신선) > localCache(영속·다소 stale).
 * 어느 소스든 `id` 가 현재 상품과 일치할 때만 채택(잘못된 상품 잔상 방지). 없으면 null → 기존 skeleton+fetch fallback.
 */

export interface SeedSources {
  /** React Query in-memory 캐시 값 (홈 카드 prefetch 가 warm — full detail). */
  rqCached?: unknown
  /** SSR inject `<script id="__SSR_INITIAL_DETAIL__">` 의 textContent (JSON). */
  ssrText?: string | null
  /** localStorage 캐시 값 (`gb:<id>`). */
  localCached?: unknown
}

function matchesId(v: unknown, productId: number): boolean {
  return (
    !!v &&
    typeof v === 'object' &&
    Number((v as { id?: unknown }).id) === productId
  )
}

/**
 * 가진 소스 중 현재 상품(productId)과 일치하는 detail 을 우선순위대로 선택.
 * @returns 시드 가능한 detail, 없으면 null.
 */
export function pickSeedDetail<T extends { id: number | string }>(
  productId: number,
  sources: SeedSources,
): T | null {
  if (!Number.isFinite(productId) || productId <= 0) return null

  // 1) RQ in-memory (세션 내 prefetch — 가장 신선)
  if (matchesId(sources.rqCached, productId)) return sources.rqCached as T

  // 2) SSR inject (worker HTMLRewriter — edge 신선)
  if (sources.ssrText) {
    try {
      const parsed = JSON.parse(sources.ssrText)
      if (parsed?.success && matchesId(parsed?.data, productId)) return parsed.data as T
      if (matchesId(parsed, productId)) return parsed as T // raw detail 형태도 graceful
    } catch {
      /* 손상된 inject — 다음 소스로 */
    }
  }

  // 3) localCache (영속 — 다소 stale 가능, axios refetch 가 곧 보정)
  if (matchesId(sources.localCached, productId)) return sources.localCached as T

  return null
}
