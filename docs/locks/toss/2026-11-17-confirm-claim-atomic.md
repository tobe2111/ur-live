# 2026-11-17 [UNLOCK] /confirm 의 DONE 선점을 결제 키와 한 문장으로 · 선점 실패를 실패로 본다

- **잠금 파일**: `src/worker/routes/payment.routes.ts` (`/confirm` 선점 CAS 블록과 그 뒤 `updateStatus` 실패 분기만)
- **대표 승인**: `AskUserQuestion` *"잠금 풀고 고침 (추천)"* (2026-11-18) — 대표 *"모두 다 해줘 가장 이상적이고 영구적으로. 그리고 다른 문제들도 파악해줘"* 로 시작한 안정성 점검에서 발견.
- **docs**: 결제 승인 API 자체는 안 건드렸다(`confirmTossPayment` 무변경). Toss 응답 필드 `paymentKey`·`method`·`approvedAt` 만 읽는다 — https://docs.tosspayments.com/reference#payment-객체

## 무엇이 깨져 있었나 (코드 실측)

1. 선점 `UPDATE orders SET status='DONE' … WHERE … NOT IN (…)` 가 `.catch(() => null)` 이었다. D1 이 던지면 `confirmClaim` 이 null →
   "이미 다른 요청이 처리함" 분기로 가서 `success:true` 만 돌려줬다. 결제 키는 이 뒤에서만 쓰므로 **주문은 PENDING·키 없음** →
   `reconciliation.ts` 가 24시간 뒤 "결제 증거 없음" 으로 **자동 취소**·재고 복구. 돈은 Toss 에 있다.
2. 선점이 성공한 뒤 `orderRepo.updateStatus`(키·결제 시각·결제수단)가 던지면 `return` — **DONE 인데 키 없음** 으로 굳고 재고 차감·
   교환권·커미션이 안 돌았다. 남긴 `payment_update_retry` 행은 읽는 코드가 0 이었다.

## 고친 것

- 선점 문장 하나에 `toss_payment_key`·`toss_order_id`·`payment_method`·`paid_at` 을 같이 쓴다(2번이 구조적으로 사라진다).
- 선점이 던지면: 키만이라도 PENDING 행에 보존(→ reconciliation 1b 가 Toss 조회로 확정) · `payment_update_retry` 기록 · critical 알림 ·
  `PAYMENT_CONFIRMED_DB_DEFERRED` 경고로 응답(종전 dbErr 경로와 같은 모양).
- 보조 `updateStatus` 가 실패해도 `return` 하지 않는다(행은 이미 온전) — 재고·교환권·커미션이 이어 돈다.
- `reconciliation.ts`(잠금 아님): retry 기록이 있는 PENDING 주문은 자동 취소 대상에서 뺀다.

## 불변으로 지킨 것

`confirmTossPayment`·금액 검증·Idempotency·가상계좌 분기·커미션/교환권/재고 순서·응답 모양. 선점 WHERE 절 그대로.

## 가드

`src/tests/unit/confirm-claim-atomic-2026-11-17.test.ts` 4건 · 실패 복구 본체는 `src/worker/utils/confirm-claim-recovery.ts`(payment.routes 크기 래칫 976 안으로 떼어 냄) + 주입 `scripts/mutations/confirm-claim-atomic-2026-11-17.mjs` 2건(빨간불 확인).
기존 결제·reconciliation 시험 13파일 155건 통과.

## ⚠️ 남은 검증

`docs/STAGING_CHECKLIST.md` **S-CLAIMATOMIC** — 대표 통제 매장 실결제 1회. 롤백: 이 커밋 revert.
