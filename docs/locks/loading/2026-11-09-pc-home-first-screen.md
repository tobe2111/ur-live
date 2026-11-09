# [LOADING_ADDITIVE] 2026-11-09 — PC 홈 서버 첫 화면(네비 높이 + 색면 + 배너 3장)

대표 "1~4번 모두 진행" 의 ③. 라이브 실측(1440px, 데스크톱 UA): first-paint 1.5초 · **첫 글자 2.25초** — `#root` 가 로더뿐이었다.
폰 홈은 2026-10-08 부터 서버가 첫 화면을 그리는데 PC 는 다른 레이아웃이라 UA 로 갈라 두기만 하고 아무것도 안 그렸다.
그런데 배너 전체 시드(`__SSR_INITIAL_HOMEBANNERS__`, #2243)가 **같은 HTML 에 이미 와 있었다.**

## 잠금표 접촉
- `src/worker/index.ts` HTMLRewriter SSR inject 블록 — **분기 한 줄 추가**(데스크톱 UA · 쿼리 없음 · 배너 시드 있음일 때만). 폰·크롤러 분기 불변. 줄 수 2672(래칫 상한).

## 무엇을 그리나(어긋날 수 없는 것만)
1. `DesktopTopNav` 높이만 — 68 + 경계선 + 44(홈 카테고리 행). 글리프 없음. `warmDesktopChrome` 이 첫 렌더 전에 네비 코드를 받아 두므로 마운트 때 그 자리에 바로 선다.
2. 색면(`--home-field`) + 컨테이너 + 큰 배너 1 · 작은 배너 2 — `PcHeroBanners` 와 **같은 상수**(`shared/pc-home-first-screen.ts` — 화면도 이 상수를 쓰게 고쳤다)로 같은 클래스·같은 사진 주소(1100/560 · q76, `cfImage` 같은 함수). 큰 자리 사진은 `Link: rel=preload`(high).
3. 그 아래 로더(34dvh). 섹션 줄·지역 4칸·목록은 안 그린다(위치·카테고리에 달려 있다).

## 못 보는 것
- 프로모 바(어드민이 켜면 네비 위 띠 — 지금 라이브 OFF). 켜지는 날 그 높이만큼 한 번 민다 → 그때 `/api/promo-bar` 시드를 같이 싣는 것이 처방.
- 가로 768 미만 데스크톱 UA — `hidden md:block` 이라 로더만(HomeRoute 의 md 분기와 같은 경계).
- 픽셀 밀림은 jsdom 이 못 잰다 — 배포 뒤 라이브 캡처로 판정.

## 가드
`pc-home-first-screen-2026-11-09.test.tsx` 6건(React `PcHeroBanners` 를 **진짜 렌더**해 서버 HTML 과 사진 주소·클래스 대조) · 주입 `pc-home-first-screen-2026-11-09.mjs` 4건(배선 제거 · 사진 폭 갈림 · 화면이 상수 이탈 · 네비 예약 제거) — 되돌려 빨간불 확인.
