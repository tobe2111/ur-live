# [UNLOCK_LOADING] 2026-11-08 — 홈(/) 전용 첫 화면 CSS (62KB → 30KB)

- 파일: `src/worker/index.ts`(재작성기 한 줄에 인자 하나) · `src/worker/utils/css-first-boot.ts` · `scripts/generate-critical-css.mjs` · `src/worker/generated/critical-css.ts`(자리표시자에 이름 하나)
- 대표: *"그냥 구글이나 브라우저에서 urdeal.kr 들어가면 느린거 얘기하는거야. 이 부분 최적화."* · 잠금 허가 2026-11-04
- 실측(라이브 홈 HTML, 폰 UA): 원본 180KB · 압축 40KB. `<head>` 101KB 중 첫 화면 CSS 62KB(열 화면 합본) — 홈 내용(`#root`)이 압축 **24KB** 지점에서야 시작(폰 첫 왕복 ≈14KB).
- 무엇: 생성기가 홈 폐쇄(home-first-screen.ts → 22파일 + index.html + 로더)에 글자로 없는 클래스의 규칙을 뺀 **홈판**을 따로 만들고, 워커는 `/` 에서만 그것을 넣는다. 비면 전체판(종전).
- 검증: 라이브 홈 본문 클래스 182개 중 전체판에 있던 171개 → 홈판에서 빠진 것 1개(`group/media` — 첫 화면 밖 `.ur-appear` 호버 규칙의 짝). 빌드된 워커에 홈판이 실린 것 대조. 시험 4건(`critical-css-2026-10-14`).
- ⚠️ 못 보는 것: 실제 폰의 표시 시각 변화 — 배포 후 홈 HTML `#root` 위치(압축 바이트)·RUM 홈 LCP p75.
