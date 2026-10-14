# 2026-10-14 홈 상단 배너를 서버 첫 화면에 · 데이터센터 표본 판정 보류

대표 "또 해야할건?" → "응 추천대로 계속 해".

## 다음 세션의 첫 액션
1. 이 PR CI 초록 확인(head sha 대조) → 대표 머지 지시 대기.
2. 배포 후 E4 — 아이폰 13 에뮬, **새 컨텍스트(첫 방문)** 로 `https://urdeal.kr/?cb=…` 의 layout-shift 를 잰다:
   기대 **CLS 0.197 → 0**(위치 없음·동탄·부산 셋 다). 측정 스크립트 모양은 아래 "실측" 절.
   서버 HTML 에 `aria-roledescription="carousel"` 이 **`ur-home-panel` 보다 앞에** 있는지도 `curl -A '<iPhone UA>'` 로.
3. 하루 뒤: `GET /api/analytics/summary?day=<KST 날짜>` 의 `CLS:/` p75 가 내려갔는지(어드민 토큰).

## 무엇이 틀렸나 (라이브 실측 2026-10-14, 아이폰 13 에뮬 · 첫 방문)
- 홈 첫 섹션 패널이 ~2초에 **y 132 → 329**(+197px). CLS **0.197**, 위치 없음/동탄/부산 **셋 다 같다**. 재방문은 0
  (배너가 캐시돼 마운트 즉시 그려져서 — 다만 그때도 서버 HTML(패널 148) → 앱(345)으로 **눈에 보이는 점프**는 있었다. CLS 에 안 잡힐 뿐).
- 원인: 상단 배너(`HomeBannerStrip` strip, 197px = 362×181 + pb 16)가 첫 섹션 **위**인데 서버 첫 화면의 시드
  (`/api/sections`)에 없었다. 2026-10-08 `home-first-screen.ts` 머리말이 "어드민이 자리를 고르면 카드가 배너 높이만큼
  내려간다(별건)" 이라고 적어 둔 그 일이, 대표가 배너 5장(id 2·3·4·5·6)을 strip 에 등록하자 현실이 됐다.
- 표본으로도 보였다: `vitals:2026-10-13:CLS:/` p75 109 · p95 239(×1000).

## 한 것 (잠금 파일 무접촉 — `worker/index.ts` 안 건드림)
- `banners.routes.ts`: 공개 GET 의 SQL 을 `listActiveBanners(DB, slot?)` 로 추출(SQL 한 벌).
- `sections.routes.ts`: 응답에 `strip_banners`(최대 5, 별도 L1 키 `home:strip_banners` ttl 120). 배너 없으면 필드 없음 = 종전 byte-동일.
- `shared/home-strip-banners.ts`(신규): `STRIP_BANNER_MAX` · `stripBannersOf` · **`STRIP_CLS`(치수 클래스 SSOT)**.
  `HomeBannerStrip` 과 워커가 같은 상수를 import — 손으로 두 벌을 적으면 갈리고, 갈린 만큼 튄다.
- `home-first-screen.ts`: `stripBannerHtml` — 첫 장(사진·스크림·제목·설명·링크)을 패널 앞에. 숫자 알약·멈춤 버튼은 안 그린다(absolute, SVG).
  링크는 `resolveBannerLink`(부품과 같은 함수), 사진은 부품과 같은 `cfImage` 호출(같은 URL).
- `useHomeBanners`: 응답 전 `placeholderData` = 시드의 strip 배너(`readHomeSectionsSeedRaw`). 캐시엔 안 들어간다.
- 실측(실제 CSS 로 서버 HTML 렌더, 390px): 배너 `[0,148,390,197]` · 카드 `[14,148,362,181]` · 패널 y **345** —
  라이브 마운트 후 값(148/197/345)과 **일치**.

## 가드
- 신규 `home-strip-banner-ssr-2026-10-14.test.tsx` 10건(진짜 `HomeBannerStrip` 을 응답 없는 상태로 렌더해 서버 HTML 과 클래스·href·사진 URL 대조)
  + 주입 7건 `scripts/mutations/home-strip-banner-ssr-2026-10-14.mjs` 전부 빨간불 확인.
- 재조준(지우지 않음): `home-banner-yanolja`·`home-top-banner-and-near-default` 는 `STRIP_CLS.x` 를 실제 값으로 되돌린 소스를 검사
  · 낡은 주입 앵커 7건을 `shared/home-strip-banners.ts` 로 · `home-near-sections` 의 응답 문장 앵커에 `, ...extra` 허용.
  🎫 49 · 🎠 10 · 📍 36 주입 전부 빨간불.

## 이번에 틀렸던 판단
- **"에이전시 콘솔 4단계 정리"를 할 일로 올렸다** — 10-12 인계 중간 절만 읽고. 같은 날 셀러 대시보드를 통째로 지워
  (`SellerLayout` 60줄 본문 래퍼) 이미 끝나 있었다. ⇒ **인계 문서는 끝까지 읽고, 할 일로 올리기 전에 코드에서 확인할 것.**
- 테스트 헬퍼를 "마지막 `import` 줄 뒤"에 끼웠더니 **여러 줄짜리 import 한가운데**에 들어가 그 파일이 파싱 실패했다.
  vitest 출력의 `Tests 14 passed` 는 **다른 파일만 센 숫자**였다(`Test Files` 줄을 안 봤다) — 주입 러너의 "주입 전에도 빨갛다" 가 잡았다.
  ⇒ 파일 단위 실패는 `Tests` 줄에 안 나온다. **`Test Files` 줄을 같이 볼 것.**

## 데이터센터(colo) 표본 — 판정 보류
- `vitals:<day>:TTFB:colo:*` 실측: 10-13 `CDG 2 · EWR 1`, 10-14 `EWR 2 · ATL 1`. **한국 표본 0건.**
- ⚠️ **EWR 은 우리 측정이다** — 이 작업 환경의 나가는 길이 EWR(라이브 응답 `cf-ray …-EWR`, `colo;desc="EWR"`)이라
  세션의 Playwright 측정이 그대로 표본이 된다. EWR 을 한국 사용자로 읽지 말 것.
- 판정에 필요한 것: 실제 한국 방문 표본(표본율 0.25). 며칠 더 쌓인 뒤 다시 본다.

## 남은 것 / 대표 판단
- 유어샵 관리 시트 E4(주인 로그인 필요) · NCP 알림톡 키 · Cloudflare early hints/0-RTT(대표가 대시보드에서)
- 결재함 28건 — `/refund` 남의 약관 문구가 가장 급함.
- 어드민이 배너를 바꾼 직후 최대 2분은 서버 첫 화면과 `/api/banners` 가 다를 수 있다(엣지 TTL) — 그때만 한 번 바뀐다.

## ✅ E4 판정 (배포 후 라이브 — 머지 `7cc29df`, 배포 실행은 뒤 머지에 밀려 `a49f768` 로 13:28 완료)
- 아이폰 13 에뮬 · 첫 방문 · 위치 없음/동탄/부산 × 3회 = 9회 **전부 CLS 0.002**, 서버 HTML 에 배너 실재(carousel 이 `ur-home-panel` 앞).
- 배포 직후(13:30) 측정에선 9회 중 2회가 **배포 전 옛 홈 HTML**(배너 없음)을 받아 0.223 이 나왔다 — SSR 시드의 옛 사본(엣지·직전 사본 1시간)이
  남아 있던 것. 14:34 재측정에서 사라졌다. ⇒ **배포 직후 1시간은 판정을 보류하고 다시 잴 것.**
- 측정기: scratchpad `cls2.mjs` 모양 — 문서 응답 본문에서 `aria-roledescription="carousel"` 유무를 같이 찍어야 옛 사본과 결함을 가른다.
