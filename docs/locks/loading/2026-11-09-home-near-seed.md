# [LOADING_ADDITIVE] 2026-11-09 홈 거리순 피드 시드(새 SSR 슬롯 MAINNEAR)

- 대표: 폰 캡처(로그인 · 위치 저장 · '거리순' · 피드 '불러오는 중…') + *"아직 많이 느리네.. 최적화 계속 해"*.
- 원인: 위치를 저장한 손님은 피드가 거리순(`&near=`)이라 MAIN 시드(인기순)를 못 쓰고 앱 부팅 뒤 한국→LA 로 다시 받았다.
- 바꾼 것: `src/worker/index.ts` 가 위치 쿠키(`ur_loc`)가 있으면 같은 격자 키 거리순 피드를 **별도 슬롯**
  `__SSR_INITIAL_MAINNEAR__`(data-near=키)로 함께 싣는다 — 400ms 마감, 넘으면 버린다. MAIN 슬롯·경로·잠금 4페이지 inject 는 그대로.
  `GroupBuyFeed` 는 키가 같을 때만 initialData 로 쓴다. 판정·경계: `src/worker/utils/home-near-seed.ts`.
- 잠금표 예외 조항 "새 SSR slot 추가(기존 inject 패턴 따라)" 에 해당.
- 가드: `home-near-seed-2026-11-09.test.ts` + 주입 2건 · 옛 가드 `home-near-empty-label-2026-10-17` 재조준(위치 없는 MAIN 은 여전히 금지).

## 2차 — 홈 유어쇼츠 줄 시드(HOMESHORTS)
- 대표 캡처 첫 화면 맨 위 유어쇼츠 칸이 빈 회색. 목록 `/api/urshorts`(4KB·10개, HOT_PATHS 예열됨)를 같은 400ms 마감으로 함께 싣고,
  `UrShortsRail` 이 첫 렌더에 그 시드로 그린다(`readHomeShortsSeed` — 한 번 읽고 지운다).

## 3차 — 홈 배너 전체 시드(HOMEBANNERS) — PC 홈
- 대표 *"그 문제가 아니라 다른 것도 있는 것 같은데"* + trace 가 PC(윈도우 크롬·LAX). PC 홈 실측: 첫 그림 2.1초(폰 0.5초) · 가장 큰 그림(맨 위 배너) 2.5초.
  PC 는 서버 첫 화면이 없고 배너는 앱이 켜진 뒤 `/api/banners`(2.9초 출발)를 물었다.
- `/api/banners`(cron 예열 키)를 같은 200ms 마감으로 함께 싣고 `useHomeBanners` 가 첫 렌더에 자리 표시값으로 쓴다.
- 남는 것: PC 는 여전히 앱이 켜져야 첫 그림(≈2초). 서버 PC 첫 화면은 별건(2열 그리드 — detail-ssr-body 머리말 ❌ PC 사유 참조).
