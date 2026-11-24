# 2026-11-24 에이전시 [수수료 저장] 실패 — 표가 라이브에 없었다

서비스: 유어딜 (에이전시 콘솔 `/agency` ↔ 사장님 초대 링크 `/store/agency/:token`).

## 증상
대표 신고(폰 화면): 에이전시 콘솔 [매장 영입 링크] 에서 수수료 5% · 총 마케팅 비용 상한 10% 를 넣고 [저장] → "수수료를 저장하지 못했어요".

## 원인 (실측)
- 라이브 메인 D1 에 `agency_share_defaults` · `agency_budget_defaults` · `agency_budget_terms` 가 **없다**(`no such table`).
- `ensureAgencyConsoleTables`(agency-schema.ts) 는 빠른 경로(열이 이미 있으면 첫 묶음 뒤 바로 return)와 느린 경로가 있다.
  2026-11-11 의 세 표(#2327·#2332)는 **느린 경로에만** 추가됐고, 라이브는 늘 빠른 경로라 한 번도 만들어지지 않았다.
- 같은 표를 JOIN 하는 곳도 함께 깨져 있었다: 사장님 초대 링크(`store-agency-invite.routes.ts` `liveInvite`),
  셀러의 에이전시 화면(`currentBudgetPctSql`), 에이전시 인플루언서 소개비(`agency-influencer-deals.ts`).

## 고친 것
- 세 표 + 인덱스를 첫 묶음(빠른 경로 앞)에 넣었다. `CREATE ... IF NOT EXISTS` 라 반복 실행해도 안전.
- 가드 `src/tests/unit/agency-schema-fast-path-2026-11-24.test.ts` — 파일이 만드는 표는 전부 early return 앞에 있어야 한다.
  수정 되돌려 주입 → 2건 빨간불 확인 후 복원. 관련 시험 17파일 261건 통과.

## 이어받는 세션의 첫 액션
배포 뒤 라이브 D1 에 `SELECT name FROM sqlite_master WHERE name IN ('agency_share_defaults','agency_budget_defaults','agency_budget_terms')`
→ 세 줄이면 표가 생긴 것. (표는 에이전시 콘솔 API 첫 요청 때 생긴다.) 그 뒤 대표가 [저장] 을 다시 눌러 성공 토스트를 보면 E5.

## 틀렸던 판단
- 없음(추측 없이 메시지 원문 grep → 라이브 표 조회로 바로 확정).
