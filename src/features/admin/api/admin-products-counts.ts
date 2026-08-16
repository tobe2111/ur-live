/**
 * 📊 어드민 상품 목록의 **부가 카운트** — 탭(상태별) · 사이드바(카테고리별).
 *   〔2026-08-16 `admin-products.routes.ts`(2350줄, god 파일 래칫 동결)에서 추출〕
 *
 * 목록 본문과 달리 이 둘은 **필터 일부를 일부러 무시한다**(탭은 q/category 를 안 본다 — 탭 자체가
 * 필터라서). 그래서 본문 WHERE 와 조각이 다르고, 한 함수 안에 섞여 있으면 어느 조건이 어디에
 * 걸리는지 읽기 어렵다.
 *
 * 🔴 **서비스 스코프는 셋 다 걸려야 한다.** 목록만 걸고 카운트를 빼면 *"0건인데 탭엔 120"* 처럼
 *   화면이 자기모순을 일으킨다 — 그건 섞여 있는 것보다 더 헷갈린다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface ProductTabCounts {
  all_count: number
  active_count: number
  inactive_count: number
  out_of_stock: number
  kt_alpha_count: number
}

export const EMPTY_TAB_COUNTS: ProductTabCounts = {
  all_count: 0, active_count: 0, inactive_count: 0, out_of_stock: 0, kt_alpha_count: 0,
}

/**
 * @param source 상단 세그먼트 — `kt_alpha`(교환권) | `regular`(배송) | 그 외(전체)
 * @param scopeBare 서비스 스코프 WHERE 조각(` AND …` 형태, 별칭 없음). 빈 문자열이면 무조건.
 */
export async function fetchProductCounts(
  DB: D1Database,
  source: string,
  scopeBare: string,
): Promise<{ tabs: ProductTabCounts; categories: Array<{ category: string; cnt: number }> }> {
  const tabWhere: string[] = []
  if (source === 'kt_alpha') tabWhere.push('kt_alpha_gift_code IS NOT NULL')
  else if (source === 'regular') tabWhere.push('kt_alpha_gift_code IS NULL')
  const tabClause = tabWhere.length
    ? `WHERE ${tabWhere.join(' AND ')}${scopeBare}`
    : (scopeBare ? `WHERE 1=1${scopeBare}` : '')

  const [tabs, cats] = await Promise.all([
    DB.prepare(
      `SELECT
         COUNT(*) as all_count,
         SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active_count,
         SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) as inactive_count,
         SUM(CASE WHEN stock=0 AND is_active=1 THEN 1 ELSE 0 END) as out_of_stock,
         SUM(CASE WHEN kt_alpha_gift_code IS NOT NULL THEN 1 ELSE 0 END) as kt_alpha_count
       FROM products ${tabClause}`,
    ).first<ProductTabCounts>().catch(() => null),
    // ⚠️ 괄호 필수 — `A OR B AND scope` 는 AND 가 먼저 묶여 **스코프가 B 에만** 걸린다(조용한 누수).
    DB.prepare(
      `SELECT COALESCE(category, '(미분류)') as category, COUNT(*) as cnt
         FROM products
        WHERE (is_active = 1 OR is_active = 0)${scopeBare}
        GROUP BY category
        ORDER BY cnt DESC LIMIT 50`,
    ).all<{ category: string; cnt: number }>().catch(() => ({ results: [] as Array<{ category: string; cnt: number }> })),
  ])

  return { tabs: tabs ?? EMPTY_TAB_COUNTS, categories: cats.results ?? [] }
}
