# 2026-10-10 — 로딩 "전반적으로 느리다" 실측 + 1순위 수리

서비스: 🎟️ 유어딜(소비자). 머니 경로 접촉 없음.

## 다음 세션의 첫 액션
1. ~~(E4 통과 — 아래 표)~~ 이 PR 이 배포됐으면 라이브에서 홈(`/`)을 4배 CPU 스로틀로 열고, 로드 후 5초 동안
   `Layout` 횟수와 메인 스레드 작업 시간을 잰다. 종전 **레이아웃 300회/5초 · 작업 10.4초(4x)**.
   기대: 레이아웃 거의 0 · 작업 2초 안팎(`/vouchers` 수준 1.9초).
2. `/api/promo-bar` 응답에 `Cache-Control: public, max-age=60` 이 붙는지 curl.

## ✅ E4 판정 (2026-10-10 14:51 KST, 라이브 · iPhone 13 · 4x 스로틀 · 로드 후 3초 대기 → 5초 측정)
배포: `bc1ab1a6` Deploy to Cloudflare Pages **success**. 라이브 CSS `index-BYgqkqAt.css` 에
`@keyframes fcfs-spark{0%,to{opacity:1}50%{opacity:.6}}` 확인. `/api/promo-bar` → `cache-control: public, max-age=60`.
| 경로 | 배지 수 | 레이아웃/5초 | 메인 스레드 작업 |
|---|---|---|---|
| / (1회차) | 96 | 11 | 1,171ms |
| / (2회차) | 96 | **0** | **500ms** |
| /map | 70 | 20 | 1,135ms |
종전 홈 **300회 · 10.4초**. 측정 스크립트는 CDP `Performance.getMetrics` 의 LayoutCount/TaskDuration 차이.

## 라이브 실측 요약 (iPhone 13 중앙값, 프록시 경유라 TTFB·API 는 부풀려짐)
| 경로 | FCP | LCP | 4x 마운트 |
|---|---|---|---|
| / | 1260 | 1344 | 2488 |
| /vouchers | 1056 | 1056 | 1766 |
| /map | 1084 | **5040** (PC 6660) | 1535 |
| /pass/2888 | 1264 | 1676 | 1615 |
| /u/jiwon1228 | 920 | 920 | 2476 |
| /user/profile | 820 | 1136 | 1432 |

## 원인 순위와 처리
1. ✅ **추첨 배지 `text-shadow` 무한 애니메이션** — 홈 96개·지도 70개, 매 프레임 레이아웃. A/B: 끄면
   1217ms → 60ms. 수리: 글로우 고정 + `opacity` 펄스, 불꽃 `will-change` 제거(`src/index.css`).
   가드 `fcfs-badge-motion-2026-10-10.test.ts` + 주입 3건(`scripts/mutations/fcfs-badge-motion.mjs`).
2. ⏳ 마운트 전 JS ~1.4MB 해제 — `locale-ko` 284KB 동시 로드(`src/i18n.ts:53`), zod `validation`
   52KB(🔒 로딩 잠금 `main.tsx` env-validator), `sentry` 431KB 가 idle 즉시 발화(`main.tsx:165-174`).
   ⇒ 잠금 항목은 대표 승인 필요.
3. ✅(일부) `/api/promo-bar` 가 꺼져 있을 때 캐시 헤더 없이 매번 D1 — 헤더를 early return 앞으로.
   남은 것: 엣지 캐시 미들웨어 미마운트(`worker/index.ts` — 🔒), `/api/analytics/vitals` 500~800ms D1 쓰기.
4. ⏳ `/map` 직렬 [마운트 → 카카오 SDK → 지오코딩+타일], `/map`·`/user/profile` 이 chunkSurface 미등재.
   PC 홈은 서버 첫 화면이 모바일 UA 전용이라 로더 1.44초.
5. ⏳ Google Fonts·Pretendard CDN CSS 렌더 차단 ~300ms(첫 방문, 🔒 `index.html`).

## 이번에 틀렸던 판단
- 지난 세션 "[E3] PR #1668 머지·배포됨" — 그 머지 커밋의 배포는 취소였다. 다음 머지(#1672) 배포가
  성공해 결과적으로 라이브엔 올라갔다(`/api/seller/scan-telemetry` 204 확인). **배포 판정은 그 커밋의
  Deploy 결과로 할 것** — 뒤 커밋이 덮었으면 그 커밋 기준으로 다시 확인.

## 대표 판단 대기
- 마이 이용권 자리: 시안 안 1~4(추천 안 3 바코드 티켓) + 마이 전체 정리 제안 한 장 — 캔버스
  https://claude.ai/artifact/27VApxxLQkDpiVxtZPt66d
- 로딩 2·4·5번 중 잠금 항목 착수 여부.

## 🎟️ 마이 사용처리 QR 티켓 (대표 확정 안 3, 같은 날)
- `SellerSection.tsx`: 사용처리 → 옅은 블루 티켓(홈 둘 + 점선 + `QrScanIcon` 꼬리), `이용권` 줄 → 진한 블루
  `이용권 등록 · 관리`(주문 위). 바로가기 `ToolRow` 4 → 3. 새 아이콘 `QrScanIcon`(urdeal-icons, 32 그리드).
- 가드 `my-scan-ticket-qr-2026-10-10.test.ts` + 주입 `scripts/mutations/my-scan-ticket-qr.mjs` 3건(빨간불 확인).
  재조준: `my-seller-all-in-my`(바로가기 셋) · `my-type-scale`(진한 블루 면 = 등록 줄) · `my-awaiting-shell`
  (껍데기에 등록 줄) · 주입 앵커 2건(`first-screen-fetch` · `my-icon-system`).
- 렌더 확인(라이트·다크) + 밀림 측정 `--slow=1500` 이동 0.
- ⚠️ 하네스는 `dist/client` 를 띄운다 — **소스 수정 후 `npx vite build` 를 먼저** 안 하면 옛 화면을 본다
  (이번에 한 번 옛 화면을 보고 헛판정할 뻔했다).
- E4: 배포 후 대표가 마이에서 티켓을 눌러 스캐너가 뜨는지.
