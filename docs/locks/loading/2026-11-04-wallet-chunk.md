# [UNLOCK_LOADING] 지갑 부품을 공용 봉투에서 지갑 봉투로 — 2026-11-04

- **바꾼 잠금 파일**: `vite.config.ts` `manualChunks` — catch-all(`app-components`) **앞에** 규칙 한 줄 추가.
  기존 규칙(env-validator·레이아웃·폴더별 chunk·hoisted 훅)은 **불변**.
- **대표 승인(그대로)**: *"잠금파일도 모두 허가해줄게"* (그 전: *"또 더 최적화해 대기업급으로 해야해"*).
- **무엇을 왜(빌드 실측)**: 내 이용권 탭이 공용 봉투 `app-components`(109KB)를 받고 9KB 만 실행했다. 원인은
  `AddToHomeHint` · `voucher/ScannableQr` · `voucher/VoucherRedeemModal` · `voucher/RedeemReviewCard` · `payment-success/SellerConversionNudge`
  다섯이 catch-all 에 떨어진 것 → `app-wallet` 으로. QR 창은 지갑의 핵심 동작이라 lazy 로 내리지 않았다(누를 때 다시 받으면 더 느리다).
- **결과**: 내 이용권 받은 JS 870 → 741KB(CPU×4 하네스) · 어드민 정적 폐쇄 256.7 → 251.6KB. surface-budgets 기준 갱신(개선 잠금).
- **가드**: `src/tests/unit/wallet-chunk-2026-11-04.test.ts`.
- **롤백**: 규칙 한 줄 제거.
