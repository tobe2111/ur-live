# [UNLOCK_LOADING] 2026-11-10 — 대외 안내 랜딩 셋 `/about` · `/partners` · `/influencer` 서버 첫 화면(머리줄 + 사진 칸) (대표 "계속 최적화")

라이브 실측(폰 4G · CPU 4배): `/about` 첫 그림 = 큰 사진 **3.2~4.7s**(PC 3.4s). 그런데 그 사진은 2026-11-09 의 응답 헤더 preload 로 **0.8s 에 이미 와 있었다** — 그리는 쪽(랜딩 청크 + React)이 늦었다. 머리줄(잉크 바 · 로고 · 글자 링크 · 파란 버튼)과 사진 칸은 고정 모양이라 서버가 먼저 그린다.

## 잠금표 접촉
- `src/worker/index.ts`: 장바구니 분기 뒤에 `landingHeroFor(url.pathname)` 분기 한 토막(같은 줄 — 2672줄 유지). 크롤러 `<noscript>`(`/about` 30자 사고의 처방)는 종전처럼 뒤에 붙인다.
- `utils/css-first-boot.ts`: `firstScreenApplies` 폰·PC 가지에 `landingPhotoKeyOf(pathname) !== null`(세 경로는 전체화면 — 자기 머리줄 · 전역 네비 없음 · PC 풀폭이라 폰·PC 같은 본문), `criticalSurfaceOf` → `landing`. 생성기 ROOTS·SURFACE_ROOTS(표면 CSS 19,087B).

## 본문과 SSOT
`shared/landing-photo.ts` — 사진 위치·대체문구(`LANDING_PHOTOS`, `PhotoHero` 가 여기서 읽는다 — 종전 premium.tsx 의 사본을 옮겼다) · 머리줄 클래스(`LANDING_FS`) · 문구(`LANDING_HEAD`) · 사진 칸 CSS(`LANDING_HERO_CSS` — premium.css ① 세 규칙의 **정지 상태**, 켄번스 시작값 scale(1.08) 이 같아 앱이 애니메이션을 붙여도 이어진다. 그 CSS 는 랜딩 청크 것이라 첫 화면 CSS 생성기에 안 들어와 `<style>` 로 인라인).
🔴 **제목·문장·버튼은 그리지 않는다** — 마스크 안에서 올라오는 모션(`Line` · `ur-load`)이 대표 승인 시안(2026-11-01 고급화)이라 서버가 먼저 보이면 깜빡인다. 사진 칸 높이(`min-h-[calc(100svh-56px)]`)는 빈 칸으로 예약한다.
세 페이지는 잠금표 밖이지만 모션 부품과 얽혀 있어 **상수로 바꾸지 않고 시험이 소스와 글자 대조**한다(머리줄 8개 · 사진 칸 안쪽 · 로고 `forceDark` · 문구). 로고는 `logoHtml(size, 'dark')`(웜화이트).
`/partners` 머리줄의 파란 버튼은 모양이 달라 서버가 안 그린다(오른쪽 칸은 '서비스 소개' 글자만 — 버튼은 마운트 때 붙는다, 머리줄 높이 고정이라 밀림 0).

## 로컬 판정(표면 CSS 로 렌더)
폰 390px: 머리줄 56 · 사진 칸 y=56 h=788(= 100svh−56) · PC 1440px: 머리줄 64 · 사진 칸 836. 배포 뒤: `lcpel.cjs /about`(종전 LCP 3.2~4.7s) · `/partners` · `/influencer` · PC · CLS.

## 가드
`landing-first-screen-2026-11-10.test.tsx` · 주입 7건 되돌려 전부 빨간불 · 재조준 2(critical-css 표면 수 18→19 · 대표 경로).
