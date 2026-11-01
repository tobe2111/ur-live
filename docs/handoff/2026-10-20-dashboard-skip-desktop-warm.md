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

## 같은 PR 의 두 번째 수리 — 어드민이 쇼핑 상세 봉투를 받던 것
- 어드민이 정적으로 받는 `app-components` 가 `lz-productL`(사진 캐러셀·선물 모달) → `embla` 를 끌고 왔다(~31KB raw).
  빌드 산출물의 import 문을 보니 app-components 가 그 봉투에서 가져가는 것은 `useFocusTrap` **하나**(장바구니 옵션 모달).
- 처방: manualChunks 규칙 한 줄 `useFocusTrap → app-ui-utils`(app-components 가 이미 받는 leaf 봉투 — 요청 수 불변).
  dash:admin 256.4 → 246.4KB br. 기준 파일은 dash:admin 만 갱신(`--rebaseline` 은 25화면 전부를 로컬 측정값으로 다시 써서 다른 화면 기준을 +0.3~1.4 느슨하게 만든다 — 쓰지 말고 그 항목만 고칠 것).

## 남은 것 (안 한 것)
- 어드민이 아직 작은 봉투 셋을 더 받는다: `lz-boot-productL`(로그인 복귀·auth-api 3.6KB) · `lz-gbDetailL-productL`(이미지 압축 2.2KB) · `lz-boot-gbDetailL-map-productL`(인앱 안내 2.7KB). app-components 의 다른 모듈이 정적으로 쓴다 — 합쳐 ~8.5KB raw, 효과 대비 위험을 보고 판단.
- 서버 미리 렌더(`prerender:main`)가 `window is not defined` 로 실패한다 — **main 에서도 같다**(이번 변경과 무관, 빌드는 graceful skip). 2026-07-07 결정으로 그 산출물은 쓰지 않아 영향은 없지만 별건으로 정리 대상.
- 이전 세션 인계의 GEO 후보 ②(`priceValidUntil`)는 **할 수 없다** — 판매 마감 날짜는 2026-09-04 이후 구매를 막지 않아 그 값을 쓰면 지어내기다. `seller` 는 이미 낸다.

## 2026-10-20 오후 — E4 실패 → 두 번째 자리 수리

### E4(배포 `d2804cc61`, #1952 포함) 결과: **통과 아님**
- 라이브 `/admin` 1440px 어드민 로그인(`scratchpad/admin-chunks.mjs`) — 여전히 `app-desktop-chrome`(555ms) ·
  `lz-home-homePc` 4개 · `lucide-desktop` · `lucide-home` 를 받고, `app-routes-admin`(597ms) · `AdminPage`(707ms)보다 **먼저** 출발.
- 배포 번들에 #1952 수리는 **실재**했다(`warmDesktopChrome` 의 숨김 분기). 즉 그 수리는 맞았고 **같은 봉투를 부르는 자리가 하나 더** 있었다.
- 원인: `MobileAppLayout.tsx` 모듈 최상단 `if (matchMedia(768+).matches) void loadSidebar()` — 경로를 안 본다.
  기다리지는 않지만(첫 렌더 안 막음) 어드민 코드와 회선을 나눈다.
- 🩸 **교훈**: "기다리는 자리" 하나만 고치고 판정을 소스로 했다. 판정은 **받은 청크 목록**으로 할 것 — 같은 봉투를 부르는 import() 자리를 전부 찾을 것(`grep -rn "DesktopLiveSidebar\|DesktopTopNav" src`).

### 수리(이 PR)
- `MobileAppLayout` 의 모듈 실행 미리받기에 `!consumerChromeHiddenByPath(window.location.pathname)` — 부팅 준비·App.tsx 와 같은 함수.
- 시험 ③ 3건(어드민·셀러·에이전시 0 · 홈·교환권 1 · 배선) + 주입 1건 — 되돌려-검증 빨간불 확인.
- critical-chunks 14 · 순환 0 · surface-budgets 25 예산 안 · role-leak 0.
- ⚠️ **E4 다시**: 배포 뒤 같은 하네스로 `/admin` 에서 `app-desktop-chrome`·`lz-home-homePc*` **0건** + `/` 1440px 는 여전히 받는지.

## 2026-10-20 후속 — 성능 경보 둘의 실체 (실측)

### 1. 홈 CLS p75 0.20 경보 = 오염된 옛 표본 (지금 화면 결함 아님)
- 경보 원문(10-20 09:20 KST): `/ CLS p75 0.20 > 기준 0.10 (직전 7일 0.03) · 표본 36`
- 일별 분해(×1000): 10-13 p75 109(9건) · 10-14 199(13건) · 10-15 0(9) · 10-16 0(4) · 10-19 0(1).
  창 36건 중 22건이 10-13/14 — 자동화 브라우저 오염은 10-14 16:01 KST #1790 에서 이미 차단.
- 라이브 재측정(iPhone 390, 수리 후 빌드): 첫 화면 3회 0 · API 1.5초 지연 2회 0 · 25회 스크롤 2회 0.010/0.
  측정기: scratchpad `cls-live.mjs` (렌더 확인 — 사진 70~133장).
- ⇒ 10-22(창 10-15~21) 회차부터 빠진다. 그 전 경보는 무시. 기준선(직전 7일)도 10-14 이전은 오염이라 ~10-29 까지 회귀 판정이 흔들린다.

### 2. 홈 LCP p75 3,160ms — 서버는 빠르고 경로가 길다
- 워커 Server-Timing total 48~148ms(`MAIN:kv-hit`).
- 국가 KR 표본의 데이터센터(colo:) — **ICN 0건**, HKG·NRT·LAX·SEA:
  HKG p50 370~609ms · NRT 400~737 · LAX 900~1,136 · SEA 2,824(1건).
- zone 요금제 = **Free Website**(CF API 실측). 무료 요금제 라우팅 우선순위 가설 — 공식 근거 못 찾음(개인 사례 1건).
  표본 20건 남짓이라 결재 안 올림. 표본이 쌓이면 colo 별 TTFB 로 다시 판정할 것.
- LCP 분해(LCPB)는 10-19 신설이라 홈 표본 1건(TTFB 978 · 렌더 대기 407).

### 3. `prerender:main` 실패는 무해 — 출력이 사용자에게 안 닿는다
- 실패 원인: `ReferenceError: window is not defined`(entry-server 렌더 중).
- 그러나 워커 `#root` catch-all(2026-07-07)이 모든 HTML 경로의 #root 를 서버 첫 화면/로더로 덮어쓴다 ⇒ 구운 셸은 사용처 0.
- 제거 후보(build:ssr + prerender:main): vite.config.ts 535 주석이 그 chars 를 신호로 쓰므로 함께 정리. 빌드 파이프라인 변경이라 별건.

## ✅ E4 통과 (배포 `8bda917f9` — #1964 포함, 진입 `index-CBHEKY5c`)
- 라이브 `/admin` 1440px 어드민 로그인, 2회: `app-desktop-chrome` **0** · `lz-home-homePc*` **0**(종전 각 1 · 4).
  같은 조건 두 번째 회차 비교 — `app-routes-admin` 692 → **461ms** · `AdminPage` 870 → **574ms**(망 편차가 커서 ms 는 참고, 판정은 청크 유무).
- 반대 방향: PC 홈 `/` 1440px 는 `app-desktop-chrome`(731ms) + `lz-home-homePc` 계열을 **그대로** 받는다.
- 남은 것(종전 판단 유지): 어드민이 `lz-boot-productL`·`lz-gbDetailL-productL`·`lz-boot-gbDetailL-map-productL`(~8.5KB raw)과
  `lucide-desktop`·`lucide-home`·`lz-common` 을 받는다 — `app-components` 의 정적 의존이라 끊으려면 묶음 규칙을 건드려야 한다(별건).
