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
 * 🔒 **결과 스코프와 정확히 같은 필터를 쓴다.** 검색은 어디서 왔느냐에 따라 범위가 **정반대**다
 *   (`SearchPage` 의 `?scope=`): 기본은 **이용권만**(2026-07-16 대표 "검색은 무조건 이용권만"),
 *   `scope=exchange` 는 **교환권만**(2026-08-08 대표 "교환권 페이지에선 교환권만" — `/vouchers` 의
 *   검색 버튼이 붙여 보낸다). 여기서 스코프를 안 받으면 교환권 검색창에 **이용권**이 제안되고
 *   눌러도 **0건**이 난다. 2026-09-30 실측으로 그 상태였다(교환권 2,260건이 제안에서 통째로 빠짐).
 *
 * 📏 실측 2026-09-30 (라이브 D1) — 왜 소스 순서가 이런가:
 *   · 이용권 359건 중 **매장명 보유 359건(100%)** → ②가 기본 스코프의 주력이다.
 *   · 교환권 2,260건 중 **매장명 0건** → exchange 에선 ②가 자연히 비고 ③(상품명)이 답이다.
 *   · `popular_searches` 는 **라이브에 테이블이 없었다**(migration 0273 미적용) → ①이 항상 빈
 *     배열이었다. 같은 커밋에서 `repair-schema` 에 넣었다 — 그전까지는 ①이 조용히 죽어 있다.
 */
import { voucherCategoriesSqlClause } from '../../../shared/constants/voucher-categories';
import { activeSellerProductSql } from '../../../shared/db/consumer-visible-product';

/** 제안 최대 개수 — 화면이 결과 자리를 차지하므로 길면 결과를 못 본다. */
export const SUGGEST_LIMIT = 10;

/** 검색 범위 — `SearchPage` 의 `?scope=` 와 **같은 말**이어야 한다. */
export type SuggestScope = 'exchange' | 'voucher';

export function normalizeScope(raw: string | undefined | null): SuggestScope {
  return raw === 'exchange' ? 'exchange' : 'voucher';
}

export async function buildSearchSuggestions(
  DB: D1Database,
  q: string,
  scopeKind: SuggestScope = 'voucher',
): Promise<string[]> {
  const vc = voucherCategoriesSqlClause();
  const exchange = scopeKind === 'exchange';
  // 세 쿼리가 **같은 조건**을 쓴다(한쪽만 달라지면 눌러서 0건이 난다).
  // ⚠️ `SearchPage.getSortedAndFilteredProducts` 의 분기를 그대로 미러한 것이다 — 한쪽을 고치면
  //    다른 쪽도 고쳐야 하고, 가드가 그 짝을 검사한다.
  // 🚫 2026-10-01: 정지·비활성 매장 제외 — 결과(`searchProducts`)와 **같은 술어**를 쓴다.
  //   제안만 가려 주면 눌렀을 때 0건이 나고, 결과만 가리면 제안이 유령을 광고한다.
  const sellerLive = activeSellerProductSql('products');
  const scope = exchange
    ? `is_active = 1
         AND ${sellerLive}
         AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)
         AND deal_only = 1`
    : `is_active = 1
         AND ${sellerLive}
         AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)
         AND (deal_only IS NULL OR deal_only = 0)
         AND (category IS NULL OR category IN (${vc.placeholders}))`;
  // exchange 스코프는 카테고리 목록을 안 쓰므로 바인딩도 없다(개수가 어긋나면 D1 이 거절한다).
  const scopeArgs = exchange ? [] : vc.values;

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
    ).bind(`%${q}%`, ...scopeArgs).all<{ s: string }>().catch(() => ({ results: [] })),
    // ③ 상품명 — 부족분만 채운다(종전엔 이것만 있었다).
    DB.prepare(
      `SELECT DISTINCT name AS s FROM products WHERE name LIKE ? AND ${scope} ORDER BY name ASC LIMIT 10`
    ).bind(`%${q}%`, ...scopeArgs).all<{ s: string }>().catch(() => ({ results: [] })),
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
