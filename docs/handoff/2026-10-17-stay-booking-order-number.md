# 2026-10-17 숙소 예약 '주문 생성 실패' 수리

## 무엇이었나
대표 신고 스크린샷 — 그린스테이인해운대 · 스탠다드 룸 · 2명 · ₩181,000 → `결제로` 누르면 "주문 생성 실패".
`orders.order_number` 는 라이브에서 `TEXT UNIQUE NOT NULL` 인데 숙소 예약 INSERT 두 곳(단건 `/stays/bookings`·다객실)이
그 컬럼을 안 넣었다. INSERT 가 늘 실패했고 `.catch(() => null)` 이 삼켜 원인이 안 보였다.
**라이브 `stay_bookings` 0건 · 숙소 주문 0건 — 숙소 예약은 한 번도 된 적이 없다**(D1 실측).

## 고친 것
- 두 INSERT 에 `order_number = stayOrderNumber()`(`STAYORD-…`). 토스 orderId(`STAY-{id}`)와 **일부러 다른** 모양 —
  같으면 결제 webhook 이 이 주문을 일반 주문 확정 경로로 잡는다(숙소 확정은 `/stays/bookings/confirm`).
- INSERT 실패를 로그로 남긴다(삼키지 않음).
- 체크인이 오늘(KST)보다 이르면 거절 — 스크린샷이 10-17 에 10-16 체크인으로 예약을 시도했다.
- 가드 `stay-order-number-2026-10-17.test.ts`(진짜 INSERT 를 라이브 제약 SQLite 에 넣는다) + 주입 2건 빨간불 확인.

## 다음 세션 첫 액션
배포 후 숙소 하나로 **staging 실결제 1회**: 예약 생성 → 토스 결제 → `/stays/bookings/confirm` → stay_bookings 1행 confirmed +
달력 차감. 이 경로는 한 번도 끝까지 돈 적이 없으므로 결제 이후 단계에 다른 결함이 있을 수 있다.

## 남은 판단
- webhook-only 확정(결제 후 브라우저를 닫은 경우)은 숙소에 연결돼 있지 않다 — 기존 설계 그대로.
