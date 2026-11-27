# Sentry `UnhandledRejection /ads` — 내장 브라우저 거절 문장을 잡음으로 분류 (2026-11-27)

레일: 유어딜 소비자(클라이언트 오류 수집) · 머니 경로 접촉 없음 · 롤백 revert.

## 무엇이 왔나
대표가 붙여 준 Sentry 이슈: `UnhandledRejection: Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4`
(2026-11-27 10:24 · `https://urdeal.kr/ads` · Windows Chrome · 스택 없음 · 사용자 정보 없음).

## 판정
- 레포에 그 문장은 없다(`grep -rn "Object Not Found\|MethodName" src` → 필터와 시험뿐).
- Error 가 아니라 **문자열** 거절이고 스택이 없다. 이 모양(`Id:N, MethodName:…, ParamCount:N`)은 내장 브라우저(CefSharp) 껍데기가 페이지와 주고받는 호출이 어긋날 때 내는 것으로 알려져 있고, 메일 보안 장치·링크 미리보기가 링크를 열 때 흔히 찍힌다.
- 전날(11-26) 저녁 대표가 제휴 제안 메일을 시험 발송했다. 그 메일 안의 링크가 열렸을 가능성이 있다 — **확인하지는 못했다**(Sentry 이벤트에 유입 경로가 없다).
- `/ads` 화면 자체는 200 으로 정상 응답한다.

## 한 것
- `src/lib/sentry-noise.ts` — `EMBEDDED_BROWSER_REJECTION`(세 조각이 다 맞을 때만) 을 잡음으로 분류.
- 시험 `feed-sort-and-sentry-noise.test.ts` 2건 추가(버린다 / 일부만 닮은 것은 올린다) · 주입 2종(`scripts/mutations/sentry-noise-embedded-browser-2026-11-27.mjs`) 빨간불 확인.
- `docs/KNOWN_ERRORS.md` 한 줄.

## 못 한 것 / 등급
- **E2.** 배포 뒤에도 그 장치가 다시 와야 "안 올라온다" 를 볼 수 있어, 라이브 판정은 Sentry 에 같은 이슈가 새로 안 쌓이는지로 본다(이미 올라온 1건은 Sentry 에서 대표가 닫으면 된다).
- 누가 열었는지는 모른다.

## 틀렸던 판단
- 없음. 다만 처음엔 `/ads` 화면의 버그부터 의심했다 — 스택이 없고 값이 Error 가 아니라는 두 가지를 먼저 봤으면 바로 갈렸다.
