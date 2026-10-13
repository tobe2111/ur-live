# 2026-10-12 딜 현금 출구 정리 (유어딜 · 머니 경로)

대표: *"딜을 정산하는 플로우도 있지? 확인 못한 건 보류"* → *"응 모두 해주고 가장 이상적으로 UI까지 짜줘"*

## 다음 세션의 첫 액션
1. PR CI 가 초록인지(head sha 대조) → 대표가 머지 지시하면 머지.
2. 머지·배포 뒤 E4 는 **staging** 에서: `docs/STAGING_CHECKLIST.md` 의 **S-REFUND-1~6**.
   라이브에서 바로 재려면 대표 계정(users.id=3, 환급 가능 4,700딜)이 마이 → [환급 신청] 시트를 열어 금액이 맞는지만 본다(신청은 누르지 말 것 — 돈이 움직인다).
3. 옛 문 410 확인(읽기만): 로그인 토큰으로 `POST /api/points/withdraw` → 410.

## 한 것
- 유저 충전 잔액 환급 문 신설: `src/worker/utils/deal-refund.ts`(SSOT) · `GET/POST /api/points/refund` · 마이 `RefundSheet` · 지급 센터 '딜 환급' 탭(입금 완료 2FA / 반려 = 딜 원복, 둘 다 CAS).
  한도 = MIN(유상 잔액, 충전 누계 − 환급·출금 누계). 한 사람당 열린 신청 1건(부분 UNIQUE). 테이블 `deal_refund_requests`(user_withdrawals 의 최소 1만원 CHECK 를 피해 따로).
- 옛 문 셋 410: `/api/points/withdraw`(3.3% 원천징수 — 약관 환급과 정반대) · `/api/seller/deal-withdraw`(적립 경로 없는 잔액) · `/api/referral-tree/withdrawals`(딜로 이미 받은 돈을 또 지급 — 이중 지급).
- 사장님 마이 '정산' = 주간 자동 정산 읽기 시트(`PayoutSheet`). 출금 시트·정산 목록 시트·딜 잔액 카드 삭제.
- 환불 두 경로(만료 이용권 자동 환불 · 반품)가 딜을 **유상 버킷으로** 돌려주던 것 → `refundDealPoints`(원 버킷 복원). 무상 딜이 환급 가능 금액으로 세탁되던 구멍.
- 가드 `deal-cash-out-2026-10-12.test.ts`(실제 SQLite) + 주입 9건(전부 빨간불 확인), 기존 9개 매니페스트 재조준.

## 라이브 노출(실측)
추천 커미션 0 · 출금 신청 0 · 환급 가능은 대표 계정 4,700딜뿐 → 옛 문으로 새 나간 돈은 없었다.

## 틀렸던 판단
- 처음엔 `user_withdrawals` 를 재사용하려 했는데 `CHECK(amount>=10000)` 이 소액 환급을 막는다 → 별 테이블.
- 닫은 문을 인증 없이 410 으로 바꿨더니 계약 시험(401 기대)이 깨졌다 → 인증 먼저, 그다음 410.
- 완전 환급 뒤 마이에 아무 표시가 없었다(버튼이 사라짐) → `/balance` 에 `refund_pending` 추가.

## 남은 것 / 보류
- 보류(대표): 카카오 로그인 같은 탭 복귀 확인 · staging 카드결제 6자리 코드.
- 신청 취소 기능 없음(반려로 대신) — 필요하면 별건.
- Notion 개발 로그: 머지 후 기록(머니 경로 체크).

## 별건으로 남긴 것
- `returns.routes.ts` 의 **추천 커미션 회수**(반품 시 `user_points.balance - commission`)가 원장 기록을 안 남긴다 — 종전엔 같은 파일의 `adjustUserPoints` 때문에 `check-balance-without-ledger`(파일 단위 판정)가 못 봤다. 이번에 그 호출이 `refundDealPoints` 로 바뀌며 드러났고, 가드 정규식에 `refundDealPoints` 를 SSOT 로 추가해 통과시켰다. **회수 자체의 원장 누락은 고치지 않았다**(라이브 추천 커미션 0건 — 영향 0). 고칠 때는 회수 batch 옆에 `recordPointTransaction` 음수 행.
