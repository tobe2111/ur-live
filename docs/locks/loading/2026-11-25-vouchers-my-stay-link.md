# 2026-11-25 `[LOADING_ADDITIVE]` `/vouchers/my` 에 `v.stay_booking_id` 한 열 추가

- 바꾼 잠금 파일: `src/features/group-buy/api/group-buy-public.routes.ts` (첫 SELECT 의 열 목록에 `v.stay_booking_id` 하나).
- 대표 승인: 2026-11-25 *"날짜 지정 시에 오지 않으면 환불되는게 아니라 소비한 것으로 해야하지 않을까?"* + 같은 날 전권 위임(`docs/decisions/2026-11-25-full-delegation.md`).
- 무엇을 왜: 지갑 QR 주의사항이 모든 이용권에 "유효기간이 지나면 자동 환불돼요" 라고 약속한다. 날짜 지정 숙소 예약은 이제 기간이 지나면
  이용한 것으로 처리되므로(환불 없음) 그 문장이 거짓이 된다. 화면이 숙소 이용권인지 알 방법이 없어 열 하나를 내려 준다.
- 실측 근거: 라이브 `vouchers` 에 `stay_booking_id` 열 있음(sqlite_master 조회, 2026-11-25). 같은 표의 열이라 JOIN·왕복 추가 없음.
  열이 없는 환경이면 종전처럼 첫 SELECT 가 실패해 기존 폴백 SELECT 로 내려간다(문구만 일반 문구로 보인다).
- 불변으로 지킨 잠금 항목: `Cache-Control`/`CDN-Cache-Control` 분리 · `group_buy_tiers` 서버 parse · `/vouchers/my` 한 물결(이용권·KT·선물 병렬) · 사본 읽기(`userReadDb`) · LIMIT 200.
- 가드·주입: `stay-no-show-2026-11-25.test.ts` '손님에게 결제 전·지갑에서 알린다' 가 열과 문구 분기를 고정.
- E4 판정: 숙소 이용권이 라이브에 0장이라 지금은 못 본다 — staging `S-STAYNOSHOW` 5번째 줄. 롤백: 열 하나 제거.
