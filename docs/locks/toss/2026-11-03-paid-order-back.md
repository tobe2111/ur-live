# [UNLOCK] 결제를 마친 주문이면 결제창이 비킨다 — 2026-11-03

- **바꾼 잠금 파일**: `src/pages/TossWidgetPayPage.tsx`
- **대표 승인**: 결재 `docs/decisions/2026-11-03-back-navigation-locked-files.md` ② 선택(2026-11-03, 세션 질문 응답 — "② 카드 결제 뒤 뒤로").
- **docs 근거**: 결제위젯 `requestPayment` 는 successUrl 로 **문서를 바꿔** 돌아온다(https://docs.tosspayments.com/reference/widget-sdk#requestpayment). 그래서 앞 칸(`/pay/widget`)이 이력에 남고 우리가 지울 수 없다.

## 증상
카드 결제 완료 화면에서 폰 뒤로 → 이미 쓴 결제창이 다시 뜬다(같은 orderId 로 위젯 초기화).

## 무엇을
- 완료 화면(`GroupBuyConfirmPaymentPage` · `StayCheckoutReturnPage`, 잠금 밖)이 승인 성공 때 `markOrderPaid(토스 orderId)`(sessionStorage, `src/lib/paid-orders.ts`).
- `TossWidgetPayPage`: 위젯 초기화 **전에** `isOrderPaid(orderId)` 면 `useSafeBack('/')` 로 한 칸 더 뒤로. bfcache 복귀(`pageshow` persisted)도 같다. 머리줄 ← 도 `useSafeBack`.

## 안 바꾼 것 (byte-불변)
위젯 초기화 · `setAmount` · `requestPayment` 인자 · successUrl/failUrl 계산 · 금액 검증 · 딜 조절. 서버 `/confirm` 무접촉.

## 가드
`src/tests/unit/safe-back-2026-11-03.test.ts` ⑤(3건). 되돌려-검증: 초기화 전 확인 줄을 지우면 빨간불.

## E4 판정 · 롤백
- 판정: 실결제(또는 staging) 한 번 → 완료 화면에서 폰 뒤로 → 결제창이 아니라 상세가 보이면 E4.
- 롤백: 해당 커밋 revert.
