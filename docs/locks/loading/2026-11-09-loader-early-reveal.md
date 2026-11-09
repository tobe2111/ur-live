# [LOADING_ADDITIVE] 2026-11-09 — 로더 즉시 표시: HTML 이 shy 창(0.5초)보다 늦게 왔으면 0.5초 숨김을 다시 기다리지 않는다

대표 *"계속 최적화"*. 라이브 스크린샷 실측(폰 4G·CPU 4배, `/cart`): HTML **0.48s** 도착 → 흰 화면 → 뼈대 **+0.7s**(shy 0.5초 + 페이드 0.2초).
shy(2026-11-02 대표 *"섞기"*)는 "0.5초 안에 끝나면 아무것도 안 보인다" 를 위한 것인데, 느린 회선에선 HTML 자체가 0.8~1.2초라 **이미 기다린 손님에게 0.5초를 더** 숨겼다.

## 잠금표 접촉
- `utils/css-first-boot.ts`(2026-10-12 UNLOCK 모듈) `applyCssFirstBoot` 의 head 에 `loaderEarlyRevealScript(nonce)` 한 줄 추가 — 다른 동작 무변경.
- `shared/brand-loader-markup.ts` `LOADER_EARLY_REVEAL_MS = LOADER_REVEAL_S * 1000`(같은 예산) · `loaderPhaseVars(…, early)` 선택 인자(기본값 종전 그대로).
- `components/brand/BrandLoader.tsx` 가 `window.__urLdrEarly` 를 읽어 같은 판정을 잇는다(서버 로더 → 앱 로더 교체 순간 다시 숨지 않게).

## 어떻게
`performance.getEntriesByType('navigation')[0].responseStart > 500` 이면 `:root` 에 `--ur-ldr-in-d:0s`(서버 로더·index.html 사본 둘 다 상속) + 표식. ES5 · try — 실패해도 종전 로더.
빠른 로딩(HTML 0.5초 안)은 **종전 그대로** 0.5초 숨김 — 대표 결정("빠르면 안 보인다")은 그대로다. 바뀐 것은 "느릴 때 더 숨기지 않는다" 뿐.

## 못 보는 것
실제 화면에 뼈대가 몇 ms 에 보이는지(배포 뒤 `scratchpad/ldrshot.cjs` 로 스크린샷 판정 — FCP 는 배경색 뼈대를 못 센다).

## 가드
`loader-early-reveal-2026-11-09.test.ts` 4건 · 주입 3건(되돌려 빨간불).
