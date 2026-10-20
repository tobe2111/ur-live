# 2026-10-20 — 대시보드가 PC 상단 네비 코드를 기다리던 것

## 무엇을 봤나 (라이브 실측)
- 어드민 로그인 상태로 `urdeal.kr/admin`(1440px)을 열어 받은 JS 를 시각순으로 찍었다.
- 어드민 라우트 청크(`app-routes-admin`, 1042ms)와 `AdminPage`(1139ms)보다 **먼저**(914ms)
  `app-desktop-chrome` · `lucide-desktop` · `lz-common` · `lucide-home` · `lz-home-homePc` + `-vouchers` · `-map` · `-urshorts` 를 받았다.
- 원인: `main.tsx` 가 첫 렌더 전에 `await warmDesktopChrome()`(2026-10-18) — "넓은 화면인가" 만 보고,
  그 네비가 그려지지 않는 주소(대시보드·결제·랜딩)를 몰랐다.

## 한 일
- `src/lib/consumer-chrome.ts` 신설: 전체화면 주소 목록(`fullScreenPrefixes`, App.tsx 에서 이동) +
  `isFullScreenPath` + `consumerChromeHiddenByPath`(전체화면 · `/products/` · `/ads`).
- App.tsx `hideBottomNav` 와 `warmDesktopChrome` 이 같은 함수를 쓴다. 몰(`isMallSurfacePath`)과 `?embed=1` 은 App.tsx 가 더한다.
- 시험 `desktop-chrome-skip-dashboards-2026-10-20.test.ts` + 주입 4건(전부 빨간불 확인). 기존 시험 셋 재조준.

## 이번에 틀린 판단
- 몰 판정까지 공용 함수에 넣었더니 `app-shell ↔ app-utils` 청크 순환으로 빌드가 멈췄다. app-shared 로 옮기면
  순환은 풀리지만 이용권·쇼핑 상세 예산이 +1.6KB 넘었다. ⇒ 공용 함수는 **의존 없는 판정만** 둔다.
- 시험에서 `window.history.replaceState` 로 주소를 바꾸려 했는데 `tests/setup.ts` 가 `window.location` 을
  가짜 객체로 바꿔 둬서 안 움직였다 → `vi.stubGlobal('location', …)`. 또 `vi.mock` 팩토리는 워커당 한 번만
  돌아 반복 측정이 0 으로 나왔다 → 매번 `vi.doMock`.
- 이 환경 브라우저는 중계 구간이 `ERR_TOO_MANY_RETRIES` 를 내 청크 자가복구가 `chrome-error` 로 튄다 →
  요청을 `page.route` 로 받아 Node `fetch` 로 대신 보내면 재현된다.

## 다음 세션의 첫 액션 (E4)
- 배포 뒤 같은 방법(어드민 로그인 → `page.route` 경유)으로 `/admin` 을 열어 `app-desktop-chrome` ·
  `lz-home-homePc*` 가 **0건**이고 `AdminPage` 가 앞당겨졌는지.
- 반대 방향: `/` 를 1440px 로 열어 `app-desktop-chrome` 이 **첫 렌더 전**에 받아지는지.

## 남은 것 (안 한 것)
- 어드민에서 `lz-boot-gbDetail` · `lz-*productL` · `embla` 도 받는다(어드민 정적 의존 쪽 — 별건).
- 이전 세션 인계의 GEO 후보 ②(`priceValidUntil`)는 **할 수 없다** — 판매 마감 날짜는 2026-09-04 이후 구매를 막지 않아 그 값을 쓰면 지어내기다. `seller` 는 이미 낸다.
