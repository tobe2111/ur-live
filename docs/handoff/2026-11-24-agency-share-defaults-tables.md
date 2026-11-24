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

## 같은 종류 전수 점검 (대표 *"지금 이런 문제들 더 있는지도 봐줘"*)
코드가 만드는 표 373개 ↔ 라이브 3개 D1 대조 → 라이브에 없는 표 39개(에이전시 3개 포함). 컬럼은 `scripts/live-columns-baseline.json` 동결 31건 재검토.

| 결과 | 무엇 | 라이브 영향 | 처리 |
|---|---|---|---|
| 고장 | 상품 CSV 일괄 등록(셀러·어드민) — products 에 없는 열 4개로 INSERT | 행마다 실패(사용 기록 없음) | 이 커밋에서 수정: 대카테고리→category, 옵션→product_options. 동결 4건 해제 → 컬럼 가드가 지킨다(주입 확인) |
| 고장·머니 | 동네공구 만료 보증금 자동 환불 cron — `community_group_buy_refunds` 를 만들지 않고 NOT EXISTS 로 읽어 조용히 0건 | 대표 계정(users.id=3) 보증금 5,000딜이 실패 그룹에 묶여 있음 | 대표 승인(*"고쳐줘"*) → 수정: cron 이 표를 먼저 만든다(라우트와 같은 `refund-table.ts`). 가드 `community-refund-table-2026-11-24.test.ts`(주입 빨간불 확인). 배포 뒤 다음 정각에 5,000딜 복원 — 전후 잔액 확인할 것. ⚠️ 그 보증금(2026-05-17)은 원장 기록 도입(06-12) 전이라 차감 기록이 없다 |
| 고장·작음 | 제휴 메일 토큰 수신거부가 메인 `email_suppressions` 에 못 씀(표 없음) | 유어애즈 억제 목록·opted_out 은 정상 기록 → 발송 영향 없음 | 보고만 |
| 죽은 코드 | `slow_queries` 기록기 호출 0 | 자가진단의 느린 쿼리 줄이 늘 빈다 | 보고만 |
| 잠복 | `user_reports` 두 곳이 다른 스키마로 생성 | 두 API 모두 화면에서 안 부름 | 보고만 |
| 잠복·머니·잠금파일 | `webhook.routes.ts` 결제취소 시 추천 커미션 회수 SELECT 가 없는 열(user_id·amount) | referral_commissions 0행 → 오늘 영향 없음 | 보고만(Toss 잠금 파일) |
| 정상 | 나머지 표 33개 — 해당 기능이 꺼져 있거나 아직 한 번도 안 쓰임(쓰는 순간 생성) | 없음 | — |

틀렸던 판단: 하위 점검이 `store_weekly_picks` 를 "체크섬이 메인에 남아 영영 안 만들어진다" 고 했지만 실측상 그 키가 메인에 없다 — 화면이 한 번도 안 열린 것(정상)으로 판정.
