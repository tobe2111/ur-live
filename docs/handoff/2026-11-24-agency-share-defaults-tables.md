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

## 3차 — 정적 SQL 전수 대조 (대표 *"너가 파악하지 못하는 문제 더 없어?"*)
방법: 라이브 3개 D1 의 sqlite_master 로 **로컬 SQLite 사본**을 만들고, 코드의 정적 SQL 5,624개를 `EXPLAIN`(실행 없음) — 오류를 삼키는 곳도 잡힌다.
스크립트는 세션 스크래치(레포 밖)에 두었다 — 가드로 올리는 건 다음 작업 후보.

| 결과 | 무엇 | 처리 |
|---|---|---|
| 고장 | 셀러 상품 옵션 목록 조회 — 없는 `product_options.stock_quantity` 를 읽어 매번 500 | 수정 |
| 고장(관측) | `abuse_detections` 표가 라이브에 없음(migrations/0242 미적용) — 부정 탐지 기록 7곳 조용히 실패, 어드민 화면·이상탐지 cron 0건. 차단 판정은 정상 | 매일 schema-repair 에 추가 |
| 고장·결정 필요 | 상품 상세 [선물] 버튼 — `gifts` 표 없음 + 결제/알림톡 미연결(미완성 기능) | 대표에게 숨김 여부 질문 |
| 고장·결정 필요 | 공구 마일스톤 알림 — `interest_list`(없음) UNION 때문에 단골(seller_follows) 알림까지 전부 실패 | 고치면 알림이 실제로 나간다 → 발송 = 결재 |
| 작음 | 비밀번호 변경 시 refresh_tokens 의 없는 `user_type` 으로 무효화 실패(삼킴) · 셀러 분석 전환율(product_views 없음) 0 · 가입 IP 이상탐지(registration_ip 없음) | 보고만 |
| 죽은/레거시 | processRefund(호출 0) · GoogleAuthService(옛 경로, 새 구글 로그인은 user_identities) · deal_balance 동기화(try) · donations·auction·funding·consignment·live_* | 영향 없음 |
| 오탐 | fcfs_applications·fcfs_draw_logs — 라이브에 있음(사본 생성 순서 문제) | — |

## 4차 — 대표 결정 3건 반영 (2026-11-24 저녁)
- [선물] 버튼 숨김: `GIFT_SEND_HIDDEN = true` (feature-flags · ProductDetailPage). FEATURE_STATUS·운영백서 재생성, `GUIDE_SEED_VERSION` 69 → 70.
- 마일스톤 알림: 없는 찜 표 UNION 제거 → 단골만. ⚠️ 목표 인원 있는 판매 상품이 0개라 당장 발송 0건(E4 판정은 그런 공구가 생긴 뒤에야 가능).
- 숙박권: 결재 `docs/decisions/2026-11-24-stay-voucher-buy-first.md` **approved — "추천대로 진행"**(Q1-1~Q5-1). 구현은 다음 PR부터. Q4(만료 자동 환불)는 머니 경로 → staging 실결제 뒤에 켠다.
- 실측 추가: 유어딜 안에서는 같은 방 이중 판매를 막는다 — 결제 승인 뒤 `available_count > 0` 가드 차감, 실패 시 자동 환불(`stays-public.routes.ts` confirm 5단계). 남는 위험은 다른 예약 앱과의 이중 판매뿐.
- 가드 `gift-hidden-milestone-follows-2026-11-24.test.ts` (옛 코드로 되돌리면 2건 빨간불 확인). 관련 시험 76파일 1,107건 · tsc 에러 0.
