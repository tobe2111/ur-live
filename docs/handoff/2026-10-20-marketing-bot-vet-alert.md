# 2026-10-20 마케팅 봇 — 빈 글 원인 · 잘린 링크 · 올리기 전 검수 · 실패 카톡 알림 (PR #1957)

## 다음 세션의 첫 액션
1. `SNS daily post` 최신 run 로그에서 `Threads 본문:` 아래에 실제 본문이 있는지, `검수 걸림` 줄이 있는지 본다.
2. 대표 카톡 권한: 대표가 한 번 `https://urdeal.kr/auth/kakao/consent/start?scope=talk_message&return=/user/profile` 를 눌러 동의해야 알림이 간다.
   동의 전에는 봇 로그에 `::warning title=카톡 알림 실패::409 KAKAO_SEND_FAILED` 가 남는다(봇은 계속 돈다).
   카카오 콘솔 동의항목에 '카카오톡 메시지 전송'이 꺼져 있으면 동의 화면에서 KOE 오류 — 그때는 대표가 콘솔에서 켠다.

## 완료분
- 빈 글 원인: Sonnet 5.5 기본 생각이 max_tokens 600~800 을 다 씀 → `thinking: between_tools` + 하한 4000 (`marketing-bot/src/lib.mjs claudeBody`)
- Threads 500자 자르기가 링크를 자르던 것 → `threadsText`
- 올리기 전 검수 `marketing-bot/src/vet.mjs` — 걸리면 한 번 다시 쓰고, 그래도 걸리면 `quality_failed` 기록 + run 빨간불
- 실패 알림: 봇 → `POST /api/ops/alert`(GitHub OIDC 로 신원 증명, 공유 비밀 0) → 대표(users.id=3) 카톡 "나에게 보내기". 하루 20건 상한.

## 이번에 틀렸던 판단
- PR 설명을 셸 큰따옴표 안에 백틱과 함께 넣었다가 백틱이 명령으로 실행돼 레포 `npm test` 가 돌았다. **PR 본문은 파일로 만들어 `--data-binary @file` 로 보낼 것.**
- `git checkout -- <file>` 로 되돌려-검증을 복원하다 커밋 전 수정분을 날렸다(두 번째). **복원은 백업 파일 복사로.**

## 남은 것
- 측정을 가입까지 잇기 · 배우기 고리 닫기 · 글마다 맞춤 이미지 (대표 승인한 순서 4~6)
