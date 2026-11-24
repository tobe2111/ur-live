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
- (완료) 상세 페이지 구매 전 안내 — 대표 *"응 허가해줄게"* → 응답 `call_booking` + 이용 안내 한 줄. 잠금 기록 `docs/locks/loading/2026-11-23-call-booking-detail-notice.md`.
- 라이브 판정(E4): 배포 뒤 전화 예약형 이용권을 하나 켜고 지갑·결제 완료·예약 탭을 확인(로그인 화면이라 대표 확인 필요) + `measure-live-vitals` 는 로그인 필요 화면이라 못 잰다.
- 2단계(앱 안 예약 요청)는 주문이 생긴 뒤.

## 머지·배포·라이브 판정 (2026-11-23 밤)
- 본체 tobe2111/ur-live#2466(`4c28fa2c`) · 상세 구매 전 안내 tobe2111/ur-live#2467(`c20c92df`) 머지.
- 첫 배포(4c28fa2c)는 **무관한 시험의 우연 실패**로 건너뛰어졌다 — `orderIdGenerator.test.ts` "returns unique values"(50개가 같은 초에 6자리 난수 → 약 0.14% 로 겹친다). 두 번째 배포(c20c92df)에 함께 반영. 그 시험 수리는 별도 제안으로 올림(이 작업 범위 밖).
- 라이브: `/api/visit-plans/mine` · `/api/seller/visit-plans` 가 404 → **401**(배포됨). 안 켠 이용권(`/api/group-buy/products/2919`) 응답에 `call_booking` 키 없음.
- 속도 `/pass/2919`(폰 4G·CPU 4배 3회): FCP 1388 · 892 · 1356ms / LCP 3972(배포 직후 첫 접속) · 992 · 1540ms / CLS 0.0009 ×3. 같은 주소의 변경 전 값은 없다(11-18 `/pass/3066` FCP 0.77~1.52s 와 같은 범위).
- **못 본 것**: 켠 이용권에서 안내·전화 버튼·예약 탭이 실제로 뜨는지(로그인 화면 + 아직 켠 이용권 0) — 대표 확인 대기.

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어 하라고 했을 때만)
`SELECT product_id FROM product_supply_meta WHERE key='call_booking' AND value='1'` (메인 D1) → 행이 생겼으면 그 상품의
`/api/group-buy/products/<id>` 에 `call_booking:true` 가 있는지, `SELECT COUNT(*) FROM voucher_visit_plans` 로 손님이 날짜·동의를 실제로 쓰는지 본다.
