# 2026-10-19 — 남은 전략 셋 (빈 시간대 · 동네 링크 · AI 비서 창구)

대표 *"남은 3가지도 다 해줘"*. 브랜치 `claude/three-strategies`.

## 완료분
1. **빈 시간대 리포트** (커밋 `a0abd49`) — 셀러 매출 분석(판매 있는 셀러)에 카드.
   - 서버 `GET /api/seller/analytics/idle-hours` — 최근 90일 `vouchers.used_at` 을 **KST** 요일×시로 집계.
   - 판정 SSOT `src/shared/idle-hours.ts`: 영업시간 = 사용 기록 첫 시~마지막 시 · 평일/주말 3시간 묶음 · **하루 평균**으로 비교 · 사용 20건 미만이면 판정 안 함 · 사용 0인 요일 종류(쉬는 날)는 후보에서 뺌.
   - 카드 `src/pages/seller-analytics/IdleHoursCard.tsx` + "시간 한정 이용권 만들기" → `/seller/meal-voucher/new`. 6개 언어.
   - 결제·가격 무접촉. 가드 `idle-hours-2026-10-19.test.ts` + 주입 5건(전부 빨간불 확인).
2. **동네 링크** (커밋: 그다음 것) — 이용권 상세 매장 카드(`StoreLocation`) 맨 아래 "서울 서초구 이용권 N개 더 보기".
   - 판정 `src/pages/group-buy/neighborhood-link.ts`: 색인 대상 시군구 → 시/도 → 없음(thin 페이지로 안 보냄).
   - 카드가 화면에 들어온 뒤에만 `/api/regions` 를 묻고 지역 페이지와 같은 키(`['regions','stats']`).
   - 잠금 파일(`GroupBuyDetailPage`) 무접촉. 가드 `neighborhood-link-2026-10-19.test.ts` + 주입 4건(전부 빨간불).
   - ⚠️ 동(洞) 단위 페이지는 안 만들었다: 주소 대부분이 도로명이라 동을 못 읽고, 실제 매장 2곳 안팎이라 thin.
3. **AI 비서 검색 창구** (미커밋 — 아래 "다음 첫 액션") — `GET /api/agent/search`, 게이트 `agent_search_enabled` **기본 OFF**.
   - SSOT `src/shared/agent-search.ts`, 라우트 `src/worker/routes/agent-search.routes.ts`(public-utility 아래 마운트, `worker/index.ts` 무접촉).
   - 검색어나 지역 필수 · 최대 10건 · 데모/도매원본/미승인/교환권 제외 · 응답은 우리 상세 주소. 결제는 사람이 상세에서.
   - 게이트 3곳 등록 + `STAGING_CHECKLIST` S-AGENT. 결재 `docs/decisions/2026-10-19-ai-agent-channel.md`(① 켜기 ② 에이전트 결제 설계 여부).

## 다음 세션의 첫 액션
- `git status` → ③ 파일들(agent-search 3개 · public-utility · 게이트 3곳 · STAGING_CHECKLIST · 결재 · 이 문서)이 미커밋이면:
  `npx vitest run src/tests/unit/agent-search-2026-10-19.test.ts` → `node scripts/check-guard-mutations.mjs --only "🤖"` → 커밋 → `node scripts/pre-push-gate.mjs` → 푸시 → PR(draft→ready→auto-merge squash).

## 이번에 틀린 판단
- 빈 시간대 첫 판이 평일만 여는 가게에 "주말이 가장 한가" 라고 말할 뻔했다(사용 0 인 주말 묶음이 이김) — 시험이 잡았다.
- 표본 하한 시험이 헛돌았다: 사용 19건을 한 시간대에 몰아서 영업시간 3시간 미만 규칙이 대신 막았다 — 주입이 잡았다.
- AI 창구 근거 수치를 위해 운영 자격 조회를 시도했다가 자동 권한 판정에 막혔다(그 뒤 셸 명령 전체가 거부됨). 실측 대신 2026-10-12 기록(실제 매장 2곳 안팎)을 인용했다.

## 남은 결정
- 결재 `2026-10-19-ai-agent-channel` (① 창구 켜기 · ② 에이전트 결제 설계).
