# [LOADING_ADDITIVE] 2026-11-08 — 표면별 첫 화면 CSS (홈 다음 9개 표면)

- 파일: `src/worker/utils/css-first-boot.ts`(`criticalSurfaceOf` · `criticalCssFor`) · `scripts/generate-critical-css.mjs`(`SURFACE_ROOTS` · `runtimeClasses`) · `src/worker/generated/critical-css.ts`(자리표시자에 이름 하나)
- 대표: *"1~5 모두 진행 후 또 최적화 진행"* · 잠금 허가 2026-11-04
- 무엇: 홈(2026-11-08 #2216)과 같은 처방을 첫 화면이 있는 표면 전부에 — 이용권 상세 · 교환권 상세 · 유어샵 · 숙소 상세 · 교환권 목록 · 숙소 목록 · 블로그 글 · 블로그 목록 · 로그인 전 탭.
  각 표면 CSS = 전체판(62KB)에서 그 표면 ROOT 폐쇄 + index.html + 로더 + **실행 중 붙는 클래스(소스에서 자동 수집)** 에 글자로 없는 클래스의 규칙을 뺀 것.
- 크기(B): home 31,005 · detail 22,143 · voucherDetail 20,637 · curator 23,450 · stayDetail 24,206 · vouchers 22,831 · stays 32,982 · blogDetail 30,384 · blogList 30,312 · guest 20,864 (전체판 61,851)
- 검증: 라이브 HTML 10표면의 본문 클래스를 대조 — 빠진 것은 `group/media`(첫 화면 밖 호버 규칙의 짝)뿐. 빌드된 워커에 10판 전부 실린 것 대조. 시험 3건 추가 + 주입(판정 한 줄 삭제 → 빨간불).
