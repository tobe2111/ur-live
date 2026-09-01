# 이용권 부분결제 — 딜 일부 + 카드 나머지 (게이트 OFF)

**날짜** 2026-09-01 · **서비스** 유어딜 · **머니 경로** 있음(게이트 OFF 라 라이브 금액 불변)

## 대표 지시

> "이용권에 딜로도 결제되게끔 해줘. 예를들어 10000원짜리 이용권이면 3000 딜이 있으면
>  포인트 차감처럼 쓰는거지. 이미 구현이 되어있지 않아?"

**안 돼 있었다.** 이용권 레일은 **전부-딜**(`/join` payment_method='deal', `balance >= totalAmount`)
아니면 **전부-카드**(`/confirm-toss`) 둘 중 하나뿐이었다. 혼합결제 자리는 **쇼핑 레일**
(`orders.deal_used` + `payment.routes /confirm`)에만 있었고, 그 레일은 지금 쇼핑탭이 숨겨져 있어
라이브에서 한 번도 안 돌았다. ⇒ 3,000딜을 가진 사람에게 그 딜은 **쓸 데가 없다.**

## 설계 — 금액이 곧 계약이다

딜 사용액을 클라이언트가 보내지 않는다. **실제 청구액에서 역산**한다:

```
딜 사용액 = 상품 총액 − 카드 청구액
```

그래서 "카드로 낸 돈 + 딜로 낸 돈 = 상품값" 이 **구조적으로** 성립한다 — 클라가 보낸 숫자를
믿고 더하는 게 아니라 서버가 아는 총액에서 빼는 것이라 조작할 자리가 없다.
청구액 == 총액이면 딜 0 = **오늘과 동일한 경로**.

**정산은 안 바뀐다.** `orders.total_amount` 에는 **총액**이 들어간다(딜도 유저가 현금으로 충전한
돈이라, 대표 말대로 *"원래 정산을 해줬어야 하는 돈"*). 커미션·원장 전부 총액 기준 그대로.

## 순서

`카드 승인 → 재고 확보 → 딜 차감(원자 CAS) → 주문 INSERT`

- **차감 실패** → 재고 되돌리고 **카드 결제를 통째로 취소**. 카드만 긁히고 딜은 안 빠진 채
  이용권이 나가면 그만큼 미수다. (재고 부족 때와 같은 처리.)
- **주문 INSERT 실패** → 기존 자동환불에 더해 **이미 뺀 딜도 복원**한다. 이 구간은 주문이 없어서
  환불 헬퍼가 못 찾는다 — 여기서만 되돌릴 수 있다.
- **과금 전 잔액 확인**을 한 번 더 둔다(안내용). 카드가 아예 안 긁히도록.

## 🔑 웹훅이 또 빼지 않는다 — 확인한 사실

Toss 웹훅 `handlePaymentConfirmed` 는 맨 앞에서 `isAlreadyProcessed(orderNumber, 'PAID')` 로
**즉시 return** 한다. 이 레일의 주문은 **처음부터 PAID 로** 들어가므로 웹훅의 딜 차감 블록
(`orders.deal_used` 를 읽는 그것)에 도달하지 못한다. 설령 지나가도 웹훅의 금액 검증이
`SUM(total_amount)`(총액) vs 웹훅 청구액(카드분) 불일치로 거부한다 — 관문이 두 겹.

⚠️ **그러니 이 INSERT 의 `'PAID'` 를 `'PENDING'` 으로 바꾸면 이중차감이 생긴다.**
관례가 아니라 안전장치다. 테스트가 고정해 뒀다.

## 코드

| 파일 | 무엇 |
|---|---|
| `src/features/group-buy/api/partial-deal.ts` (신규) | 몸통 전부 — `planPartialDeal()`(순수) · 게이트/잔액 조회 · `derivePartialDeal`(역산·검증) · `spendPartialDeal`(원자 차감·실패 시 재고복원+결제취소) · `recordOrderDealUsed` · `restorePartialDeal` |
| `group-buy.routes.ts` `/join`(toss init) | `amount` 를 카드 청구액으로. `dealUsed`/`totalAmount` 동봉(화면 표시용) |
| `group-buy.routes.ts` `/confirm-toss` | 그 helper 들을 부르기만 한다(`derivePartialDeal` → `spendPartialDeal` → `recordOrderDealUsed`, 실패 시 `restorePartialDeal`) — 라우트 순증 **+27줄** |
| `src/tests/unit/voucher-partial-deal.test.ts` | 18건 (계산 7 + 배선 11) |
| `docs/STAGING_CHECKLIST.md` | **S10** 신설 |
| `admin-system-monitoring.routes.ts` | `OPS_GATES` 등재 |

`group-buy.routes.ts` 는 이미 1,413줄이라 로직을 라우트에 쓰면 래칫이 막는다 — 몸통을 모듈로 뺀 건
그 제약 덕이고, 결과적으로 순수함수 테스트가 가능해졌다(래칫 1413→1440 재동결).

**클라이언트 변경 0** — `GroupBuyDetailPage` 는 이미 서버가 준 `amount` 를 그대로 위젯에 넘긴다.
게이트를 켜면 그 값이 줄어들 뿐이다. 화면에 "딜 3,000 + 카드 7,000" 을 **표시**하려면
응답의 `dealUsed`/`totalAmount` 를 쓰면 된다 — 이번엔 안 붙였다(표시가 없어도 금액은 맞는다).

## 이번에 틀렸던 판단

**테스트가 엉뚱한 코드를 보고 있었다.** `orders INSERT` 를 `indexOf` 로 잡았는데 이 파일에는
INSERT 가 **둘**(전부-딜 `/join` · 카드 `/confirm-toss`)이라 앞의 것이 잡혔다. 세 검사가 조용히
헛돌 뻔했다(다행히 문자열이 달라 빨간불로 드러났다). `payment_key` 컬럼을 가진 쪽이 카드 경로다 —
앵커를 못 찾으면 **던지도록** 해 뒀다. 이 레포의 단골 사고("검사가 실패할 수 없음")를 또 할 뻔한 것.

## 다음 세션의 첫 액션

1. **S10 을 staging 에서** — 게이트 ON → 딜 있는 계정으로 이용권 카드결제 →
   `SELECT total_amount, deal_used FROM orders WHERE order_number=?` 가 (총액, 딜분) 인지,
   `point_transactions` 에 그 주문 차감이 **1행**인지(웹훅이 안 뺐는지), 환불 시 복원되는지.
2. 통과하면 S10 상태 ✅ + 날짜. 프로덕션 게이트 활성은 **대표가 어드민에서**.
3. (선택) 결제 화면에 "딜 N + 카드 M" 표시 — 응답 필드는 이미 나간다.
