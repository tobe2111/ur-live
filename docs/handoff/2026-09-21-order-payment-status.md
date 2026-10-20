# 💸 결제된 주문의 `payment_status` — 환불이 막히고 매출이 빠지던 것 (2026-09-21)

대표 지시: *"머지 해. 2번도 착수하고"* — 2번은 [#1522](https://github.com/tobe2111/ur-live/pull/1522)
작업 중 발견해 보고한 별건이다.

## 무엇이 문제였나

공구·장바구니·checkout 결제 경로가 주문을 만들 때 `status='PAID'` 만 쓰고 `payment_status` 를
안 써서 컬럼 **기본값 `'pending'`** 에 머물렀다. 그 값을 `'approved'` 로 읽는 곳들이 그 주문을
통째로 비켜 간다:

- 🔴 **소비자 환불 요청이 400** — `order.routes.ts:801` 이 *"결제가 완료되지 않은 주문입니다"*.
  돈은 이미 냈는데. (셀러가 대신 하는 `refundOrderFully` 경로엔 이 검사가 없어 **된다**.)
- `ops-daily-digest`(어제 매출) · `seller-daily-report` · `seller-tier-eval` · `anomaly-detect` ·
  `daily-self-diagnostic` · 셀러 온보딩 `first_payment` 에서 누락.

라이브 실측: `PAID/DONE/DELIVERED` + `pending` **4건**, `CANCELLED` + `pending` 57건.

쇼핑 경로는 **2026-04-22 에 같은 이유로 이미 고쳐졌다** — `order.repository.ts:603` 주석
*"payment_status='approved' 동기화 — 이전엔 status=DONE 이어도 pending 인 채 남아서 환불/정산
로직 오작동"*. 공구 경로만 안 고쳐져 있었다.

## 고친 것

| 자리 | 변경 |
|---|---|
| `group-buy.routes` 487·1230 | PAID INSERT 에 `payment_status='approved'` (딜·카드 둘 다) |
| `cart-checkout.routes` 223 | 〃 |
| `worker/utils/checkout.ts` 231 | 〃 (이 파일만 `status` 가 바인드값이라 컬럼·bind 둘 다) |
| `order-refund.ts` CAS 전이 | `payment_status='refunded'` — **머니 룰 #2 대칭** |
| `order.routes` 환불 요청 경로 | 〃 (환불 경로가 둘이라 한쪽만 고치면 장부가 갈린다) |
| `order.repository` | `updateStatus*` extras 에 `payment_status` 통로 + 실제 SET |
| `repair-schema/column-repairs` | 기존 행 backfill(멱등) |

**안 건드린 것**: `experience-campaign.routes`(0원 체험단 — 돈이 오간 적 없어 매출·`first_payment`
에 섞이면 안 된다) · `PENDING` 으로 만드는 INSERT 들(`OrderRepository`·`stays-public`).

**backfill 조건** — 모르면 안 바꾼다:
`payment_status='pending'` **그리고** `status IN (PAID,DONE,DELIVERED)` **그리고**
결제 흔적 있음(`payment_key` / `toss_payment_key` / `payment_method='deal_points'`).
`CANCELLED` 57건은 결제 전 취소와 결제 후 취소가 섞여 있어 손대지 않는다 — 섞인 채로 `approved`
를 찍으면 환불 건수 집계가 되레 틀어진다.

## 🔴 이걸로도 **안 풀리는 절반** (다음 세션이 판단할 것)

공구 카드 주문은 `payment_key` 만 채우고 **`toss_payment_key` 는 NULL** 이다(라이브 id 89 실측).
소비자 환불 엔드포인트는 `getPaymentInfo()` 가 돌려주는 `toss_payment_key` **하나만** 보므로,
`payment_status` 를 고쳐도 그 주문은 **400 → 422 `PAYMENT_KEY_MISSING`** 으로 벽이 바뀔 뿐이다.
(`refundOrderFully` 는 `toss_payment_key || payment_key` 폴백이 있어 셀러 환불은 된다.)

**그런데 `toss_payment_key` 만 채우는 건 위험하다.** 그 엔드포인트는 `refundOrderFully` 를
안 쓰고 **환불을 직접 구현**한다 — Toss 취소·CAS·재고·추천커미션만 하고 **딜 복원 · 공급자/영입자
역전 · 원장 역전 · 이용권 회수**를 안 한다. 즉 키만 채워 길을 열면 **환불받고 이용권은 그대로
쓸 수 있는** 구멍이 생긴다.

⇒ 권고: **소비자 환불 엔드포인트를 `refundOrderFully` 에 위임**한다. 다만 그 루틴은 전액 전용이고
현 엔드포인트는 `body.refund_amount` 부분환불을 받으므로, 부분환불을 어떻게 할지가 선행 결정이다
(S6 `partial_refund_enabled` 와도 맞물린다). **대표 판단 사항.**

## 검증
tsc 0 · 신규 `order-payment-status-2026-09-21` 12건 pass ·
주입 `scripts/mutations/order-payment-status.mjs` **10건 되돌려-검증 전부 빨간불 확인** ·
`check-sql-column-exists` / `check-status-constraints` 통과.

🩸 테스트가 내 검출기를 잡았다: PAID INSERT 를 `status` 자리의 `'PAID'` 리터럴로 찾았는데
`checkout.ts` 만 그 값을 **바인드**해서 0건이 나왔다 — "0건이면 통과가 아니라 앵커가 낡은 것"
단언 덕에 빨간불이 떴고, 그 파일은 모양에 맞는 별도 검사로 뺐다.

## ⚠️ 프로덕션 반영 전
**staging 실결제 필수 — `docs/STAGING_CHECKLIST.md` `P16`.** 게이트가 없는 변경이라 머지 즉시
적용된다(= 머지 자체가 대표 판단 사항).
