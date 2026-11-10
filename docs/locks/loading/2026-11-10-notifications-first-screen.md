# [UNLOCK_LOADING] 2026-11-10 — 알림 `/notifications` 서버 첫 화면(세션 쿠키가 있을 때만) (대표 "계속 최적화")

라이브 실측(폰 4G · CPU 4배): `/notifications` HTML 0.3~0.5s · **첫 그림 1.7~2.3s**(로더-먼저만). 머리줄(뒤로 · 알림 · 모두 읽음 자리)은 고정 모양이고 목록은 API 가 와야 안다.

## 잠금표 접촉
- `src/worker/index.ts`: FAQ 분기 뒤에 `authed && url.pathname === '/notifications'` 분기 한 토막(같은 줄 — 2672줄 유지). UA 는 빌더 인자.
- `utils/css-first-boot.ts`: `firstScreenApplies` 폰·PC 가지에 `(authed && /^\/notifications\/?$/)`, `criticalSurfaceOf` → `notifications`. 생성기 ROOTS·SURFACE_ROOTS(표면 CSS 30,564B).

## 가드 방향이 게스트 탭과 반대다
게스트 탭은 `!authed`(세션 없을 때만), 알림은 **`authed`(세션 쿠키 있을 때만)**. 비로그인은 `ProtectedRoute` 가 로그인으로 보내므로 머리줄을 먼저 보이면 깜빡임이다. 로그인 흔적(localStorage)은 보지 않는다 — 쿠키가 없으면 API 가 401 이라 그릴 목록도 없다.
⚠️ 못 보는 것: 쿠키는 있는데 세션이 만료된 사람(머리줄이 한 번 보이고 로그인으로 — 종전 로더와 같은 길이).

## 본문과 SSOT
`shared/notifications-page.ts`(뿌리 · 당김 동그라미 · 목록 칸 · '모두 읽음' 클래스, 문구 — 한국어 기본값은 번역 파일과 같다) + 공용 머리줄 `utils/sub-page-head-html.ts` **신설**(`subPageHeadHtml(title, wide)` — FAQ 의 것을 옮겨 두 화면이 쓴다). 알림은 `wide`(오른쪽 칸 88px)이고 서버는 그 칸을 **비운다** — '모두 읽음' 은 안 읽은 게 있을 때만 앱이 세우고, 칸 폭이 고정이라 제목은 안 움직인다. 목록 칸은 비우고 로더가 그 아래.

## 로컬 판정(표면 CSS 로 렌더)
폰 390px: 제목(h1, 숨김) 칸 x=92(= 88px 칸 + px-1) · PC 1440px: x=597(액자 505 + 92). 배포 뒤: 로그인 세션으로 `/notifications` 폰 FCP(종전 1.7~2.3s) — 이 컨테이너엔 소비자 세션이 없어 **대표 폰 실측 또는 RUM 표본**으로 판정한다.

## 가드
`notifications-first-screen-2026-11-10.test.tsx` · 주입 5건 되돌려 전부 빨간불 · 재조준 2(critical-css 표면 수 16→17 · 대표 경로).
