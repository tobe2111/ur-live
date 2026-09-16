/**
 * 🔢 2026-09-03 [UNLOCK_LOADING] (대표 "가장 이상적으로 하자") — 동네딜 피드 **전체 개수**.
 *
 * 왜 필요한가: 같은 날 클라이언트가 "50개씩 끝까지 걸어가 전부 받기"를 그만뒀다(useMapProducts).
 * 그러면 화면의 "N곳" 이 **로드된 수**가 되어 338곳을 50곳이라고 말하게 된다 — 다 받지 않고도
 * 정확한 수를 말하려면 서버가 세어 줘야 한다.
 *
 * 비용: 필터 없는 기본 피드(status+category)에 대해서만 센다. 조합은 status×카테고리 5종뿐이고
 * `cacheGet`(TTL 900s) + 응답 자체의 엣지 캐시가 앞에 있어 **콜로·15분당 1회** COUNT 가 전부다.
 * (지역/검색/bbox 가 붙은 요청은 세지 않는다 — 그 화면은 클라가 `loadAll()` 로 전체를 받는다.)
 *
 * ⚠️ WHERE 는 목록 쿼리와 **같은 조건**이어야 한다. 어긋나면 "50곳 중 60곳" 같은 거짓말이 된다.
 *    (도매 원본상품 제외 조건까지 동일 — 서비스 분리 룰.)
 */
import { cacheGet } from '@/worker/utils/cache'
import type { Env } from '@/worker/types/env'

export async function getActiveFeedTotal(
  env: Env,
  DB: D1Database,
  status: string,
  categories: readonly string[],
): Promise<number | null> {
  try {
    const key = `group_buy_products_count:${status}:${categories.join(',')}`
    const n = await cacheGet(
      env.SESSION_KV,
      key,
      async () => {
        const placeholders = categories.map(() => '?').join(',')
        const row = await DB.prepare(`
          SELECT COUNT(*) AS n
          FROM products p
          WHERE p.category IN (${placeholders}) AND p.is_active = 1
            AND (p.group_buy_status = ? OR ? = 'all')
            AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
        `).bind(...categories, status, status).first<{ n: number }>()
        return Number(row?.n ?? 0)
      },
      { ttl: 900, staleWhileRevalidate: 300 },
    )
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  } catch {
    return null   // fail-soft — 개수는 부가 정보다. 없으면 클라가 로드된 수로 폴백한다.
  }
}
