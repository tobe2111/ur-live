/**
 * 🔔 **주문 상태가 바뀌었을 때 구매자에게 보낼 한국어 문장** — 셀러 주문 경로의 SSOT.
 *
 * ## 왜 한 벌인가 (2026-10-07)
 * 같은 맵을 `seller-orders.routes.ts` 의 **단건·일괄 두 블록이 각자** 들고 있었고,
 * 그래서 **서로 다르게 틀려** 있었다:
 * - **단건** `PUT/PATCH /api/seller/orders/:id/status` — `CONFIRMED` 키를 들고 있었는데 그 값은
 *   `VALID_STATUSES`·`ORDER_TRANSITIONS` 어디에도 없어 **도달 불가**였다. 반대로 셀러가 실제로
 *   누르는 `PREPARING` 은 키가 없어 폴백 `` `주문 상태: ${dbStatus}` `` 이 한국 소비자에게
 *   **영문 enum 을 그대로** 보냈다.
 * - **일괄** `PATCH /api/seller/orders/bulk-status` — 같은 `PREPARING` 을 셀렉트 박스에 띄워
 *   두고(`pages/seller-orders/BulkActionBar`) 키가 없어 알림을 **한 건도 안 보냈다**
 *   (폴백이 없어 조용히 넘어간다).
 *
 * ⇒ 한쪽은 틀린 걸 보내고 한쪽은 아무것도 안 보냈다. **에러가 없어 아무도 신고하지 않는다.**
 *
 * 🔴 **폴백(`|| \`주문 상태: ${s}\``)을 되살리지 말 것** — `VALID_STATUSES` 에 상태가 하나 늘면
 *    그 enum 이름이 그대로 새어 나간다. 문장이 없으면 **안 보내는 것**이 맞다(일괄이 원래 그랬다).
 *
 * 🔑 **키는 `VALID_STATUSES` 안의 값이어야 한다.** 화면이 보낼 수 있는 상태
 * (`pages/seller-orders/statusHelpers.nextStatusOf` 의 목적지 + 일괄 셀렉트의 `<option>`)는
 * 전부 여기 있어야 하고, 그 교차 검사를
 * `src/tests/unit/order-status-notice-2026-10-07.test.ts` ③ 이 한다.
 *
 * ⚠️ 어드민 경로(`/api/admin/orders/:n/status`)와 구매자 수취확인
 * (`features/orders/api/orders.routes.ts`)은 **자기 문구**를 쓴다 — 트리거가 달라서 합치지 않았다.
 */
export const ORDER_STATUS_NOTICE: Record<string, string> = {
  PREPARING: '주문이 확인되어 상품을 준비하고 있습니다.',
  SHIPPING: '\u{1F4E6} 주문하신 상품이 발송되었습니다!',
  DELIVERED: '✅ 배송이 완료되었습니다. 상품을 확인해주세요!',
  CANCELLED: '❌ 주문이 취소되었습니다.',
}
