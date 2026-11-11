# 2026-11-11 — 에이전시 몫 % 자동 확정 (결재 ①)

대표: *"모두가 번거롭지 않게 자동화"* → *"응 그렇게 진행해줘. 사장님이 에이전시에게 직접 주는거 말고 자동 분배"*.
결재: `docs/decisions/2026-11-11-agency-share-auto-split.md` (approved · ①만 구현, ②③ 대기).

## 한 것 (돈 이동 0 — 저장만)
- 새 표 `agency_share_defaults(agency_id PK, pct)` (ensure 안) — 에이전시가 미리 정하는 몫 %.
  처음엔 `agency_accounts` 에 ALTER 로 열을 더했는데 `check-sql-column-exists` 가 막았다(라이브 사진에 있는 표는 사진만 믿는다) → 표를 따로 둠.
- 에이전시 콘솔 `POST /api/agency-console/store-invite/share {pct}`(관리자) · `GET /store-invite` 가 `sharePct` 반환.
  영입 링크 카드에 "우리 몫 %" 칸(직원은 보기만).
- 사장님 `GET /api/store-agency-invite/:token` 이 `sharePct` 반환 → 초대 화면·등록 띠에 "에이전시 몫 N%" 표시.
- `POST /accept` 가 `share_pct`(사장님이 본 값)를 받아 지금 값과 다르면 **409 SHARE_CHANGED**(동의 안 한 % 금지).
  **새로 맡긴 순간**(새 링크 · pending→active)에만 `setAgencyShare` — 이미 운영 중인 매장의 % 는 안 바꾼다.
- 가드 `agency-invite-share-auto-2026-11-11.test.ts` 8건(진짜 라우트 + SQLite) · 주입 5건 전부 빨간불 확인.
  `agency-invite-link-2026-10-31` 의 호출 문자열 한 줄 재조준.

## 틀렸던 판단
- `agencyRequest` 는 body 를 스스로 JSON.stringify 한다 — 처음 `JSON.stringify({pct})` 로 넘겨 이중 문자열이 될 뻔했다.

## 남은 것
- 제휴 위젯 요청(`partner-request` → 에이전시 수락) 경로는 % 를 저장하지 않는다(사장님이 % 를 본 화면이 없다). 필요하면 위젯 화면에 % 표시부터.
- ② 겹치면 큰 쪽 하나 · ③ 계좌 칸·자동 지급·스위치 ON — 12월 지급대행과 함께(결재 파일).
