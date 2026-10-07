/**
 * 📦 **배송이 있는 주문만** — 서버 집계용 WHERE 술어. 클라 `order-stage.ts` 의 짝.
 *
 * 매장 요약(`/my-stores/summary`)의 "처리 대기" 를 세는 쿼리가 이용권 주문까지 셌다 —
 * 사장님이 [주문 확인] 을 누를 일이 없는 주문이 영원히 그 숫자에 남았다(2026-10-07).
 *
 * 판정은 `orderKindOfItems`(`order-kind.ts`)와 **같은 규칙**을 SQL 로 옮긴 것이다:
 * - 라인이 하나도 없으면 **배송**(모르면 배송 — 운송장 칸을 지우는 쪽이 위험하다)
 * - 라인 중 하나라도 상품을 못 찾거나, 교환권(`deal_only=1`)도 이용권 카테고리도 아니면 **배송**
 * - 전부 교환권/이용권이면 배송 아님
 *
 * 카테고리 목록은 `voucher-categories.ts` 에서 만든다(손으로 적으면 두 벌이 갈린다).
 * 값이 상수라 바인딩 없이 리터럴로 넣는다 — 사용자 입력은 한 글자도 안 섞인다.
 */
import { VOUCHER_CATEGORIES, LEGACY_CATEGORY_MAP } from '../constants/voucher-categories'

const NO_SHIPPING_CATEGORIES = [...VOUCHER_CATEGORIES, ...Object.keys(LEGACY_CATEGORY_MAP)]
  .map((c) => `'${c.replace(/'/g, "''")}'`)
  .join(',')

/** `orders` 별칭(`o`)의 주문이 배송 주문이면 참. */
export function shippingOrderSql(alias = 'o'): string {
  return `(NOT EXISTS (SELECT 1 FROM order_items oi_s WHERE oi_s.order_id = ${alias}.id)
    OR EXISTS (SELECT 1 FROM order_items oi_s LEFT JOIN products p_s ON p_s.id = oi_s.product_id
                WHERE oi_s.order_id = ${alias}.id
                  AND (p_s.id IS NULL
                       OR (COALESCE(p_s.deal_only, 0) <> 1 AND COALESCE(p_s.category, '') NOT IN (${NO_SHIPPING_CATEGORIES})))))`
}
