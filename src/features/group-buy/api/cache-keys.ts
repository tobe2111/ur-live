/**
 * 🛡️ 2026-05-16: 공구 캐시 invalidation 헬퍼.
 *
 * group-buy-public.routes.ts 의 /products endpoint 가 사용하는
 * 캐시 키 (`group_buy_products:${status}:${categories.join(',')}`) 패턴을
 * 단일 source 로 관리. 셀러가 voucher 상품 생성/수정/취소 시 호출.
 */

import { cacheInvalidate } from '@/worker/utils/cache'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'

const STATUSES = ['active', 'achieved', 'expired', 'all'] as const

/**
 * group_buy_products:* 캐시 전체 무효화.
 * 6 카테고리 × 4 status × ('all' / single) 조합 모두 nuke.
 * KV 미바인딩 시 fail-open (cacheInvalidate 내부 처리).
 */
export async function invalidateGroupBuyProductsCache(KV: KVNamespace | undefined): Promise<void> {
  const keys: string[] = []
  // 'all' 카테고리 — VOUCHER_CATEGORIES.join(',') 형식
  const allCategoriesJoined = VOUCHER_CATEGORIES.join(',')
  // 개별 카테고리 — 단일 카테고리 키
  for (const status of STATUSES) {
    keys.push(`group_buy_products:${status}:${allCategoriesJoined}`)
    for (const cat of VOUCHER_CATEGORIES) {
      keys.push(`group_buy_products:${status}:${cat}`)
    }
  }
  // 🛡️ 2026-05-20: @cloudflare/workers-types vs Hono types 버전 차이로 KVNamespace 호환 안 됨.
  //   런타임은 동일 객체 — `as unknown as` 로 안전 캐스팅.
  await cacheInvalidate(KV as unknown as Parameters<typeof cacheInvalidate>[0], keys)
}
