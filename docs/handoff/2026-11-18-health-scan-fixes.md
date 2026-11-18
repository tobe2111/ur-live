
## 이어서 — 돈 구멍 4건 수리 (대표 승인: 결제 없이 발급 · 주문 취소 3건 · 매장 부분환불 카드 · 기한 마지막 날)
- `/join` 결제수단 빈 값 → 'deal' · 셀프 주문 취소(`/orders/:id/cancel`·`/orders/refund`)에 `voucherOrderSelfCancelBlock`(미사용·7일·장 단위)
- 셀프 취소 돈 돌려주기 추출 `voucher-self-cancel-refund.ts` — 돌려주기 전 `bookVoucherRefundOnOrder` · 혼합결제 split
- 매장 부분환불 카드 = 토스 부분취소(4xx 원상복구 · 5xx 재시도 큐) · 날짜만 기한 → 한국 23:59:59 + 매일 청소 30번이 기존 미사용 행 보정
- 장바구니 딜 실패 시 `spendPartialDeal` qty 0(재고는 줄 단위 복원만)
- 가드 `voucher-money-holes-b-2026-11-18.test.ts` 12건 + 주입 10. 기존 시험 2건 갱신(셀프취소 문장 위치 · 기한 값). staging `S-MONEYB1118`.
- 틀렸던 판단: 처음에 날짜만 → 23:59:59 를 그대로 돌려줬는데 상한(12개월) 날짜와 같은 날이면 12개월을 반나절 넘겼다 — 기존 시험이 잡았다.
