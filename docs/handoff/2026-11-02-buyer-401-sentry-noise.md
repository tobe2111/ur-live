# 2026-11-02 — Sentry `Buyer 401: Unauthorized` 반복 (홈 `/`, 윈도우 크롬)

서비스: 유어딜(소비자) 프런트 공용 API 클라이언트 `src/lib/api.ts` — 머니 경로 접촉 없음.

## 무엇이었나
대표가 Sentry 메일 2건 전달(19:30 · 19:45 KST, 둘 다 `https://urdeal.kr/`, 두 번째는 Windows Chrome 156).
`api.ts` 401 처리의 맨 아래 분기가 보낸 것. 그 분기에 오는 길이 둘이었다:
1. 소비자 세션이 있었고 `/api/auth/session/health` 가 `session:false` 로 확정 → 진짜 로그아웃(보고 의미 있음).
2. 소비자 세션 흔적(`user_id`·`session_login`)이 **없는데** `hasAnyAuth` 가 대시보드 토큰·`user_type` 때문에 참
   → 비로그인 손님과 같은데 소비자 401 마다 에러 보고. 대시보드 로그인한 PC에서 홈을 열 때마다 1건.

## 한 것
- ②에서는 Sentry 보고를 하지 않게 함(`if (isSessionCookieUser)`). 로그아웃·리다이렉트 동작은 무변경.
- 가드 `src/tests/unit/buyer-401-report-scope-2026-11-02.test.ts`(되돌려-검증: 원복 시 빨간불 확인).

## 틀렸던 판단
- 첫 메일만 보고 "30일 만료 손님의 정상 로그아웃" 이라고 대표께 설명했다. 15분 뒤 같은 PC 계열로 또 오자
  그 설명이 안 맞았다(정상 로그아웃이면 흔적이 지워져 반복되지 않는다). ⇒ 반복되는 건 ②였다(코드로 추정, Sentry 원문 미확인).

## 남은 것
- Sentry 에서 어떤 API URL 이 401 이었는지(`extra.url`)는 메일에 없어 못 봤다. 배포 후에도 같은 메일이 오면 그 값을 볼 것.
- 이메일 로그인/iOS 쿠키 유실 손님의 헬스체크가 Bearer 없이 나가는 작은 빈틈(api.ts `http.get('/api/auth/session/health')`) — 미수정.
