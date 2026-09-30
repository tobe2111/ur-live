/**
 * 🔎 **검색 자동완성 — 무엇을 제안할지** (2026-09-30 대표 *"연관검색? 처럼 나오는거 별로야"*)
 *
 * 종전엔 `products.name` **통짜**만 돌려줘서, "돈가스" 를 치면 제안에
 * *"홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트"* 가 뜨고 **바로 아래 첫 결과가 같은 문자열**이었다.
 * 제안이 아니라 결과의 복사본이고, 그게 결과 위를 덮고 있었다(덮는 쪽은 `SearchSuggestPanel` 이 고쳤다).
 *
 * ⇒ **짧은 검색어**를 준다. 우선순위: ① 인기 검색어(다른 사람이 실제로 친 말) ② 매장명 ③ 상품명.
 *   ②가 핵심이다 — 위 예에서 "홍대돈까스 · 드들돈가스" 가 나오면 제안이 결과와 **다른 일**을 한다.
 *
 * 🔒 **눌러서 0건이 나오면 안 된다**: 매장명은 `SEARCH_COLUMNS` 에 `restaurant_name` 이 있어야
 *   검색이 실제로 찾아 준다(`repositories/search-query.ts`). 그 목록에서 빠지면 이 제안도 빼야 한다.
 * 🔒 2026-07-20 (대표 "이용권만"): 결과 스코프(이용권)와 **정확히 같은 필터**를 쓴다 —
 *   교환권(deal_only=1)·비-voucher 카테고리를 제안하면 눌러도 0건이라 불일치가 된다.
 */
import { voucherCategoriesSqlClause } from '../../../shared/constants/voucher-categories';

/** 제안 최대 개수 — 화면이 결과 자리를 차지하므로 길면 결과를 못 본다. */
export const SUGGEST_LIMIT = 10;

export async function buildSearchSuggestions(DB: D1Database, q: string): Promise<string[]> {
  const vc = voucherCategoriesSqlClause();
  // 이용권 스코프 — 세 쿼리가 **같은 조건**을 쓴다(한쪽만 달라지면 눌러서 0건이 난다).
  const scope = `is_active = 1
         AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)
         AND (deal_only IS NULL OR deal_only = 0)
         AND (category IS NULL OR category IN (${vc.placeholders}))`;

  const [popular, stores, names] = await Promise.all([
    // ① 다른 사람이 실제로 친 말. prefix 매칭이라 "돈가스" 로 "돈가스 맛집" 같은 게 붙는다.
    DB.prepare(`SELECT keyword FROM popular_searches WHERE keyword LIKE ? ORDER BY search_count DESC LIMIT 5`)
      .bind(`${q}%`).all<{ keyword: string }>().catch(() => ({ results: [] })),
    // ② 매장명 — 제안이 결과와 다른 일을 하게 만드는 축.
    DB.prepare(
      `SELECT DISTINCT restaurant_name AS s FROM products
         WHERE restaurant_name IS NOT NULL AND restaurant_name <> '' AND restaurant_name LIKE ?
           AND ${scope}
         ORDER BY restaurant_name ASC LIMIT 6`
    ).bind(`%${q}%`, ...vc.values).all<{ s: string }>().catch(() => ({ results: [] })),
    // ③ 상품명 — 부족분만 채운다(종전엔 이것만 있었다).
    DB.prepare(
      `SELECT DISTINCT name AS s FROM products WHERE name LIKE ? AND ${scope} ORDER BY name ASC LIMIT 10`
    ).bind(`%${q}%`, ...vc.values).all<{ s: string }>().catch(() => ({ results: [] })),
  ]);

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (v?: string | null) => {
    const t = (v || '').trim();
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push(t) }
  };
  for (const r of (popular.results || [])) push(r.keyword);
  for (const r of (stores.results || [])) push(r.s);
  for (const r of (names.results || [])) { if (out.length >= SUGGEST_LIMIT) break; push(r.s) }
  return out.slice(0, SUGGEST_LIMIT);
}
