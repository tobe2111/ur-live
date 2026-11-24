# 2026-11-24 숙박권 '먼저 판매' 기본 (결재 Q1·Q2·Q3·Q5 구현 · Q4 는 기존 장치가 이미 맡음)

서비스: 유어딜(숙박 이용권 — 사장님 등록 화면 / 손님 상세·내 예약).
결재: `docs/decisions/2026-11-24-stay-voucher-buy-first.md` — 대표 방향 *"그래 그렇게 하자"* → 세부 5개 **"추천대로 진행"**.

## 이어받는 세션의 첫 액션
staging 에서 `docs/STAGING_CHECKLIST.md` **S-STAYFIRST** 를 한 바퀴 돈다(등록 → 카드 결제 → 사용 처리 → 셀프 취소 → 만료 환불).
만료 환불은 예약의 `voucher_expires_at` 과 묶인 `vouchers.expires_at` 을 과거로 두고 03:00 회차 뒤
`SELECT status, refund_status FROM vouchers WHERE stay_booking_id = ?` 가 `expired / refunded` 면 통과.
그 다음은 결재 `docs/decisions/2026-11-25-stay-expiry-refund-gaps.md`(open) 의 대표 답에 따른다.

## Q4 는 새 코드가 아니었다 (2026-11-25 확인)
- 숙소 결제 확정 → `issueStayVouchers` 가 `vouchers` 행을 만든다(`expires_at = stayVoucherExpiresAt` — 먼저 판매는 `voucher_expires_at`).
- 만료 환불 cron(`auto-settlement.ts` `handleExpiredVoucherRefunds`)의 조회·선점 SQL 에 숙소 제외 조건이 없다 → 만료 미사용이면 결제액 그대로 환불(카드 = Toss 취소).
- 사장님 수동 '사용' 은 `settleStayVoucherAfterManual` 로 묶인 이용권도 `used` 로 만든다 → 쓰고도 환불되는 길 없음.
- 만료 뒤 셀프 취소는 환불율 0 → 두 번 안 나간다.
- 빈틈(결재 올림): ① 만료 환불 뒤에도 `stay_bookings.status` 가 `confirmed` 로 남는다(화면 표시만 — 손님 쪽은 이 PR 에서 연락 버튼을 숨겼다)
  ② **날짜 지정 예약도 같은 cron 을 탄다** — 체크아웃 날이 지나도록 사장님이 체크인을 안 누르면(노쇼 포함) 100% 환불된다. 취소 정책(임박 취소 0~50%)과 어긋난다.

## 한 것 (이 PR)
- `src/shared/stay-sale-mode.ts` — 판매 방식·유효기간 선택지·판정(`resolveStaySale`)·이용 안내 정리. 화면·서버 공용.
- 등록 위저드: `StaySaleFields`(판매 방식 3 · 유효기간 3·6·12개월 필수 · 쓸 수 없는 날 안내) → `StayRoomsFields` 에 삽입.
  폼 기본 `stay_sale_mode='voucher'`, `stay_validity_days=0`(미선택) → [다음] 판정 `stayStepError`.
- 서버 `POST /api/seller/stays/:id/info`: `sale_mode: 'date'` 고정 제거 → 판정 결과 저장, 이용 안내는 `house_rules`.
  `PUT /api/seller/stays/:id`: 판매 방식 변경 때 같은 판정.
- 수정 화면 `StayManagePanel` 체크인·정책 탭에 같은 부품.
- 손님: 상세의 먼저 판매 상자에 이용 안내 + 문구 정리 · 내 숙소 예약에 `StayVoucherContact`(코드 크게 + 전화·문자).
  `GET /stays/my-bookings` 가 `store_phone`(= `products.restaurant_phone`) 동봉.
- 셀러 가이드 + `GUIDE_SEED_VERSION` 71 · 플랫폼 모델 숙소 행 · STAGING S-STAYFIRST.
- 가드 `stay-sale-mode-2026-11-24.test.ts` 17건 — 주입 3종(서버가 date 로 되돌림 / 유효기간 필수 제거 / 만료 이용권에 연락 버튼) 빨간불 확인. 관련 시험 72파일 961건 · tsc 0.

## 실측·사실
- 서버·손님 화면은 2026-05 부터 세 방식(`voucher`·`date`·`both`)을 다 처리한다. 막혀 있던 것은 등록 경로가 `date` 로 덮어쓰던 한 줄.
- 이용 안내를 새 열 대신 `house_rules`(기존 열 · 상세가 `psi.*` 로 이미 내려준다)에 둔 이유: 열 추가 ALTER 가 라이브에 안 붙는
  사고를 오늘 세 번 봤다 + `stays-public.routes.ts` 가 파일 크기 동결값(1392줄)에 딱 붙어 있다.
- 유어딜 안 이중 판매는 막혀 있다(결제 승인 뒤 `available_count > 0` 가드 차감, 실패 시 자동 환불). 남는 위험은 다른 예약 앱과의 이중 판매.
- 라이브 숙박 예약 0건 · 판매 중 숙박 20곳은 seller 없는 시범 데이터(전부 `date`).

## 머지·배포 뒤 실측 (2026-11-25 02:30)
- PR #2482 → main `5a9824b52`. Pages·cron 워커 배포 success.
- 셀러 가이드: `GET /api/guides/seller` 1회 → `guide_seed_version` 50 → 71, '먼저 판매' 섹션 1개 확인.
  (50 에 멈춰 있던 것은 고장이 아니다 — 2026-10-17 뒤로 가이드를 연 사람이 없었다. 재시드는 첫 접근 때 돈다.)
- 손님 숙소 상세 `/stays/2944`(날짜 지정 숙소) 폰 4G·CPU 4배 3회: FCP 1024 · 824 · 776ms / LCP 1196 · 988 · 1164ms / CLS 0.0044 ×3.
  같은 회차 대조군 `/vouchers` FCP 1212 · 1480 · 1536ms — 측정 시점 회선이 평소보다 느렸다. 바꾸기 전 값은 재지 않았다(이번 변경은 먼저 판매 상자 안쪽이라 날짜 지정 숙소에는 안 그려진다).
- 먼저 판매 숙소가 라이브에 0곳이라 손님 화면(선택 상자·연락 버튼)은 **여전히 E2**. 내 숙소 예약·셀러 위저드는 로그인 화면이라 못 쟀다.

## 못 한 것 / 판정 등급
- **E2.** 화면을 그려서 보지 못했다 — `visual-preview` 하네스에 숙소 상세·셀러 위저드 시드가 없다. 배포 뒤에도 라이브에
  먼저 판매 숙소가 없어 손님 화면 E4 는 실제 숙소가 등록돼야 가능하다(셀러 위저드는 로그인 필요 — 대표 폰 확인 요청).

## 틀렸던 판단
- 11-24 낮에 대표에게 "같은 방 이중 판매 방지는 미확인" 이라고 했다 — 코드에 가드가 있었다(위 실측).
- 결재 문서 상태를 `decided` 로 적어 pre-push 시험이 막았다 — 정의된 값은 `open|approved|rejected|expired`.
- **"먼저 판매 숙박권은 만료되면 환불 0원" 이라고 결재 문서와 대표 보고에 적었다 — 틀렸다.** 예약 표(`stay_bookings`)의 취소 분기만 보고
  판단했고, 2026-11-03 에 숙소가 이용권(`vouchers`)으로 합쳐져 만료 환불 cron 을 같이 탄다는 것을 놓쳤다.
  한 기능을 표 하나만 보고 판정하지 말 것 — 숙소는 `stay_bookings` 와 `vouchers` 두 곳에 산다.
