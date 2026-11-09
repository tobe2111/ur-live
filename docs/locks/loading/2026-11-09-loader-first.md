# [UNLOCK_LOADING] 2026-11-09 — "로더 먼저": 첫 화면 없는 소비자 화면도 앱 CSS 를 렌더 차단에서 뺀다 · PC 홈 첫 화면 CSS

대표 *"계속 최적화"*. 라이브 실측(폰 4G): `/search`·`/cart`·`/videos` 는 HTML 이 **0.3~0.5s** 에 다 왔는데 첫 그림이 **1.1~1.5s** — 인라인 `<style>` 을 든 로더조차 37KB 앱 CSS 를 기다렸다(렌더 차단 스타일시트).

## 잠금표 접촉
- `src/worker/index.ts` HTMLRewriter 블록의 CSS-first 호출 한 줄: `applyCssFirstBoot(…, cssFirst, firstScreenApplies(…) ? criticalCssFor(path) : '')`.
- `utils/css-first-boot.ts`(2026-10-12 UNLOCK 의 모듈): `cssFirstApplies` = 첫 화면 표면 **또는** 로더-먼저 표면 · `firstScreenApplies`(옛 cssFirstApplies + PC 홈) · `loaderFirstApplies`(대시보드·임베드·인증·API 제외) · `applyCssFirstBoot` 는 켜지면 **항상** 앱 CSS `media=print`(첫 화면 CSS 유무 무관, 백스톱 10초) · `criticalCssFor` 는 모르는 표면에 `''`(전체판 69KB 폴백 제거 — 알려진 표면의 폴백은 그대로).

## 왜 안전한가
- 로더(`brandLoaderMarkup`)는 자기 `<style>` 을 들고 있어 앱 CSS 없이 그려진다(0.5초 안에 끝나면 안 보이는 `shy`).
- React(엔트리)는 종전대로 **앱 CSS 가 붙은 뒤에만** 켠다(엔트리 지연 + `media=all` 복귀가 같은 run() 안). 바뀐 것은 "CSS 를 기다리는 동안 무엇이 보이느냐"뿐.
- 대시보드(어드민·사장님·에이전시)·임베드·인증 콜백은 제외 — 자체 테마 CSS 에 기대는 첫 그림이 있다.
- PC 홈: 홈판 critical CSS 에 PC 첫 화면 클래스가 이미 있어(#2252) 데스크톱 UA 에도 첫 화면 CSS 를 넣는다 → PC 첫 그림이 앱 CSS 를 안 기다린다.

## 못 보는 것
HTMLRewriter 런타임(워커 전용) · 실제 첫 그림(배포 뒤 라이브 실측: /search·/cart·/videos 와 PC 홈).

## 가드
`loader-first-2026-11-09.test.ts` 8건 · 주입 3건(되돌려 빨간불) · css-first-boot·critical-css 가드 재조준(미적용 = 대시보드·임베드·인증 / 빈 CSS 도 print / PC 홈 첫 화면 CSS).

## 🩸 배포 뒤 판정(E4) — 로더가 **보이지 않았다** → 토큰판 추가 (같은 날 후속 · 커밋 참조)
- 라이브 실측(#2260 배포 뒤, 폰 4G·CPU 4배): `/cart` HTML **0.18s** · 첫 그림 **2.1s**(앱이 그린 것) · `/search` 1.9s · `/videos` 2.0s. 앱 CSS 는 `media=print` 로 바뀌어 있었고 로더 마크업도 `#root` 에 있었는데 **첫 그림이 앱 렌더까지 0** 이었다.
- 원인: 로더의 색이 `var(--brand)`·`var(--rule)` — 그 변수는 앱 CSS `:root` 에 있다. 로더-먼저 표면엔 첫 화면 CSS 를 안 넣기로 했으니(위 `criticalCssFor` → `''`) 변수가 없어 **투명한 로더**였다. "로더가 자기 스타일을 든다" 는 위 '왜 안전한가' 첫 줄이 **색만 빼고** 사실이었다. 로컬 가드는 전부 초록 — 그림을 봐야만 보이는 결함이다.
- 처방: 생성기가 전체판에서 **변수 선언 블록만**(`:root{…}` · `.dark,[data-theme=dark]{…}`) 뽑은 **토큰판 `CRITICAL_CSS_TOKENS`**(2,263B)을 만들고, `applyCssFirstBoot` 가 첫 화면 CSS 가 없는 표면엔 그것을 넣는다. 첫 화면 표면은 종전 그대로(토큰은 이미 표면 CSS 안에 있다).
- 가드: `critical-css` 토큰판 1건(형태·크기·연속 블록) · `css-first-boot` 1건(없으면 토큰·있으면 표면 CSS) · 주입 1건(토큰 제거 → 빨간불). 못 보는 것은 그대로 **실제 그림** — 배포 뒤 `/cart`·`/search` 첫 그림이 HTML 직후인지 다시 잰다.
