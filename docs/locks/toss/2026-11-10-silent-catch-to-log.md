# 2026-11-10 [UNLOCK] 결제 승인·웹훅의 빈 catch 14곳 → 로그를 남기는 catch (동작 무변경)

- **잠금 파일**: `src/worker/routes/payment.routes.ts`(8곳) · `src/worker/routes/webhook.routes.ts`(6곳)
- **대표 승인**: 세션이 *"결제 잠금 파일 14곳도 같은 방식으로 정리할까요?"* 라고 묻자 **"허가해줄게 계속 개선"** (2026-11-10).

## 무엇을 왜

두 파일에 `.catch(() => {})` 가 14곳 있었다. 실패해도 다음 줄로 넘어가는 것은 의도(결제 확정을 부가 작업 실패로 깨지 않는다)지만,
**로그도 한 줄 안 남는다.** 그중 둘은 부가 작업이 아니라 돈이다 — 부분 딜 결제의 딜 차감(`adjustUserPoints … 잔액부족`):
차감이 실패하면 주문은 확정되고 딜은 안 빠지는데 아무 흔적이 없다. 나머지는 셀러 원장 기입(`creditSellerOrderToLedger`),
알림, 후처리 묶음(`_bg()`)이다.

→ 전부 `.catch(swallow('payment'))` / `.catch(swallow('webhook'))` 로 바꿨다. `swallow` 는 `console.error('[swallow:<라벨>]', err)` 만 하고
던지지 않는다 — **제어 흐름·반환값·순서는 그대로**(둘 다 `undefined` 로 이행).

## 불변으로 지킨 잠금 항목

- `/confirm` 금액 검증 · `confirmTossPayment` 호출 · client-key endpoint — 무변경
- 웹훅 V2 이벤트 분기 · graceful 시그니처 · Toss 조회 대조(2026-11-09) — 무변경
- 어떤 catch 도 **던지게** 바꾸지 않았다(확정 흐름이 부가 작업 실패로 끊기지 않는다)

## 가드·주입

- `src/tests/unit/money-utils-no-silent-catch-2026-11-10.test.ts` — 두 파일을 목록에 추가(빈 catch 0)
- 주입 `[silent]` 2건 추가(각 파일에서 하나를 빈 catch 로 되돌린다) — 빨간불 확인
- 두 파일을 읽는 기존 시험 15파일 182건 통과 · 주입 지도 성함 · tsc 0

## E4 판정 · 롤백

- 배포 뒤 결제 1건이 정상 확정되는지(동작 무변경이라 기존 staging 항목 S-WHLOOKUP 과 함께 본다).
  로그 효과 자체는 실패가 날 때만 보인다(워커 로그 `[swallow:payment]` · `[swallow:webhook]`).
- 롤백: 이 커밋 revert.
