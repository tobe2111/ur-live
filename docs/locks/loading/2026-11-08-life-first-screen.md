# [UNLOCK_LOADING] 2026-11-08 생활(`/life`) 첫 화면을 서버가 그린다

- 대표 *"모두 최적화"*. 실측(라이브, 느린 4G 흉내): `/life` FCP 1.9s — 고정 문구 화면인데 앱 코드가 다 와야 그렸다.
- 잠금 접촉: `src/worker/index.ts` `#root` 분기 한 줄 추가(폰 UA `/life` 만) · `css-first-boot.ts`(경로 추가) · 생성기 ROOTS/SURFACE_ROOTS 추가.
- 처방: `worker/utils/life-first-screen.ts` — [머리 + 상황별 묶음 넷], 아이콘은 같은 크기 빈 칸. 모양 SSOT `shared/life-page.ts` 를
  화면(`LifePage`·`LifeHero`·`life-tiles`)도 import 한다(두 벌 금지). 서버 첫 화면으로 부팅했으면 타일 등장 움직임을 끈다(깜빡임 방지).
- 박스 실측(390×844, 라이브 HTML 에 서버 첫 화면을 넣고 JS 끔 vs 라이브 React): h1 `[20,52,350,55]` · 주 버튼 `[20,183,350,48]` ·
  묶음 제목 넷 y=271/491/671/851 · 타일·큰 줄 좌표 전부 동일.
- 가드: `life-first-screen-2026-11-08.test.ts` + 기존 4건 재조준(값이 SSOT 로 옮겨감).
- 롤백: revert(분기 한 줄 제거 시 종전 로더).
- 판정(E4): 배포 후 `/life` FCP(전 1.9s) · 마운트 때 안 움직이는지.
