# 2026-11-24 정산 계좌 없는 매장 알림

서비스: **유어딜(소비자 이용권) — 매장 정산**. 대표 *"지급 대행 쓰지 않는 선에선? 일단 지금 할 수 있는거 진행해줘 알리는 기능"*.

## 한 것
- `src/worker/utils/bank-missing.ts`: 승인 매장 중 은행·계좌번호가 둘 다 있지 않은 곳 + 송금 대기액·판매 중 이용권 수.
  - 사장님 대시보드 알림 `bank_missing` — 판매 중이거나 받을 돈이 있는 매장에 **7일에 한 번**(cron `bank-missing-nudge`, KST 18:40 슬롯). 앱 알림만.
  - 대표 아침 요약에 "정산 계좌 없는 매장 N곳 · 그중 받을 돈 있는 매장 M곳(합계)".
- 시험 `bank-missing-nudge-2026-11-24.test.ts` 9건(진짜 SQLite) · 주입 8건 빨간불 확인. 머니 경로 무접촉(읽기 + 알림).

## 라이브 실측 (11-24)
- 승인 매장 13곳 전부 계좌 미등록. 알림 대상 3곳(14 · 26 · 29 — 판매 중). 송금 대기 정산 1건: 매장 14 · 15,200원.

## 이번에 틀렸던 판단
- 첫 판은 `payouts.payee_type = 'seller'` 만 봤다. **매장 사장님 정산 행은 `store_owner`** 다(`payoutPayeeType`) → 매장 14 의 받을 돈이 0 으로 읽혔다.
  시험은 내가 지어낸 픽스처(`'seller'`)라 초록이었고, **라이브에 같은 쿼리를 읽기 전용으로 돌려서** 잡았다. ⇒ 픽스처를 라이브 표기로 고치고 주입 2건 추가.

## 남은 결정 (대표)
- 지급대행 없이 가는 정산 운영(주 1회 일괄 이체 파일 + 소액 자동 승인)은 12-17 개정 전금법 대상 여부를 법무에 확인해야 한다 — `docs/decisions/2026-11-03-settlement-structure.md`.
- 계좌는 사장님이 직접 넣어야 한다(마이 › 정산 › 계좌 등록). 대표가 대신 넣는 길은 없다.

## 이어받는 세션의 첫 액션 (대표가 이어 하라고 했을 때만)
`SELECT recipient_id, created_at FROM dashboard_notifications WHERE type='bank_missing'` 로 알림이 실제로 쌓였는지, 며칠 뒤
`SELECT COUNT(*) FROM sellers WHERE status IN ('active','approved') AND seller_type='store_owner' AND TRIM(COALESCE(bank_account,''))!=''` 로 등록이 늘었는지 본다.

## 후속 — 어드민이 계좌를 대신 입력 (같은 날)
대표 *"1번 일단 만들어줘봐"* (직전 제안: "직접 넣으신 매장의 정산 계좌를 대표님이 어드민에서 대신 입력할 수 있게 만들까요?").
- `features/admin/api/admin-store-bank.routes.ts`: `GET/PUT /api/admin/sellers/:id/bank-account` · 화면 `admin-merchant-commissions/StoreBankCard.tsx`(`/admin/merchant-commissions` 매장 조회 → 정산 계좌 카드).
- 지킨 것: 역할(finance·super·admin — `admin-roles.ts` SENSITIVE_MUTATIONS) · 덮어쓰기는 `confirm_overwrite` · 감사 로그와 응답·알림에 계좌번호는 끝 4자리 · 사장님에게 즉시 알림 · 은행은 `shared/banks.ts` 목록만.
- 어드민이 넣으면 `is_verified=1`(사장님께 직접 받은 값이라는 전제). 사장님이 스스로 바꾸면 종전대로 0.
- 시험 `admin-store-bank-2026-11-24.test.ts` 10건(실제 라우트 + 진짜 SQLite) · 주입 6건 빨간불 확인. 머니 로직(금액·정산·송금) 무접촉.
- 계좌 없는 매장 알림(#2470)은 머지·배포 성공(`27ba6a74`). 첫 회차는 11-24 저녁 6시 40분 — 그 뒤 `dashboard_notifications` 로 판정.
- 못 본 것: 어드민 화면에서 실제로 저장되는지(로그인 화면 — 대표 확인).
