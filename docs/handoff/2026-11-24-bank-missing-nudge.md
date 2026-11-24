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
