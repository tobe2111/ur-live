/**
 * 장바구니 타입 통합 정의 - 전체 앱 공통 사용
 *
 * ✅ CartPage.tsx, useCart.ts, CheckoutPage.tsx, MyOrdersPage.tsx 공통 사용
 * - id: string | number (DB에 따라 다를 수 있음)
 * - price: price_snapshot 또는 price 두 가지 필드 모두 지원
 */
/**
 * 가격 계산 헬퍼: price_snapshot → price 순서로 사용
 */
export function getCartItemPrice(item) {
    return item.price_snapshot ?? item.price ?? 0;
}
