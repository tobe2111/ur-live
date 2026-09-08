# [E2] 실행기 5회차 — 결재 store-acquisition-pipeline 선택지 1 (2026-09-08 13:18~14:1x KST)

## 무엇
`docs/decisions/2026-09-07-store-acquisition-pipeline.md` 대표 답 *"모두 기본안대로 해줘"* ⇒ 선택지 1(준비까지 자동 · 발송은 대표 · N=20). PR #1406 (draft, 머지 대기).

## 코드를 먼저 열어 본 결과 (이 회차에서 제일 값진 것)
결재의 "파이프라인" 넷 중 셋은 **이미 있었다**: 후보 풀 `store_prospects`(79k, 인허가+카카오 수집) · 상태 추적(status/contact_channel/follow_up_at/memo) · 매장별 문구(`opening-briefing` 축하+상권 수치). 없던 것만 만들었다 —
① **주 단위 고정 묶음** `store_weekly_picks`(KST 월요일 키 · 같은 주엔 같은 20곳 · 최근 8주 미포함 · 우선업종→개업→이메일→최신 인허가) ② **입점 제안 문구** `store-proposal.ts`(이용권 예시·직접/중개 요율은 `loadFeeRates` 인자·등록 링크 `urdeal.kr/business?ref=store-{id}`·개업 없으면 문장 생략) ③ **묶음별 추적표** `trackerOf` + 8주 이력.
⚠️ 처음 계획대로 "후보 추출 cron + 새 테이블 + 새 페이지"를 만들었으면 같은 기능이 두 벌이 됐을 것이다.

## 검증
tsc 0 · `store-weekly-picks.test.ts` 9 pass · worker build 0 · 관련 가드 GREEN(PR 본문). 🩸 테스트가 내 단언 오류를 잡음(`/weekly` vs `/:id` 순서 — `/:id` 는 PATCH 뿐이라 충돌 없음 → 단언 교정).

## 다음 세션의 첫 액션
1. PR #1406 CI(~50분) → 초록이면 머지(체크인 14:2x KST 예약됨). 405 이면 `git merge origin/main` 단독 → UU 확인 → 생성 파일 2개 고정 → 푸시.
2. 머지 뒤 결재 파일 `반영 커밋` 줄을 해시로(실행기 WIP 마감 규칙) · Notion 개발 로그 1행 · 결재함 행 갱신.
3. 다음 실행기 회차(17:18 KST)는 **셀러 자동 승인**(`2026-09-07-seller-auto-approval.md` 선택지 1)을 집는다 — 국세청 진위 확인 API 연동은 코드에 없고(grep 0) `apis.data.go.kr` 은 이 환경 프록시 차단이라 **라이브 워커에서만 스펙 검증 가능**. 게이트 `seller_auto_approval_enabled` 기본 OFF · API 키 미설정이면 사람 큐 폴백을 설계에 넣을 것.

## E4 판정 방법
배포 후 `/admin/store-prospects` 상단 "🗓️ 이번 주 영입 20곳" 패널에 행이 뜨고, 한 행의 "제안 문구"에 요율(직접 10%/중개 5% — 어드민 값)과 등록 링크가 보이면 E4. 20곳이 0이면 조건(영업중·미접촉·연락처 보유)에 맞는 매장이 없는 것 — 카카오 매장 수집 버튼으로 풀을 채운다.

## 남은 결정
없음(이 항목). 정산 자동 승인 임계값은 대표 보류 중(기한 09-14).
