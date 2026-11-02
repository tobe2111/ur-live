# [LOADING_ADDITIVE] 유어쇼츠 뷰어를 미리받기 등록부에 — 2026-11-02

- **바꾼 잠금 파일**: `src/App.tsx` (잠긴 항목: idle prefetch 목록 — **불변**)
- **무엇을**: `const VideosPage = lazy(...)` → `lazyPage(...)` + `registerRoutePreload('videos', VideosPage.load)`.
  다른 화면(map·gbDetail·stayDetail…)과 같은 등록 한 줄. 여전히 lazy 다(홈 묶음에 재생 코드가 안 들어간다).
- **왜**: 대표 *"유어쇼츠도 느리더라"* — 카드를 누르는 사이(`pointerdown`) 뷰어 코드를 받으려고. 홈이 `import()` 를 직접 쓰면
  묶음기가 봉투를 다시 짜 전 화면 첫 화면 무게가 늘었다(CI `surface-budgets` 12화면 +1.5KB — `lib/route-preload` 머리말).
- **가드**: `src/tests/unit/partial-slow-round2-2026-11-02.test.ts` · `urshorts-core.test.ts` ③(재조준) + 주입.
- **롤백**: revert.
