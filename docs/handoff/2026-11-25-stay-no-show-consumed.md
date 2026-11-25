# 2026-11-25 날짜 지정 숙소 노쇼 = 이용한 것으로 마감

서비스: 유어딜(숙소 이용권). 머니 경로: **있음**(만료 환불 대상 변경 · 정산 원장). 롤백: revert(만료 환불이 다시 날짜 예약을 잡는다).
결재: `docs/decisions/2026-11-25-stay-expiry-refund-gaps.md` — 대표 *"날짜 지정 시에 오지 않으면 환불되는게 아니라 소비한 것으로 해야하지 않을까?"*

## 이어받는 세션의 첫 액션
staging 에서 `docs/STAGING_CHECKLIST.md` **S-STAYNOSHOW** 를 돈다. 판정 쿼리:
`SELECT v.status, v.refund_status, sb.status FROM vouchers v JOIN stay_bookings sb ON sb.id = v.stay_booking_id WHERE v.id = ?`
→ `used / (빈 값) / no_show` 이고 그 주문의 Toss 취소가 0건이면 통과. 원장은 `voucher:<id>` 참조 3줄.
라이브에서는 숙박 예약이 0건이라 하트비트(`stay-no-show-settle` ok)까지만 볼 수 있다.

## 한 것
- `src/worker/cron/expired-voucher-refund-sql.ts` — `notDateStaySql`: 날짜 지정 예약에 묶인 이용권을 만료 환불 조회·선점(폴백 문장 포함)에서 뺀다.
- `src/worker/cron/stay-no-show.ts` — 조회·선점 SQL SSOT + `handleStayNoShows`: 선점(`unused|expired → used`) → 예약 `confirmed → no_show` + 상태 로그 → 정산 원장 → 앱 안 알림.
  예약이 이미 `checked_in`·`checked_out`·`no_show`(사장님이 손으로 누름)여도 이용권이 안 쓰인 채 만료됐으면 원장까지 닫는다.
- `src/worker/utils/voucher-seller-redeem.ts` — 원장 블록을 `recordVoucherUseSettlement` 로 **행동 그대로** 꺼냄(스캔·챗봇·노쇼 마감이 같은 함수).
- `daily-lane.ts` 머니 그룹에 `stay-no-show-settle` · `check-cron-heartbeat.mjs` 필수 목록.
- 손님 안내: 숙소 상세 취소 정책 아래 한 줄 · 지갑 QR 주의사항(숙소 이용권이면 다른 문장, 6개 언어) · 내 숙소 예약 상태 '이용 처리(미방문)'.
  `/vouchers/my` 에 `v.stay_booking_id` 한 열(잠금 기록 `docs/locks/loading/2026-11-25-vouchers-my-stay-link.md`).
- 셀러 가이드 + `GUIDE_SEED_VERSION` 72 · 플랫폼 모델 숙소 행 · staging `S-STAYNOSHOW`.
- 가드 `stay-no-show-2026-11-25.test.ts` 9건(실제 sqlite) — 주입 2종(환불 조회에서 제외 조건 제거 / 노쇼 조회에서 날짜 조건 제거) 빨간불 확인.

## 실측·사실
- 라이브 `stay_bookings` 0행 · 숙소에 묶인 이용권 0장 → 오늘 영향받는 돈 0원.
- 라이브 `vouchers` 에 `stay_booking_id`·`refund_status` 열 있음 → 새 조회가 폴백으로 떨어지지 않는다.
- 사장님 수동 [노쇼] 버튼(`transitionBooking 'no_show'`)은 예약 상태만 바꾸고 이용권을 건드리지 않았다 — 종전엔 그 뒤 전액 환불됐다. 이제 노쇼 마감이 원장까지 닫는다.

## 못 한 것 / 판정 등급
- **E2.** 실결제로 돌리지 않았다(staging 필요). 화면도 그려 보지 못했다.
- 취소된 예약인데 이용권이 `unused` 로 남는 이례(시험의 10번)는 어느 cron 도 잡지 않는다 — 취소 경로가 이용권을 먼저 잡으므로 정상 흐름에선 생기지 않는다.

## 틀렸던 판단
- 처음엔 지갑 문구를 놓쳤다 — 규칙을 바꾸면 그 규칙을 **약속하는 문장**이 어디 있는지 먼저 grep 할 것(`자동 환불`).

## 머지와 라이브 판정 (2026-11-26 아침)
- 머지 `546da568b`(PR 2485).
- **[E4] 첫 실행 확인**: 머니 레인이 2026-11-26 03:00 에 돌았다. 하트비트 `stay-no-show-settle` ok(134ms) · `expired-voucher-refund` ok(131ms) · `auto-settlement` ok. 숙박 예약이 0건이라 처리된 건은 0 — 볼 수 있는 것은 "돌았고 실패하지 않았다" 까지다.
- 배포 뒤 실측(11-25): 숙소 상세의 안내 문구가 라이브에 있음 · 폰 4G 3회 FCP 1548·764·704ms / CLS 0.0044·0.0044·0.0002 · 가이드 시드 72 반영.
- 남은 것: 실제 숙박 예약 한 건으로 노쇼 → 이용 처리 → 정산 원장을 보는 것(staging `S-STAYNOSHOW`). 라이브에 예약이 생기기 전에는 확인할 방법이 없다.
