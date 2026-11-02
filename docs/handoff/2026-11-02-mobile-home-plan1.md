# 모바일 홈 안 1 — 첫 섹션 제목 없음 · 배너 아래로 · 유어쇼츠 둘째 섹션 뒤 · 전국=서울 그림 (2026-11-02)

## 완료분
- 시안: `docs/design/mobile-home-order-2026-11-02.md` 3차 + `assets/mobile-home-plan1-2026-11-02.png`
- 구현: HomeSections(`bareFirst`·`shortsAfter`) · MobileHomePage · worker `home-first-screen.ts` · `home-region-hero.ts`(전국→서울)
- 가드 재조준 7파일 + 주입 4건(`mobile-home-plan1-2026-11-02.mjs`) + 내장 주입 1건 재조준(`check-guard-mutations.mjs` '🎫 모바일 상단 띠 배너 배선')

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- 라이브 폰 홈(390px, 지역 '서울'·'전국') 캡처 → 순서가 사진 → 카드 → 배너 → 인기 → 유어쇼츠 인지, 마운트 때 튐이 없는지.
- LCP: 배너 preload(`lcp-image-link.ts homeLcpImage`)가 카드 사진과 경쟁하는지 재 보고 필요하면 뺀다.

## 이번에 틀렸던 판단
- `check-guard-mutations.mjs` 안에 **내장** 주입("배너가 첫 섹션 아래로")이 있어서, 의도한 변경이 `check-no-injection` 에 '주입 잔재' 로 잡혔다. 매니페스트 폴더만 보지 말고 내장 목록도 grep 할 것.

## 대기
- 대전(옛 사진)·충북(없음) 일러스트, 전국 전용 그림 — 대표가 보내 주면 반영.
- main 의 surface-budgets 빨간불(gbDetail·stayDetail +0.1KB 초과)은 이 작업 이전(15:30 KST~)부터다 — 다른 세션 몫.
