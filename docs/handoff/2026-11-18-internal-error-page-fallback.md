# Sentry JAVASCRIPT-REACT-38 — `internal error; reference=…` on GET `/` (2026-11-18)

서비스: 유어딜(소비자) 워커 전역 오류 처리기. 머니 경로 없음.

## 판정
- 문구는 Cloudflare 런타임 내부 일시 오류(에셋·캐시·서브요청). 실측: 직후 홈 5회 모두 200. 우리 DB 오류 기록·Pages 함수 통계에 같은 시각 예외 0(처리기가 잡아서 응답했기 때문).
- 고칠 수 있는 결함은 하나: 화면 요청에도 **JSON 500** 을 돌려줘서 손님이 홈 대신 영어 오류 글자를 봤다.

## 완료
- `src/worker/middleware/error-handler.ts` `pageFallback` — 5xx + 화면 요청(GET·text/html·비API·비파일)이면 SPA 셸(실패 시 한국어 503 + 5초 자동 재시도).
- 시험 `error-handler-page-fallback-2026-11-18.test.ts` 9건(진짜 Hono 앱에 던짐) + 주입 2건 빨간불 확인.
- `docs/KNOWN_ERRORS.md` 에 "Cloudflare 런타임" 줄.

## 이번에 틀렸던 판단 / 못 한 것
- 스택의 줄 번호(bundledWorker:93270)로 원인 코드를 짚으려 했는데 Pages 가 배포 때 다시 묶어 번호가 맞지 않았다. 로컬 재번들(esbuild)로도 안 맞는다 — 시간 쓰지 말 것.
- 그 시각 응답 코드 통계는 토큰에 zone analytics 권한이 없어 못 봤다(권한 추가 요청 안 함 — 규칙).
- Sentry 이벤트 수는 이 환경에 Sentry 토큰이 없어 못 봤다.

## 이어받는 세션의 첫 액션
Sentry 에서 JAVASCRIPT-REACT-38 이 반복되는지 본다. 한 시간에 여러 건이면 Cloudflare 상태 페이지와 대조.
