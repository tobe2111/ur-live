// ⚠️ AUTO-GENERATED — scripts/generate-route-chunk-map.mjs 가 빌드 시 재생성. 수동 편집 금지.
// 라우트 표면별 lazy 페이지 청크(엔트리 폐쇄 제외) — 워커가 modulepreload 로 주입해 엔트리와 병렬 다운로드.
//
// 🧹 2026-08-27: 커밋본은 **빈 맵**이다(설계 원안 — 생성기의 `emit({})`). 예전엔 어느 빌드의 산출물이
//   그대로 커밋돼 있었고, 그 맵은 `RestaurantMapPage`(2026-07-15 "홈=지도" 잔재)까지 참조하는 낡은
//   것이었다. 빌드가 항상 재생성하므로 라이브는 무사했지만, 낡은 산출물이 커밋에 남아 있으면
//   ① 가드가 그걸 읽고 엉뚱한 판정을 내리고(실제로 그랬다) ② 생성기가 어쩌다 안 돌면 워커가
//   **없는 자산**으로 modulepreload 를 쏜다. 빈 맵이면 주입을 조용히 생략할 뿐이라 언제나 안전하다.
export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = {}
