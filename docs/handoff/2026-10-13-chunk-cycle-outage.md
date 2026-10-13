# 2026-10-13 라이브 전 페이지 오류 화면 — 청크 순환

## 다음 세션 첫 액션
- 배포 후 `node <스크래치>/crash3.mjs` 방식(가짜 `window.Sentry` 로 바운더리 예외 수신)으로 `https://urdeal.kr/` 가 오류 화면이 아닌지 확인.
  더 간단히: 라이브 홈에서 "문제가 발생했습니다" 문구가 없는지.

## 무엇이 있었나
- 증상: urdeal.kr 전 페이지(홈·교환권·지도·유어샵, PC·모바일)가 ErrorBoundary "문제가 발생했습니다".
- 원인: PR #1756 이 `src/shared/kakao-place-url.ts` 를 `RestaurantMiniMap`(app-components)에서도 import →
  규칙 없는 그 파일이 `app-seller-components` 에 묶임 → 두 청크 순환 → TDZ (`Cannot access 'Z' before initialization`).
- 수정: `vite.config.ts` 에 규칙 1줄(app-shared) + `onLog` 순환 게이트(허용목록 밖 순환 = 빌드 실패).

## 이번에 틀렸던 판단 / 배운 것
- 프로덕션 ErrorBoundary 는 예외를 콘솔에 안 남긴다(DEV 만). `window.Sentry.captureException` 을 부르므로
  `addInitScript` 로 가짜 Sentry 를 심으면 예외 원문을 받을 수 있다 — 라이브 크래시 원인 수집의 최단 경로.
- Playwright 는 `proxy: { server: process.env.HTTPS_PROXY }` 를 줘야 urdeal.kr 이 열린다(외부 트래커만 차단).
- `surface-role-leak` 는 이 순환을 못 잡았다 — 순환은 "역할 청크가 첫 페인트에 실린다" 와 다른 클래스다.

## 남은 것
- 없음(게이트가 재발을 막는다). 허용목록 두 순환(app-shared↔app-utils)은 지금 무해하지만 근본적으로는 푸는 게 낫다(별건).
