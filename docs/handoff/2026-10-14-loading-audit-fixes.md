# 2026-10-14 로딩 개선점 전수 보고 → 순서대로 수리 (대표 "모두 순서대로 진행")

## 근거 (실측)
- 실사용자 vitals: `GET /api/analytics/summary?day=YYYY-MM-DD`(어드민 토큰, KV 25% 표본).
  10-12~13: 홈 LCP p75 2.1~3.7s · **지도 LCP p75 7.7~10.4s** · 이용권 상세 3.0~4.3s · **교환권 CLS p75 0.14** · TTFB p50 0.3~0.5s.
- 재생(느린 4G·CPU 4배): 첫 화면 전 바이트 JS 250~290KB(br) 압도 · 폰트 1~9KB(문제 아님).

## 순서 (대표 승인)
1. ✅ 교환권 CLS — 브랜드 줄 예약을 카테고리 있을 때만(`!!category`). 재생 CLS 0.142 → 0.002. PR 은 이 브랜치.
2. ✅ 교환권 서버 첫 화면 — `utils/vouchers-first-screen.ts`. 재생 LCP 2.50 → 1.17s(사진 low 우선순위 · 로그인/넓은 화면이면 걷어냄). 지도 첫 화면은 3번과 묶어 판단.
3. 지도 LCP(타일 700KB) — (가) 첫 화면 일반 화질 / (나) 목록 먼저 중 택1.
4. JS 다이어트(axios → fetch 18KB 부터).
- 대기: TTFB 지점(colo) 수집 1주 뒤 판정 · 홈 CLS p95 0.21~0.24(재생 미재현 — 10-13 위치 섹션 수리 후 재판정).

## 다음 세션 첫 액션
`curl /api/analytics/summary?day=<배포 다음날>` 로 `CLS:/vouchers` p75 < 0.1 확인(E4).

## 측정 도구 (scratchpad, 세션 한정)
`replaycls.mjs`(CLS 출처) · `replaysnap.mjs`(시점별 블록 높이) · `replayfs.mjs`(/static/fonts 도 DIST 서빙).
