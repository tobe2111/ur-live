# [UNLOCK_LOADING] 내 이용권(GET /vouchers/my) — 세 조회 한 물결 — 2026-11-04

- **바꾼 잠금 파일**: `src/features/group-buy/api/group-buy-public.routes.ts` — `router.get('/my')` 핸들러 안의 **순서만**.
  잠긴 항목(공개 목록의 `Cache-Control`/`CDN-Cache-Control` 분리 · `group_buy_tiers` 서버 parse)은 **불변**.
- **대표 승인(그대로)**: *"허가 — 고쳐줘"* (질문: 차례로 묻는 횟수를 약 4번 → 2번으로, 결과·화면 동일).
- **무엇을 왜**: 이용권 목록 · 교환권(KT) 목록 · 선물 상태는 셋 다 uid 만 필요하고 서로 무관하다 → `Promise.all`.
  한국 손님은 HKG·NRT·LAX 콜로에서 미국 동부 D1 로 묻는다(1주 RUM ICN 0건) → 왕복 하나 ≈0.2초.
  같은 날 앞 PR(#2193)에서 선물 표 확인 DDL 이 사본 세션 때문에 매 요청 원본으로 가던 버그도 고쳤다(`voucher-gift.ts` `dbKey`).
- `voucher-gift.ts`: `withGiftState` = `loadGiftState`(조회) + `applyGiftState`(순수 표시) 로 분리 — 기존 호출 계약 유지.
- **가드**: `src/tests/unit/serial-waves-round4-2026-11-04.test.ts`.
- **E4 판정**: 배포 뒤 대표 폰으로 이용권 탭 체감 + 어드민 vitals `D1` 표본.
- **롤백**: revert.
