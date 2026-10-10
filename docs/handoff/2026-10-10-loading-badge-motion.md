# 2026-10-10 — 로딩 "전반적으로 느리다" 실측 + 1순위 수리

서비스: 🎟️ 유어딜(소비자). 머니 경로 접촉 없음.

## 다음 세션의 첫 액션
1. 이 PR 이 배포됐으면 라이브에서 홈(`/`)을 4배 CPU 스로틀로 열고, 로드 후 5초 동안
   `Layout` 횟수와 메인 스레드 작업 시간을 잰다. 종전 **레이아웃 300회/5초 · 작업 10.4초(4x)**.
   기대: 레이아웃 거의 0 · 작업 2초 안팎(`/vouchers` 수준 1.9초).
2. `/api/promo-bar` 응답에 `Cache-Control: public, max-age=60` 이 붙는지 curl.

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
