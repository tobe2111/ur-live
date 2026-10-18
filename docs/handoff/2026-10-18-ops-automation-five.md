# [E2] 2026-10-18 운영 자동화 5종 — 남은 조각 (카톡 봇 미답변 수집 + 루틴 지시문)

대표 *"모두 다 하자"* (자동화 5종 제안에 대한 답).

## 5종 현황 (실측)
1. 홍보 자동화 — **이미 돌고 있음**: `sns-daily-post.yml`(하루 3회 인스타·스레드 게시) · `sns-reply-comments.yml` · `sns-weekly-review.yml`. 블로그 AI 초안은 메인 Pages env 에 `ANTHROPIC_API_KEY` 가 **없어서**(env-readiness 실측 false) 멈춰 있음 — 대표가 키 등록 + `BLOG_AI_DRAFTS_ENABLED=true` 해야 켜짐.
2. 사장님 가입 심사 — `NTS_API_KEY` **설정돼 있음**(health-dashboard featureConfig 실측 true). 매일 점검 루틴 (C)에 `POST /api/admin/sellers/:id/recheck-nts`(진위 결과만 기록, 승인 안 함) 호출을 추가.
3. 카톡 봇 미답변 수집 — **이번 PR**: `src/worker/utils/cs-unanswered.ts` + 봇 폴백 경로 배선 + 어드민 `GET /api/admin/cs-unanswered`. 주간 보고 루틴이 읽어 FAQ 후보를 낸다. 봇 자체는 `KAKAO_SKILL_SECRET` 미설정으로 아직 404(대표 오픈빌더 설정 필요).
4. 알림 한 곳으로 — 매일 점검·주간 보고 루틴이 이미 GitHub 이슈/노션 한 곳으로 모은다. 추가 작업 없음.
5. 매장·제휴 후보 — 영업 메일 초안 루틴이 이미 매일 후보 5명 발굴 + 초안. 추가 작업 없음.

## 다음 세션 첫 액션
- PR 머지 확인 → 봇이 켜진 뒤 `GET /api/admin/cs-unanswered?days=7` 로 행이 쌓이는지.
- 루틴 3개가 10-16 에 전부 `USAGE_LIMIT_REACHED` 로 실패 — 사용량 한도가 풀렸는지 다음 회차(10-19) 결과 확인.

## 틀렸던 판단
- 처음 "홍보 자동화를 새로 만들어야 한다" 고 제안했는데 SNS 자동 게시는 PR #1866 으로 이미 라이브였다. 제안 전에 `.github/workflows` 를 먼저 봤어야 했다.
- `/api/version` 의 secrets 목록에 NTS_API_KEY 가 없어서 "미설정" 으로 볼 뻔했다 — 그 목록은 일부만 보여 준다. 판정은 `/api/_internal/health-dashboard` 의 featureConfig 로.

## 대표 결정 대기
- 블로그 AI 초안: `ANTHROPIC_API_KEY`(메인 Pages) 등록 여부.
- 카톡 봇: 오픈빌더 스킬 연결 + `KAKAO_SKILL_SECRET` 등록.
