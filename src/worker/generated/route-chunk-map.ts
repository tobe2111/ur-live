// 🧩 자리표시자 — **빌드가 이 파일을 고치지 않는다.** (2026-11-01)
//
// 진짜 맵은 `scripts/generate-route-chunk-map.mjs` 가 빌드 때 `route-chunk-map.build.ts`(추적 안 함)로
// 만들고, `scripts/build-worker.js` 가 워커를 번들할 때 `./generated/route-chunk-map` import 를 그 파일로
// 바꿔 끼운다. 이 파일은 **타입검사용**이다(이름·타입만 맞추면 된다 — 값은 번들에 안 들어간다).
//
// 왜: 종전엔 빌드가 이 추적 파일을 매번 덮어썼다. 클라 빌드 없이 워커만 빌드하면 **빈 맵**이 덮어써
// 작업트리가 더러워졌고, 그게 실수로 커밋됐고(main 150커밋 중 5회), 무관한 PR 끼리 여기서 충돌했다.
// ⚠️ 여기에 진짜 값을 다시 적지 말 것 — 번들에는 어차피 안 들어가고, 충돌만 되살아난다.
//    가드: `src/tests/unit/route-chunk-map-placeholder-2026-11-01.test.ts`
export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = {}
export const ENTRY_CSS: string[] = []
export const BOOT_JS: string[] = []
