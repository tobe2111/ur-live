# 2026-10-20 SNS 마케팅 봇 — 중복 판정을 실물 조회로 (대표 결정 A안)

## 배경
- 봇 상태(`marketing-bot/data/posts.json`·`comments.json`)를 main 에 직접 push 했는데 main 룰셋(Verify 필수·우회 0)이
  원리상 막는다 → `Commit data` 단계가 매번 실패, 게시물 목록이 늘 `[]`.
- 10-20 17:33 KST 수동 실행이 **실제로 게시했는데 기록을 못 남겼다**. 백업 cron(#1965)이 추가돼 같은 날
  19:30·21:17 회차가 같은 글을 또 올릴 상황이었다. 워크플로 disable 은 이 세션 토큰이 403.

## 한 것
- `src/live.mjs`: 오늘 게시 여부 = Threads `/{user}/threads` · 인스타 `/{ig}/media` 실물 조회,
  답했나 = 그 댓글의 `/replies` 에 내 계정이 있나, 이슈 만들었나 = `needs-owner` 이슈 본문의 댓글 ID.
- 조회 실패는 "안 올렸다"로 보지 않는다(게시 중단 · 그 댓글 건너뜀 · 이슈 조회 실패면 회차 실패).
- 네 워크플로에서 `Commit data` 제거 + `contents: read`.
- Threads 게시/답글 publish 를 `lib.threadsPublish`(컨테이너 폴링 + Media Not Found 재시도) 하나로.
- 시험 `marketing-bot/test/live.test.mjs` 8건(되돌려-검증 2건 빨간불 확인).

## 남은 것
- 주간 리뷰의 최적 시간대·비율 조정 저장 경로 없음(리포트 이슈에만 남음). 후보: 상태 전용 GitHub 이슈.
- 오늘 17:33 게시분이 실제로 나갔는지는 Meta 토큰이 없어 세션이 못 본다 — 대표가 계정에서 확인.
- 열린 PR #1949(다른 세션) 가 같은 파일·Commit data 단계를 만진다 — 충돌 예상.

## 틀렸던 판단
- 처음엔 "저장이 안 되니 댓글 봇만 죽어 있다"로 봤다. 실제로는 백업 cron 이 붙은 뒤 **중복 게시**가 임박해 있었다.
