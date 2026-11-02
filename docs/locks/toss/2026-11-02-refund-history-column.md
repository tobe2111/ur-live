# 2026-11-02 · [UNLOCK] · `src/worker/utils/refund.ts` — 부분 환불 내역 INSERT 컬럼 이름

**대표 승인(그대로)**: *"응 고쳐도 돼."* — 결재 `docs/decisions/2026-11-02-refund-history-column.md`

## 무엇을 왜
- `refundOrderPartial` 4단계 `INSERT INTO order_refund_history (order_id, amount, reason)` →
  **`refund_amount`**. 라이브 `order_refund_history` 컬럼은 `id, order_id, refund_amount, reason, created_at`
  (2026-11-02 `pragma_table_info`, `src/shared/db/live-schema.snapshot.json`).
- 종전 `amount` 는 라이브에 없어 INSERT 가 **매번** 실패했고 `.catch(swallow('refund:history-insert'))` 가 삼켰다
  → 라이브 `order_refund_history` **0행**, `orders.refunded_amount > 0` 주문 1건의 내역이 없다.
- 찾은 경로: 라이브 컬럼 사진 가드(`check-sql-column-exists.mjs`, #2094)의 동결 목록.
- 같은 커밋에서 참조 정의(`production-schema.ts` · `src/db/schema.ts` — import 0)를 라이브 모양으로 맞췄다.

## 불변으로 지킨 것
- 환불 금액 계산 · `orders.refunded_amount` 누적(3단계) · Toss 취소 호출 · 전액 환불 상태 전환 · 재고 복구 — **한 글자도 안 바꿈**.
- best-effort(`swallow`) 성격 유지 — 기록 실패가 환불을 막지 않는다.

## 가드
- 컬럼 가드가 이제 라이브 사진 기준이라 옛 `amount` 로 되돌리면 `check-sql-column-exists -s` 가 빨간불(되돌려-검증 확인).
- 동결 목록에서 `refund.ts|INSERT|order_refund_history.amount` 를 내렸다.

## E4 · 롤백
- E4: 다음 부분 환불이 일어난 뒤 `SELECT COUNT(*) FROM order_refund_history` 가 0 → 1 이상. 세션이 환불을 일으킬 수 없어 **대표 판정 대기**.
- 롤백: 그 한 줄을 `amount` 로 되돌리는 revert(기록이 다시 안 남을 뿐 돈 흐름은 무관).
