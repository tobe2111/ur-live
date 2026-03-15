/**
 * 주문 타입 통합 정의 - 전체 앱 공통 사용
 *
 * ✅ MyOrdersPage.tsx, OrdersTab.tsx, CheckoutPage.tsx 등 모두 이 파일에서 import
 * - id: number | string (DB에 따라 다를 수 있으므로 union type)
 * - status: 모든 상태 포함 (string union)
 */
/** @deprecated enum 대신 OrderStatusValue 사용 */
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "pending";
    OrderStatus["PAID"] = "paid";
    OrderStatus["PREPARING"] = "preparing";
    OrderStatus["SHIPPING"] = "shipping";
    OrderStatus["DELIVERED"] = "delivered";
    OrderStatus["CANCELLED"] = "cancelled";
    OrderStatus["REFUNDED"] = "refunded";
})(OrderStatus || (OrderStatus = {}));
export const OrderStatusLabels = {
    pending: '결제 대기',
    paid: '결제 완료',
    preparing: '상품 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '취소됨',
    refunded: '환불 완료',
};
