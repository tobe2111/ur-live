// 🎨 자리표시자 — **빌드가 이 파일을 고치지 않는다.** (2026-11-03)
//
// 진짜 첫 화면 CSS 는 `scripts/generate-critical-css.mjs` 가 빌드 때 `critical-css.build.ts`(추적 안 함)로
// 만들고, `scripts/build-worker.js` 가 워커를 번들할 때 `../generated/critical-css` import 를 그 파일로 바꿔 끼운다
// (`scripts/critical-css-plugin.cjs` — 번들 대조까지 한다). 이 파일은 **타입검사용**이다.
//
// 왜: 종전엔 59KB 가 한 줄인 생성물을 커밋했다. 첫 화면 클래스 하나만 바뀌어도 그 줄이 통째로 바뀌어,
// 동시에 고친 PR 끼리 **무조건** 충돌했다(최근 3일 main 머지 109건 중 16건이 이 파일을 고쳤다).
// 배포는 어차피 매번 다시 만들었으므로 커밋본은 배포에 아무 일도 안 했다.
// ⚠️ 여기에 진짜 값을 다시 적지 말 것 — 번들에는 안 들어가고 충돌만 되살아난다.
//    가드: `src/tests/unit/critical-css-placeholder-2026-11-03.test.ts`
export const CRITICAL_CSS: string = ''
