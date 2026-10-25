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

## 2026-10-24 갱신 — #1969 와 합침 + CI 막던 취약점
- 컨테이너가 재시작돼 로컬의 머지 커밋·stash(구글 이미지 `noimageindex` 작업)가 **사라졌다**(푸시 전이었다). 머지는 다시 했고,
  이미지 작업은 **다시 만들어야 한다**(설계: 허브 화면 `/`·`/map`·`/browse`·`/vouchers`·`/stays`·`/region*`·`/u/x`·`/s/x` 에만
  `<meta name="robots" content="noimageindex">` → 상품 사진의 출처가 상세 페이지로 잡히게). ⇒ **커밋 안 한 작업은 stash 에 두지 말고 WIP 커밋+푸시.**
- 워크플로는 main(#1969 — `marketing-data` 브랜치 저장)을 채택. 판정은 계속 실물 조회, 저장은 로그(posts.json 덧붙이기)·학습값(schedule·mix-state)만.
  "남은 것"의 주간 리뷰 저장 경로 문제는 이걸로 해소.
- 사흘 사이 새 advisory 로 **전 PR 의 CI 가 막혀 있었다**: dompurify(critical)·follow-redirects·undici 는 패치 상향,
  vite GHSA-587h(10-21 대표 승인)·zod GHSA-mrhx(10-24 대표 승인, 임시 — zod 4 이행은 결제 잠금 파일 때문에 별건)는 허용목록.
- 별건(미수리): #1969 orphan 단계가 `git rm -rq --cached ..` 를 marketing-bot 기준으로 돌려 `marketing-data` 첫 커밋에 레포 전체가 들어갔다.
