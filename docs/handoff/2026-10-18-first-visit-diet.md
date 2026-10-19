# 2026-10-18 — 첫 방문 다이어트 (교환권 배너 · 사진 화질 · 첫 화면 코드)

대표: *"남은거 얼마나 더 있어? 아직은 처음 유어딜 링크 들어갈 때 대기업 수준으로 빠른 것 같진 않아"* →
제가 남은 셋(① 교환권 배너 LCP — 잠금 파일 ② 사진 화질 85→75 ③ 첫 방문 JS)을 보고 → ***"다 이상적으로 해줘."***
⇒ 셋 다 승인(잠금 파일 접촉·화질 변경 포함).

## 다음 세션의 첫 액션 (E4 — 배포 후)
1. `curl -sS -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' https://urdeal.kr/vouchers | grep -c '__SSR_INITIAL_BANNERS__'`
   → **1** 이면 배너 시드가 실린다. 같은 HTML 의 `#ur-first-screen` 판 안에 `<img … fetchpriority="high">` 가 있는지.
2. 홈 HTML 의 카드 사진 주소에 `quality=75` 가 있는지(`grep -o 'quality=[0-9]*' | sort | uniq -c`) · 상세(`/pass/2919`) 히어로는 `quality=85`.
3. 폰 UA 로 `/vouchers` 를 브라우저로 열어(하네스 `visual-preview --trace-api` 방식) **`locale-ko-rest`·`app-desktop-chrome`·`app-routes-seller`·`app-notification-panel` 이 0** 인지.
4. 다음 날 09:25 KST SLO(`perf_slo`) — `/vouchers` LCP p75 가 내려갔는지(창이 7일이라 며칠 걸린다).

## 완료분 (한 PR)
### ① 교환권 머리 배너를 서버 첫 화면에 (잠금 `worker/index.ts`)
- 원인(라이브 실측, 느린 4G·CPU 4배): LCP 가 배너 사진인데 요청이 **3.8초**에 출발(화면 코드 → `/api/banners` 응답 뒤에야 `<img>`). LCP 4.3s.
- 워커 `/vouchers`(쿼리 없음) 가 `/api/banners`(cron 예열 키 — 새 캐시 키 0)를 보조 시드 `BANNERS` 로 받아 `__SSR_INITIAL_BANNERS__` 주입,
  서버 첫 화면이 판 안에 첫 장을 그린다(클래스·주소는 부품과 같은 상수·같은 함수 `stripBannerImageUrl`), 앱은 시드로 첫 렌더.
- 보조 시드 script id 는 슬롯 이름을 따른다(`__SSR_INITIAL_${slot ?? 'SECTIONS'}__` — 홈은 종전 그대로).
### ② 사진 기본 화질 85 → 75 (`cf-image.ts`)
- 홈 카드 8장 avif 59.8 → 46.0KB(−23%). 상세 히어로는 `DETAIL_HERO_QUALITY = 85` 명시. 데이터 절약 모드는 명시값도 65 로.
### ③ 첫 방문 화면 코드
- **셀러 라우트 표 lazy**(raw 28KB) — `/s/:id`·`/profile/:id` 는 `routes/seller-public.routes.tsx` 로 분리(정적), 표는 `App.tsx` 에서 `lazy`.
- **PC 상단 네비 lazy**(`app-desktop-chrome`, raw 33KB) — 넓은 화면이면 `main.tsx` 가 첫 렌더 전에 `warmDesktopChrome()` 로 받는다(PC 밀림 0 — 하네스 shift 실측).
  묶음기 `ENTRY_DYNAMIC` 로 네비·셀러 표를 엔트리 폐쇄로 세서 공용 모듈 배치를 지킨다(안 그러면 청크 순환 셋이 생겼다).
- **lucide 봉투 재배치** — 셸이 쓰는 lucide 는 이제 **2개**(refresh-cw · x). 네비가 쓰던 홈 아이콘은 `lucide-home`, 네비·사이드바 전용은 새 `lucide-desktop`.
  🩸 사이드바(`DesktopLiveSidebar`, 같은 청크)의 `Compass`·`Plus` 가 목록에 없어 **PC 가 214개 `lucide` 봉투를 받고 있었다**(10-13 이후 · 실행 JS 410 → 372KB).
- **알림 시트·패널을 누를 때만** — `NotificationSheet` 는 `lazy()` 인데 묶음기가 `lz-common`(대부분의 첫 화면)에 넣어 lazy 경계가 무의미했다.
  `LAZY_ENVELOPES`(surface-chunks.mjs)로 이름을 지킨다. A/B(gz): 홈 221.6 → 218.8 · 블로그 글 205.9 → 203.0 · 교환권 214.3 → 212.5.
- **한국어 번역 core 축소** — 소스가 가리키지 않는 키 746개를 `locale-ko-rest` 로(core br 28.2 → 20.1KB). FAQ 답(`faq.aN`)은 질문 짝 규칙으로 core 유지.
  안전망(missingKeyHandler)은 **기본값이 없을 때(키 이름이 보일 자리) 또는 다른 언어일 때만** rest 를 받는다.

### 숫자 (로컬 빌드)
- 화면 첫 방문 무게(br, check-surface-budgets): 전 화면 약 −6KB, 장바구니·검색 −13KB.
- 실행된 JS(check-exec-cost): 전 화면 −25~31KB, PC 홈 −38KB 추가.

## 이번에 틀렸던 판단
- **rest 안전망을 "core 에 없는 키면 무조건" 으로 짰더니 5화면이 rest 를 받았다** — 원인 대부분이 *ko 에 아예 없는 키*(defaultValue 전용)라 받아도 소용없었다. 계측(`data-i18n-miss`)으로 키를 뽑아 보고서야 알았다. ⇒ 안전망 조건은 *"받으면 화면이 나아지는가"* 로.
- **App.tsx 주석에 `/seller/*` 를 썼더니 주석 제거기가 `/*` 를 블록 주석 시작으로 읽어** 다른 시험(`VideosPage` lazy)이 거짓 빨간불을 냈다. 줄 주석에도 `/*` 를 쓰지 말 것.
- **예산 증가(homePc +4.3 · blogPost +3.8)를 결함으로 읽을 뻔했다** — 그 예산은 화면별 목록 상한(js 10개) 안의 청크만 센다. 실제 다운로드를 A/B 로 재니 같거나 줄었다. ⇒ 예산이 늘면 **실측 다운로드부터** 볼 것.
- **생성물 route-chunk-map 을 가드 실행 전에 되돌려** 판정을 못 믿게 했다 — 되돌리기는 가드를 다 돌린 뒤에.

## 남은 것 / 대기
- 로컬에 `@cloudflare/playwright` 미설치라 social-card·ads-lane-cadence 시험 2파일이 로컬에서만 빨갛다(CI 무관, 선재).
- PC 홈이 `codes`(qrcode) 청크를 받는다(앱 받기 밴드 QR — 선재, 별건).
