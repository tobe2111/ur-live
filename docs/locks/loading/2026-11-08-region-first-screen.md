# [UNLOCK_LOADING] 2026-11-08 지역 착지(`/region/…`) 첫 화면을 서버가 그린다

- 대표 *"계속 최적화"*. sitemap 이 제출하는 검색 착지점 38곳. 실측(라이브, 느린 4G 흉내) FCP 1.65s(앱 코드가 다 와야 그렸다).
- 잠금 접촉: `src/worker/index.ts` — ① 지역 경로에 보조 시드 `REGIONS`(`/api/regions`, 3KB · 엣지 300s) ② `#root` 분기 한 줄(폰 UA · 쿼리 없음)
  · `css-first-boot.ts`(경로 · 표면) · 생성기 ROOTS/SURFACE_ROOTS.
- 처방: `worker/utils/region-first-screen.ts` — [빵부스러기 + 제목 + 딜 수 줄 + 분류 칩]. 모양·계산 SSOT `shared/region-page.ts` 를 화면도 import.
  화면은 같은 시드(`readRegionsSeed`)로 첫 렌더 → 종전의 "아직 딜이 없어요" → "N개" 깜빡임도 사라진다.
- 박스 실측(390×844, `/region/서울/성동구`): 빵부스러기 `[20,16,350,18]` · h1 `[20,46,350,26]` · 딜 수 `[20,80,350,19]` · 칩 7개 y=120 — 서버 HTML·React 동일.
- 가드: `region-first-screen-2026-11-08.test.ts` + 재조준 3(시험 2 · 주입 2, 빨간불 확인).
- 롤백: revert.
- 판정(E4): 배포 후 `/region/서울/성동구` FCP(전 1.65s).
