# 2026-11-18 — 돈 코드 4건 + 데이터 정정 (대표 승인)

## 완료
- 코드(이 PR): ① 이용권 사용 장부 수수료 = 구매 때 요율(`purchaseRateSnapshot`, ledger.ts) ② 결제 승인된 주문은 미결제 자동취소 제외(scheduled-cleanup) ③ 만료 자동환불 후 **전액일 때만** `REFUNDED`(`markOrderRefundedIfFull`, auto-settlement — 부분환불인데 무조건 REFUNDED 로 찍던 줄 제거) ④ 인플루언서 원천징수 기본값 사업소득 3.3% + `influencer_withholding_log` 기록 + 어드민 세금 월합계 반영.
- 가드 `money-fixes-2026-11-18.test.ts` + 주입 6건 전부 빨간불. staging `S-MONEY1118`.
- 데이터: 대표 시험 환급 신청 #1(4,700딜) 공식 경로 `PATCH /api/admin/payout-center/refund/1/reject` 로 반려 → 대표 딜 111,500 → 116,200(실측).

## 남은 것 (대표 판단)
- 지급 대기 #1(홍대돈까스 16,150원) 안의 **950원 이중 적립**, 대표 자전거래의 **중개 몫 620원** — 정정하는 공식 경로가 없다.
  `payouts/:id/cancel` 은 취소된 금액이 다음 생성 때 다시 쌓여 950 을 못 뺀다. 원장 SQL 직접 수정은 금지 규칙.
  ⇒ 정정 도구(감사 로그 남는 어드민 조정 API)를 단독 세션 + staging 으로 만들 것. **그 전까지 지급 #1 승인·송금 보류.**

## 틀렸던 판단
- 없음(이번 세션 범위). `--only` 는 파일명이 아니라 주입 이름 부분일치다(`money1118`).

## 2026-11-18 이어서 — 장부 조정 기능 (대표 "장부 조정 기능도 만들어줘. 너가 알아서 마무리까지")
- 본체 `src/worker/utils/ledger-correction.ts` · API `src/features/admin/api/admin-payouts/ledger-corrections.ts`
  (`POST/GET /api/admin/ledger/adjustments` · `POST /api/admin/ledger/attributions/:id/cancel`, finance + 2FA + 감사 로그).
- 원장은 안 지우고 반대 방향 한 줄(`admin_adjustment`, `adj:{key}` 부분 UNIQUE). 지급 대기 행은 선점(CAS) 후 원장, 원장 실패 시 되돌림.
- 가드 `ledger-correction-2026-11-18.test.ts`(라이브 두 건을 픽스처로) + 주입 6. 가이드 v67. staging `S-LEDGERADJ`.
- 라이브 적용 계획(배포 뒤): ① `seller:14 → platform:escrow` 950, payout_id 1, key `store14-dup-950` ② attribution 1 취소.
  950 의 짝을 escrow 로 잡은 이유: 옛 `group_buy_join`(id 3)은 user→seller 직행이라 escrow 에 들어온 적이 없는데 `voucher_used`(id 4)가 escrow 에서 950 을 뺐다 → escrow 가 950 모자라다. 이 한 줄이 양쪽을 동시에 맞춘다.
