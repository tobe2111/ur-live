/**
 * 🛠️ 셀러 상품 수정 응답 — `PUT /api/seller/products/:id` 가 UPDATE 뒤 돌려주는 행 (2026-09-21).
 *
 * E5 실사용(S-BROKER 준비로 테스트 이용권을 숨기려다)에서 발견: 응답 SELECT 가 **라이브에 없는 `image` 컬럼**을 읽어
 * UPDATE 는 이미 반영됐는데 **매번 500** 을 돌려줬다(D1 실측 `no such column: image`). 셀러는 "수정 실패" 를 보고
 * 다시 누르고, 실제론 저장돼 있었다. `image` 는 마이그레이션엔 있고 repair-schema 는 안 만드는 컬럼이라 코드만 보면 있다.
 * `live_only_price`/`live_price_enabled` 도 같은 처지(0112 마이그레이션만) — 있으면 읽고, 없으면 **그 둘만** 뺀다.
 *
 * 재고는 등록이 `stock` 에만 쓰고 `stock_quantity` 는 DEFAULT 0 이라 canonical 을 먼저 읽는다(목록 쿼리와 같은 순서 —
 * 뒤집혀 있으면 등록 직후 응답이 재고 0 으로 보인다).
 */
export function sellerProductAfterUpdateSql(withLive: boolean): string {
  return `SELECT id, name, description, price, original_price,
              COALESCE(stock, stock_quantity, 0) AS stock,
              COALESCE(thumbnail_url, image_url) AS image_url,
              category, ${withLive ? 'live_only_price, live_price_enabled, ' : ''}
              COALESCE(status, 'ACTIVE') AS status, updated_at
       FROM products WHERE id = ?`
}

export async function readSellerProductAfterUpdate(db: D1Database, productId: string | number): Promise<Record<string, unknown> | null> {
  try {
    return await db.prepare(sellerProductAfterUpdateSql(true)).bind(productId).first<Record<string, unknown>>()
  } catch (e) {
    // 라이브 스키마 편차만 흡수한다 — 그 외 에러는 그대로 올린다(삼키면 다음 결함이 조용해진다)
    if (!/no such column/i.test(String((e as Error)?.message || ''))) throw e
    return db.prepare(sellerProductAfterUpdateSql(false)).bind(productId).first<Record<string, unknown>>()
  }
}
