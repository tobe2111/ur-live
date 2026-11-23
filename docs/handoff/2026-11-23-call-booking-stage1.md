# 2026-11-23 전화 예약형 이용권 1단계

서비스: **유어딜(소비자 이용권)**. 대표 *"응 다 해줘. 정산은 오케이. 토스페이먼츠가 정산하는 일자에 맞게 해줘야 할 것 같아서 지금대로 해야겠다"*
(직전 보고: ① 전화 예약형 1단계 ② 손님 번호는 동의한 손님만·방문 다음 날까지 ③ 정산은 영업 문구를 실제에 맞춤).

## 한 것
- 규칙·저장 `src/worker/utils/visit-plan.ts` (`product_supply_meta.call_booking` · 새 표 `voucher_visit_plans`)
- API `src/features/visit-plans/api/visit-plans.routes.ts` (사장님 스위치·목록·날짜 / 손님 목록·날짜·번호 동의)
- 알림: `seller-sale-notify.ts` `notifyCallBookingSale`(대시보드 벨) · cron `visit-eve-reminder`(KST 18:40 슬롯, 앱 알림만)
- 화면: `BookingModeSection`(전화 예약 모드) · `FirstVoucherPage` 스위치 · `CallBookingToggle`(이용권 목록) ·
  `CallBookingBlock`(지갑 QR 창 · 결제 완료) · `SellerBookingsPage` 전화 예약 탭(`CallBookingsPanel`) · `PhoneIcon`
- 시험 `visit-plan-call-booking-2026-11-23.test.ts` 22건(진짜 SQLite) · 주입 9건 빨간불 확인
- 문서: platform-model §3 · 셀러 가이드(GUIDE_SEED_VERSION 68) · `docs/design/voucher-booking-request-2026-11.md` 1단계 절

## 결정(대표 말 그대로)
- 정산 유보(영업일 10일)는 그대로. "차주 정산" 이라는 영업 문구는 대표가 실제에 맞춰 말한다.
- 손님 번호 동의는 **기본 꺼짐**(손님이 직접 켠다) — 결제 화면(잠금)에서 받는 동의가 아니라 이용권 화면의 스위치다.

## 이번에 틀릴 뻔한 것
- 전날 알림의 "한 번만" 은 순차 시험으로는 못 깬다(조회 조건이 이미 걸러 준다) → 조회 직후 선점을 흉내 내는 시험을 따로 넣었다.
- 판매 알림 호출부는 상품 id 를 안 넘긴다 → 매장의 전화 예약형 상품 이름과 대조(결제 경로 파일 무수정).

## 남은 것
- 상세 페이지 구매 전 안내 — `group-buy-public.routes.ts`·`GroupBuyDetailPage.tsx` 가 잠금 파일이라 대표 허가 필요.
- 라이브 판정(E4): 배포 뒤 전화 예약형 이용권을 하나 켜고 지갑·결제 완료·예약 탭을 확인(로그인 화면이라 대표 확인 필요) + `measure-live-vitals` 는 로그인 필요 화면이라 못 잰다.
- 2단계(앱 안 예약 요청)는 주문이 생긴 뒤.
