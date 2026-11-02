# 부분 환불 기록이 한 번도 저장되지 않는다 — 잠금 파일 refund.ts 의 컬럼 이름 한 줄을 고칠까요?

상태: open
등급: C
역할: dev
올린 날: 2026-11-02
기한: 2026-11-09

## 질문
`src/worker/utils/refund.ts`(Toss 잠금 파일)의 환불 기록 INSERT 에서 컬럼 이름 `amount` 를 라이브 이름 `refund_amount` 로 고쳐도 될까요? (예 / 아니오)

## 근거 (실측)
- 라이브 `order_refund_history` 컬럼: `id, order_id, refund_amount, reason, created_at` (2026-11-02 `pragma_table_info`, `src/shared/db/live-schema.snapshot.json`).
- 코드 `refund.ts` 4단계: `INSERT INTO order_refund_history (order_id, amount, reason)` → 라이브에 `amount` 가 없어 **매번 실패**하고 `.catch(swallow('refund:history-insert'))` 가 삼킨다.
- 라이브 `order_refund_history` **0행** · `orders.refunded_amount > 0` 주문 **1건** → 그 환불의 개별 내역이 없다.
- **돈 자체는 정상이다**: 환불 금액은 바로 위 3단계(`orders.refunded_amount` 누적)와 Toss 취소가 처리한다. 빠지는 것은 "몇 번에 걸쳐 얼마씩 환불했는가" 기록뿐이다.
- 찾은 경로: 2026-11-02 라이브 컬럼 사진 가드(`check-sql-column-exists.mjs`)를 켜자 동결 목록 47종에 들어왔다.

## 선택지
1. **한 줄 고친다** (`amount` → `refund_amount`) — 장점: 다음 부분 환불부터 내역이 남는다 / 단점: 잠금 파일이라 audit 기록(`docs/locks/toss/`) 필요 / 머니 접촉: 기록 테이블 INSERT 만(금액 계산·Toss 호출 무변경).
2. **그대로 둔다** — 장점: 잠금 파일 무접촉 / 단점: 부분 환불 내역이 계속 안 남는다(정산·CS 때 근거 부족).

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)
안 1. 금액 경로는 건드리지 않고 기록 한 줄만 고치는 일이라 위험이 작고, 기록이 없는 상태가 더 위험하다.

## 롤백
그 한 줄을 `amount` 로 되돌리는 revert.

## 결정 (대표가 한 말 그대로)

## 반영 커밋
